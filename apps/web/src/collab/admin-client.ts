import { z } from 'zod';
import type { ControlPlaneClient } from '@re-shell/contracts';

const roleSchema = z.enum(['viewer', 'operator', 'admin']);
const memberSchema = z.object({ tenantId: z.string(), userId: z.string(), role: roleSchema });
const policySchema = z.object({
  tenantId: z.string(), policyVersion: z.number(), policyPack: z.string().nullable(),
  allowedCommandIds: z.array(z.string()),
  workspaces: z.array(z.object({ id: z.string(), allowedCommandIds: z.array(z.string()), effectiveCommandIds: z.array(z.string()) })),
});
const auditSchema = z.object({
  entries: z.array(z.object({
    id: z.number(), ts: z.number(), userId: z.string().nullable(), action: z.string(),
    decision: z.enum(['allow', 'deny']), code: z.string().nullable(),
  })),
  nextBeforeId: z.number().nullable(),
});
export type Member = z.infer<typeof memberSchema>;
export type TeamPolicy = z.infer<typeof policySchema>;
export type AuditPage = z.infer<typeof auditSchema>;
export type Role = Member['role'];
const tenantPath = (tenantId: string): string => `/tenants/${encodeURIComponent(tenantId)}`;

/** Uses the same authenticated envelope client as collaboration, with validated admin read models. */
export class AdministrationClient {
  constructor(private readonly client: ControlPlaneClient) {}
  async members(tenantId: string, signal?: AbortSignal): Promise<Member[]> {
    return z.object({ members: z.array(memberSchema) }).parse(
      await this.client.call('GET', `${tenantPath(tenantId)}/members`, undefined, signal)
    ).members;
  }
  async setMember(tenantId: string, userId: string, role: Role): Promise<void> {
    await this.client.call('PUT', `${tenantPath(tenantId)}/members/${encodeURIComponent(userId)}`, { role });
  }
  async removeMember(tenantId: string, userId: string): Promise<void> {
    await this.client.call('DELETE', `${tenantPath(tenantId)}/members/${encodeURIComponent(userId)}`);
  }
  async policy(tenantId: string, signal?: AbortSignal): Promise<TeamPolicy> {
    return z.object({ policy: policySchema }).parse(
      await this.client.call('GET', `${tenantPath(tenantId)}/policy`, undefined, signal)
    ).policy;
  }
  async updatePolicy(tenantId: string, input: { allowedCommandIds: string[]; policyPack: string | null }): Promise<void> {
    await this.client.call('PUT', `${tenantPath(tenantId)}/policy`, input);
  }
  async audit(tenantId: string, beforeId?: number, signal?: AbortSignal): Promise<AuditPage> {
    const query = new URLSearchParams({ limit: '50', ...(beforeId !== undefined ? { beforeId: String(beforeId) } : {}) });
    return auditSchema.parse(await this.client.call('GET', `${tenantPath(tenantId)}/audit?${query}`, undefined, signal));
  }
  async createTenant(input: { id: string; name: string; allowedCommandIds: string[] }): Promise<void> {
    await this.client.call('POST', '/tenants', input);
  }
}
