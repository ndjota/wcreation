import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RoleGuard } from "@/components/shared/RoleGuard";
import { supabase } from "@/lib/supabase";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authed/users")({
  component: UsersPage,
});

function UsersPage() {
  const { auth } = useAuth();
  const q = useQuery({
    queryKey: ["users-tenant", auth.profile?.tenant_id],
    queryFn: async () => {
      if (!auth.profile?.tenant_id) return [];
      const { data, error } = await supabase
        .schema("wcreation")
        .from("users")
        .select("id, email, nombre, role_code, activo")
        .eq("tenant_id", auth.profile.tenant_id);
      if (error) throw error;
      return data;
    },
    enabled: Boolean(auth.profile?.tenant_id) && auth.profile?.role_code === "owner_admin",
  });

  return (
    <RoleGuard allow={["owner_admin", "superadmin"]}>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Usuarios del tenant</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Equipo</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(q.data ?? []).map((u: { id: string; email: string; nombre: string; role_code: string }) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.nombre}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.role_code}</TableCell>
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
