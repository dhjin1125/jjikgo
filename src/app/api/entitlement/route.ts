import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { PLANS, getConfig } from "@/lib/server/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const uid = await getSessionUserId();
  if (!uid)
    return NextResponse.json({
      plan: "anonymous",
      limits: { docsPerDay: null, vault: null },
      configured: { kakao: getConfig().kakaoConfigured, toss: getConfig().tossConfigured },
    });
  const rows = await query<{ plan: string; expires_at: Date | null }>(
    `SELECT plan, expires_at FROM entitlements WHERE user_id = $1`,
    [uid]
  );
  let plan = rows.rows[0]?.plan ?? "free";
  const expiresAt = rows.rows[0]?.expires_at;
  if (expiresAt && new Date(expiresAt) < new Date()) plan = "free";
  const limits =
    plan === "pro"
      ? { docsPerMonth: PLANS.pro.docLimit, vault: PLANS.pro.vaultLimit }
      : plan === "pass7"
        ? { docsTotal: PLANS.pass7.docLimit, vault: PLANS.pass7.vaultLimit }
        : { docsPerDay: 1, vault: 1 };
  return NextResponse.json({
    plan,
    expiresAt,
    limits,
    configured: { kakao: getConfig().kakaoConfigured, toss: getConfig().tossConfigured },
  });
}
