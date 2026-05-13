import { DeviceAddForm } from "@/components/devices/DeviceAddForm";
import { DeviceGrid } from "@/components/devices/DeviceGrid";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/devices/")({
  component: DevicesIndexPage,
});

function DevicesIndexPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Dispositivos</h2>
      <DeviceAddForm />
      <DeviceGrid />
    </div>
  );
}
