-- 일정을 남에게 보여 주는 게시판.

-- 올린 일정.
--
-- trip_id 는 어디서 왔는지 적어 둘 뿐, 내용은 snapshot 에 그때의 사본으로
-- 담습니다. 원본을 가리키게 두면 올린 뒤 일정을 고치거나 지웠을 때 남이 보던
-- 글이 조용히 바뀌거나 깨집니다. 사본을 뜨면 원본을 지워도 글은 남습니다.
CREATE TABLE trip_posts (
    id          VARCHAR(16)  PRIMARY KEY,
    trip_id     VARCHAR(16)  REFERENCES trips(id) ON DELETE SET NULL,
    author_id   VARCHAR(16)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(120) NOT NULL,
    summary     VARCHAR(300),
    snapshot    JSONB        NOT NULL,
    day_count   INTEGER      NOT NULL DEFAULT 0,
    place_count INTEGER      NOT NULL DEFAULT 0,
    -- 세어 둔 값. 매번 세면 목록 한 번에 조인이 둘 더 붙습니다.
    like_count  INTEGER      NOT NULL DEFAULT 0 CHECK (like_count >= 0),
    view_count  INTEGER      NOT NULL DEFAULT 0 CHECK (view_count >= 0),
    -- 신고를 받아 운영자가 내린 글. 지우지 않고 감춥니다.
    hidden      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_posts_new ON trip_posts (hidden, created_at DESC);
CREATE INDEX ix_posts_top ON trip_posts (hidden, like_count DESC);
CREATE INDEX ix_posts_author ON trip_posts (author_id);

-- 추천. 한 사람이 한 번만.
CREATE TABLE trip_post_likes (
    post_id    VARCHAR(16) NOT NULL REFERENCES trip_posts(id) ON DELETE CASCADE,
    user_id    VARCHAR(16) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, user_id)
);

-- 조회수.
--
-- 볼 때마다 한 줄씩 쌓으면 이 표만 금세 제일 커집니다. 사람과 날짜로 묶어
-- 하루에 한 번만 셉니다. 새로고침을 눌러도 늘지 않습니다.
--
-- 로그인한 사람만 셉니다. 아닌 사람까지 세려면 IP 를 남겨야 하는데, 그건
-- 조회수 하나 때문에 들고 있을 값이 아닙니다.
CREATE TABLE trip_post_views (
    post_id VARCHAR(16) NOT NULL REFERENCES trip_posts(id) ON DELETE CASCADE,
    user_id VARCHAR(16) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    on_date DATE        NOT NULL,
    PRIMARY KEY (post_id, user_id, on_date)
);

-- 신고. 한 사람이 한 글에 한 번.
CREATE TABLE trip_post_reports (
    post_id    VARCHAR(16)  NOT NULL REFERENCES trip_posts(id) ON DELETE CASCADE,
    user_id    VARCHAR(16)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason     VARCHAR(300),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, user_id)
);
CREATE INDEX ix_reports_new ON trip_post_reports (created_at DESC);
