-- 도장을 걷습니다.
--
-- 「다녀왔다」를 장소마다 눌러 표시하게 두었습니다. 그런데 갔다 왔는지는
-- 본인이 압니다. 그걸 앱에 또 눌러 주는 것은 할 일 목록에 체크하는 느낌이지
-- 여행이 아닙니다.
--
-- 같이 걷히는 것: 「3/8 다녀옴」 진행률, 여행 피드 화면, 보석함의 다녀옴 표시.
ALTER TABLE places DROP COLUMN visited_at;
ALTER TABLE places DROP COLUMN visited_by;
DROP INDEX IF EXISTS idx_places_visited;

-- 장소마다 남기던 별점과 한 줄도 걷습니다.
--
-- 사진과 글을 남기려면 <b>장소를 먼저 골라야</b> 했습니다. 그래서 숙소에서
-- 찍은 단체 사진, 이동 중에 찍은 것, 마지막 날 공항에서 먹은 우동은 올릴
-- 데가 없었습니다. 피드가 그 일을 대신합니다.
--
-- 별점은 버리는 것이 아니라 옮겨 갑니다 — place_tips 가 이미 구글 장소
-- 번호에 달려 있어서, 거기 별 한 칸을 더하면 남의 일정에서도 보이고
-- 쌓입니다(4단계).
ALTER TABLE places DROP COLUMN stars;
ALTER TABLE places DROP COLUMN review;

-- 장소에 붙은 사진 중 「그 자리에서 남긴 것」을 걷습니다.
--
-- 「다니면서 볼 것」(메뉴판·예매 화면·가는 길 지도)은 남깁니다. 그것은
-- 피드와 다른 일입니다 — 남에게 보이려고 넣는 것이 아니라 가게 앞에서
-- 꺼내 보려고 넣는 것입니다.
DELETE FROM place_photos WHERE kind = 'RECORD';

-- 남은 것이 한 가지뿐이라 칸이 거짓말을 합니다.
--
-- 값이 하나인 갈래 칸은 "여기 여러 가지가 있다" 고 말하면서 실제로는 아무것도
-- 안 가릅니다. 읽는 사람은 다른 값이 어디 있나 찾게 됩니다. 걷습니다 —
-- 필요해지면 그때 다시 둡니다.
DROP INDEX IF EXISTS idx_place_photos_of;
ALTER TABLE place_photos DROP COLUMN kind;
CREATE INDEX idx_place_photos_of ON place_photos (place_id, sort);
