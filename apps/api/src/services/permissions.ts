import type { RoleCode } from "@wcreation/shared";
import type { AuthUser } from "../plugins/auth.js";
import type { FastifyInstance } from "fastify";

export async function getVisibleDeviceIds(
  fastify: FastifyInstance,
  user: AuthUser,
): Promise<string[] | "all"> {
  if (user.roleCode === "superadmin") return "all";

  if (user.roleCode === "owner_admin") {
    if (!user.tenantId) return [];
    const { data, error } = await fastify.supabaseAdmin
      .schema("wcreation")
      .from("devices")
      .select("id")
      .eq("tenant_id", user.tenantId);
    if (error) throw error;
    return (data ?? []).map((r) => r.id as string);
  }

  if (user.roleCode === "responsable") {
    const { data, error } = await fastify.supabaseAdmin
      .schema("wcreation")
      .from("user_device_access")
      .select("device_id")
      .eq("user_id", user.id);
    if (error) throw error;
    return (data ?? []).map((r) => r.device_id as string);
  }

  return [];
}

export async function canViewDevice(fastify: FastifyInstance, user: AuthUser, deviceId: string): Promise<boolean> {
  const v = await getVisibleDeviceIds(fastify, user);
  if (v === "all") return true;
  return v.includes(deviceId);
}

export async function getDeviceAccessPermiso(
  fastify: FastifyInstance,
  userId: string,
  deviceId: string,
): Promise<"ver" | "configurar" | null> {
  const { data } = await fastify.supabaseAdmin
    .schema("wcreation")
    .from("user_device_access")
    .select("permiso")
    .eq("user_id", userId)
    .eq("device_id", deviceId)
    .maybeSingle();
  return (data?.permiso as "ver" | "configurar" | undefined) ?? null;
}

export async function canConfigureThresholds(
  fastify: FastifyInstance,
  user: AuthUser,
  deviceId: string,
  modificablePorResponsable: boolean,
): Promise<boolean> {
  if (user.roleCode === "superadmin") return true;
  if (user.roleCode === "owner_admin" && user.tenantId) {
    const { data } = await fastify.supabaseAdmin
      .schema("wcreation")
      .from("devices")
      .select("tenant_id")
      .eq("id", deviceId)
      .maybeSingle();
    return data?.tenant_id === user.tenantId;
  }
  if (user.roleCode === "responsable") {
    if (!modificablePorResponsable) return false;
    const p = await getDeviceAccessPermiso(fastify, user.id, deviceId);
    return p === "configurar";
  }
  return false;
}

export function isSuperadmin(user: AuthUser): boolean {
  return user.roleCode === "superadmin";
}

export async function canManageDeviceQr(fastify: FastifyInstance, user: AuthUser, deviceId: string): Promise<boolean> {
  if (user.roleCode === "superadmin") return true;
  if (user.roleCode !== "owner_admin" || !user.tenantId) return false;
  const { data } = await fastify.supabaseAdmin
    .schema("wcreation")
    .from("devices")
    .select("tenant_id")
    .eq("id", deviceId)
    .maybeSingle();
  return data?.tenant_id === user.tenantId;
}

export function roleCode(user: AuthUser): RoleCode {
  return user.roleCode;
}
