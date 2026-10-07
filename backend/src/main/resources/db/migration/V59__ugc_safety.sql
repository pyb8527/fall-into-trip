-- 신고 · 차단 — 스토어가 묻는 「사람이 올린 것을 어떻게 다루나」.
--
-- 여행기 · 댓글 · 팁에는 신고가 있었는데(세 건이면 저절로 감춤) 피드 글과
-- 프로필에는 없었고, 사람을 막는 길은 아예 없었습니다. 구글 플레이와 애플이
-- 둘 다 「신고」와 「차단」을 앱 안에 두라고 합니다.

-- 피드 글 신고. 한 사람이 한 글에 한 번 — tip_reports 와 같은 꼴입니다.
-- 세 건이 쌓이면 posts.hidden 을 켭니다. 감추기만 하고 지우지 않으므로
-- 운영자가 되돌릴 수 있습니다.
CREATE TABLE feed_reports (
    post_id    VARCHAR(16)  NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    user_id    VARCHAR(16)  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    reason     VARCHAR(300),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, user_id)
);

-- 프로필 신고 — 이름 · 한 줄 소개 · 얼굴 사진.
--
-- 감춤 칸을 users 에 두지 않고 <건수>로 셉니다. 서로 다른 세 사람이 신고하면
-- 남에게 보이는 소개와 사진을 비웁니다(이름은 둡니다 — 누군지는 알아야
-- 합니다). 운영자가 확인하고 「괜찮다」고 하면 이 줄들을 지우고, 그러면
-- 저절로 다시 보입니다. 칸을 따로 두면 그 칸과 이 줄들이 어긋날 수 있습니다.
CREATE TABLE profile_reports (
    user_id     VARCHAR(16)  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    reporter_id VARCHAR(16)  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    reason      VARCHAR(300),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, reporter_id)
);

-- 차단. 막은 사람과 막힌 사람.
--
-- 둘 중 누가 탈퇴해도 줄이 같이 갑니다. 막힌 사람에게는 알리지 않습니다 —
-- 이 표는 막은 사람 쪽에서만 읽힙니다(목록 · 풀기).
CREATE TABLE user_blocks (
    blocker_id VARCHAR(16)  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    blocked_id VARCHAR(16)  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);

-- 「나를 막은 사람」을 찾는 쪽. 목록을 거를 때 양쪽을 다 봅니다 — 막은
-- 사람의 글도 막힌 사람에게 안 보여야 합니다.
CREATE INDEX ix_user_blocks_blocked ON user_blocks (blocked_id);
