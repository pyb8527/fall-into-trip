-- 기록은 여행의 것입니다.
--
-- 도장은 이미 여행의 것으로 옮겼는데(V34) 거기 붙는 사진과 한 줄은 아직
-- 사람마다 따로였습니다. 그래서 셋이 간 여행에서 한 장소에 세 덩어리가
-- 나란히 섰고, 남이 올린 것은 손댈 수가 없었습니다. 같이 다녀온 자리의
-- 기록인데 각자 자기 것만 고칠 수 있으면, 흐린 사진 하나를 바꾸는 데도
-- 올린 사람이 앱을 열어야 합니다.
--
-- 한 장소에 하나로 둡니다. 그 여행 멤버면 누구나 더하고 고치고 뺍니다.

-- 별점과 한 줄은 도장 옆으로 갑니다. 다녀왔다는 사실과 그때 어땠는지는
-- 같은 자리의 이야기입니다.
--
-- note 가 아니라 review 인 까닭은 places.note 가 이미 차 있어서입니다 —
-- 그쪽은 가기 전에 적어 두는 메모이고 이쪽은 다녀와서 남기는 말입니다.
ALTER TABLE places ADD COLUMN stars SMALLINT;
ALTER TABLE places ADD COLUMN review VARCHAR(200);

-- 사람마다 남겨 둔 것을 장소로 올립니다.
--
-- 한 장소에 여럿이 남겼으면 먼저 남긴 사람 것을 둡니다. 이어 붙이면 누가 한
-- 말인지 모르는 한 덩어리가 되고, 골라 내면 무엇을 버렸는지 아무도 모릅니다.
UPDATE places p
SET stars = first.stars,
    review = first.note
FROM (
    SELECT DISTINCT ON (place_id) place_id, stars, note
    FROM visits
    WHERE stars IS NOT NULL OR note IS NOT NULL
    ORDER BY place_id, visited_at ASC
) AS first
WHERE p.id = first.place_id;

-- 사진도 장소에 답니다.
--
-- kind 를 두는 까닭은 사진이 두 가지 일을 하기 때문입니다.
--
--   RECORD    다녀와서 남긴 것. 여행기에 실립니다.
--   REFERENCE 가기 전에 챙겨 둔 것 — 메뉴판, 예매 화면, 가는 길 지도.
--             여행기에는 안 실립니다.
--
-- 이 둘을 한 칸에 담아 두면 남의 여행기에 예매 QR 이 실립니다. 표를 나누는
-- 대신 칸 하나로 가르는 것은, 붙이고 떼고 지우는 일이 양쪽이 똑같아서입니다.
CREATE TABLE place_photos (
    place_id VARCHAR(16) NOT NULL REFERENCES places (id) ON DELETE CASCADE,
    photo_id VARCHAR(16) NOT NULL REFERENCES photos (id) ON DELETE CASCADE,
    kind     VARCHAR(10) NOT NULL,
    -- 올린 차례. 고른 차례대로 서야 그날의 흐름이 보입니다.
    sort     INTEGER     NOT NULL,
    -- 누가 올렸는지. 손대는 것을 막는 데는 안 씁니다 — 멤버면 누구나
    -- 고칩니다. 사진 파일 자체를 지우는 것만 올린 사람 몫입니다.
    added_by VARCHAR(16) REFERENCES users (id) ON DELETE SET NULL,
    PRIMARY KEY (place_id, photo_id)
);

CREATE INDEX idx_place_photos_of ON place_photos (place_id, kind, sort);

-- 사람마다 붙어 있던 것을 한 줄로 폅니다. 차례는 장소 안에서 다시 셉니다 —
-- 사람이 갈라져 있을 때는 저마다 0 부터였습니다.
INSERT INTO place_photos (place_id, photo_id, kind, sort, added_by)
SELECT place_id,
       photo_id,
       'RECORD',
       ROW_NUMBER() OVER (PARTITION BY place_id ORDER BY user_id, sort) - 1,
       user_id
FROM visit_photos;

-- 옛 자리는 걷습니다. 별점·한 줄·사진이 다 옮겨 갔으니 남은 것이 없습니다.
DROP TABLE visit_photos;
DROP TABLE visits;
