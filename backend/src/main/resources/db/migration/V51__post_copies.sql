-- 둘러보기 — 혼자·모임 조건과 「이번 주 많이 가져간 여행」.
--
-- from_group
--
--   그 여행기가 모임 여행에서 나왔는지. 「혼자 여행」을 찾는 사람과 「여럿이
--   간 여행」을 찾는 사람이 보고 싶은 것이 다릅니다 — 동선의 빽빽함도 숙소도
--   다릅니다. 내놓을 때 원본 여행에 모임이 있었는지를 적어 둡니다. 원본이
--   나중에 모임을 옮기거나 지워져도 글은 그때의 것입니다.
--
-- copy_count · post_copies
--
--   「내 여행으로 가져오기」를 세지 않았습니다. 하트는 「좋다」지만 가져온
--   것은 <b>실제로 쓴다</b>는 뜻이라, 고르는 사람에게 더 믿을 만한 숫자입니다.
--   합계는 copy_count 에, 「이번 주」를 셀 수 있게 언제 가져갔는지는
--   post_copies 에 남깁니다. 같은 사람이 여러 번 가져가도 한 번만 셉니다.

ALTER TABLE trip_posts
    ADD COLUMN from_group BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN copy_count INTEGER NOT NULL DEFAULT 0;

UPDATE trip_posts p
SET from_group = true
FROM trips t
WHERE p.trip_id = t.id
  AND t.group_id IS NOT NULL;

CREATE TABLE post_copies (
    post_id    VARCHAR(16) NOT NULL REFERENCES trip_posts (id) ON DELETE CASCADE,
    user_id    VARCHAR(16) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, user_id)
);

CREATE INDEX idx_post_copies_at ON post_copies (created_at);
