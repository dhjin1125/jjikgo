import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/server/db";
import { hashPassword, signSession, SESSION_COOKIE } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { email, password, name } = await req.json().catch(() => ({}));
  if (
    typeof email !== "string" ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    typeof password !== "string" ||
    password.length < 8
  ) {
    return NextResponse.json(
      { error: "이메일 형식과 8자 이상 비밀번호를 확인해주세요." },
      { status: 400 }
    );
  }
  try {
    const rows = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, name, provider)
       VALUES ($1, $2, $3, 'email')
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [email, hashPassword(password), typeof name === "string" ? name.slice(0, 40) : ""]
    );
    if (!rows.rows.length)
      return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });
    const uid = rows.rows[0].id;
    await query(
      `INSERT INTO entitlements (user_id, plan) VALUES ($1, 'free') ON CONFLICT DO NOTHING`,
      [uid]
    );
    const token = await signSession(uid);
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 86400,
      secure: process.env.NODE_ENV === "production",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `가입 실패: ${(e as Error).message}` }, { status: 500 });
  }
}
