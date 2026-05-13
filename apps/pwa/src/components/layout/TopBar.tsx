import { LangSwitcher } from "@/components/shared/LangSwitcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/hooks/useI18n";
import { Link } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";

export function TopBar() {
  const { t } = useI18n();
  const { auth, signOut } = useAuth();
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950">
      <h1 className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        {t("nav.appTitle")}
      </h1>
      <div className="flex items-center gap-1">
        <LangSwitcher />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("auth:account")}>
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium text-slate-900 dark:text-slate-100">{auth.profile?.nombre}</p>
              <p className="truncate font-mono text-[10px] text-slate-500">{auth.profile?.email}</p>
              <p className="mt-1 font-mono text-[10px] uppercase text-slate-400">{auth.profile?.role_code}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings/profile">{t("nav.profile")}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void signOut().then(() => {
                  window.location.href = "/login";
                });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t("auth:logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
