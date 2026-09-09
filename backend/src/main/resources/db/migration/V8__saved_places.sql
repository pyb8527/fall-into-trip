-- 나중에 쓰려고 담아 두는 장소.
--
-- 남의 일정을 통째로 복제하는 길은 있었지만 "이 집만 갖고 싶다" 가 안 됐습니다.
-- 담아 두었다가 내 일정 아무 날에나 꺼내 넣습니다.
CREATE TABLE saved_places (
    id         VARCHAR(16)  PRIMARY KEY,
    user_id    VARCHAR(16)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(120) NOT NULL,
    lat        DOUBLE PRECISION NOT NULL,
    lng        DOUBLE PRECISION NOT NULL,
    -- 구글이 아는 번호. 있으면 영업시간도 볼 수 있습니다.
    place_id   VARCHAR(255),
    cat        VARCHAR(40),
    note       TEXT,
    -- 어느 글에서 담았는지. 없으면 검색이나 지도에서 담은 것입니다.
    from_post  VARCHAR(16) REFERENCES trip_posts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_saved_user ON saved_places (user_id, created_at DESC);

-- 같은 가게를 두 번 담을 이유가 없습니다. 번호를 아는 것만 막습니다 —
-- 직접 찍은 좌표는 이름이 달라도 같은 곳인지 알 수 없어 판단하지 않습니다.
CREATE UNIQUE INDEX ux_saved_place ON saved_places (user_id, place_id)
    WHERE place_id IS NOT NULL;
