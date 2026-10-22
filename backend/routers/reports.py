"""Citizen-facing report endpoints. Guest reporting is sacred: no auth, OTP, GPS or
photo is ever required to submit (preserved requirement). Risk signals inform human
review — they never block, reject or delay a report."""

import re
import secrets
from datetime import timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from models.ease import (
    HistoryEntry, Loc, Reply, Report, ReportCancel, ReportCreate, ReplyCreate, Risk,
    RiskSignal, ReportPublic,
)
from lib.db import db
from lib.audit import add_audit
from lib.catalog import CAT, TEST_WORDS, classify_severity
from lib.routing import CENTER_NODE, snap
from lib.security import get_principal, utcnow

router = APIRouter(prefix="/reports", tags=["reports"])

ACTIVE_STATUSES = ("Reported", "Acknowledged", "Under review", "Assigned", "En route", "On scene")


def norm_phone(p: str | None) -> str | None:
    if not p:
        return None
    digits = re.sub(r"\D", "", p)
    return digits[-10:] if len(digits) >= 10 else (digits or None)


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


def loc_note(loc: Loc) -> str:
    if loc.manual and loc.address:
        return f"Location: {loc.address}"
    if loc.lat is not None:
        return f"GPS location shared (±{round(loc.accuracy_m or 0)} m)"
    return "Location not shared"


async def compute_risk(text: str, category: str, phone: str | None, acct: str | None) -> Risk:
    """Signals only. Anonymity itself is NEVER a signal; a flagged report is never
    auto-rejected — it stays fully visible in the queue for human review."""
    signals: list[RiskSignal] = []
    score = 0
    t = text.lower()
    if any(w in t for w in TEST_WORDS):
        score += 30
        signals.append(RiskSignal(id="testwords", kind="inferred", weight=30,
                                  text="Wording suggests a test or joke."))
    ident_phone = phone if acct == "guest" else None
    if acct and acct != "guest" or ident_phone:
        since = utcnow() - timedelta(seconds=120)
        q = {"created_at": {"$gte": since}, "$or": []}
        if ident_phone:
            q["$or"].append({"phone": ident_phone})
        if acct and acct != "guest":
            q["$or"].append({"acct": acct})
        recent = await db.reports.count_documents(q)
        if recent >= 2:
            score += 30
            signals.append(RiskSignal(id="burst", kind="observed", weight=30,
                                      text="Several submission attempts within 2 minutes."))
        dup_q = {"category": category, "created_at": {"$gte": utcnow() - timedelta(minutes=15)}}
        others = await db.reports.find(dup_q).to_list(50)
        words = set(t.split())
        for o in others:
            ow = set(o["text"].lower().split())
            if not ow:
                continue
            overlap = len(words & ow) / max(1, min(len(words), len(ow)))
            if len(words) >= 4 and overlap >= 0.6:
                score += 25
                signals.append(RiskSignal(id="duplicate", kind="observed", weight=25,
                                          text=f"Similar report received recently ({o['code']}) — possible duplicate."))
                break
    level = "high" if score >= 60 else ("medium" if score >= 25 else "low")
    return Risk(score=score, level=level, signals=signals)


@router.post("", response_model=Report, status_code=201)
async def create_report(body: ReportCreate, principal=Depends(get_principal)):
    category = body.category if body.category in CAT else "other"
    text = body.text.strip()
    if len(text) < 5:
        raise HTTPException(status_code=422, detail="Describe the situation in a few words.")
    acct = principal.user_id if principal and principal.type == "citizen" else "guest"
    reporter = principal.name if principal and principal.type == "citizen" else ((body.reporter_name or "").strip() or None)
    phone = principal.ident if principal and principal.type == "citizen" else norm_phone(body.phone)
    severity = classify_severity(text, category, body.urgency)
    node = snap(body.loc.map_x, body.loc.map_y) if body.loc.map_x is not None and body.loc.map_y is not None else CENTER_NODE
    risk = await compute_risk(text, category, phone, acct)
    code = "RPT-" + secrets.token_hex(3).upper()
    rep = Report(
        code=code, category=category, label=CAT[category][0], urgency=body.urgency,
        severity=severity, text=text, node=node, loc=body.loc, details=body.details,
        reporter_name=reporter, phone=phone, acct=acct, risk=risk,
        needs_review=risk.level != "low",
        hist=[HistoryEntry(stage="Reported", note=loc_note(body.loc), actor=reporter or "Guest")],
    )
    await db.reports.insert_one(rep.model_dump())
    await add_audit("Report received", code, actor=reporter or "Guest",
                    role="Citizen" if acct != "guest" else "Guest",
                    reason=f"{CAT[category][0]} · {severity}")
    return rep


