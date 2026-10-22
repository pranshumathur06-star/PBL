"""Idempotent demo seed: response units, clearly-labelled sample incidents, audit history
and demo staff accounts. Run: cd /app/backend && python seed.py"""

import asyncio
from datetime import timedelta

from lib.audit import add_audit
from lib.catalog import CAT
from lib.city_graph import FAC
from lib.db import db, ensure_indexes
from lib.routing import snap
from lib.security import hash_password, utcnow

UNITS = [
    ("AMB-12", "ambulance", "Doon Hospital", "Available", "ALS"),
    ("AMB-07", "ambulance", "Max Super Speciality Hospital", "Available", "BLS"),
    ("AMB-03", "ambulance", "Synergy Hospital", "Temporarily unavailable", "BLS"),
    ("AMB-09", "ambulance", "Graphic Era Hospital", "Available", "BLS"),
    ("FIRE-04", "fire", "Dehradun Fire Station", "Assigned", "Water tender"),
    ("FIRE-02", "fire", "ISBT Fire Post", "Offline / location stale", "Rescue"),
    ("PCR-03", "police", "Kotwali Police Station", "Available", "PCR van"),
    ("PCR-11", "police", "Patel Nagar Police Station", "Available", "PCR van"),
]

# [code, category, severity, minutes_ago, text, (map_x, map_y), area, status]
SEED = [
    ("SAMPLE-101", "medical", "Critical", 6, "Elderly person with chest pain, conscious", (440, 230), "Rajpur Road area", "Reported"),
    ("SAMPLE-102", "accident", "High", 14, "Two-wheeler and car collision, one person injured", (335, 55), "Haridwar Road area", "Acknowledged"),
    ("SAMPLE-103", "fire", "Critical", 3, "Smoke from first-floor kitchen, residents leaving", (150, 150), "Patel Nagar area", "Reported"),
    ("SAMPLE-104", "theft", "Medium", 31, "Bag snatched near the market, suspect left on foot", (275, 185), "Clock Tower area", "Under review"),
    ("SAMPLE-105", "flood", "High", 52, "Water entering ground-floor shops near a drain", (140, 305), "Graphic Era side", "Assigned"),
    ("SAMPLE-106", "other", "Low", 12, "Sample: lol test report, ignore", (300, 100), "Kotwali area", "Reported"),
    ("SAMPLE-107", "medical", "Medium", 95, "Fall at home, minor head injury, awake", (210, 95), "Doon Hospital side", "Resolved"),
    ("SAMPLE-108", "accident", "Medium", 20, "Vehicle broken down, blocking one lane", (348, 275), "NH7 area", "Reported"),
]

URG = {"Critical": "life", "High": "urgent"}

DEMO_USERS = [
    ("admin@ease.demo", "Demo Admin", "Admin"),
    ("dispatcher@ease.demo", "Demo Dispatcher", "Dispatcher"),
    ("analyst@ease.demo", "Demo Analyst", "Read-only analyst"),
]
DEMO_PASSWORD = "EaseDemo112"


