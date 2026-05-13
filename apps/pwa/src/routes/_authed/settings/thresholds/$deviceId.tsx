import { ThresholdsForm } from "@/components/devices/ThresholdsForm";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authed/settings/thresholds/$deviceId")({
  component: ThresholdsSettingsPage,
});

function ThresholdsSettingsPage() {
  const { deviceId } = Route.useParams();
  const { accessToken, auth } = useAuth();

  const accessPerm = useQuery({
    queryKey: ["uda-th", deviceId, auth.profile?.id],
    queryFn: async () => {
      if (!auth.profile?.id || !deviceId || auth.profile.role_code !== "responsable") return "owner" as const;
      const { data } = await supabase
        .schema("wcreation")
        .from("user_device_access")
        .select("permiso")
        .eq("user_id", auth.profile.id)
        .eq("device_id", deviceId)
        .maybeSingle();
      return (data?.permiso as "ver" | "configurar" | undefined) ?? null;
    },
    enabled: Boolean(deviceId && auth.profile?.id),
  });

  const q = useQuery({
    queryKey: ["device", deviceId],
    queryFn: async () => {
      if (!accessToken) throw new Error("no token");
      return api.device(accessToken, deviceId);
    },
    enabled: Boolean(accessToken && deviceId),
  });
  const d = q.data;
  const canEdit =
    auth.profile?.role_code === "superadmin" ||
    auth.profile?.role_code === "owner_admin" ||
    (auth.profile?.role_code === "responsable" &&
      accessPerm.data === "configurar" &&
      Boolean(d?.device_thresholds?.modificable_por_responsable));

  if (q.isLoading) return <p className="text-sm text-slate-500">Cargando…</p>;
  if (!d) return <p className="text-sm text-red-600">No encontrado</p>;
  return (
    <div className="max-w-3xl space-y-4">
      <h2 className="text-lg font-semibold">Umbrales · {d.nombre}</h2>
      <ThresholdsForm deviceId={deviceId} initial={d.device_thresholds} readOnly={!canEdit} />
    </div>
  );
}
