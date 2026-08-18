import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  PortalApiError,
  portalErrorResponse,
  requirePortalContext,
  requiredString,
  supabaseRest,
  writeAuditLog,
} from "@/lib/portal/server";
import type { PlatformResource } from "@/lib/portal/types";

const BUCKET = "platform-resources";
const MAX_FILE_BYTES = 25 * 1024 * 1024;
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

export async function POST(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required." }, { status: 400 });
    }

    if (!hasAllowedExtension(file.name)) {
      return NextResponse.json({ error: "Unsupported platform resource file type." }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Platform resource file is too large." }, { status: 413 });
    }

    const platformId = requiredString(formData.get("platformId"), "Platform");
    const folderId = requiredString(formData.get("folderId"), "Folder");
    const title = requiredString(formData.get("title") || file.name, "Resource title");
    const description =
      typeof formData.get("description") === "string"
        ? String(formData.get("description")).trim() || null
        : null;
    const safeName = sanitizeFilename(file.name);
    const path = `${platformId}/${folderId}/${Date.now()}-${safeName}`;
    const supabase = supabaseServiceClient();

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError || !uploadData) {
      console.error("Platform resource upload failed", uploadError);
      return NextResponse.json({ error: "Platform resource upload failed." }, { status: 500 });
    }

    const resources = await supabaseRest<PlatformResource[]>("platform_resources", {
      method: "POST",
      prefer: "return=representation",
      body: {
        created_by: context.profile.id,
        description,
        file_name: file.name,
        file_size: file.size,
        folder_id: folderId,
        platform_id: platformId,
        resource_type: "document",
        storage_bucket: BUCKET,
        storage_path: uploadData.path,
        title,
        updated_by: context.profile.id,
      },
    });
    const resource = resources[0];

    await writeAuditLog(context, "platform_resource.uploaded", "platform_resources", resource.id, {
      fileName: file.name,
      folderId,
      platformId,
      size: file.size,
    });

    return NextResponse.json({ resource }, { status: 201 });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