async def seed() -> None:
    fac_by_name = {f["n"]: f["p"] for f in FAC}

    # Response units (facility -> snapped graph node, so routes can be computed).
    for uid, svc, fac, stat, tags in UNITS:
        p = fac_by_name.get(fac, (305, 150))
        doc = {"id": uid, "svc": svc, "facility": fac, "node": snap(p[0], p[1]),
               "stat": stat, "tags": tags, "active": True, "sample": False}
        await db.units.update_one({"id": uid}, {"$setOnInsert": doc}, upsert=True)

    # Sample incidents, deterministically rebuilt if missing.
    if not await db.reports.find_one({"sample": True}):
        now = utcnow()
        for code, cat, sev, mins, text, (x, y), area, status in SEED:
            ts = now - timedelta(minutes=mins)
            hist = [{"ts": ts, "stage": "Reported", "note": f"Location: {area} (sample)", "actor": "Guest (sample)"}]
            if status != "Reported":
                hist.append({"ts": ts + timedelta(minutes=3), "stage": "Acknowledged", "note": "Acknowledged (sample)", "actor": "System (sample)"})
            if status == "Under review":
                hist.append({"ts": ts + timedelta(minutes=5), "stage": "Under review", "note": "Under review (sample)", "actor": "System (sample)"})
            unit = "FIRE-04" if code == "SAMPLE-105" else None
            if status == "Assigned":
                hist.append({"ts": ts + timedelta(minutes=8), "stage": "Unit assigned", "note": "FIRE-04 assigned (sample)", "actor": "System (sample)"})
            if status == "Resolved":
                hist.append({"ts": ts + timedelta(minutes=40), "stage": "Resolved", "note": "Resolved (sample)", "actor": "System (sample)"})
            doc = {
                "id": code.lower(), "code": code, "category": cat, "label": CAT[cat][0],
                "urgency": URG.get(sev, "info"), "severity": sev, "text": text, "status": status,
                "node": snap(x, y),
                "loc": {"manual": True, "address": f"{area} (sample)", "lat": None, "lng": None,
                        "accuracy_m": None, "map_x": x, "map_y": y},
                "details": {}, "reporter_name": None, "phone": None, "acct": "guest", "unit": unit,
                "route_km": None, "risk": {"score": 0, "level": "low", "signals": []},
                "needs_review": False, "flag": False, "flag_reason": None, "link": None, "sample": True,
                "created_at": ts, "updated_at": ts, "hist": hist, "replies": [],
            }
            await db.reports.update_one({"code": code}, {"$setOnInsert": doc}, upsert=True)

        # Preserved risk-review demo: SAMPLE-106 carries inferred + observed signals.
        await db.reports.update_one({"code": "SAMPLE-106"}, {"$set": {
            "risk": {"score": 60, "level": "high", "signals": [
                {"id": "testwords", "kind": "inferred", "weight": 30, "text": "Wording suggests a test or joke."},
                {"id": "burst", "kind": "observed", "weight": 30, "text": "Several submission attempts within 2 minutes."},
            ]},
            "needs_review": True,
        }})
        await db.reports.update_one({"code": "SAMPLE-101"}, {"$set": {"replies": [
            {"id": "s1", "ts": utcnow() - timedelta(minutes=4), "by": "Command Centre (sample)", "role": "staff",
             "text": "Your report is in the queue. Stay with the person and keep the phone free (sample)."},
        ]}})

    # Demo staff accounts (clearly labelled on the sign-in page).
    for email, name, role in DEMO_USERS:
        if not await db.users.find_one({"type": "staff", "ident": email}):
            salt, digest, iters = hash_password(DEMO_PASSWORD)
            await db.users.insert_one({
                "id": email, "type": "staff", "ident": email, "name": name, "role": role,
                "salt": salt, "hash": digest, "iters": iters, "disabled": False, "created_at": utcnow(),
            })

    # Sample audit history.
    if not await db.audit.find_one({"sample": True}):
        now = utcnow()
        samples = [
            ("Demo dataset loaded", "-", "Deterministic seed data for demonstration"),
            ("Acknowledged", "SAMPLE-102", "Sample acknowledgement"),
            ("Priority change", "SAMPLE-103", "Raised to Critical (sample)"),
            ("Unit assigned", "SAMPLE-105", "FIRE-04 assigned (sample)"),
            ("Resolved", "SAMPLE-107", "Sample resolution"),
        ]
        for i, (action, target, reason) in enumerate(samples, 1):
            e = await add_audit(action, target, actor="System (sample)", role="System", reason=reason, sample=True)
            await db.audit.update_one({"id": e.id}, {"$set": {"ts": now - timedelta(minutes=100 - i * 10)}})

    await ensure_indexes()
    print("Seed complete: 8 units, 8 sample incidents, demo staff accounts, audit history.")


if __name__ == "__main__":
    asyncio.run(seed())
