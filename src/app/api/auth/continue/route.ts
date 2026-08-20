import { NextRequest, NextResponse } from "next/server";
import { verifySignedPortalAuthLink } from "@/lib/portal/signedAuthLink";
import { portalErrorResponse } from "@/lib/portal/server";

export async function GET(request: NextRequest) {
  try {
    const target = verifySignedPortalAuthLink(request.nextUrl.searchParams.get("state"));
    return NextResponse.redirect(target, 302);
  } catch (error) {
    return portalErrorResponse(error);
  }
}

