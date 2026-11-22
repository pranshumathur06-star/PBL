// All frontend requests go through the backend API.
// In local development, Vite forwards /api requests to localhost:8001.

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(//$/, "");

export class ApiError extends Error {
status: number;
body: unknown;

constructor(status: number, body: unknown, message: string) {
super(message);
this.name = "ApiError";
this.status = status;
this.body = body;
}
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
const route = path.startsWith("/") ? path : /${path};

const response = await fetch(${API_BASE}${route}, {
...options,
credentials: "include",
headers: {
...(options.body ? { "Content-Type": "application/json" } : {}),
...options.headers,
},
});

const contentType = response.headers.get("content-type") || "";
let body: unknown = null;

if (response.status !== 204) {
if (contentType.includes("application/json")) {
body = await response.json().catch(() => null);
} else {
body = await response.text().catch(() => "");
}
}

if (!response.ok) {
let message = response.statusText || "Request failed";

if (body && typeof body === "object" && "detail" in body) {
  const detail = (body as { detail: unknown }).detail;
  if (typeof detail === "string") message = detail;
} else if (typeof body === "string" && body) {
  message = body;
}

throw new ApiError(response.status, body, message);

}

return body as T;
}

export function apiGet<T>(path: string): Promise<T> {
return request<T>(path, { method: "GET" });
}

export function apiPost<T>(path: string, data: unknown = {}): Promise<T> {
return request<T>(path, {
method: "POST",
body: JSON.stringify(data),
});
}
