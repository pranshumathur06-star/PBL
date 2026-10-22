// Hand-written mirrors of the Pydantic models in backend/models/ease.py.
// Nothing infers across the HTTP boundary — keep this file in sync in the same edit.

export interface Loc {
  manual: boolean;
  address: string | null;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  map_x: number | null;
  map_y: number | null;
}

export interface ReportDetails {
  landmark: string | null;
  pin: string | null;
  injuries: string | null;
  people: string | null;
  immediate_danger: boolean;
}

export interface RiskSignal {
  id: string;
  kind: "observed" | "inferred";
  weight: number;
  text: string;
}

export interface Risk {
  score: number;
  level: "low" | "medium" | "high";
  signals: RiskSignal[];
}

export interface HistoryEntry {
  ts: string;
  stage: string;
  note: string | null;
  actor: string | null;
}

export interface Reply {
  id: string;
  ts: string;
  by: string;
  role: string;
  text: string;
}

export type Severity = "Critical" | "High" | "Medium" | "Low";
export type Urgency = "life" | "urgent" | "info";
export type Category =
  | "medical" | "accident" | "fire" | "violence" | "theft" | "flood" | "ev" | "other";

export interface Report {
  id: string;
  code: string;
  category: Category;
  label: string;
  urgency: Urgency;
  severity: Severity;
  text: string;
  status: string;
  node: string;
  loc: Loc;
  details: ReportDetails;
  reporter_name: string | null;
  phone: string | null;
  acct: string;
  unit: string | null;
  route_km: number | null;
  risk: Risk;
  needs_review: boolean;
  flag: boolean;
  flag_reason: string | null;
  link: string | null;
  sample: boolean;
  created_at: string;
  updated_at: string;
  hist: HistoryEntry[];
  replies: Reply[];
}

export interface ReportPublic {
  code: string;
  category: string;
  label: string;
  severity: string;
  status: string;
  unit: string | null;
  created_at: string;
  hist: HistoryEntry[];
  replies: Reply[];
  loc_note: string | null;
  text: string | null;
  node: string | null;
  full: boolean;
}

export interface NearbyFacility {
  name: string;
  type: string;
  node: string;
  distance_km: number;
  eta_min: number;
  helpline: string;
  points: number[][];
}

export type UnitSvc = "ambulance" | "fire" | "police" | "mech";

export interface Unit {
  id: string;
  svc: UnitSvc;
  facility: string;
  node: string;
  stat: string;
  tags: string;
  active: boolean;
  sample: boolean;
}

export interface AuditEntry {
  id: string;
  n: number;
  ts: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  reason: string | null;
  prev: string | null;
  next: string | null;
  sample: boolean;
}

export interface SessionUser {
  id: string;
  type: "citizen" | "staff";
  name: string;
  role: string;
  ident: string;
}

export interface RouteResult {
  from_node: string;
  to_node: string;
  distance_km: number;
  eta_min: number;
  path: string[];
  points: number[][];
  settled: number;
  compute_ms: number;
}

export interface Facility {
  n: string;
  t: string;
  p: number[];
  at: string;
}

export interface GraphData {
  pxkm: number;
  nodes: Record<string, number[]>;
  edges: [number, number, number, number[][]][];
  facilities: Facility[];
  center_node: string;
  node_count: number;
  edge_count: number;
}

export interface QueueResponse {
  items: Report[];
  total: number;
}

export interface Analytics {
  total: number;
  active: number;
  resolved: number;
  by_status: Record<string, number>;
  by_severity: Record<string, number>;
  by_category: Record<string, number>;
  avg_ack_min: number | null;
  units_available: number;
  units_total: number;
}

export interface UserAdminView {
  id: string;
  type: string;
  name: string;
  role: string;
  ident: string;
  disabled: boolean;
  created_at: string;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  medical: "Medical",
  accident: "Road accident",
  fire: "Fire",
  violence: "Violence / threat",
  theft: "Crime / theft",
  flood: "Flood / disaster",
  ev: "Vehicle breakdown",
  other: "Other",
};

export const SEVERITIES: Severity[] = ["Critical", "High", "Medium", "Low"];

export const ACTIVE_STATUSES = ["Reported", "Acknowledged", "Under review", "Assigned", "En route", "On scene"];
