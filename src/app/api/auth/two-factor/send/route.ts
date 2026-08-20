import { NextRequest, NextResponse } from "next/server";
import { sendPortalLoginCodeEmail } from "@/lib/portal/resend";
import {
  PortalApiError,
  portalErrorResponse,
  requirePortalContext,
  supabaseRest,
} from "@/lib/portal/server";
import { generateLoginCode, hashLoginCode } from "@/lib/portal/twoFactor";

type LoginChallenge = {
  consumed_at: string | null;
  created_at: string;
  id: string;
};

const CODE_TTL_SECONDS = 10 * 60;
const RESEND_COOLDOWN_SECONDS = 45;

export async function POST(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, undefined, { skipTwoFactor: true });
    const now = new Date();
    const recentChallenges = await supabaseRest<LoginChallenge[]>("portal_login_challenges", {
      query: new URLSearchParams({
        select: "id,created_at,consumed_at",
        user_id: `eq.${context.user.id}`,
        order: "created_at.desc",
        limit: "1",
      }),
    });
    const latestChallenge = recentChallenges[0];

    if (
      latestChallenge &&
      !latestChallenge.consumed_at &&
      now.getTime() - new Date(latestChallenge.created_at).getTime() <
        RESEND_COOLDOWN_SECONDS * 1000
    ) {
      throw new PortalApiError("Wait a moment before requesting another verification code.", 429);
    }

    await supabaseRest("portal_login_challenges", {
      method: "PATCH",
      prefer: "return=minimal",
      query: new URLSearchParams({
        user_id: `eq.${context.user.id}`,
        consumed_at: "is.null",
      }),
      body: { consumed_at: now.toISOString() },
    });

    const code = generateLoginCode();
    await supabaseRest("portal_login_challenges", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        agent_profile_id: context.profile.id,
        code_hash: hashLoginCode(code, context.user.id),
        email: context.profile.email,
        expires_at: new Date(now.getTime() + CODE_TTL_SECONDS * 1000).toISOString(),
        user_id: context.user.id,
      },
    });

    await sendPortalLoginCodeEmail({
      code,
      name: context.profile.name,
      role: context.profile.role,
      to: context.profile.email,
    });

    return NextResponse.json({
      email: context.profile.email,
      expiresInSeconds: CODE_TTL_SECONDS,
      role: context.profile.role,
    });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

