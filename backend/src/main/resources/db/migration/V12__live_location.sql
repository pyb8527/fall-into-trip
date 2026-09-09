-- 자유시간에 서로를 찾는 두 가지.

-- "나 지금 여기 카페임" — 잠깐 꽂아 두는 핀.
--
-- 일정에 넣을 곳이 아니라 지금 있는 자리를 알리는 것이라 장소와 따로 둡니다.
-- 기한이 지나면 안 보입니다. 어제 꽂은 핀이 오늘 지도에 남아 있으면 거기
-- 있는 줄 압니다.
CREATE TABLE trip_pins (
    id         VARCHAR(16)  PRIMARY KEY,
    trip_id    VARCHAR(16)  NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id    VARCHAR(16)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lat        DOUBLE PRECISION NOT NULL,
    lng        DOUBLE PRECISION NOT NULL,
    label      VARCHAR(80),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ  NOT NULL
);
CREATE INDEX ix_pins_trip ON trip_pins (trip_id, expires_at);

-- 실시간 위치.
--
-- 열쇠가 (여행, 사람)이라 한 사람당 <한 줄>입니다. 새 자리가 오면 덮어씁니다.
-- 줄을 쌓으면 그것은 다닌 자취가 되고, 자취는 우리가 들고 있을 값이 아닙니다.
--
-- expires_at 이 지나면 안 보입니다. 켠 것을 잊어도 계속 새어 나가지 않습니다.
CREATE TABLE trip_locations (
    trip_id    VARCHAR(16)  NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id    VARCHAR(16)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lat        DOUBLE PRECISION NOT NULL,
    lng        DOUBLE PRECISION NOT NULL,
    accuracy   DOUBLE PRECISION,
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ  NOT NULL,
    PRIMARY KEY (trip_id, user_id)
);
CREATE INDEX ix_locations_trip ON trip_locations (trip_id, expires_at);
