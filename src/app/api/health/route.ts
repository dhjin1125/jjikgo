import { NextResponse } from "next/server";
import { getConfig } from "@/lib/server/config";
import { query } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const c = getConfig();
  let db = "not-configured";
  if (c.dbConfigured) {
    try {
      await query("SELECT 1");
      db = "ok";
    } catch {
      db = "error";
    }
  }
  return NextResponse.json({
    ok: true,
    db,
    kakao: c.kakaoConfigured,
    toss: c.tossConfigured,
  });
}
