import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RoleGuard } from "@/components/shared/RoleGuard";
import { supabase } from "@/lib/supabase";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authed/groups")({
  component: GroupsPage,
});

function GroupsPage() {
  const { auth } = useAuth();
  const q = useQuery({
    queryKey: ["groups", auth.profile?.tenant_id, auth.profile?.role_code],
    queryFn: async () => {
      if (auth.profile?.role_code === "superadmin") {
        const { data, error } = await supabase
          .schema("wcreation")
          .from("groups")
          .select("id, nombre, responsable_user_id, tenant_id");
        if (error) throw error;
        return data;
      }
      if (!auth.profile?.tenant_id) return [];
      const { data, error } = await supabase
        .schema("wcreation")
        .from("groups")
        .select("id, nombre, responsable_user_id, tenant_id")
        .eq("tenant_id", auth.profile.tenant_id);
      if (error) throw error;
      return data;
    },
    enabled:
      Boolean(auth.profile) &&
      (auth.profile?.role_code === "superadmin" || Boolean(auth.profile?.tenant_id)),
  });

  return (
    <RoleGuard allow={["owner_admin", "superadmin"]}>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Grupos</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Locales</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(q.data ?? []).map((g: { id: string; nombre: string }) => (
                  <TableRow key={g.id}>
                    <TableCell>{g.nombre}</TableCell>
                    <TableCell className="text-slate-500">{g.id}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}
