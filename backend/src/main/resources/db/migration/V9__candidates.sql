-- 가고 싶은 곳 후보와 투표.
--
-- 일정에 바로 넣으면 아직 정하지도 않은 것이 확정처럼 보이고, 빼자고 말하기도
-- 어려워집니다. 후보로 올려 두고 각자 좋아요를 누른 뒤, 다 좋다고 한 것만
-- 일정으로 옮깁니다.
CREATE TABLE trip_candidates (
    id         VARCHAR(16)  PRIMARY KEY,
    trip_id    VARCHAR(16)  NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    name       VARCHAR(120) NOT NULL,
    lat        DOUBLE PRECISION NOT NULL,
    lng        DOUBLE PRECISION NOT NULL,
    place_id   VARCHAR(255),
    cat        VARCHAR(40),
    note       TEXT,
    added_by   VARCHAR(16)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_candidates_trip ON trip_candidates (trip_id, created_at);

-- 한 사람이 한 후보에 한 표.
--
-- yes 를 참·거짓으로 둡니다. 표를 아예 안 던진 것과 싫다고 한 것은 다릅니다 —
-- 안 던진 사람이 있으면 아직 정해지지 않은 것입니다.
CREATE TABLE candidate_votes (
    candidate_id VARCHAR(16) NOT NULL REFERENCES trip_candidates(id) ON DELETE CASCADE,
    user_id      VARCHAR(16) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    yes          BOOLEAN     NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (candidate_id, user_id)
);
