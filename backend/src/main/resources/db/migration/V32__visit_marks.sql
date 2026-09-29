-- 도장에 남기는 것들.
--
-- 지금까지 도장은 "다녀왔다" 한 가지만 말했습니다. 그런데 도장을 찍는 자리가
-- 곧 그 장소에 서 있는 순간입니다 — 사진 한 장과 한 줄이 나오기에 그보다 좋은
-- 때가 없습니다. 돌아와서 여행기를 쓰려고 하면 그때 무엇을 느꼈는지부터 다시
-- 떠올려야 합니다.
--
-- 여기 쌓인 것이 나중에 여행기의 재료가 됩니다. 글을 올릴 때 장소마다 이미
-- 사진과 한 줄이 붙어 있으면, 쓰는 일이 "고르는 일" 로 줄어듭니다.
--
-- 셋 다 비워 둘 수 있습니다. 도장만 찍고 지나가는 것이 여전히 기본입니다.
ALTER TABLE visits ADD COLUMN photo_id VARCHAR(16) REFERENCES photos (id) ON DELETE SET NULL;
ALTER TABLE visits ADD COLUMN stars    SMALLINT;
ALTER TABLE visits ADD COLUMN note     VARCHAR(200);

-- 사진이 지워지면 도장은 남고 사진만 떨어집니다(ON DELETE SET NULL).
-- 다녀온 사실까지 같이 지울 이유는 없습니다.
