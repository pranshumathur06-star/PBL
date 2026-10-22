"""Pydantic v2 models for EASE — every route request/response body lives here.
Frontend mirrors these by hand in frontend/src/types.ts; keep the pair in sync in one edit."""

import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------- location / report

class Loc(BaseModel):
    manual: bool = False
    address: str | None = None
    lat: float | None = None
    lng: float | None = None
    accuracy_m: float | None = None
    map_x: float | None = None  # illustrative demo-map coordinates (sample graph space)
    map_y: float | None = None


class ReportDetails(BaseModel):
    landmark: str | None = None
    pin: str | None = None
    injuries: str | None = None  # none | minor | serious | unknown
    people: str | None = None
    immediate_danger: bool = False


class RiskSignal(BaseModel):
    id: str
    kind: Literal["observed", "inferred"]
    weight: int
    text: str


class Risk(BaseModel):
    score: int = 0
    level: Literal["low", "medium", "high"] = "low"
    signals: list[RiskSignal] = []


class HistoryEntry(BaseModel):
    ts: datetime = Field(default_factory=_utcnow)
    stage: str
    note: str | None = None
    actor: str | None = None


class Reply(BaseModel):
    id: str = Field(default_factory=_uuid)
    ts: datetime = Field(default_factory=_utcnow)
    by: str
    role: str  # 'staff' | 'citizen'
    text: str


class ReportCreate(BaseModel):
    text: str = Field(min_length=5, max_length=2000)
    category: str = "other"
    urgency: Literal["life", "urgent", "info"] = "info"
    loc: Loc = Field(default_factory=Loc)
    details: ReportDetails = Field(default_factory=ReportDetails)
    reporter_name: str | None = None
    phone: str | None = None


class Report(BaseModel):
    id: str = Field(default_factory=_uuid)
    code: str  # human-followable id, e.g. RPT-XXXXXX
    category: str
    label: str
    urgency: str
    severity: Literal["Critical", "High", "Medium", "Low"]
    text: str
    status: str = "Reported"
    node: str
    loc: Loc = Field(default_factory=Loc)
    details: ReportDetails = Field(default_factory=ReportDetails)
    reporter_name: str | None = None
    phone: str | None = None
    acct: str = "guest"  # 'guest' or the citizen user id
    unit: str | None = None
    route_km: float | None = None  # shortest-path distance of the active assignment
    risk: Risk = Field(default_factory=Risk)
    needs_review: bool = False
    flag: bool = False
    flag_reason: str | None = None
    link: str | None = None
    sample: bool = False
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
    hist: list[HistoryEntry] = []
    replies: list[Reply] = []


class ReportCancel(BaseModel):
    phone: str | None = None  # guest ownership proof
    reason: str | None = None


class ReportPublic(BaseModel):
    """Limited follow-up projection for anonymous status checks by reference code."""
    code: str
    category: str
    label: str
    severity: str
    status: str
    unit: str | None = None
    created_at: datetime = Field(default_factory=_utcnow)
    hist: list[HistoryEntry] = []
    replies: list[Reply] = []
    loc_note: str | None = None
    text: str | None = None
    node: str | None = None
    full: bool = False


class ReplyCreate(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    phone: str | None = None  # guest ownership proof


# ---------------------------------------------------------------- units / audit

class Unit(BaseModel):
    id: str  # e.g. AMB-12
    svc: Literal["ambulance", "fire", "police", "mech"]
    facility: str
    node: str
    stat: str = "Available"
    tags: str = ""
    active: bool = True
    sample: bool = False


class UnitStatusPatch(BaseModel):
    stat: str
    reason: str | None = None


class UnitActivePatch(BaseModel):
    active: bool
    reason: str | None = None


class AuditEntry(BaseModel):
    id: str = Field(default_factory=_uuid)
    n: int = 0
    ts: datetime = Field(default_factory=_utcnow)
    actor: str
    role: str
    action: str
    target: str
    reason: str | None = None
    prev: str | None = None
    next: str | None = None
    sample: bool = False


# ---------------------------------------------------------------- ops actions

class StatusChange(BaseModel):
    status: str
    reason: str | None = None


class PriorityChange(BaseModel):
    severity: Literal["Critical", "High", "Medium", "Low"]
    reason: str | None = None


class AssignBody(BaseModel):
    unit_id: str
    reason: str | None = None


class NoteBody(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class ReviewDecision(BaseModel):
    decision: Literal["cleared", "needs-review", "escalated"]
    note: str | None = None


class FlagBody(BaseModel):
    flag: bool
    reason: str | None = None


class LinkBody(BaseModel):
    other_code: str
    reason: str | None = None


class ReasonBody(BaseModel):
    reason: str | None = None


# ---------------------------------------------------------------- auth

class CitizenRegister(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str  # 10-digit Indian mobile, validated in route
    password: str = Field(min_length=8, max_length=128)


class CitizenOtpVerify(BaseModel):
    name: str
    phone: str
    password: str
    code: str


class OtpIssue(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str
    password: str = Field(min_length=8, max_length=128)


class LoginBody(BaseModel):
    ident: str
    password: str


class SessionUser(BaseModel):
    id: str
    type: str
    name: str
    role: str
    ident: str


class BootstrapBody(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str
    password: str = Field(min_length=8, max_length=128)


class UserAdminView(BaseModel):
    id: str
    type: str
    name: str
    role: str
    ident: str
    disabled: bool = False
    created_at: datetime = Field(default_factory=_utcnow)


class RoleChange(BaseModel):
    role: str
    reason: str | None = None


class DisableChange(BaseModel):
    disabled: bool
    reason: str | None = None


# ---------------------------------------------------------------- routing / graph

class RouteResult(BaseModel):
    from_node: str
    to_node: str
    distance_km: float
    eta_min: int
    path: list[str]
    points: list[list[float]]
    settled: int
    compute_ms: float


class GraphMeta(BaseModel):
    pxkm: float
    node_count: int
    edge_count: int


class NearbyFacility(BaseModel):
    name: str
    type: str  # hospital | fire | police | pharmacy | mech
    node: str
    distance_km: float
    eta_min: int
    helpline: str  # national helpline for this service type (India)
    points: list[list[float]]


# ---------------------------------------------------------------- contact

class ContactMessage(BaseModel):
    id: str = Field(default_factory=_uuid)
    name: str = Field(min_length=2, max_length=80)
    email: str
    org: str | None = None
    message: str = Field(min_length=10, max_length=2000)
    created_at: datetime = Field(default_factory=_utcnow)


# ---------------------------------------------------------------- analytics

class Analytics(BaseModel):
    total: int
    active: int
    resolved: int
    by_status: dict[str, int]
    by_severity: dict[str, int]
    by_category: dict[str, int]
    avg_ack_min: float | None
    units_available: int
    units_total: int
