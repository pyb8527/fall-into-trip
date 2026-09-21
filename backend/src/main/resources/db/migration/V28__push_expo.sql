-- 앱으로도 알림을 보냅니다.
--
-- 여태 브라우저(Web Push)만 있었습니다. 앱은 전송 방식이 아예 다릅니다 —
-- 브라우저는 우리가 직접 중계 서버에 암호화해서 밀어 넣지만, 앱은 Expo 가
-- 대신 애플·구글에 넘겨 줍니다.
--
-- 표를 새로 만들지 않습니다. "이 사람이 이 기기로 알림을 받는다" 는 같은
-- 이야기이고, 보내는 쪽에서만 갈래를 봅니다. 표가 둘이면 끌 때도 셀 때도
-- 두 군데를 봐야 합니다.

ALTER TABLE push_subscriptions
    ADD COLUMN IF NOT EXISTS kind varchar(8) NOT NULL DEFAULT 'web';

-- 앱 토큰에는 브라우저 열쇠가 없습니다. Expo 가 준 토큰 한 줄이 전부이고,
-- 그것은 endpoint 자리에 들어갑니다.
ALTER TABLE push_subscriptions ALTER COLUMN p256dh DROP NOT NULL;
ALTER TABLE push_subscriptions ALTER COLUMN auth DROP NOT NULL;
