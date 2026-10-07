// 서버 전용 환경 설정. 클라이언트 번들에 넣지 않는다.
function env(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export function getConfig() {
  return {
    baseUrl: env("APP_BASE_URL", "http://localhost:3939"),
    sessionSecret: env("SESSION_SECRET"),
    databaseUrl: env("DATABASE_URL"),
    databaseSsl: env("DATABASE_SSL") === "true",
    kakaoClientId: env("KAKAO_CLIENT_ID"),
    kakaoClientSecret: env("KAKAO_CLIENT_SECRET"),
    tossClientKey: env("TOSS_CLIENT_KEY"),
    tossSecretKey: env("TOSS_SECRET_KEY"),
    get kakaoConfigured() {
      return !!this.kakaoClientId;
    },
    get tossConfigured() {
      return !!this.tossClientKey && !!this.tossSecretKey;
    },
    get dbConfigured() {
      return !!this.databaseUrl;
    },
  };
}

export const PLANS = {
  pass7: { name: "7일 이용권", amount: 4900, days: 7, docLimit: 20, vaultLimit: 5 },
  pro: { name: "프로", amount: 9900, days: 30, docLimit: 100, vaultLimit: 20 },
} as const;
export type PlanId = keyof typeof PLANS;
