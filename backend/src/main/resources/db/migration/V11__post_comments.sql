-- 올라온 일정에 달리는 댓글.

-- 피드백을 받고 싶은 글인지.
--
-- 구경만 하라고 올린 글에 훈수가 달리면 반갑지 않습니다. 올리는 사람이 먼저
-- 열어 둘 때만 댓글칸이 생깁니다.
ALTER TABLE trip_posts ADD COLUMN feedback BOOLEAN NOT NULL DEFAULT FALSE;

-- 댓글.
--
-- day_index·place_index 가 있으면 그 장소에 달린 것입니다. 없으면 일정 전체에
-- 대한 말입니다. "둘째 날 이 집 말고 옆집이 낫다" 는 어디에 대한 말인지가
-- 붙어 있어야 뜻이 통합니다.
--
-- 사본의 자리를 가리킵니다. 글은 올릴 때 뜬 사본이라 나중에 바뀌지 않으므로
-- 자리가 어긋나지 않습니다.
CREATE TABLE post_comments (
    id          VARCHAR(16)  PRIMARY KEY,
    post_id     VARCHAR(16)  NOT NULL REFERENCES trip_posts(id) ON DELETE CASCADE,
    user_id     VARCHAR(16)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text        VARCHAR(500) NOT NULL,
    day_index   INTEGER,
    place_index INTEGER,
    hidden      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_comments_post ON post_comments (post_id, hidden, created_at);

-- 신고. 한 사람이 한 댓글에 한 번.
CREATE TABLE comment_reports (
    comment_id VARCHAR(16)  NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
    user_id    VARCHAR(16)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason     VARCHAR(300),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (comment_id, user_id)
);
