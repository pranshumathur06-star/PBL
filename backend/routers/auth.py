"""Auth routes — citizen (mobile + demo OTP), staff (email + roles), first-admin bootstrap.

Migration note: the original stored PBKDF2 hashes and sessions in the browser
(localStorage/sessionStorage) and honestly labelled that as NOT a security boundary.
Sessions are now httpOnly cookies backed by Mongo; passwords hashed server-side with the
same PBKDF2-SHA256 / 120k iterations. The 5-attempt lockout is preserved."""

import re
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from models.ease import (
    BootstrapBody, CitizenOtpVerify, LoginBody, OtpIssue, SessionUser,
)
from lib.db import db
from lib.security import (
    PBKDF2_ITERS, SESSION_COOKIE, create_session, destroy_session, get_principal,
    hash_password, utcnow, verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

MOBILE_RE = re.compile(r"^[6-9]\d{9}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
OTP_TTL_SECONDS = 600
LOCK_SECONDS = 300
MAX_ATTEMPTS = 5


def public_user(u: dict) -> SessionUser:
    return SessionUser(id=u["id"], type=u["type"], name=u["name"], role=u.get("role", "Citizen"), ident=u["ident"])


def pw_ok(p: str) -> bool:
    return len(p) >= 8 and any(c.isalpha() for c in p) and any(c.isdigit() for c in p)


async def lock_state(key: str) -> int:
    rec = await db.login_fails.find_one({"key": key})
    if rec and rec.get("until") and rec["until"].replace(tzinfo=None) >= utcnow().replace(tzinfo=None):
        secs = int((rec["until"].replace(tzinfo=None) - utcnow().replace(tzinfo=None)).total_seconds())
        raise HTTPException(status_code=429, detail=f"Too many attempts. Try again in {max(secs, 1)} s.")
    return rec["n"] if rec else 0


async def register_fail(key: str, n: int) -> None:
    if n + 1 >= MAX_ATTEMPTS:
        await db.login_fails.update_one(
            {"key": key}, {"$set": {"n": 0, "until": utcnow() + timedelta(seconds=LOCK_SECONDS)}}, upsert=True)
    else:
        await db.login_fails.update_one({"key": key}, {"$set": {"n": n + 1}}, upsert=True)


async def do_login(response: Response, user_type: str, ident: str, password: str) -> SessionUser:
    ident = ident.strip()
    key = f"{user_type}:{ident.lower()}"
    n = await lock_state(key)
    user = await db.users.find_one({"type": user_type, "ident": ident.lower() if user_type == "staff" else ident})
    if not user or user.get("disabled") or not verify_password(
            password, user.get("salt", ""), user.get("hash", ""), user.get("iters", PBKDF2_ITERS)):
        await register_fail(key, n)
        raise HTTPException(status_code=401, detail="Incorrect details. Please check and try again.")
    await db.login_fails.delete_one({"key": key})
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_login": utcnow()}})
    await create_session(response, user["id"])
    return public_user(user)


@router.post("/citizen/otp")
async def citizen_otp(body: OtpIssue):
    """Step 1 of citizen registration. Demo honesty: there is no SMS gateway, so the
    verification code is returned here and shown in the UI labelled as demo-only."""
    phone = body.phone.strip()
    if not MOBILE_RE.match(phone):
        raise HTTPException(status_code=422, detail="Enter a valid 10-digit Indian mobile number.")
    if not pw_ok(body.password):
        raise HTTPException(status_code=422, detail="Password needs at least 8 characters with a letter and a digit.")
    if len(body.name.strip()) < 2:
        raise HTTPException(status_code=422, detail="Enter your full name.")
    if await db.users.find_one({"type": "citizen", "ident": phone}):
        raise HTTPException(status_code=409, detail="An account with this number already exists. Try signing in.")
    code = f"{secrets.randbelow(9000) + 1000}"
    await db.otps.update_one(
        {"phone": phone},
        {"$set": {"code": code, "name": body.name.strip(), "password": body.password,
                  "expires_at": utcnow() + timedelta(seconds=OTP_TTL_SECONDS)}},
        upsert=True,
    )
    return {"demo_code": code, "note": "Demo only: no SMS is sent. This code would normally arrive by SMS."}


@router.post("/citizen/register", response_model=SessionUser)
async def citizen_register(body: CitizenOtpVerify, response: Response):
    phone = body.phone.strip()
    rec = await db.otps.find_one({"phone": phone})
    if not rec or rec.get("code") != body.code.strip():
        raise HTTPException(status_code=401, detail="That verification code is not correct.")
    if rec["expires_at"].replace(tzinfo=None) < utcnow().replace(tzinfo=None):
        raise HTTPException(status_code=401, detail="That code has expired. Start again to get a new one.")
    if await db.users.find_one({"type": "citizen", "ident": phone}):
        raise HTTPException(status_code=409, detail="An account with this number already exists. Try signing in.")
    salt, digest, iters = hash_password(body.password)
    user = {"id": secrets.token_urlsafe(12), "type": "citizen", "ident": phone, "name": rec.get("name", body.name.strip()),
            "role": "Citizen", "salt": salt, "hash": digest, "iters": iters, "disabled": False, "created_at": utcnow()}
    await db.users.insert_one(user)
    await db.otps.delete_one({"phone": phone})
    await create_session(response, user["id"])
    return public_user(user)


@router.post("/citizen/login", response_model=SessionUser)
async def citizen_login(body: LoginBody, response: Response):
    return await do_login(response, "citizen", body.ident.strip(), body.password)


@router.post("/staff/login", response_model=SessionUser)
async def staff_login(body: LoginBody, response: Response):
    ident = body.ident.strip().lower()
    if not EMAIL_RE.match(ident):
        raise HTTPException(status_code=422, detail="Enter your work email address.")
    return await do_login(response, "staff", ident, body.password)


@router.post("/staff/bootstrap", response_model=SessionUser)
async def staff_bootstrap(body: BootstrapBody, response: Response):
    """First-run setup: when no staff account exists, the first account becomes Admin
    (preserved from the original). Disabled once any staff account exists."""
    if await db.users.find_one({"type": "staff"}):
        raise HTTPException(status_code=409, detail="Staff accounts already exist — sign in instead.")
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Enter a valid work email address.")
    if not pw_ok(body.password):
        raise HTTPException(status_code=422, detail="Password needs at least 8 characters with a letter and a digit.")
    salt, digest, iters = hash_password(body.password)
    user = {"id": secrets.token_urlsafe(12), "type": "staff", "ident": email, "name": body.name.strip(),
            "role": "Admin", "salt": salt, "hash": digest, "iters": iters, "disabled": False, "created_at": utcnow()}
    await db.users.insert_one(user)
    await create_session(response, user["id"])
    return public_user(user)


@router.get("/me", response_model=SessionUser | None)
async def me(principal=Depends(get_principal)):
    if principal is None:
        return None
    return SessionUser(id=principal.user_id, type=principal.type, name=principal.name,
                       role=principal.role, ident=principal.ident)


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response):
    await destroy_session(request)
    response.delete_cookie(key=SESSION_COOKIE, path="/")
    return None
