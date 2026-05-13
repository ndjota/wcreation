import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleGuard } from "@/components/shared/RoleGuard";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/hooks/useI18n";
import { supabase } from "@/lib/supabase";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { toast } from "sonner";

const GROUP_NONE = "__none__";

export function DeviceAddForm() {
  const { accessToken, auth } = useAuth();
  const profile = auth.profile;
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [serial, setSerial] = React.useState("");
  const [nombre, setNombre] = React.useState("");
  const [groupId, setGroupId] = React.useState<string>(GROUP_NONE);
  const [tenantForSuper, setTenantForSuper] = React.useState<string | null>(null);

  const isSuper = profile?.role_code === "superadmin";

  const tenantsQ = useQuery({
    queryKey: ["tenants-picker"],
    queryFn: async () => {
      if (!accessToken) return [];
      const { items } = await api.tenants(accessToken);
      return items;
    },
    enabled: Boolean(accessToken) && isSuper,
  });

  React.useEffect(() => {
    const items = tenantsQ.data;
    if (!isSuper || !items?.length || tenantForSuper) return;
    const first = items[0];
    if (first) setTenantForSuper(first.id);
  }, [isSuper, tenantsQ.data, tenantForSuper]);

  const effectiveTenantId =
    profile?.role_code === "owner_admin" ? profile.tenant_id : tenantForSuper;

  const groupsQ = useQuery({
    queryKey: ["groups-picker", effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      const { data, error } = await supabase
        .schema("wcreation")
        .from("groups")
        .select("id, nombre")
        .eq("tenant_id", effectiveTenantId)
        .order("nombre");
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      return rows.map((row) => ({ id: String(row.id), nombre: String(row.nombre) }));
    },
    enabled: Boolean(accessToken) && Boolean(effectiveTenantId),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!accessToken) throw new Error("no token");
      const body: {
        serial_number: string;
        nombre: string;
        group_id?: string | null;
        tenant_id?: string;
      } = {
        serial_number: serial.trim(),
        nombre: nombre.trim(),
        group_id: groupId === GROUP_NONE ? null : groupId,
      };
      if (isSuper && tenantForSuper) {
        body.tenant_id = tenantForSuper;
      }
      return api.createDevice(accessToken, body);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast.success(t("addDeviceSuccess", { ns: "devices" }));
      setSerial("");
      setNombre("");
      setGroupId(GROUP_NONE);
      void navigate({ to: "/devices/$deviceId", params: { deviceId: data.id } });
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError && e.status === 409) {
        const body = e.body as Record<string, unknown> | undefined;
        const message = typeof body?.message === "string" ? body.message : t("addDeviceSerialTaken", { ns: "devices" });
        toast.error(message);
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    },
  });

  const disabledSubmit =
    !accessToken ||
    !serial.trim() ||
    !nombre.trim() ||
    (isSuper && !tenantForSuper) ||
    createMut.isPending;

  return (
    <RoleGuard allow={["owner_admin", "superadmin"]}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("addDeviceTitle", { ns: "devices" })}</CardTitle>
          <CardDescription className="text-xs text-slate-600 dark:text-slate-400">
            {t("addDeviceHintCerts", { ns: "devices" })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSuper ? (
            <div className="space-y-2">
              <Label htmlFor="wc-add-tenant">{t("addDeviceTenant", { ns: "devices" })}</Label>
              <Select
                value={tenantForSuper ?? ""}
                onValueChange={(v) => {
                  setTenantForSuper(v);
                  setGroupId(GROUP_NONE);
                }}
                disabled={!tenantsQ.data?.length}
              >
                <SelectTrigger id="wc-add-tenant">
                  <SelectValue placeholder="…" />
                </SelectTrigger>
                <SelectContent>
                  {(tenantsQ.data ?? []).map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.razon_social} ({row.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="wc-add-serial">{t("addDeviceSerial", { ns: "devices" })}</Label>
            <Input
              id="wc-add-serial"
              autoComplete="off"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="SN-MI-HELADERA-01"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wc-add-nombre">{t("addDeviceNombre", { ns: "devices" })}</Label>
            <Input
              id="wc-add-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={t("addDeviceNombrePh", { ns: "devices" })}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("addDeviceGroup", { ns: "devices" })}</Label>
            <Select value={groupId} onValueChange={setGroupId} disabled={!effectiveTenantId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GROUP_NONE}>{t("addDeviceGroupNone", { ns: "devices" })}</SelectItem>
                {(groupsQ.data ?? []).map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">{t("addDeviceHintResponsable", { ns: "devices" })}</p>

          <Button type="button" disabled={disabledSubmit} onClick={() => void createMut.mutateAsync()}>
            {t("addDeviceSubmit", { ns: "devices" })}
          </Button>
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
