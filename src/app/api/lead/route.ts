import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase env vars");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const supabase = getSupabaseClient();

    // 1. Save to Supabase
    const { error } = await supabase
      .from("merchant_applications")
      .insert({
        data: body,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // 2. Send to Salesforce (example webhook or API endpoint)
    const salesforceWebhookUrl = process.env.SALESFORCE_WEBHOOK_URL;
    if (!salesforceWebhookUrl) {
      return NextResponse.json(
        { error: "Missing Salesforce webhook URL" },
        { status: 500 }
      );
    }

    await fetch(salesforceWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
