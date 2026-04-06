/**
 * RBAC roles — SRS F12 / Database Design Document (`user_role` ENUM).
 * Customers have no account; these apply only to authenticated staff users.
 */
export const USER_ROLES = ["admin", "staff", "kitchen"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    (USER_ROLES as readonly string[]).includes(value)
  );
}

/** Route prefix → role allowed to access that area (strict 1:1). */
export function roleForProtectedPath(pathname: string): UserRole | null {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/staff" || pathname.startsWith("/staff/")) return "staff";
  if (pathname === "/kitchen" || pathname.startsWith("/kitchen/"))
    return "kitchen";
  return null;
}
