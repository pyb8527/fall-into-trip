-- 사진과 글을 나누는 자리.
--
-- 장소마다 기록을 남기게 했던 것을 0단계에서 걷어 냈습니다. 그 자리가 안 쓰인
-- 이유는 분명했습니다 — 무엇을 남기려면 <b>장소를 먼저 골라야</b> 해서, 숙소에서
-- 찍은 단체 사진은 올릴 데가 없었습니다. 여행에서 가장 남기고 싶은 사진이 정작
-- 갈 곳이 없는 셈이었습니다.
--
-- 장소에서 떼어 냅니다. 사진 몇 장과 글 한 줄이면 됩니다.

-- 이름을 group_posts 가 아니라 posts 로 둡니다. 그룹 없이도 올리므로 그룹이
-- 이 글의 주인이 아닙니다.
CREATE TABLE posts (
    id         VARCHAR(16)   PRIMARY KEY,
    author_id  VARCHAR(16)   NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- 비어 있으면 내 피드입니다. 그룹을 지우면 그 그룹에 올린 글도 같이
    -- 갑니다 — 그룹 밖으로 내보내면 아무에게도 안 보이는 글이 남습니다
    group_id   VARCHAR(16)   REFERENCES groups (id) ON DELETE CASCADE,
    -- 어느 여행 이야기인지. 여행을 지워도 글은 남습니다 — 글은 그 여행이
    -- 아니라 그때 있었던 일에 대한 것입니다
    trip_id    VARCHAR(16)   REFERENCES trips (id) ON DELETE SET NULL,
    -- 사진만 올려도 됩니다
    text       VARCHAR(2000),
    tags       TEXT[]        NOT NULL DEFAULT '{}',
    -- 신고를 받아 운영자가 내린 것. 지우지 않고 감춥니다
    hidden     BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_posts_group ON posts (group_id, created_at DESC) WHERE group_id IS NOT NULL;
CREATE INDEX idx_posts_mine  ON posts (author_id, created_at DESC);
CREATE INDEX idx_posts_trip  ON posts (trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX idx_posts_tags  ON posts USING GIN (tags);

-- place_photos 와 같은 꼴입니다. 배열로 담으면 사진이 지워질 때 없는 번호가
-- 배열에 남고, 그 자리는 화면에서 깨진 네모가 됩니다 — 없어진 줄도 모르고
-- 지나갑니다. 줄로 두면 사진이 지워질 때 이것도 함께 갑니다.
CREATE TABLE post_photos (
    post_id  VARCHAR(16) NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    photo_id VARCHAR(16) NOT NULL REFERENCES photos (id) ON DELETE CASCADE,
    sort     INTEGER     NOT NULL,
    PRIMARY KEY (post_id, photo_id)
);

CREATE INDEX idx_post_photos_of ON post_photos (post_id, sort);

-- ------------------------------------------------------------------ 댓글
--
-- 댓글은 지금 쓰던 표를 늘립니다. 새로 파는 것보다 낫습니다 — 신고·숨김·운영
-- 화면이 이미 이 표를 봅니다.
--
-- 대신 post_id 한 칸이 두 표(trip_posts·posts)를 가리키게 되므로 외래키를
-- 떼야 합니다. 그 값이 그냥 사라지는 것이 아니라, 지금까지 DB 가 대신 해 주던
-- 일이 코드로 넘어옵니다 — 글을 지울 때 댓글을 코드가 지워야 하고, 빼먹으면
-- 지운 글의 댓글이 영영 남습니다. PostService.remove 와 FeedService.remove
-- 두 자리입니다.
ALTER TABLE post_comments ADD COLUMN kind VARCHAR(8) NOT NULL DEFAULT 'JOURNAL';

-- 이름을 짐작해서 지우지 않습니다. IF EXISTS 로 적어 두면 이름이 다를 때
-- 조용히 안 떨어지고, 피드 댓글을 처음 다는 순간에야 터집니다.
DO $$
DECLARE
    fk TEXT;
BEGIN
    SELECT con.conname INTO fk
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'post_comments'
      AND con.contype = 'f'
      AND con.conkey = ARRAY[(
          SELECT att.attnum FROM pg_attribute att
          WHERE att.attrelid = rel.oid AND att.attname = 'post_id'
      )]::smallint[];

    IF fk IS NULL THEN
        RAISE EXCEPTION 'post_comments.post_id 의 외래키를 못 찾았습니다';
    END IF;
    EXECUTE format('ALTER TABLE post_comments DROP CONSTRAINT %I', fk);
END $$;

-- 지금 있는 줄은 전부 여행기 댓글입니다(DEFAULT 로 이미 그렇게 찼습니다).
-- 찾을 때 종류까지 함께 보므로 색인에 넣습니다.
DROP INDEX IF EXISTS ix_comments_post;
CREATE INDEX ix_comments_post ON post_comments (post_id, kind, hidden, created_at);
