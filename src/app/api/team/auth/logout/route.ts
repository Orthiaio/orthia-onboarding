import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/team/user-auth";

export async function POST() {
  const res = NextResponse.json({ success: true });
  clearSessionCookie(res);
  return res;
}
