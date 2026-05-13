import { api, type EventRow } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

export function useDeviceEvents(
  deviceId: string | undefined,
  filters: { tipo?: string; severidad?: string; from?: string; to?: string },
) {
  const { accessToken } = useAuth();
  return useInfiniteQuery({
    queryKey: ["events", deviceId, filters],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      if (!accessToken || !deviceId) return { items: [] as EventRow[], next_cursor: null as string | null };
      const q: { limit: number; cursor?: string; tipo?: string; severidad?: string; from?: string; to?: string } = {
        limit: 50,
      };
      if (pageParam) q.cursor = pageParam;
      if (filters.tipo) q.tipo = filters.tipo;
      if (filters.severidad) q.severidad = filters.severidad;
      if (filters.from) q.from = filters.from;
      if (filters.to) q.to = filters.to;
      return api.events(accessToken, deviceId, q);
    },
    getNextPageParam: (last) => last.next_cursor,
    enabled: Boolean(accessToken && deviceId),
    placeholderData: keepPreviousData,
  });
}
