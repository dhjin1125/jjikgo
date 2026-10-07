import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getConfig } from "./config";

export const SESSION_COOKIE = "jjikgo_session";
const OAUTH_STATE_COOKIE = "jjikgo_kakao_state";

function getSecret() {
  const s = getConfig().sessionSecret;
  if (!s || s.length < 32 || s.startsWith("replace-with"))
    throw new Error("SESSION_SECRET not configured");
  return new TextEncoder().encode(s);
}

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 32).toString("hex");
  return `s1:${salt}:${hash}`;
}

export function checkPassword(pw: string, stored: string): boolean {
  const [, salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(pw, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function signSession(userId: string) {
  return new SignJWT({ sub: userId, kind: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });
    if (payload.kind !== "session" || typeof payload.sub !== "string") return null;
    return payload.sub as string;
  } catch {
    return null;
  }
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? verifySession(token) : null;
}

export async function createKakaoState() {
  const nonce = randomBytes(24).toString("base64url");
  const token = await new SignJWT({ nonce, kind: "kakao" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getSecret());
  return { nonce, token };
}

export async function verifyKakaoState(token: string, nonce: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });
    return payload.kind === "kakao" && payload.nonce === nonce;
  } catch {
    return false;
  }
}

export { OAUTH_STATE_COOKIE };

export function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}
