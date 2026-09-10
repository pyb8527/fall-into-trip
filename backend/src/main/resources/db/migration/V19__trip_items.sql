-- ============================================================================
--  챙길 것.
--  ---------------------------------------------------------------------------
--  여권, 어댑터, 약, 우산. 떠나기 전에 서로 "그거 챙겼어?" 를 몇 번씩 묻게
--  되는 것들입니다.
--
--  누가 챙길지를 함께 적습니다. 그것이 없으면 목록이 "각자 알아서" 가 되고,
--  그러면 어댑터가 셋이거나 없거나 둘 중 하나가 됩니다.
--
--  일정과 따로 둡니다. 장소가 아니라 여행에 딸린 것이고, 날짜와도 무관합니다
--  — 떠나기 전에 챙기는 것이라 며칟날에 매이지 않습니다.
-- ============================================================================

CREATE TABLE trip_items (
    id         VARCHAR(16)  PRIMARY KEY,
    trip_id    VARCHAR(16)  NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    name       VARCHAR(80)  NOT NULL,
    -- 누가 챙길지. 비어 있으면 아직 안 정한 것입니다.
    owner_id   VARCHAR(16)  REFERENCES users(id) ON DELETE SET NULL,
    -- 챙겼는지. 동행자 누구나 체크할 수 있습니다.
    done       BOOLEAN      NOT NULL DEFAULT false,
    sort       INTEGER      NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by VARCHAR(16)  NOT NULL REFERENCES users(id)
);

CREATE INDEX ix_trip_items_trip ON trip_items (trip_id, sort);
