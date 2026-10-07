import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getConfig } from "@/lib/server/config";
import {
  verifyKakaoState,
  signSession,
  SESSION_COOKIE,
  OAUTH_STATE_COOKIE,
} from "@/lib/server/auth";
import { query } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const c = getConfig();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const store = await cookies();
  const saved = store.get(OAUTH_STATE_COOKIE)?.value ?? "";
  store.delete(OAUTH_STATE_COOKIE);

  const fail = (m: string) =>
    NextResponse.redirect(new URL(`/login?error=${m}`, c.baseUrl));

  if (!code || !saved || !(await verifyKakaoState(saved, state)))
    return fail("state");

  // code → token
  const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: c.kakaoClientId,
      client_secret: c.kakaoClientSecret,
      redirect_uri: `${c.baseUrl}/api/auth/kakao/callback`,
      code,
    }),
  });
  if (!tokenRes.ok) return fail("token");
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) return fail("token");

  // profile
  const meRes = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!meRes.ok) return fail("profile");
  const me = (await meRes.json()) as {
    id: number;
    kakao_account?: { email?: string; profile?: { nickname?: string } };
  };
  const kakaoId = String(me.id);
  const name = me.kakao_account?.profile?.nickname ?? "";
  const email = me.kakao_account?.email ?? null;

  const rows = await query<{ id: string }>(
    `INSERT INTO users (email, name, provider, provider_id)
     VALUES ($1, $2, 'kakao', $3)
     ON CONFLICT (provider, provider_id)
     DO UPDATE SET name = EXCLUDED.name, email = COALESCE(EXCLUDED.email, users.email)
     RETURNING id`,
    [email, name, kakaoId]
  );
  const uid = rows.rows[0].id;
  await query(
    `INSERT INTO entitlements (user_id, plan) VALUES ($1, 'free') ON CONFLICT DO NOTHING`,
    [uid]
  );
  const token = await signSession(uid);
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 86400,
    secure: process.env.NODE_ENV === "production",
  });
  return NextResponse.redirect(new URL("/editor", c.baseUrl));
}
