-- 한 장소에 여러 장.
--
-- 도장 한 자리에 사진이 한 장뿐이었습니다. 그런데 한 곳에서 여러 장을 찍는
-- 것이 보통이고, 그중 한 장만 고르라고 하면 나머지는 갈 데가 없습니다.
--
-- 줄을 따로 둡니다. 배열 칸으로 두면 사진이 지워졌을 때 없는 번호가 남는데,
-- 그러면 화면에 깨진 자리가 생깁니다. 줄로 두면 사진이 지워질 때 함께 갑니다.
CREATE TABLE visit_photos (
    user_id  VARCHAR(16) NOT NULL,
    place_id VARCHAR(16) NOT NULL,
    photo_id VARCHAR(16) NOT NULL REFERENCES photos (id) ON DELETE CASCADE,
    -- 올린 차례. 고른 차례대로 서야 그날의 흐름이 보입니다.
    sort     INTEGER     NOT NULL,
    PRIMARY KEY (user_id, place_id, photo_id),
    FOREIGN KEY (user_id, place_id) REFERENCES visits (user_id, place_id) ON DELETE CASCADE
);

CREATE INDEX idx_visit_photos_place ON visit_photos (place_id);

-- 한 장씩 붙어 있던 것을 옮깁니다.
INSERT INTO visit_photos (user_id, place_id, photo_id, sort)
SELECT user_id, place_id, photo_id, 0
FROM visits
WHERE photo_id IS NOT NULL;

ALTER TABLE visits DROP COLUMN photo_id;
