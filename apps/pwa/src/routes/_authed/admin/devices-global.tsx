import { DeviceGrid } from "@/components/devices/DeviceGrid";
import { RoleGuard } from "@/components/shared/RoleGuard";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/admin/devices-global")({
  component: AdminDevicesPage,
});

function AdminDevicesPage() {
  return (
    <RoleGuard allow={["superadmin"]}>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Dispositivos globales</h2>
        <DeviceGrid />
      </div>
    </RoleGuard>
  );
}
