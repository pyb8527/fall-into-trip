-- 남긴 한 줄이 실제로 쓰였는지.
--
-- PlaceTip 은 남긴 사람에게 아무것도 돌려주지 않았습니다. 자기가 남긴 것이
-- 쓰였는지 알 길이 없어서, 남긴 사람에게 이 앱은 "한 번 글자를 넣은 곳" 으로
-- 끝났습니다.
--
-- trip_post_views 와 같은 모양입니다. 열쇠 셋이 곧 "하루 한 번" 규칙이라,
-- 두 번째 넣기가 조용히 실패하면 그만이고 세는 쪽에 조건문이 필요 없습니다.
CREATE TABLE place_tip_views (
    tip_id  VARCHAR(16) NOT NULL REFERENCES place_tips(id) ON DELETE CASCADE,
    user_id VARCHAR(16) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    on_date DATE        NOT NULL,
    PRIMARY KEY (tip_id, user_id, on_date)
);

-- 팁 하나가 몇 번 쓰였는지를 셉니다. 열쇠의 첫 칸이 tip_id 라 이 색인이
-- 없어도 되지만, 합계는 "내 팁 전부" 를 한 번에 묻습니다 — 그때는 열쇠를
-- 타고 들어가는 것이 아니라 tip_id 여럿으로 긁습니다.
CREATE INDEX ix_tip_views_tip ON place_tip_views (tip_id);
