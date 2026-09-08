-- 게시판이 100개를 넘으면 정렬만으로는 못 찾습니다. 골라 볼 수단을 둡니다.

-- 어느 지역 여행인지. 올릴 때 글쓴이가 고릅니다.
--
-- 좌표는 이미 있지만 그것이 어느 나라인지는 모릅니다. 알아내려면 장소마다
-- 역지오코딩을 돌려야 하고 그만큼 요금이 붙습니다. 고르는 것은 한 번이고
-- 글쓴이가 제일 잘 압니다.
ALTER TABLE trip_posts ADD COLUMN region VARCHAR(24);

-- 지역으로 거른 뒤 최근 순으로 보는 것이 가장 흔한 조합입니다.
CREATE INDEX ix_posts_region ON trip_posts (hidden, region, created_at DESC);

-- 며칠짜리인지로도 거릅니다. "3박 4일 일정" 은 실제로 사람들이 찾는 방식입니다.
CREATE INDEX ix_posts_days ON trip_posts (hidden, day_count);

-- 제목과 소개에서 글자를 찾습니다.
--
-- 지금은 LIKE 로 훑습니다. 글이 몇 만 개가 되기 전까지는 이것으로 충분하고,
-- 느려지면 pg_trgm 확장을 켜고 GIN 인덱스를 얹으면 됩니다. 없는 문제를 미리
-- 풀지 않습니다.
