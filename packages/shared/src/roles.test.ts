import { describe, expect, it } from "vitest";
import { ROLE_HIERARCHY, roleHasPermission } from "./roles.js";

describe("roles", () => {
  it("superadmin outranks owner_admin", () => {
    expect(ROLE_HIERARCHY.superadmin).toBeGreaterThan(ROLE_HIERARCHY.owner_admin);
  });

  it("responsable can view devices when policy allows", () => {
    expect(roleHasPermission("responsable", "devices.view")).toBe(true);
  });
});
