import { queryClient } from "./queryClient";
import { apiPost } from "./api";

// Clear cached account data when starting a fresh session.
export function beginSession(): void {
  queryClient.clear();
}

// End the session and redirect the browser.
export async function endSession(redirectTo = "/"): Promise<void> {
  try {
    await apiPost<unknown>("/auth/logout");
  } catch {
    // Sign out locally even if the backend is unavailable.
  } finally {
    queryClient.clear();
    window.location.assign(redirectTo);
  }
}
