-- 언제 갈까 — 날짜 정하기 투표.
--
-- 날짜는 다수결이 아닙니다
--
--   가고 싶은 곳은 전원 동의로 정합니다(CandidateService). 날짜도 같은
--   결입니다 — 많이 된다는 날이 아니라 <b>모두 되는 날</b>을 찾습니다.
--   그래서 줄 세우는 순서가 셋입니다.
--
--     1. 가는 사람 모두 「돼요」인 날
--     2. 「안 돼요」가 없는 날
--     3. 나머지
--
--   「가는 사람」은 TripAccessPolicy.peopleOf 입니다 — 「못 가요」라고 한
--   사람은 날짜 셈에서도 빠집니다(V43).
--
-- 앱이 혼자 정하지 않습니다
--
--   마감도 기본값도 없습니다. 확정은 여행을 만든 사람이 누릅니다 —
--   RouteTidy 가 동선을 제안만 하고 사람이 수락해야 바뀌는 것과 같습니다.
--
-- 확정해도 후보를 안 지웁니다
--
--   확정된 날에 「안 돼요」였던 사람에게 「못 가요로 바꿀까요?」를 물어야
--   합니다. 후보와 답이 남아 있어야 그 사람이 누구인지 압니다.
--
-- 안 받은 것
--
--   캘린더 연동으로 빈 날 찾기(Howbout) — 남의 일정 전체를 읽습니다.
--   시간 단위 격자(When2meet) — 여행은 날 단위입니다.

CREATE TABLE date_options (
    id           VARCHAR(16) PRIMARY KEY,
    trip_id      VARCHAR(16) NOT NULL REFERENCES trips (id) ON DELETE CASCADE,

    start_iso    DATE        NOT NULL,
    -- 0 이면 당일치기. 여행을 만들 때와 같은 셈입니다
    nights       INTEGER     NOT NULL CHECK (nights BETWEEN 0 AND 30),

    -- 올린 사람이 탈퇴해도 후보는 남습니다. 다른 사람이 이미 답을 달았습니다
    created_by   VARCHAR(16) REFERENCES users (id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- 확정된 후보. 여행마다 하나만 채워집니다(서비스가 지킵니다)
    confirmed_at TIMESTAMPTZ,

    UNIQUE (trip_id, start_iso, nights)
);

CREATE INDEX idx_date_options_trip ON date_options (trip_id);

CREATE TABLE date_answers (
    option_id  VARCHAR(16) NOT NULL REFERENCES date_options (id) ON DELETE CASCADE,
    user_id    VARCHAR(16) NOT NULL REFERENCES users (id) ON DELETE CASCADE,

    -- YES / IF_NEED / NO — 돼요 / 어쩔 수 없으면 / 안 돼요.
    -- 줄이 없는 것은 「아직 안 답함」입니다. 「돼요」로 보지 않습니다
    answer     VARCHAR(8)  NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (option_id, user_id)
);
