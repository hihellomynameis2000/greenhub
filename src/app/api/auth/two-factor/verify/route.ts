import { NextRequest, NextResponse } from "next/server";
import {
  type PortalContext,
  PortalApiError,
  portalErrorResponse,
  requirePortalContext,
  requiredString,
  supabaseRest,
  writeAuditLog,
} from "@/lib/portal/server";
import { hashLoginCode, setTwoFactorCookie } from "@/lib/portal/twoFactor";

type LoginChallenge = {
  attempts: number;
  code_hash: string;
  consumed_at?: string | null;
  id: string;
};

const MAX_ATTEMPTS = 5;
const IDEMPOTENT_VERIFY_WINDOW_SECONDS = 60;

function verifiedResponse(context: PortalContext) {
  const response = NextResponse.json({
    role: context.profile.role,
    redirectTo: context.profile.role === "admin" ? "/portal/admin" : "/portal/agent",
  });
  setTwoFactorCookie(response, context.user.id);
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, undefined, { skipTwoFactor: true });
    const body = (await request.json()) as Record<string, unknown>;
    const code = requiredString(body.code, "Verification code").replace(/\s+/g, "");

    if (!/^\d{6}$/.test(code)) {
      throw new PortalApiError("Enter the 6-digit verification code.", 400);
    }

    const challenges = await supabaseRest<LoginChallenge[]>("portal_login_challenges", {
      query: new URLSearchParams({
        select: "id,code_hash,attempts",
        user_id: `eq.${context.user.id}`,
        consumed_at: "is.null",
        expires_at: `gt.${new Date().toISOString()}`,
        order: "created_at.desc",
        limit: "1",
      }),
    });
    const challenge = challenges[0];

    if (!challenge) {
      const recentVerifiedChallenges = await supabaseRest<LoginChallenge[]>("portal_login_challenges", {
        query: new URLSearchParams({
          select: "id,code_hash,attempts,consumed_at",
          user_id: `eq.${context.user.id}`,
          consumed_at: "not.is.null",
          created_at: `gte.${new Date(
            Date.now() - IDEMPOTENT_VERIFY_WINDOW_SECONDS * 1000
          ).toISOString()}`,
          order: "created_at.desc",
          limit: "1",
        }),
      });
      const recentVerifiedChallenge = recentVerifiedChallenges[0];

      if (recentVerifiedChallenge?.code_hash === hashLoginCode(code, context.user.id)) {
        return verifiedResponse(context);
      }

      throw new PortalApiError("The verification code is invalid or has expired.", 400);
    }

    if (challenge.attempts >= MAX_ATTEMPTS) {
      await supabaseRest("portal_login_challenges", {
        method: "PATCH",
        prefer: "return=minimal",
        query: new URLSearchParams({ id: `eq.${challenge.id}` }),
        body: { consumed_at: new Date().toISOString() },
      });
      throw new PortalApiError("Too many verification attempts. Request a new code.", 429);
    }

    if (challenge.code_hash !== hashLoginCode(code, context.user.id)) {
      const attempts = challenge.attempts + 1;
      await supabaseRest("portal_login_challenges", {
        method: "PATCH",
        prefer: "return=minimal",
        query: new URLSearchParams({ id: `eq.${challenge.id}` }),
        body: {
          attempts,
          ...(attempts >= MAX_ATTEMPTS ? { consumed_at: new Date().toISOString() } : {}),
        },
      });
      throw new PortalApiError("The verification code is incorrect.", 400);
    }

    await supabaseRest("portal_login_challenges", {
      method: "PATCH",
      prefer: "return=minimal",
      query: new URLSearchParams({ id: `eq.${challenge.id}` }),
      body: { consumed_at: new Date().toISOString() },
    });

    await writeAuditLog(context, "portal.two_factor_verified", "agent_profiles", context.profile.id, {
      role: context.profile.role,
    });

    return verifiedResponse(context);
  } catch (error) {
    return portalErrorResponse(error);
  }
}
