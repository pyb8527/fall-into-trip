-- 도장은 여행의 것입니다.
--
-- 지금까지 도장은 사람마다 따로 찍혔습니다. "같은 여행을 가도 누구는 들르고
-- 누구는 지나칠 수 있다" 는 생각이었는데, 실제로는 같은 일정을 같이 다닙니다.
-- 그래서 셋이 간 여행에서 진행률이 셋 다 달랐고, 「0/57 다녀옴」 이 누구의
-- 숫자인지 알 수 없었습니다.
--
-- 도장을 장소에 답니다. 한 사람이 찍으면 다 같이 찍힌 것입니다.
ALTER TABLE places ADD COLUMN visited_at TIMESTAMPTZ;
ALTER TABLE places ADD COLUMN visited_by VARCHAR(16) REFERENCES users (id) ON DELETE SET NULL;

-- 이미 찍혀 있던 것을 옮깁니다. 가장 먼저 찍은 사람이 찍은 것으로 둡니다 —
-- 같이 간 여행에서 처음 누른 사람이 그 자리에 있었던 사람입니다.
UPDATE places p
SET visited_at = first.at,
    visited_by = first.who
FROM (
    SELECT DISTINCT ON (place_id) place_id, visited_at AS at, user_id AS who
    FROM visits
    ORDER BY place_id, visited_at ASC
) AS first
WHERE p.id = first.place_id;

-- 어느 날이 얼마나 찼는지 셀 때 씁니다.
CREATE INDEX idx_places_visited ON places (day_id) WHERE visited_at IS NOT NULL;

-- visits 는 이제 "그 자리에서 남긴 것" 만 담습니다. 도장이 아니라 자취입니다.
--
-- 남긴 것이 하나도 없는 줄은 치웁니다. 도장은 위로 옮겨 갔으므로 그 줄들은
-- 이제 아무 말도 하지 않습니다 — 남겨 두면 "이 사람이 뭔가 남겼다" 로 잘못
-- 읽힙니다.
DELETE FROM visits
WHERE photo_id IS NULL AND stars IS NULL AND note IS NULL;
