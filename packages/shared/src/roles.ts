/** Códigos de rol persistidos en Supabase (`wcreation.roles`). */
export const ROLE_CODES = [
  "superadmin",
  "owner_admin",
  "responsable",
  "public_viewer",
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

/** Jerarquía numérica: mayor = más privilegios operativos. */
export const ROLE_HIERARCHY: Record<RoleCode, number> = {
  superadmin: 100,
  owner_admin: 80,
  responsable: 50,
  public_viewer: 10,
} as const;

export type Permission =
  | "tenants.manage"
  | "devices.manage"
  | "devices.view"
  | "thresholds.manage"
  | "users.manage"
  | "public_qr.manage";

/** Matriz declarativa de permisos por rol (la RLS en Supabase refina el acceso a filas). */
export const ROLE_PERMISSIONS: Record<RoleCode, readonly Permission[]> = {
  superadmin: [
    "tenants.manage",
    "devices.manage",
    "devices.view",
    "thresholds.manage",
    "users.manage",
    "public_qr.manage",
  ],
  owner_admin: [
    "devices.manage",
    "devices.view",
    "thresholds.manage",
    "users.manage",
    "public_qr.manage",
  ],
  /** Umbrales: el API exige además `user_device_access.permiso = configurar` y `modificable_por_responsable`. */
  responsable: ["devices.view"],
  public_viewer: ["devices.view"],
} as const;

export function roleHasPermission(role: RoleCode, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function isRoleAtLeast(role: RoleCode, minimum: RoleCode): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimum];
}
