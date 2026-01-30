import "server-only";

import type { Session } from "next-auth";
import { sql } from "@/lib/dbconnect";

export type LoginLogInput = {
  actorType: string | null;
  actorUserId: number | null;
  actorEmail: string | null;
  identifier: string | null;
  success: boolean;
  errorMessage?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: unknown;
};

function safeString(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function resolveRequestInfo(req: Request | undefined): { ip: string | null; userAgent: string | null } {
  if (!req) return { ip: null, userAgent: null };
  const ip = safeString((req as unknown as { ip?: string }).ip) ?? safeString(req.headers.get("x-forwarded-for"));
  const userAgent = safeString(req.headers.get("user-agent"));
  return { ip, userAgent };
}

export async function logLoginEvent(params: { session: Session | null; req?: Request; input: LoginLogInput }): Promise<void> {
  try {
    const { req, input } = params;
    const reqInfo = resolveRequestInfo(req);

    await sql/* sql */`
      INSERT INTO public.login_logs (
        actor_type,
        actor_user_id,
        actor_email,
        identifier,
        success,
        error_message,
        ip,
        user_agent,
        metadata
      ) VALUES (
        ${input.actorType},
        ${input.actorUserId},
        ${input.actorEmail},
        ${input.identifier},
        ${Boolean(input.success)},
        ${input.errorMessage ?? null},
        ${input.ip ?? reqInfo.ip},
        ${input.userAgent ?? reqInfo.userAgent},
        ${input.metadata === undefined ? null : (input.metadata as any)}
      )
    `;
  } catch {
  }
}
