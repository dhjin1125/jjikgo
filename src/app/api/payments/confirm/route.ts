// 토스 결제 승인 — 서버에서 paymentKey를 확인하고 이용권을 부여한다.
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { getConfig, PLANS, type PlanId } from "@/lib/server/config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const c = getConfig();
  const { paymentKey, orderId, amount } = (await req.json().catch(() => ({}))) as {
    paymentKey?: string;
    orderId?: string;
    amount?: number;
  };
  if (!paymentKey || !orderId || !amount)
    return NextResponse.json({ error: "잘못된 승인 요청" }, { status: 400 });
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "login" }, { status: 401 });

  const pay = await query<{ user_id: string; plan: PlanId; amount: number; status: string; payment_key: string | null }>(
    `SELECT user_id, plan, amount, status, payment_key FROM payments WHERE order_id = $1`,
    [orderId]
  );
  const row = pay.rows[0];
  if (!row || row.user_id !== uid || row.amount !== amount)
    return NextResponse.json({ error: "결제 정보가 일치하지 않습니다." }, { status: 400 });
  if (row.status === "done")
    // 이미 승인된 주문 — 멱등 응답 (중복 승인 방지)
    return NextResponse.json({ ok: true, already: true, plan: row.plan });

  const secret = Buffer.from(`${c.tossSecretKey}:`).toString("base64");
  const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  const body = (await res.json()) as { code?: string; message?: string };
  if (!res.ok) {
    await query(
      `UPDATE payments SET status='failed', fail_reason=$2, updated_at=now() WHERE order_id=$1`,
      [orderId, `${body.code ?? ""} ${body.message ?? ""}`.slice(0, 200)]
    );
    return NextResponse.json(
      { error: body.message ?? "승인 실패" },
      { status: 400 }
    );
  }

  await query(
    `UPDATE payments SET status='done', payment_key=$2, updated_at=now() WHERE order_id=$1`,
    [orderId, paymentKey]
  );
  const plan = PLANS[row.plan];
  const expires =
    row.plan === "pass7"
      ? new Date(Date.now() + plan.days * 86400_000)
      : new Date(Date.now() + plan.days * 86400_000);
  await query(
    `INSERT INTO entitlements (user_id, plan, expires_at, updated_at)
     VALUES ($1,$2,$3,now())
     ON CONFLICT (user_id) DO UPDATE SET plan=$2, expires_at=$3, updated_at=now()`,
    [uid, row.plan, expires]
  );
  return NextResponse.json({ ok: true, plan: row.plan });
}
