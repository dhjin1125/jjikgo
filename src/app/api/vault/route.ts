// 도장함 동기화 — '도장함에 저장'을 선택한 자산만 서버에 보관.
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { query, getPool } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "login" }, { status: 401 });
  const rows = await query<{
    asset_id: string;
    kind: string;
    name: string;
    data_url: string;
    aspect: number;
    created_at: Date;
  }>(
    `SELECT asset_id, kind, name, data_url, aspect, created_at
     FROM vault_assets WHERE user_id = $1 ORDER BY created_at DESC`,
    [uid]
  );
  return NextResponse.json({
    assets: rows.rows.map((r) => ({
      id: r.asset_id,
      kind: r.kind,
      name: r.name,
      dataUrl: r.data_url,
      aspect: r.aspect,
      createdAt: new Date(r.created_at).getTime(),
    })),
  });
}

export async function PUT(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "login" }, { status: 401 });
  const { assets } = (await req.json().catch(() => ({}))) as {
    assets?: {
      id: string;
      kind: string;
      name: string;
      dataUrl: string;
      aspect: number;
      createdAt: number;
    }[];
  };
  if (!Array.isArray(assets) || assets.length > 50)
    return NextResponse.json({ error: "잘못된 도장함 목록" }, { status: 400 });

  // 이용권 도장함 한도
  const ent = await query<{ plan: string }>(
    `SELECT plan FROM entitlements WHERE user_id = $1`,
    [uid]
  );
  const plan = ent.rows[0]?.plan ?? "free";
  const limit = plan === "pro" ? 20 : plan === "pass7" ? 5 : 1;
  if (assets.length > limit)
    return NextResponse.json(
      { error: `도장함 한도 초과 — ${plan} 요금제는 ${limit}개까지 저장됩니다.`, limit },
      { status: 403 }
    );

  const ids = assets.map((a) => a.id);
  const client = await getPool()!.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM vault_assets WHERE user_id = $1 AND asset_id <> ALL($2::text[])`,
      [uid, ids.length ? ids : [""]]
    );
    for (const a of assets) {
      if (
        typeof a.id !== "string" ||
        typeof a.dataUrl !== "string" ||
        a.dataUrl.length > 900_000
      )
        continue;
      await client.query(
        `INSERT INTO vault_assets (user_id, asset_id, kind, name, data_url, aspect, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,to_timestamp($7/1000.0))
         ON CONFLICT (user_id, asset_id)
         DO UPDATE SET kind=$3, name=$4, data_url=$5, aspect=$6`,
        [uid, a.id, a.kind, (a.name ?? "").slice(0, 80), a.dataUrl, a.aspect, a.createdAt ?? Date.now()]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return NextResponse.json({ ok: true });
}
