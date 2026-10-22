"""Command Centre operations API. Read = any staff role; every mutating action is
permission-gated (deny-by-default) and written to the audit trail with reason and
before/after values. 403 = role can't act; 404 = unknown record."""

import re
from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from lib.audit import add_audit
from lib.catalog import CAT, NEXT, SEV_RANK, SVC, UNIT_STATUSES
from lib.db import db
from lib.routing import eta_min, route
from lib.security import Principal, require_perm, require_staff, utcnow
from models.ease import (
    Analytics, AssignBody, AuditEntry, DisableChange, FlagBody, HistoryEntry, LinkBody,
    NoteBody, PriorityChange, ReasonBody, Reply, Report, ReviewDecision, RiskSignal,
    RoleChange, StatusChange, Unit, UnitActivePatch, UnitStatusPatch, UserAdminView,
)

router = APIRouter(prefix="/ops", tags=["ops"])


def to_report(doc: dict) -> Report:
    # motor hands back naive UTC datetimes — normalise on read so Pydantic serialises with offset.
    for f in ("created_at", "updated_at"):
        v = doc.get(f)
        if v is not None and v.tzinfo is None:
            doc[f] = v.replace(tzinfo=timezone.utc)
    for h in doc.get("hist", []):
        if h.get("ts") and h["ts"].tzinfo is None:
            h["ts"] = h["ts"].replace(tzinfo=timezone.utc)
    for r in doc.get("replies", []):
        if r.get("ts") and r["ts"].tzinfo is None:
            r["ts"] = r["ts"].replace(tzinfo=timezone.utc)
    return Report(**doc)


def is_active(status: str) -> bool:
    return status not in ("Resolved", "Closed", "Cancelled")


async def load_incident(code: str) -> dict:
    doc = await db.reports.find_one({"code": code})
    if not doc:
        raise HTTPException(status_code=404, detail="No incident with that reference.")
    return doc


async def aud(p: Principal, action: str, target: str, reason: str | None = None,
              prev: str | None = None, nxt: str | None = None) -> None:
    await add_audit(action, target, actor=p.name, role=p.role, reason=reason, prev=prev, nxt=nxt)


# ------------------------------------------------------------------ queue / detail

@router.get("/queue")
async def queue(
    status: str | None = None, severity: str | None = None, category: str | None = None,
    q: str | None = None, sort: str = "pri", p: Principal = Depends(require_staff),
):
    query: dict = {}
    if status:
        query["status"] = status
    if severity:
        query["severity"] = severity
    if category:
        query["category"] = category
    if q:
        query["$or"] = [
            {"code": {"$regex": re.escape(q), "$options": "i"}},
            {"text": {"$regex": re.escape(q), "$options": "i"}},
            {"loc.address": {"$regex": re.escape(q), "$options": "i"}},
        ]
    docs = await db.reports.find(query).sort("created_at", -1).to_list(1000)
    items = [to_report(d) for d in docs]
    if sort == "pri":
        items.sort(key=lambda r: (SEV_RANK.get(r.severity, 0), r.created_at.timestamp()), reverse=True)
    return {"items": [r.model_dump() for r in items], "total": len(items)}


@router.get("/incident/{code}", response_model=Report)
async def incident(code: str, p: Principal = Depends(require_staff)):
    return to_report(await load_incident(code))


# ------------------------------------------------------------------ lifecycle

@router.post("/incident/{code}/ack", response_model=Report)
async def ack(code: str, body: ReasonBody | None = None, p: Principal = Depends(require_perm("ack"))):
    doc = await load_incident(code)
    if doc["status"] != "Reported":
        raise HTTPException(status_code=409, detail=f"Cannot acknowledge from {doc['status']}.")
    await db.reports.update_one({"code": code}, {
        "$set": {"status": "Acknowledged", "updated_at": utcnow()},
        "$push": {"hist": HistoryEntry(stage="Acknowledged", note=(body.reason if body else None) or "Operator acknowledged", actor=p.name).model_dump()},
    })
    await aud(p, "Acknowledged", code, reason=(body.reason if body else None), prev="Reported", nxt="Acknowledged")
    return to_report(await db.reports.find_one({"code": code}))


