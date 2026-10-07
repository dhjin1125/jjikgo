import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { query } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ user: null });
  const rows = await query<{ email: string | null; name: string; provider: string }>(
    `SELECT email, name, provider FROM users WHERE id = $1`,
    [uid]
  );
  if (!rows.rows.length) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { id: uid, ...rows.rows[0] } });
}
