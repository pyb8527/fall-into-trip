-- 무리가 먼저 있고, 여행은 그 안에서 생깁니다.
--
-- 지금까지는 여행이 먼저 있고 거기에 사람을 불렀습니다. 그래서 여행이 끝나면
-- 그 사람들과의 끈도 같이 끝났습니다 — 작년에 같이 간 사람과 올해 또 가려면
-- 초대 링크를 다시 보내야 했고, 둘이 같은 무리라는 것을 앱은 몰랐습니다.
--
-- 뒤집습니다. 그룹을 만들고, 사람을 부르고, 그 안에서 여행을 만듭니다.

CREATE TABLE groups (
    id              VARCHAR(16)  PRIMARY KEY,
    name            VARCHAR(40)  NOT NULL,
    -- 한 줄 소개. 없어도 됩니다
    about           VARCHAR(200),
    -- 그림 하나. 그룹 만들기는 이름 하나로 끝나야 하므로, 표지 사진이 아니라
    -- 그림이 먼저입니다 — 사진을 고르라고 하면 거기서 멈춥니다
    emoji           VARCHAR(8),
    cover_photo_id  VARCHAR(16)  REFERENCES photos (id) ON DELETE SET NULL,
    owner_id        VARCHAR(16)  NOT NULL REFERENCES users (id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE group_members (
    group_id   VARCHAR(16) NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
    user_id    VARCHAR(16) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- OWNER / MEMBER. 운영진·부방장 같은 것은 안 둡니다 — 스무 명짜리 모임에
    -- 결재선이 필요하지 않습니다
    role       VARCHAR(16) NOT NULL DEFAULT 'MEMBER',
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_group_members_user ON group_members (user_id);

-- 초대는 지금 여행 초대를 그대로 옮긴 것입니다 — 토큰은 해시로만 두고,
-- 만료가 있습니다.
CREATE TABLE group_invites (
    id          VARCHAR(16) PRIMARY KEY,
    group_id    VARCHAR(16) NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    created_by  VARCHAR(16) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ,
    -- 한 링크를 몇 명이 쓸 수 있는지. 모임에 셋을 한꺼번에 부르는 일이
    -- 흔해서, 한 번 쓰고 죽는 링크보다 이쪽이 맞습니다
    max_uses    INTEGER     NOT NULL DEFAULT 1,
    used_count  INTEGER     NOT NULL DEFAULT 0,
    -- 잘못 보낸 링크를 막는 길. 만료를 기다릴 수 없을 때 씁니다
    revoked_at  TIMESTAMPTZ
);

CREATE INDEX idx_group_invites_group ON group_invites (group_id);

-- 여행은 그룹의 것일 수도, 혼자 것일 수도 있습니다.
--
-- ON DELETE SET NULL 입니다. 그룹을 지워도 여행은 안 지웁니다 — 방을
-- 정리하려다 지난 여행이 통째로 사라지면 안 됩니다.
ALTER TABLE trips ADD COLUMN group_id VARCHAR(16) REFERENCES groups (id) ON DELETE SET NULL;
CREATE INDEX idx_trips_group ON trips (group_id) WHERE group_id IS NOT NULL;

-- ---------------------------------------------------------------- 옮기기
--
-- 사람이 둘 이상인 여행마다 그룹을 하나씩 만듭니다. 이름은 여행 이름을 그대로
-- 씁니다 — 사람이 나중에 고칩니다.
--
-- 혼자 쓰던 여행은 그룹을 안 만듭니다. group_id 가 NULL 로 남고, 만든 사람의
-- 혼자 여행이 됩니다.
-- 한 질의로 하려면 「방금 만든 그룹」과 「그 여행」을 다시 짝지어야 하는데,
-- 이름과 주인으로는 못 짝짓습니다(같은 이름의 여행이 둘일 수 있습니다).
-- 줄마다 돕니다 — 지금 여행 수가 적어 값이 들지 않습니다.
--
-- 「사람이 둘 이상」이 아니라 「주인 말고 또 있나」로 고릅니다. 세어서 고르면
-- 주인이 멤버 표에서 빠진 여행(한 명인데 그 한 명이 주인이 아닌)이 하나로
-- 세어져 그룹을 못 얻고, 그러면 그 사람이 보던 여행이 말없이 사라집니다.
-- 묻는 것은 처음부터 「이 여행을 주인 말고 누가 더 보고 있었나」입니다.
--
-- 들어온 때는 안 옮깁니다 — trip_members 가 그것을 적어 둔 적이 없습니다.
-- 모두 지금으로 둡니다(DEFAULT now()). 없는 것을 지어내는 것보다 낫습니다.
DO $$
DECLARE
    t        RECORD;
    new_id   VARCHAR(16);
BEGIN
    FOR t IN
        SELECT id, title, owner_id
        FROM trips
        WHERE EXISTS (
            SELECT 1 FROM trip_members m
            WHERE m.trip_id = trips.id AND m.user_id <> trips.owner_id
        )
    LOOP
        new_id := substr(md5(random()::text || clock_timestamp()::text || t.id), 1, 16);

        INSERT INTO groups (id, name, emoji, owner_id)
        VALUES (new_id, left(t.title, 40), '🧳', t.owner_id);

        -- 여행 멤버를 그대로 옮깁니다. 여행 주인이 그룹 주인입니다.
        --
        -- 주인을 따로 더합니다(UNION). 멤버 표에 주인이 없는 여행이 있으면
        -- groups.owner_id 는 그 사람을 가리키는데 group_members 에는 없는
        -- 모임이 되고, 그러면 주인이 제 모임을 못 엽니다.
        INSERT INTO group_members (group_id, user_id, role)
        SELECT new_id,
               u.user_id,
               CASE WHEN u.user_id = t.owner_id THEN 'OWNER' ELSE 'MEMBER' END
        FROM (
            SELECT m.user_id FROM trip_members m WHERE m.trip_id = t.id
            UNION
            SELECT t.owner_id
        ) AS u
        ON CONFLICT DO NOTHING;

        UPDATE trips SET group_id = new_id WHERE id = t.id;
    END LOOP;
END $$;

-- 사람을 부르는 길이 그룹 초대 하나가 되었습니다.
--
-- 값이 있습니다 — 「이번 여행만 같이 짜는 동료」를 부를 수 없게 됩니다.
-- 그때는 그 사람과의 그룹을 만들면 되고, 그래서 그룹 만들기가 이름 하나로
-- 끝나야 합니다.
DROP TABLE trip_invites;
DROP TABLE trip_members;