@router.post("/incident/{code}/status", response_model=Report)
async def change_status(code: str, body: StatusChange, p: Principal = Depends(require_perm("review_st"))):
    doc = await load_incident(code)
    allowed = NEXT.get(doc["status"], [])
    if body.status not in allowed:
        raise HTTPException(status_code=409, detail=f"Cannot move {doc['status']} → {body.status}.")
    updates: dict = {"status": body.status, "updated_at": utcnow()}
    if body.status in ("En route", "On scene") and doc.get("unit"):
        await db.units.update_one({"id": doc["unit"]}, {"$set": {"stat": body.status}})
    await db.reports.update_one({"code": code}, {
        "$set": updates,
        "$push": {"hist": HistoryEntry(stage=body.status, note=body.reason or f"Status updated by {p.name}", actor=p.name).model_dump()},
    })
    await aud(p, f"Status → {body.status}", code, reason=body.reason, prev=doc["status"], nxt=body.status)
    return to_report(await db.reports.find_one({"code": code}))


@router.post("/incident/{code}/priority", response_model=Report)
async def change_priority(code: str, body: PriorityChange, p: Principal = Depends(require_perm("prio"))):
    doc = await load_incident(code)
    if body.severity == doc["severity"]:
        raise HTTPException(status_code=409, detail="Priority is already set to that value.")
    await db.reports.update_one({"code": code}, {
        "$set": {"severity": body.severity, "updated_at": utcnow()},
        "$push": {"hist": HistoryEntry(stage="Priority change", note=f"{doc['severity']} → {body.severity}", actor=p.name).model_dump()},
    })
    await aud(p, "Priority change", code, reason=body.reason, prev=doc["severity"], nxt=body.severity)
    return to_report(await db.reports.find_one({"code": code}))


@router.post("/incident/{code}/assign", response_model=Report)
async def assign(code: str, body: AssignBody, p: Principal = Depends(require_perm("assign"))):
    doc = await load_incident(code)
    if not is_active(doc["status"]):
        raise HTTPException(status_code=409, detail="This incident is closed.")
    unit = await db.units.find_one({"id": body.unit_id})
    if not unit:
        raise HTTPException(status_code=404, detail="No such response unit.")
    need = SVC.get(doc["category"])
    if need and unit["svc"] != need:
        raise HTTPException(status_code=400,
                            detail=f"{unit['id']} is a {unit['svc']} unit; a {CAT.get(doc['category'], ('this incident',))[0]} incident needs a {need} unit.")
    if not unit.get("active", True):
        raise HTTPException(status_code=400, detail=f"{unit['id']} is deactivated.")
    km, _path, _pts, _settled, _ms = route(unit["node"], doc["node"])
    if km == float("inf"):
        raise HTTPException(status_code=409, detail="No road path from that unit's base on the sample graph.")
    prev_status, prev_unit = doc["status"], doc.get("unit")
    new_status = "Assigned" if prev_status in ("Reported", "Acknowledged", "Under review") else prev_status
    unit_stat = {"Assigned": "Assigned", "En route": "En route", "On scene": "On scene"}.get(new_status, "Assigned")
    if prev_unit and prev_unit != unit["id"]:
        await db.units.update_one({"id": prev_unit}, {"$set": {"stat": "Available"}})
    await db.units.update_one({"id": unit["id"]}, {"$set": {"stat": unit_stat}})
    await db.reports.update_one({"code": code}, {
        "$set": {"unit": unit["id"], "status": new_status, "route_km": round(km, 2), "updated_at": utcnow()},
        "$push": {"hist": HistoryEntry(
            stage="Unit assigned" if not prev_unit else "Unit reassigned",
            note=f"{unit['id']} ({unit['facility']}) · shortest-path {km:.1f} km · est. {eta_min(km)} min (sample graph)",
            actor=p.name).model_dump()},
    })
    await aud(p, "Unit assigned" if not prev_unit else "Unit reassigned", code, reason=body.reason,
              prev=f"{prev_unit or '—'} / {prev_status}", nxt=f"{unit['id']} / {new_status}")
    return to_report(await db.reports.find_one({"code": code}))


