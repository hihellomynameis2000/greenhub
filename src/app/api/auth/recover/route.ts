import { NextRequest, NextResponse } from "next/server";
import { portalAppUrl, resendConfig, sendPortalAccessEmail } from "@/lib/portal/resend";
import { PortalApiError, supabaseAuthAdmin, supabaseRest } from "@/lib/portal/server";
import type { AgentProfile } from "@/lib/portal/types";

type RecoveryLinkResponse = {
  action_link?: string;
  properties?: {
    action_link?: string;
  };
};

const successResponse = { success: true };

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email) return NextResponse.json(successResponse);

  try {
    resendConfig();
    const profiles = await supabaseRest<Pick<AgentProfile, "email" | "name">[]>(
      "agent_profiles",
      {
        query: new URLSearchParams({
          select: "email,name",
          email: `eq.${email}`,
          limit: "1",
        }),
      }
    );
    const profile = profiles[0];

    if (!profile) return NextResponse.json(successResponse);

    const recovery = await supabaseAuthAdmin<RecoveryLinkResponse>("admin/generate_link", {
      type: "recovery",
      email: profile.email,
      redirect_to: `${portalAppUrl()}/set-password`,
    });
    const accessUrl = recovery.action_link ?? recovery.properties?.action_link;

    if (!accessUrl) {
      throw new Error("Supabase did not return a password recovery link.");
    }

    await sendPortalAccessEmail({
      accessUrl,
      name: profile.name,
      to: profile.email,
      type: "recovery",
    });
  } catch (error) {
    console.error("Password recovery email failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof PortalApiError
            ? error.message
            : "Password recovery is temporarily unavailable. Please contact GreenHub support.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json(successResponse);
}
