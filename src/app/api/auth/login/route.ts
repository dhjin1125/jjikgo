import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/server/db";
import { checkPassword, signSession, SESSION_COOKIE } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string")
    return NextResponse.json({ error: "입력을 확인해주세요." }, { status: 400 });
  const rows = await query<{ id: string; password_hash: string | null }>(
    `SELECT id, password_hash FROM users WHERE email = $1 AND provider = 'email'`,
    [email]
  );
  const u = rows.rows[0];
  if (!u?.password_hash || !checkPassword(password, u.password_hash))
    return NextResponse.json(
      { error: "이메일 또는 비밀번호가 맞지 않습니다." },
      { status: 401 }
    );
  const token = await signSession(u.id);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 86400,
    secure: process.env.NODE_ENV === "production",
  });
  return NextResponse.json({ ok: true });
}
