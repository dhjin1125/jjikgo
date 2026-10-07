// 결제 준비 — orderId를 서버가 발급하고 클라이언트가 토스 결제창을 연다.
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getSessionUserId } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { getConfig, PLANS, type PlanId } from "@/lib/server/config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const c = getConfig();
  if (!c.tossConfigured)
    return NextResponse.json(
      { error: "결제 준비 중입니다. 곧 열립니다.", code: "NOT_CONFIGURED" },
      { status: 503 }
    );
  const uid = await getSessionUserId();
  if (!uid)
    return NextResponse.json({ error: "로그인이 필요합니다.", code: "LOGIN" }, { status: 401 });

  const { plan } = (await req.json().catch(() => ({}))) as { plan?: PlanId };
  if (!plan || !(plan in PLANS))
    return NextResponse.json({ error: "잘못된 상품" }, { status: 400 });

  // 진행 중 ready 결제가 있으면 재사용하지 않고 새로 발급 (이중 결제 방지 — orderId 유일)
  const orderId = `jjikgo-${Date.now()}-${randomBytes(4).toString("hex")}`;
  await query(
    `INSERT INTO payments (order_id, user_id, plan, amount, status)
     VALUES ($1,$2,$3,$4,'ready')`,
    [orderId, uid, plan, PLANS[plan].amount]
  );
  return NextResponse.json({
    orderId,
    amount: PLANS[plan].amount,
    orderName: `찍고 ${PLANS[plan].name}`,
    clientKey: c.tossClientKey,
    successUrl: `${c.baseUrl}/payment/success`,
    failUrl: `${c.baseUrl}/payment/fail`,
  });
}
