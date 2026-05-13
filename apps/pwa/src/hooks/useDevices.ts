import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";

export function useDevices(query?: { group_id?: string; estado?: string; search?: string }) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ["devices", query],
    queryFn: async () => {
      if (!accessToken) return { items: [] };
      return api.devices(accessToken, query);
    },
    enabled: Boolean(accessToken),
    refetchInterval: 60_000,
  });
}