@router.get("/mine", response_model=list[Report])
async def my_reports(principal=Depends(get_principal)):
    if principal is None or principal.type != "citizen":
        return []
    docs = await db.reports.find({"$or": [{"acct": principal.user_id}, {"phone": principal.ident}]}) \
        .sort("created_at", -1).to_list(200)
    return [to_report(d) for d in docs]


@router.get("/{code}", response_model=ReportPublic)
async def get_report(code: str, phone: str | None = None, principal=Depends(get_principal)):
    doc = await db.reports.find_one({"code": code})
    if not doc:
        raise HTTPException(status_code=404, detail="No report with that reference. Check the code and try again.")
    full = False
    if principal and principal.type == "staff":
        full = True
    elif principal and principal.type == "citizen" and doc.get("acct") == principal.user_id:
        full = True
    elif phone and doc.get("phone") and norm_phone(phone) == doc["phone"]:
        full = True
    rep = to_report(doc)
    if full:
        return ReportPublic(
            code=rep.code, category=rep.category, label=rep.label, severity=rep.severity,
            status=rep.status, unit=rep.unit, created_at=rep.created_at, hist=rep.hist,
            replies=rep.replies, loc_note=loc_note(rep.loc), text=rep.text, node=rep.node, full=True,
        )
    # Anonymous follow-up by reference code: status timeline only — no reporter PII, no risk data.
    return ReportPublic(
        code=rep.code, category=rep.category, label=rep.label, severity=rep.severity,
        status=rep.status, unit=rep.unit, created_at=rep.created_at,
        hist=rep.hist, replies=rep.replies, loc_note=loc_note(rep.loc), node=rep.node, full=False,
    )


async def _own_report(code: str, body_phone: str | None, principal) -> dict:
    doc = await db.reports.find_one({"code": code})
    if not doc:
        raise HTTPException(status_code=404, detail="No report with that reference.")
    owned = (principal and principal.type == "citizen" and doc.get("acct") == principal.user_id) or \
            (doc.get("acct") == "guest" and doc.get("phone") and body_phone and norm_phone(body_phone) == doc["phone"])
    if not owned:
        raise HTTPException(status_code=403, detail="Only the person who filed this report can change it.")
    return doc


@router.post("/{code}/cancel", response_model=Report)
async def cancel_report(code: str, body: ReportCancel, principal=Depends(get_principal)):
    doc = await _own_report(code, body.phone, principal)
    if doc["status"] not in ("Reported", "Acknowledged"):
        raise HTTPException(status_code=409, detail="This report has already been actioned — call 112 if circumstances changed.")
    await db.reports.update_one({"code": code}, {
        "$set": {"status": "Cancelled", "updated_at": utcnow()},
        "$push": {"hist": HistoryEntry(stage="Cancelled", note=body.reason or "Cancelled by reporter", actor="Reporter").model_dump()},
    })
    await add_audit("Report cancelled by reporter", code, actor="Reporter", role="Citizen", reason=body.reason)
    return to_report(await db.reports.find_one({"code": code}))


@router.post("/{code}/reply", response_model=Report)
async def citizen_reply(code: str, body: ReplyCreate, principal=Depends(get_principal)):
    doc = await _own_report(code, body.phone, principal)
    by = (principal.name if principal and principal.type == "citizen" else doc.get("reporter_name") or "Guest")
    await db.reports.update_one({"code": code}, {
        "$set": {"updated_at": utcnow()},
        "$push": {"replies": Reply(by=by, role="citizen", text=body.text.strip()).model_dump()},
    })
    return to_report(await db.reports.find_one({"code": code}))
