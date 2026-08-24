import "server-only";

import type { Session } from "next-auth";
import { sql } from "@/lib/dbconnect";

export type AdminActivityLogInput = {
  action: string;
  entityType?: string | null;
  entityId?: string | number | null;
  success?: boolean;
  errorMessage?: string | null;
  metadata?: unknown;
  requestPath?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

function safeString(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v);
  return s.length > 0 ? s : null;
}

function resolveRequestInfo(req: Request | undefined): { ip: string | null; userAgent: string | null; path: string | null } {
  if (!req) return { ip: null, userAgent: null, path: null };
  const ip = safeString((req as unknown as { ip?: string }).ip) ?? safeString(req.headers.get("x-forwarded-for"));
  const userAgent = safeString(req.headers.get("user-agent"));
  let path: string | null = null;
  try {
    path = safeString(new URL(req.url).pathname);
  } catch {
    path = null;
  }
  return { ip, userAgent, path };
}

export async function logAdminAction(params: {
  session: Session | null;
  req?: Request;
  input: AdminActivityLogInput;
}): Promise<void> {
  const { session, req, input } = params;
  try {
    const actorUserIdRaw = (session?.user as { userId?: number | string } | undefined)?.userId;
    const actorUserId = actorUserIdRaw === undefined || actorUserIdRaw === null ? null : Number(actorUserIdRaw);

    const actorEmail = safeString((session?.user as { email?: string | null } | undefined)?.email);
    const actorType = safeString((session?.user as { type?: string | null } | undefined)?.type);

    const reqInfo = resolveRequestInfo(req);

    const success = input.success ?? true;
    const entityId = input.entityId === undefined || input.entityId === null ? null : String(input.entityId);

    const metadataJson = input.metadata === undefined ? null : (input.metadata as any);

    await sql/* sql */`
      INSERT INTO public.admin_activity_logs (
        actor_user_id,
        actor_email,
        actor_type,
        action,
        entity_type,
        entity_id,
        success,
        error_message,
        ip,
        user_agent,
        request_path,
        metadata
      ) VALUES (
        ${Number.isFinite(actorUserId as number) ? actorUserId : null},
        ${actorEmail},
        ${actorType},
        ${String(input.action)},
        ${input.entityType ?? null},
        ${entityId},
        ${Boolean(success)},
        ${input.errorMessage ?? null},
        ${input.ip ?? reqInfo.ip},
        ${input.userAgent ?? reqInfo.userAgent},
        ${input.requestPath ?? reqInfo.path},
        ${metadataJson}
      )
    `;
  } catch (logErr) {
    console.error("[adminActivityLog] Failed to log action:", String(input.action), logErr);
  }
}
