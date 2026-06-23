"use client";

import { createClient } from "@supabase/supabase-js";

export const portalSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function portalRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await portalSupabase.auth.getSession();

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
