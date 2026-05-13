import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RoleGuard } from "@/components/shared/RoleGuard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authed/admin/tenants")({
  component: AdminTenantsPage,
});

function AdminTenantsPage() {
  const { accessToken } = useAuth();
  const { locale } = useI18n();
  const q = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      if (!accessToken) throw new Error("no token");
      return api.tenants(accessToken);
    },
    enabled: Boolean(accessToken),
  });

  return (
    <RoleGuard allow={["superadmin"]}>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Tenants (admin)</h2>
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slug</TableHead>
                  <TableHead>Razón social</TableHead>
                  <TableHead>Alta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(q.data?.items ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.slug}</TableCell>
                    <TableCell>{row.razon_social}</TableCell>
                    <TableCell>{formatDate(row.created_at, locale)}</TableCell>
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
