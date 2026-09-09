-- ============================================================================
--  브라우저 알림을 받을 자리.
--  ---------------------------------------------------------------------------
--  한 사람이 여러 기기에서 받을 수 있으므로 사람마다 여러 줄입니다. 폰에서
--  켜 두고 노트북에서도 켜면 두 줄입니다.
--
--  endpoint 가 곧 그 기기입니다 — 브라우저가 발급하는 주소이고, 같은 기기에서
--  다시 켜면 같은 것이 옵니다. 그래서 이것을 유일 열쇠로 둡니다. 안 그러면
--  껐다 켤 때마다 쌓여 한 기기에 알림이 여러 번 옵니다.
--
--  p256dh 와 auth 는 그 기기만 읽을 수 있게 내용을 봉하는 데 쓰는 열쇠입니다.
--  우리 것이 아니라 브라우저가 만들어 준 것이라, 새면 그 기기로 가짜 알림을
--  보낼 수 있을 뿐 그 사람의 다른 것에는 닿지 않습니다.
-- ============================================================================

CREATE TABLE push_subscriptions (
    id          VARCHAR(24)  PRIMARY KEY,
    user_id     VARCHAR(24)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint    TEXT         NOT NULL UNIQUE,
    p256dh      VARCHAR(200) NOT NULL,
    auth        VARCHAR(60)  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    -- 마지막으로 보내 본 때. 계속 실패하는 것을 걷어 내는 데 씁니다.
    failed_at   TIMESTAMPTZ
);

CREATE INDEX idx_push_user ON push_subscriptions (user_id);
