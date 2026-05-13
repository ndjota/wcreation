import type { RoleCode } from "@wcreation/shared";
import { isRoleAtLeast, roleHasPermission, type Permission } from "@wcreation/shared";

export function canSeeDevice(role: RoleCode): boolean {
  return roleHasPermission(role, "devices.view");
}

export function canEditThresholds(role: RoleCode): boolean {
  return roleHasPermission(role, "thresholds.manage");
}

export function canManageUsers(role: RoleCode): boolean {
  return roleHasPermission(role, "users.manage");
}

export function canManageGroups(role: RoleCode): boolean {
  return isRoleAtLeast(role, "owner_admin");
}

export function canAccessTenantSettings(role: RoleCode): boolean {
  return role === "owner_admin" || role === "superadmin";
}

export function canAccessAdmin(role: RoleCode): boolean {
  return role === "superadmin";
}

export function hasPermission(role: RoleCode, p: Permission): boolean {
  return roleHasPermission(role, p);
}
