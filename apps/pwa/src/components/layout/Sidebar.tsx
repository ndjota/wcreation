import { RoleGuard } from "@/components/shared/RoleGuard";
import { cn } from "@/lib/cn";
import { useI18n } from "@/hooks/useI18n";
import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Cpu,
  Gauge,
  LayoutDashboard,
  ListTree,
  Settings2,
  Shield,
  Users,
} from "lucide-react";

function NavLink({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === to || pathname.startsWith(`${to}/`);
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white",
        active && "bg-slate-800 text-white",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const { t } = useI18n();
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-300">
      <div className="flex h-14 items-center border-b border-slate-800 px-4">
        <Link to="/dashboard" className="text-sm font-bold tracking-tight text-white">
          WCreation
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        <NavLink to="/dashboard" label={t("nav.dashboard")} icon={LayoutDashboard} />
        <NavLink to="/devices" label={t("nav.devices")} icon={Cpu} />
        <NavLink to="/events" label={t("nav.events")} icon={ListTree} />
        <RoleGuard allow={["owner_admin", "superadmin"]}>
          <NavLink to="/groups" label={t("nav.groups")} icon={Building2} />
        </RoleGuard>
        <RoleGuard allow={["owner_admin", "superadmin"]}>
          <NavLink to="/users" label={t("nav.users")} icon={Users} />
        </RoleGuard>
        <NavLink to="/settings/profile" label={t("nav.settings")} icon={Settings2} />
        <RoleGuard allow={["superadmin"]}>
          <div className="my-2 border-t border-slate-800 pt-2">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("nav.admin")}</p>
            <NavLink to="/admin/tenants" label={t("nav.tenants")} icon={Shield} />
            <NavLink to="/admin/devices-global" label={t("nav.devicesGlobal")} icon={Gauge} />
          </div>
        </RoleGuard>
      </nav>
    </aside>
  );
}
