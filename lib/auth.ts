export async function getTenantIdFromSession(): Promise<string> {
  const tenantId = process.env.TENANT_ID;
  if (!tenantId) {
    throw new Error("Missing tenant_id in session");
  }
  return tenantId;
}
