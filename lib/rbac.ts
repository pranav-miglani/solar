export type AccountType = "SUPERADMIN" | "ORG" | "GOVT"

export interface Permission {
  resource: string
  action: "create" | "read" | "update" | "delete"
}

const ROLE_PERMISSIONS: Record<AccountType, Permission[]> = {
  SUPERADMIN: [
    // Full access to everything
    { resource: "accounts", action: "read" },
    { resource: "organizations", action: "create" },
    { resource: "organizations", action: "read" },
    { resource: "organizations", action: "update" },
    { resource: "organizations", action: "delete" },
    { resource: "vendors", action: "create" },
    { resource: "vendors", action: "read" },
    { resource: "vendors", action: "update" },
    { resource: "vendors", action: "delete" },
    { resource: "plants", action: "create" },
    { resource: "plants", action: "read" },
    { resource: "plants", action: "update" },
    { resource: "plants", action: "delete" },
    { resource: "work_orders", action: "create" },
    { resource: "work_orders", action: "read" },
    { resource: "work_orders", action: "update" },
    { resource: "work_orders", action: "delete" },
    { resource: "alerts", action: "read" },
    { resource: "alerts", action: "update" },
    { resource: "telemetry", action: "read" },
    { resource: "efficiency", action: "read" },
  ],
  GOVT: [
    // Read-only global access
    { resource: "organizations", action: "read" },
    { resource: "vendors", action: "read" },
    { resource: "plants", action: "read" },
    { resource: "work_orders", action: "read" },
    { resource: "alerts", action: "read" },
    { resource: "telemetry", action: "read" },
    { resource: "efficiency", action: "read" },
  ],
  ORG: [
    // Read-only access to own org data
    { resource: "organizations", action: "read" },
    { resource: "vendors", action: "read" },
    { resource: "plants", action: "read" },
    { resource: "work_orders", action: "read" },
    { resource: "alerts", action: "read" },
    { resource: "telemetry", action: "read" },
    { resource: "efficiency", action: "read" },
  ],
}

export function hasPermission(
  accountType: AccountType,
  resource: string,
  action: Permission["action"]
): boolean {
  const permissions = ROLE_PERMISSIONS[accountType] || []
  return permissions.some(
    (p) => p.resource === resource && p.action === action
  )
}

export function requirePermission(
  accountType: AccountType,
  resource: string,
  action: Permission["action"]
): void {
  if (!hasPermission(accountType, resource, action)) {
    throw new Error(
      `Account type ${accountType} does not have permission to ${action} ${resource}`
    )
  }
}

export function canCreate(accountType: AccountType, resource: string): boolean {
  return hasPermission(accountType, resource, "create")
}

export function canRead(accountType: AccountType, resource: string): boolean {
  return hasPermission(accountType, resource, "read")
}

export function canUpdate(accountType: AccountType, resource: string): boolean {
  return hasPermission(accountType, resource, "update")
}

export function canDelete(accountType: AccountType, resource: string): boolean {
  return hasPermission(accountType, resource, "delete")
}
