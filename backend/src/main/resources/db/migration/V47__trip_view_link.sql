-- 로그인 없이 보는 일정 링크.
--
-- 모임에 안 든 사람에게 일정만 보여 줍니다 — 숙소 주인, 같이 가는 친구의 가족,
-- 아직 가입 안 한 동행. 「계정 없이 동행자 자동 등록」을 반대한 까닭이 「여행
-- 안에 위치와 가계부가 있다」였으므로(docs/ideas.md), 일정만 냅니다.
--
--   보이는 것    날짜 · 장소 이름 · 시각 · 메모
--   안 보이는 것 가계부, 위치 공유, 피드, 사람 이름, 안내판(도어락 번호)
--
-- 여행마다 열쇠 하나, 해시로만 둡니다
--
--   새로 만들면 옛 링크가 죽고, 끊을 수 있습니다. 여행 마지막 날 다음 날에는
--   저절로 죽습니다 — 그 날은 따로 적지 않고 볼 때 날짜에서 셉니다. 날짜를
--   옮기면 죽는 날도 따라 옮겨야 하는데, 적어 두면 그 둘이 어긋납니다.

ALTER TABLE trips ADD COLUMN view_token_hash VARCHAR(64);

CREATE UNIQUE INDEX ux_trips_view_token ON trips (view_token_hash) WHERE view_token_hash IS NOT NULL;
