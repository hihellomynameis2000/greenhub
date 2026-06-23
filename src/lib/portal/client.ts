"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let portalSupabase: SupabaseClient | null = null;

export function getPortalSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Portal authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  portalSupabase ??= createClient(url, anonKey);
  return portalSupabase;
}

export async function portalRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await getPortalSupabase().auth.getSession();

  if (!session?.access_token) {
    throw new Error("Sign in is required to use live portal data.");
  }

  const response = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(body.error || "The portal request could not be completed.");
  }

  return body;
}
