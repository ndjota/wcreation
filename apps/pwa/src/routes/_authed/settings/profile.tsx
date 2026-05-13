import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/settings/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { auth } = useAuth();
  return (
    <div className="max-w-lg space-y-4">
      <h2 className="text-lg font-semibold">Perfil</h2>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Datos de cuenta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 font-mono text-sm">
          <p>
            <span className="text-slate-500">Nombre</span> {auth.profile?.nombre}
          </p>
          <p>
            <span className="text-slate-500">Email</span> {auth.profile?.email}
          </p>
          <p>
            <span className="text-slate-500">Rol</span> {auth.profile?.role_code}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
