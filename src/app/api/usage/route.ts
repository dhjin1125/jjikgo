// 내보내기 사용 기록 — 무료 한도와 이용권 차감의 근거.
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { PLANS } from "@/lib/server/config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const uid = await getSessionUserId();
  if (!uid)
    // 로그인 전 사용은 기록하지 않는다 — 베타 기간 무제한 (랜딩에 명시)
    return NextResponse.json({ ok: true, plan: "anonymous" });

  const { kind, pages } = (await req.json().catch(() => ({}))) as {
    kind?: string;
    pages?: number;
  };
  const ent = await query<{ plan: string; expires_at: Date | null }>(
    `SELECT plan, expires_at FROM entitlements WHERE user_id = $1`,
    [uid]
  );
  let plan = ent.rows[0]?.plan ?? "free";
  const expiresAt = ent.rows[0]?.expires_at;
  if (expiresAt && new Date(expiresAt) < new Date()) plan = "free";

  // 한도 검사
  if (plan === "free") {
    const today = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM usage_events
       WHERE user_id = $1 AND created_at::date = now()::date`,
      [uid]
    );
    if (parseInt(today.rows[0].n, 10) >= 1)
      return NextResponse.json(
        { error: "무료는 하루 1건입니다. 이용권을 확인하거나 내일 다시 이용하세요.", code: "LIMIT" },
        { status: 403 }
      );
  } else if (plan === "pass7") {
    const n = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM usage_events WHERE user_id = $1`,
      [uid]
    );
    if (parseInt(n.rows[0].n, 10) >= PLANS.pass7.docLimit)
      return NextResponse.json(
        { error: "7일 이용권 20건을 모두 사용했습니다.", code: "LIMIT" },
        { status: 403 }
      );
  } else if (plan === "pro") {
    const n = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM usage_events
       WHERE user_id = $1 AND created_at > date_trunc('month', now())`,
      [uid]
    );
    if (parseInt(n.rows[0].n, 10) >= PLANS.pro.docLimit)
      return NextResponse.json(
        { error: "이번 달 100건을 모두 사용했습니다.", code: "LIMIT" },
        { status: 403 }
      );
  }

  await query(
    `INSERT INTO usage_events (user_id, kind, pages) VALUES ($1,$2,$3)`,
    [uid, (kind ?? "pdf").slice(0, 10), Math.max(1, Math.min(500, pages ?? 1))]
  );
  return NextResponse.json({ ok: true, plan });
}
