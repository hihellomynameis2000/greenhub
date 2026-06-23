import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

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
  fileUrl?: string;
};

const SALESFORCE_WEBTOLEAD_URL =
  "https://webto.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8";

function buildSalesforceDescription(body: LeadPayload): string {
  const parts = [
    toText(body.notes) ? `Notes: ${toText(body.notes)}` : "",
    toText(body.fileUrl) ? `Supporting Document URL: ${toText(body.fileUrl)}` : "",
    toText(body.dbaName) ? `DBA / Merchant Name: ${toText(body.dbaName)}` : "",
    toText(body.legalAddr2) ? `Legal Business Address 2: ${toText(body.legalAddr2)}` : "",
    toText(body.locAddr1) ? `Business Location Address 1: ${toText(body.locAddr1)}` : "",
    toText(body.locAddr2) ? `Business Location Address 2: ${toText(body.locAddr2)}` : "",
    toText(body.locCity) ? `Business Location City: ${toText(body.locCity)}` : "",
    toText(body.locState) ? `Business Location State: ${toText(body.locState)}` : "",
    toText(body.locZip) ? `Business Location ZIP: ${toText(body.locZip)}` : "",
    toText(body.mailAddr1) ? `Mailing Address 1: ${toText(body.mailAddr1)}` : "",
    toText(body.mailAddr2) ? `Mailing Address 2: ${toText(body.mailAddr2)}` : "",
    toText(body.mailCity) ? `Mailing City: ${toText(body.mailCity)}` : "",
    toText(body.mailState) ? `Mailing State: ${toText(body.mailState)}` : "",
    toText(body.mailZip) ? `Mailing ZIP: ${toText(body.mailZip)}` : "",
  ].filter(Boolean);

  return parts.join("\n");
}

function toSalesforcePayload(body: LeadPayload) {
  const description = buildSalesforceDescription(body);

  return {
    oid: "00DHn000002T2Ez",
    retURL: "https://www.greenhub.io/",

    first_name: toText(body.firstName) ?? "",
    last_name: toText(body.lastName) ?? "",
    title: toText(body.title) ?? "",
    phone: toText(body.phone) ?? "",
    email: toText(body.email) ?? "",

    company: toText(body.dbaName) ?? toText(body.legalName) ?? "",
    Legal_Business_Name__c: toText(body.legalName) ?? "",
    Corp_Structure__c: toText(body.corpStructure) ?? "",
    industry: toText(body.industry) ?? "",
    Website_URL__c: toText(body.websiteUrl) ?? "",

    Visa_Mastercard_Discover_Monthly_Volume__c:
      body.vmdMonthly != null ? String(body.vmdMonthly) : "",
    American_Express_Monthly_Volume__c:
      body.amexMonthly != null ? String(body.amexMonthly) : "",
    Internet__c: body.internetPct != null ? String(body.internetPct) : "",
    Retail_Swiped__c: body.retailPct != null ? String(body.retailPct) : "",
    Keyed_MO_TO__c: body.keyedPct != null ? String(body.keyedPct) : "",

    Ecomm_Platform__c: toText(body.ecommercePlatform) ?? "",
    Gateway__c: toText(body.gateway) ?? "",
    Log_In__c: toText(body.websiteLogin) ?? "",
    Password__c: toText(body.websitePassword) ?? "",

    street: toText(body.legalAddr1) ?? "",
    city: toText(body.legalCity) ?? "",
    state: toText(body.legalState) ?? "",
    zip: toText(body.legalZip) ?? "",
    country: "",
    Legal_Business_Address_2__c: toText(body.legalAddr2) ?? "",

    Business_Location_Address__Street__s: toText(body.locAddr1) ?? "",
    Business_Location_Address__City__s: toText(body.locCity) ?? "",
    Business_Location_Address__PostalCode__s: toText(body.locZip) ?? "",
    Business_Location_Address_2__c: toText(body.locAddr2) ?? "",

    Mailing_Address__Street__s: toText(body.mailAddr1) ?? "",
    Mailing_Address__City__s: toText(body.mailCity) ?? "",
    Mailing_Address__StateCode__s: toText(body.mailState) ?? "",
    Mailing_Address__PostalCode__s: toText(body.mailZip) ?? "",
    Mailing_Address__CountryCode__s: "",
    Mailing_Address_2__c: toText(body.mailAddr2) ?? "",

    description,
  };
}

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase env vars");
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
        file_url: toText(body.fileUrl),
        data: body,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // 2. Send to Salesforce Web-to-Lead
    let salesforceOk = true;
    try {
      const sfPayload = toSalesforcePayload(body);
      const params = new URLSearchParams();

      Object.entries(sfPayload).forEach(([key, value]) => {
        params.append(key, String(value ?? ""));
      });

      const sfRes = await fetch(SALESFORCE_WEBTOLEAD_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
        redirect: "follow",
      });

      if (!sfRes.ok) {
        salesforceOk = false;
        const text = await sfRes.text();
        console.error("Salesforce Web-to-Lead failed", sfRes.status, text);
      }
    } catch (sfErr) {
      salesforceOk = false;
      console.error("Salesforce Web-to-Lead error", sfErr);
    }

    return NextResponse.json({ success: true, salesforceOk });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
