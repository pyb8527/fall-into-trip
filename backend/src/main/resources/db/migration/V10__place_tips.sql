-- 다녀온 사람이 남기는 한 줄.
--
-- "지금 대기 40분", "2번 출구로 나와야 함" 처럼 구글에는 없고 방금 다녀온
-- 사람만 아는 것들입니다.
--
-- 여행이 아니라 <구글 장소 번호>에 답니다. 여행에 달면 같은 가게를 넣어 둔
-- 남의 일정에서는 안 보이는데, 그러면 팁이 쌓일 데가 없습니다.
CREATE TABLE place_tips (
    id         VARCHAR(16)  PRIMARY KEY,
    place_id   VARCHAR(255) NOT NULL,
    user_id    VARCHAR(16)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text       VARCHAR(200) NOT NULL,
    -- 신고를 받아 운영자가 내린 글. 지우지 않고 감춥니다.
    hidden     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- 한 장소의 최근 것부터 봅니다. 오래된 팁은 값이 없습니다.
CREATE INDEX ix_tips_place ON place_tips (place_id, hidden, created_at DESC);
CREATE INDEX ix_tips_user ON place_tips (user_id, created_at DESC);

-- 신고. 한 사람이 한 팁에 한 번.
CREATE TABLE tip_reports (
    tip_id     VARCHAR(16)  NOT NULL REFERENCES place_tips(id) ON DELETE CASCADE,
    user_id    VARCHAR(16)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason     VARCHAR(300),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (tip_id, user_id)
);
