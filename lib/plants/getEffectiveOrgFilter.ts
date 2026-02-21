/**
 * Get the effective org filter for list/search APIs.
 * - ORG: always use session orgId (ignore request orgId).
 * - GOVT / SUPERADMIN / DEVELOPER: use request orgId if provided, else null (all orgs).
 */
export function getEffectiveOrgFilter(
  accountType: string,
  sessionOrgId: number | undefined | null,
  requestOrgId: number | string | undefined | null
): number | null {
  if (accountType === "ORG") {
    return sessionOrgId ?? null
  }
  if (requestOrgId === undefined || requestOrgId === null || requestOrgId === "") {
    return null
  }
  const parsed = typeof requestOrgId === "string" ? parseInt(requestOrgId, 10) : requestOrgId
  return Number.isNaN(parsed) ? null : parsed
}