@router.post("/incident/{code}/resolve", response_model=Report)
async def resolve(code: str, body: ReasonBody, p: Principal = Depends(require_perm("resolve"))):
    doc = await load_incident(code)
    if not is_active(doc["status"]):
        raise HTTPException(status_code=409, detail="This incident is already closed.")
    if doc.get("unit"):
        await db.units.update_one({"id": doc["unit"]}, {"$set": {"stat": "Available"}})
    await db.reports.update_one({"code": code}, {
        "$set": {"status": "Resolved", "updated_at": utcnow()},
        "$push": {"hist": HistoryEntry(stage="Resolved", note=body.reason or f"Resolved by {p.name}", actor=p.name).model_dump()},
    })
    await aud(p, "Resolved", code, reason=body.reason, prev=doc["status"], nxt="Resolved")
    return to_report(await db.reports.find_one({"code": code}))


@router.post("/incident/{code}/close", response_model=Report)
async def close(code: str, body: ReasonBody, p: Principal = Depends(require_perm("resolve"))):
    doc = await load_incident(code)
    if doc["status"] != "Resolved":
        raise HTTPException(status_code=409, detail="Resolve the incident before closing it.")
    await db.reports.update_one({"code": code}, {
        "$set": {"status": "Closed", "updated_at": utcnow()},
        "$push": {"hist": HistoryEntry(stage="Closed", note=body.reason or f"Closed by {p.name}", actor=p.name).model_dump()},
    })
    await aud(p, "Closed", code, reason=body.reason, prev="Resolved", nxt="Closed")
    return to_report(await db.reports.find_one({"code": code}))


@router.post("/incident/{code}/reopen", response_model=Report)
async def reopen(code: str, body: ReasonBody, p: Principal = Depends(require_perm("reopen"))):
    doc = await load_incident(code)
    if doc["status"] not in ("Resolved", "Closed"):
        raise HTTPException(status_code=409, detail="Only resolved or closed incidents can be reopened.")
    await db.reports.update_one({"code": code}, {
        "$set": {"status": "Under review", "updated_at": utcnow()},
        "$push": {"hist": HistoryEntry(stage="Reopened", note=body.reason or f"Reopened by {p.name}", actor=p.name).model_dump()},
    })
    await aud(p, "Reopened", code, reason=body.reason, prev=doc["status"], nxt="Under review")
    return to_report(await db.reports.find_one({"code": code}))


# ------------------------------------------------------------------ notes / replies / risk

@router.post("/incident/{code}/note", response_model=Report)
async def add_note(code: str, body: NoteBody, p: Principal = Depends(require_perm("note"))):
    doc = await load_incident(code)
    await db.reports.update_one({"code": code}, {
        "$set": {"updated_at": utcnow()},
        "$push": {"hist": HistoryEntry(stage="Internal note", note=body.text.strip(), actor=p.name).model_dump()},
    })
    await aud(p, "Internal note", code, reason=body.text.strip()[:120])
    return to_report(await db.reports.find_one({"code": code}))


@router.post("/incident/{code}/reply", response_model=Report)
async def staff_reply(code: str, body: NoteBody, p: Principal = Depends(require_perm("note"))):
    doc = await load_incident(code)
    await db.reports.update_one({"code": code}, {
        "$set": {"updated_at": utcnow()},
        "$push": {"replies": Reply(by=p.name, role="staff", text=body.text.strip()).model_dump()},
    })
    await aud(p, "Reply sent to reporter", code, reason=body.text.strip()[:120])
    return to_report(await db.reports.find_one({"code": code}))


@router.post("/incident/{code}/review", response_model=Report)
async def review(code: str, body: ReviewDecision, p: Principal = Depends(require_perm("rview"))):
    if body.decision == "escalated" and not p.can("rview2"):
        raise HTTPException(status_code=403, detail="Escalation requires a supervisor.")
    doc = await load_incident(code)
    needs = body.decision != "cleared"
    note = body.note or {"cleared": "Reviewed — no further action", "needs-review": "Needs further review",
                         "escalated": "Escalated for supervisor review"}[body.decision]
    await db.reports.update_one({"code": code}, {
        "$set": {"needs_review": needs, "updated_at": utcnow()},
        "$push": {"hist": HistoryEntry(stage="Risk review", note=note, actor=p.name).model_dump()},
    })
    await aud(p, f"Risk review: {note}", code, reason=body.note, prev=f"needs_review={doc.get('needs_review')}", nxt=f"needs_review={needs}")
    return to_report(await db.reports.find_one({"code": code}))


