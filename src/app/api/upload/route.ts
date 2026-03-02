import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png"]);

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase env vars");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey);
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

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!hasAllowedExtension(file.name)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    const supabase = getSupabaseClient();
    const safeName = sanitizeFilename(file.name);
    const path = `applications/${Date.now()}-${safeName}`;

    const { data: uploadData, error } = await supabase.storage
      .from("merchant-documents")
      .upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (error || !uploadData) {
      console.error(error);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    let url: string | null = null;
    const { data: signedData } = await supabase.storage
      .from("merchant-documents")
      .createSignedUrl(uploadData.path, 60 * 60 * 24);

    if (signedData?.signedUrl) {
      url = signedData.signedUrl;
    } else {
      const { data: publicData } = supabase.storage
        .from("merchant-documents")
        .getPublicUrl(uploadData.path);
      url = publicData?.publicUrl ?? null;
    }

    if (!url) {
      return NextResponse.json({ error: "URL generation failed" }, { status: 500 });
    }

    return NextResponse.json({ url, path: uploadData.path });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
