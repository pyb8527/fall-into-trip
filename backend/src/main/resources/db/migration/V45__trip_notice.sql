-- 여행 안내판 — 여행 전체에 걸린 것을 적어 두는 글 한 장.
--
-- 둘 곳이 없었습니다
--
--   날짜별 칸(days.budget, flight)은 날짜에 묶이고, 「챙겨 둔 것」
--   (place_photos REFERENCE)은 장소에 묶입니다. 숙소 도어락 번호, 모이는
--   곳, 비상 연락처처럼 여행 전체에 걸린 것은 놓을 자리가 없어 각자의
--   메신저에 흩어졌습니다.
--
-- 글 한 장을 함께 고칩니다
--
--   답글은 없습니다 — 답글이 붙으면 채팅이 되고, 이 앱은 채팅을 안 합니다.
--   읽음 표시도 없습니다 — 「누가 읽었나」는 안 읽은 사람을 드러냅니다(눈치).
--
--   동시에 고치면 trips.version(낙관적 잠금)으로 뒤 사람이 「다른 사람이
--   먼저 고쳤어요」를 봅니다. 합치지 않습니다.
--
-- 누가 · 언제를 남기는 까닭
--
--   소식함이 「○○ 님이 안내판을 고쳤어요」를 띄웁니다. 소식은 따로 쌓지
--   않고 이미 저장된 시각을 읽어 모으므로(NewsService), 그 시각이 여기
--   있어야 합니다.
--
-- 지켜야 할 것
--
--   여권 번호·카드 번호를 적지 말라고 입력칸 아래에 늘 적어 둡니다. 암호화는
--   하지 않습니다. 로그인 없이 보는 일정 링크에는 이 칸을 싣지 않습니다.

ALTER TABLE trips
    ADD COLUMN notice    TEXT,
    ADD COLUMN notice_by VARCHAR(16) REFERENCES users (id) ON DELETE SET NULL,
    ADD COLUMN notice_at TIMESTAMPTZ;

-- 글이 너무 길면 안내판이 아니라 문서입니다. 화면이 4000 자에서 막고,
-- 표도 같은 줄을 지킵니다.
ALTER TABLE trips
    ADD CONSTRAINT trips_notice_len CHECK (notice IS NULL OR char_length(notice) <= 4000);
