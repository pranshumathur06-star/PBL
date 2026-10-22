"""Contact / demo-request endpoint. Stores the message and is honest about it:
no email is sent — nothing pretends to be delivered."""

import re

from fastapi import APIRouter, HTTPException

from lib.db import db
from lib.security import utcnow
from models.ease import ContactMessage

router = APIRouter(prefix="/contact", tags=["contact"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@router.post("", status_code=201)
async def submit(body: ContactMessage):
    if not EMAIL_RE.match(body.email.strip()):
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    doc = body.model_dump()
    doc["email"] = body.email.strip().lower()
    doc["created_at"] = utcnow()
    await db.messages.insert_one(doc)
    return {"ok": True, "id": body.id,
            "note": "Saved to the project's demonstration database. No email is sent — this form does not deliver messages anywhere."}
