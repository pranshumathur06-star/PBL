import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { SessionUser } from "@/types";

// Who am I? The backend answers from the httpOnly session cookie (or null).
export function useSession() {
  const q = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<SessionUser | null>("/auth/me"),
    staleTime: 60_000,
    retry: false,
  });
  return { user: q.data ?? null, isLoading: q.isLoading, refetch: q.refetch };
}
