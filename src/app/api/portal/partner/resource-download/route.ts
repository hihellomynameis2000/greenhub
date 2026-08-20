import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  PortalApiError,
  portalErrorResponse,
  requirePortalContext,
  requiredString,
  supabaseRest,
} from "@/lib/portal/server";
import { agentCanViewPlatformFolder } from "@/lib/portal/partner";
import type { PlatformResource } from "@/lib/portal/types";

function supabaseServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new PortalApiError("Portal storage is not configured.", 500);
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  });
}

export async function GET(request: NextRequest) {
  try {
    const context = await requirePortalContext(request);
    const id = requiredString(request.nextUrl.searchParams.get("id"), "Resource ID");
    const resources = await supabaseRest<PlatformResource[]>("platform_resources", {
      query: new URLSearchParams({
        select: "*",
        id: `eq.${id}`,
        is_active: "eq.true",
        limit: "1",
      }),
    });
    const resource = resources[0];

    if (!resource) {
      return NextResponse.json({ error: "Resource not found." }, { status: 404 });
    }

    if (context.profile.role === "agent" && !(await agentCanViewPlatformFolder(context, resource.folder_id))) {
      return NextResponse.json({ error: "You do not have access to this resource." }, { status: 403 });
    }

    if (resource.external_url) {
      return NextResponse.json({ url: resource.external_url });
    }

    if (!resource.storage_bucket || !resource.storage_path) {
      return NextResponse.json({ error: "This resource does not have a file attached yet." }, { status: 404 });
    }

    const { data, error } = await supabaseServiceClient()
      .storage
      .from(resource.storage_bucket)
      .createSignedUrl(resource.storage_path, 60 * 10);

    if (error || !data?.signedUrl) {
      console.error("Platform resource signed URL failed", error);
      return NextResponse.json({ error: "The resource file could not be opened." }, { status: 500 });
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
