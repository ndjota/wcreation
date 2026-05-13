import { api, type ReadingRow } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export function useDeviceReadings(
  deviceId: string | undefined,
  range: { from: string; to: string },
  interval: string,
) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ["readings", deviceId, range.from, range.to, interval],
    queryFn: async (): Promise<{ items: ReadingRow[] }> => {
      if (!accessToken || !deviceId) return { items: [] };
      return api.readings(accessToken, deviceId, { from: range.from, to: range.to, interval });
    },
    enabled: Boolean(accessToken && deviceId),
    placeholderData: keepPreviousData,
  });
}
