-- 찍고 스키마. 사용자·도장함·서식·이용권·결제 기록.
-- 문서 본문은 저장하지 않는다 (브라우저 처리 원칙 유지).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext UNIQUE,
  password_hash text,
  name          text NOT NULL DEFAULT '',
  provider      text NOT NULL DEFAULT 'email',      -- email | kakao
  provider_id   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_id)
);

-- 도장함: 사용자가 '도장함에 저장'을 선택한 것만 서버에 남는다
CREATE TABLE IF NOT EXISTS vault_assets (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_id   text NOT NULL,
  kind       text NOT NULL,
  name       text NOT NULL,
  data_url   text NOT NULL,
  aspect     double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, asset_id)
);

CREATE TABLE IF NOT EXISTS templates (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tpl_id     text NOT NULL,
  name       text NOT NULL,
  doc_kind   text NOT NULL,
  payload    jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tpl_id)
);

-- 이용권: 무료(free) / 7일 이용권(pass7) / 프로(pro)
CREATE TABLE IF NOT EXISTS entitlements (
  user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan       text NOT NULL DEFAULT 'free',
  expires_at timestamptz,              -- pass7은 7일, pro는 다음 결제일, free는 null
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 결제 기록: 이중 결제·이중 차감 방지의 근거. order_id는 서버가 발급.
CREATE TABLE IF NOT EXISTS payments (
  order_id    text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan        text NOT NULL,
  amount      integer NOT NULL,
  status      text NOT NULL DEFAULT 'ready', -- ready | done | failed | canceled
  payment_key text UNIQUE,
  fail_reason text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 내보내기 사용 기록 (무료 한도·과금 차감의 근거)
CREATE TABLE IF NOT EXISTS usage_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL,      -- pdf | image | docx | hwpx
  pages      integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usage_events_user_day
  ON usage_events (user_id, created_at);
