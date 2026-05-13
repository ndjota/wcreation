import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleGuard } from "@/components/shared/RoleGuard";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authed/settings/tenant")({
  component: TenantSettingsPage,
});

function TenantSettingsPage() {
  const { auth } = useAuth();
  const q = useQuery({
    queryKey: ["tenant-me", auth.profile?.tenant_id],
    queryFn: async () => {
      if (!auth.profile?.tenant_id) return null;
      const { data, error } = await supabase
        .schema("wcreation")
        .from("tenants")
        .select("id, slug, razon_social, cuit")
        .eq("id", auth.profile.tenant_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(auth.profile?.tenant_id),
  });

  return (
    <RoleGuard allow={["owner_admin", "superadmin"]}>
      <div className="max-w-xl space-y-4">
        <h2 className="text-lg font-semibold">Tenant</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Datos comerciales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 font-mono text-sm">
            {q.data ? (
              <>
                <p>Slug: {String(q.data.slug)}</p>
                <p>Razón social: {String(q.data.razon_social)}</p>
                <p>CUIT: {q.data.cuit ? String(q.data.cuit) : "—"}</p>
              </>
            ) : (
              <p className="text-slate-500">Sin tenant asignado.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}
