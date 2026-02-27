import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type LeadPayload = {
  dbaName?: string;
  legalName?: string;
  corpStructure?: string;
  industry?: string;
  websiteUrl?: string;
  websiteLogin?: string;
  websitePassword?: string;
  ecommercePlatform?: string;
  gateway?: string;
  legalAddr1?: string;
  legalAddr2?: string;
  legalCity?: string;
  legalState?: string;
  legalZip?: string;
  locAddr1?: string;
  locAddr2?: string;
  locCity?: string;
  locState?: string;
  locZip?: string;
  separateMailing?: boolean | string;
  mailAddr1?: string;
  mailAddr2?: string;
  mailCity?: string;
  mailState?: string;
  mailZip?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  phone?: string;
  email?: string;
  vmdMonthly?: string | number;
  amexMonthly?: string | number;
  internetPct?: string | number;
  retailPct?: string | number;
  keyedPct?: string | number;
  notes?: string;
};

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase env vars");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

function toText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LeadPayload;

    const supabase = getSupabaseClient();

    // 1. Save to Supabase
    const { error } = await supabase
      .from("merchant_applications")
      .insert({
        dba_name: toText(body.dbaName),
        legal_name: toText(body.legalName),
        corp_structure: toText(body.corpStructure),
        industry: toText(body.industry),
        website_url: toText(body.websiteUrl),
        website_login: toText(body.websiteLogin),
        website_password: toText(body.websitePassword),
        ecommerce_platform: toText(body.ecommercePlatform),
        gateway: toText(body.gateway),
        legal_addr1: toText(body.legalAddr1),
        legal_addr2: toText(body.legalAddr2),
        legal_city: toText(body.legalCity),
        legal_state: toText(body.legalState),
        legal_zip: toText(body.legalZip),
        loc_addr1: toText(body.locAddr1),
        loc_addr2: toText(body.locAddr2),
        loc_city: toText(body.locCity),
        loc_state: toText(body.locState),
        loc_zip: toText(body.locZip),
        separate_mailing: toBoolean(body.separateMailing),
        mail_addr1: toText(body.mailAddr1),
        mail_addr2: toText(body.mailAddr2),
        mail_city: toText(body.mailCity),
        mail_state: toText(body.mailState),
        mail_zip: toText(body.mailZip),
        first_name: toText(body.firstName),
        last_name: toText(body.lastName),
        title: toText(body.title),
        phone: toText(body.phone),
        email: toText(body.email),
        vmd_monthly: toNumber(body.vmdMonthly),
        amex_monthly: toNumber(body.amexMonthly),
        internet_pct: toInt(body.internetPct),
        retail_pct: toInt(body.retailPct),
        keyed_pct: toInt(body.keyedPct),
        notes: toText(body.notes),
        data: body,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // 2. Send to Salesforce (example webhook or API endpoint)
    const salesforceWebhookUrl = process.env.SALESFORCE_WEBHOOK_URL;
    let salesforceOk = true;
    if (!salesforceWebhookUrl) {
      salesforceOk = false;
      console.warn("Missing Salesforce webhook URL");
    } else {
      try {
        const sfRes = await fetch(salesforceWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!sfRes.ok) {
          salesforceOk = false;
          console.error("Salesforce webhook failed", sfRes.status);
        }
      } catch (sfErr) {
        salesforceOk = false;
        console.error("Salesforce webhook error", sfErr);
      }
    }

    return NextResponse.json({ success: true, salesforceOk });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
