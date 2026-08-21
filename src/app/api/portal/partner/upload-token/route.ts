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

const BUCKET = "platform-resources";
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  ".csv",
  ".doc",
  ".docx",
  ".jpg",
  ".jpeg",
  ".pdf",
  ".png",
  ".txt",
  ".xls",
  ".xlsx",
  ".zip",
]);

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

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function hasAllowedExtension(name: string) {
  const lower = name.toLowerCase();
  for (const ext of ALLOWED_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

async function assertFolderBelongsToPlatform(platformId: string, folderId: string) {
  const folders = await supabaseRest<{ id: string; platform_id: string }[]>(
    "platform_resource_folders",
    {
      query: new URLSearchParams({
        select: "id,platform_id",
        id: `eq.${folderId}`,
        is_active: "eq.true",
        limit: "1",
      }),
    }
  );
  const folder = folders[0];

  if (!folder || folder.platform_id !== platformId) {
    throw new PortalApiError("The selected folder does not belong to this platform.", 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePortalContext(request, "admin");
    const body = (await request.json()) as Record<string, unknown>;
    const platformId = requiredString(body.platformId, "Platform");
    const folderId = requiredString(body.folderId, "Folder");
    const fileName = requiredString(body.fileName, "File name");
    const fileSize =
      typeof body.fileSize === "number" && Number.isFinite(body.fileSize)
        ? Math.trunc(body.fileSize)
        : 0;

    if (!hasAllowedExtension(fileName)) {
      return NextResponse.json({ error: "Unsupported platform resource file type." }, { status: 400 });
    }

    if (fileSize <= 0 || fileSize > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Platform resource file is too large." }, { status: 413 });
    }

    await assertFolderBelongsToPlatform(platformId, folderId);

    const safeName = sanitizeFilename(fileName);
    const path = `${platformId}/${folderId}/${Date.now()}-${safeName}`;
    const supabase = supabaseServiceClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path, { upsert: false });

    if (error || !data) {
      console.error("Platform resource signed upload URL failed", error);
      return NextResponse.json(
        {
          error:
            error?.message?.toLowerCase().includes("bucket")
              ? "Platform resource storage is not ready."
              : "The upload could not be prepared.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      bucket: BUCKET,
      path: data.path,
      signedUrl: data.signedUrl,
      token: data.token,
    });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
