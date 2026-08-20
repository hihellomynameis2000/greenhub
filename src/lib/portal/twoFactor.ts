import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";

export const PORTAL_TWO_FACTOR_COOKIE = "greenhub_portal_2fa";
const TWO_FACTOR_MAX_AGE_SECONDS = 8 * 60 * 60;

type CookiePayload = {
  exp: number;
  uid: string;
};

function authSecret() {
  const secret =
    process.env.PORTAL_AUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.RESEND_API_KEY;

  if (!secret) {
    throw new Error("Portal verification is not configured.");
  }

  return secret;
}

function sign(value: string) {
  return createHmac("sha256", authSecret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function generateLoginCode() {
  return String(randomInt(100000, 1000000));
}

export function hashLoginCode(code: string, userId: string) {
  return sign(`${userId}:${code.trim()}`);
}

export function createTwoFactorToken(userId: string) {
  const payload: CookiePayload = {
    exp: Date.now() + TWO_FACTOR_MAX_AGE_SECONDS * 1000,
    uid: userId,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function twoFactorTokenIsValid(request: NextRequest, userId: string) {
  const token = request.cookies.get(PORTAL_TWO_FACTOR_COOKIE)?.value;
  if (!token) return false;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || !safeEqual(sign(encodedPayload), signature)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as CookiePayload;
    return payload.uid === userId && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function setTwoFactorCookie(response: NextResponse, userId: string) {
  response.cookies.set(PORTAL_TWO_FACTOR_COOKIE, createTwoFactorToken(userId), {
    httpOnly: true,
    maxAge: TWO_FACTOR_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearTwoFactorCookie(response: NextResponse) {
  response.cookies.set(PORTAL_TWO_FACTOR_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
