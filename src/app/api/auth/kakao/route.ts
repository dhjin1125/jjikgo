import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getConfig } from "@/lib/server/config";
import { createKakaoState, OAUTH_STATE_COOKIE } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const c = getConfig();
  if (!c.kakaoConfigured)
    return NextResponse.redirect(new URL("/login?error=kakao", c.baseUrl));
  const { nonce, token } = await createKakaoState();
  (await cookies()).set(OAUTH_STATE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });
  const url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.searchParams.set("client_id", c.kakaoClientId);
  url.searchParams.set(
    "redirect_uri",
    `${c.baseUrl}/api/auth/kakao/callback`
  );
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", nonce);
  return NextResponse.redirect(url);
}
