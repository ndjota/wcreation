import type { RoleCode } from "@wcreation/shared";
import { useRole } from "@/lib/auth";
import type { ReactNode } from "react";

export function RoleGuard({
  allow,
  children,
  fallback,
}: {
  allow: readonly RoleCode[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const role = useRole();
  if (!role || !allow.includes(role)) {
    return fallback ?? null;
  }
  return <>{children}</>;
}
