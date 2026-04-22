// Uses Web Crypto API so this works in both the Edge (middleware) and Node runtimes.
import { NextRequest, NextResponse } from "next/server";

export const TEAM_GATE_COOKIE = "team_gate";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const TEAM_GATE_PASSWORD = "Orthia";

function getSecret(): string {
  return process.env.TEAM_GATE_SECRET || process.env.ADMIN_PASSWORD || "team-gate-fallback";
}

function toHex(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < b.length; i++) out += b[i].toString(16).padStart(2, "0");
  return out;
}

function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) return new Uint8Array();
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacHex(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toHex(sig);
}

export async function signGateCookie(): Promise<string> {
  const ts = Date.now().toString();
  const hmac = await hmacHex(ts);
  return `${ts}:${hmac}`;
}

export async function verifyGateCookie(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const parts = value.split(":");
  if (parts.length !== 2) return false;
  const [ts, providedHmac] = parts;
  const tsNum = parseInt(ts, 10);
  if (isNaN(tsNum)) return false;
  const age = Date.now() - tsNum;
  if (age < 0 || age > MAX_AGE_SECONDS * 1000) return false;
  const expected = await hmacHex(ts);
  return timingSafeEqual(fromHex(providedHmac), fromHex(expected));
}

export async function setGateCookieOn(res: NextResponse) {
  res.cookies.set(TEAM_GATE_COOKIE, await signGateCookie(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

export function safeCompare(a: string, b: string): boolean {
  const enc = new TextEncoder();
  return timingSafeEqual(enc.encode(a), enc.encode(b));
}