@router.post("/incident/{code}/flag", response_model=Report)
async def flag(code: str, body: FlagBody, p: Principal = Depends(require_perm("flag"))):
    doc = await load_incident(code)
    await db.reports.update_one({"code": code}, {
        "$set": {"flag": body.flag, "flag_reason": body.reason if body.flag else None, "updated_at": utcnow()},
        "$push": {"hist": HistoryEntry(stage="Flagged" if body.flag else "Flag removed", note=body.reason, actor=p.name).model_dump()},
    })
    await aud(p, "Flagged for attention" if body.flag else "Flag removed", code, reason=body.reason,
              prev=f"flag={doc.get('flag')}", nxt=f"flag={body.flag}")
    return to_report(await db.reports.find_one({"code": code}))


@router.post("/incident/{code}/link", response_model=Report)
async def link_dup(code: str, body: LinkBody, p: Principal = Depends(require_perm("link"))):
    doc = await load_incident(code)
    other = await db.reports.find_one({"code": body.other_code})
    if not other:
        raise HTTPException(status_code=404, detail="No report with that reference to link.")
    if body.other_code == code:
        raise HTTPException(status_code=400, detail="An incident cannot link to itself.")
    signal = RiskSignal(id="dup-link", kind="observed", weight=25,
                        text=f"Linked as possible duplicate of {body.other_code}.")
    new_score = min(100, doc["risk"].get("score", 0) + 25)
    level = "high" if new_score >= 60 else ("medium" if new_score >= 25 else "low")
    await db.reports.update_one({"code": code}, {
        "$set": {"link": body.other_code, "updated_at": utcnow(),
                 "risk": {"score": new_score, "level": level,
                          "signals": doc["risk"].get("signals", []) + [signal.model_dump()]}},
        "$push": {"hist": HistoryEntry(stage="Linked", note=f"Possible duplicate of {body.other_code}", actor=p.name).model_dump()},
    })
    await aud(p, "Linked possible duplicate", code, reason=body.reason, prev=doc.get("link") or "—", nxt=body.other_code)
    return to_report(await db.reports.find_one({"code": code}))


# ------------------------------------------------------------------ units

@router.get("/units", response_model=list[Unit])
async def units(p: Principal = Depends(require_staff)):
    docs = await db.units.find().sort("id", 1).to_list(200)
    return [Unit(**d) for d in docs]


@router.post("/units/{unit_id}/status", response_model=Unit)
async def unit_status(unit_id: str, body: UnitStatusPatch, p: Principal = Depends(require_perm("unit"))):
    doc = await db.units.find_one({"id": unit_id})
    if not doc:
        raise HTTPException(status_code=404, detail="No such unit.")
    if body.stat not in UNIT_STATUSES:
        raise HTTPException(status_code=422, detail="Unknown unit status.")
    await db.units.update_one({"id": unit_id}, {"$set": {"stat": body.stat}})
    await aud(p, f"Unit status → {body.stat}", unit_id, reason=body.reason, prev=doc["stat"], nxt=body.stat)
    return Unit(**await db.units.find_one({"id": unit_id}))


@router.post("/units/{unit_id}/active", response_model=Unit)
async def unit_active(unit_id: str, body: UnitActivePatch, p: Principal = Depends(require_perm("unit"))):
    doc = await db.units.find_one({"id": unit_id})
    if not doc:
        raise HTTPException(status_code=404, detail="No such unit.")
    await db.units.update_one({"id": unit_id}, {"$set": {"active": body.active}})
    await aud(p, "Unit deactivated" if not body.active else "Unit reactivated", unit_id,
              reason=body.reason, prev=f"active={doc.get('active')}", nxt=f"active={body.active}")
    return Unit(**await db.units.find_one({"id": unit_id}))


# ------------------------------------------------------------------ audit / analytics / users

@router.get("/audit", response_model=list[AuditEntry])
async def audit_list(
    actor: str | None = None, action: str | None = None, target: str | None = None,
    p: Principal = Depends(require_staff),
):
    query: dict = {}
    if actor:
        query["actor"] = {"$regex": re.escape(actor), "$options": "i"}
    if action:
        query["action"] = {"$regex": re.escape(action), "$options": "i"}
    if target:
        query["target"] = {"$regex": re.escape(target), "$options": "i"}
    docs = await db.audit.find(query).sort("n", -1).to_list(300)
    out = []
    for d in docs:
        v = d.get("ts")
        if v is not None and v.tzinfo is None:
            d["ts"] = v.replace(tzinfo=timezone.utc)
        out.append(AuditEntry(**d))
    return out


