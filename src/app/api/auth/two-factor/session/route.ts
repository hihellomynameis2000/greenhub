import { NextResponse } from "next/server";
import { clearTwoFactorCookie } from "@/lib/portal/twoFactor";

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearTwoFactorCookie(response);
  return response;
}