@router.get("/analytics", response_model=Analytics)
async def analytics(p: Principal = Depends(require_staff)):
    docs = await db.reports.find().to_list(5000)
    by_status: dict[str, int] = {}
    by_sev: dict[str, int] = {}
    by_cat: dict[str, int] = {}
    ack_minutes: list[float] = []
    for d in docs:
        by_status[d["status"]] = by_status.get(d["status"], 0) + 1
        by_sev[d["severity"]] = by_sev.get(d["severity"], 0) + 1
        by_cat[d["category"]] = by_cat.get(d["category"], 0) + 1
        for h in d.get("hist", []):
            if h.get("stage") == "Acknowledged" and h.get("ts") and d.get("created_at"):
                delta = (h["ts"] - d["created_at"]).total_seconds()
                if 0 <= delta < 86400:
                    ack_minutes.append(delta / 60)
    units_docs = await db.units.find().to_list(200)
    return Analytics(
        total=len(docs),
        active=sum(1 for d in docs if is_active(d["status"])),
        resolved=sum(1 for d in docs if d["status"] in ("Resolved", "Closed")),
        by_status=by_status, by_severity=by_sev, by_category=by_cat,
        avg_ack_min=round(sum(ack_minutes) / len(ack_minutes), 1) if ack_minutes else None,
        units_available=sum(1 for u in units_docs if u.get("stat") == "Available" and u.get("active", True)),
        units_total=len(units_docs),
    )


@router.get("/users", response_model=list[UserAdminView])
async def list_users(p: Principal = Depends(require_perm("users"))):
    docs = await db.users.find().sort("created_at", 1).to_list(500)
    out = []
    for d in docs:
        v = d.get("created_at")
        if v is not None and v.tzinfo is None:
            d["created_at"] = v
        out.append(UserAdminView(id=d["id"], type=d["type"], name=d["name"], role=d.get("role", "Citizen"),
                                 ident=d["ident"], disabled=d.get("disabled", False), created_at=d["created_at"]))
    return out


async def _active_admins() -> int:
    return await db.users.count_documents({"type": "staff", "role": "Admin", "disabled": {"$ne": True}})


@router.post("/users/{user_id}/role", response_model=UserAdminView)
async def set_role(user_id: str, body: RoleChange, p: Principal = Depends(require_perm("users"))):
    doc = await db.users.find_one({"id": user_id})
    if not doc or doc["type"] != "staff":
        raise HTTPException(status_code=404, detail="No such staff account.")
    if body.role not in ("Dispatcher", "Supervisor", "Admin", "Read-only analyst"):
        raise HTTPException(status_code=422, detail="Unknown role.")
    if doc["role"] == "Admin" and body.role != "Admin" and await _active_admins() <= 1:
        raise HTTPException(status_code=409, detail="At least one active administrator is required.")
    await db.users.update_one({"id": user_id}, {"$set": {"role": body.role}})
    await aud(p, "Role change", doc["ident"], reason=body.reason, prev=doc["role"], nxt=body.role)
    d = await db.users.find_one({"id": user_id})
    return UserAdminView(id=d["id"], type=d["type"], name=d["name"], role=d["role"], ident=d["ident"],
                         disabled=d.get("disabled", False), created_at=d.get("created_at", utcnow()))


@router.post("/users/{user_id}/disabled", response_model=UserAdminView)
async def set_disabled(user_id: str, body: DisableChange, p: Principal = Depends(require_perm("users"))):
    doc = await db.users.find_one({"id": user_id})
    if not doc or doc["type"] != "staff":
        raise HTTPException(status_code=404, detail="No such staff account.")
    if body.disabled and doc["role"] == "Admin" and await _active_admins() <= 1:
        raise HTTPException(status_code=409, detail="At least one active administrator is required.")
    await db.users.update_one({"id": user_id}, {"$set": {"disabled": body.disabled}})
    await aud(p, "Account disabled" if body.disabled else "Account enabled", doc["ident"],
              reason=body.reason, prev=f"disabled={doc.get('disabled')}", nxt=f"disabled={body.disabled}")
    d = await db.users.find_one({"id": user_id})
    return UserAdminView(id=d["id"], type=d["type"], name=d["name"], role=d["role"], ident=d["ident"],
                         disabled=d.get("disabled", False), created_at=d.get("created_at", utcnow()))
