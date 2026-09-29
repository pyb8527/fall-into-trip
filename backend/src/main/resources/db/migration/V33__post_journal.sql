-- 글이 여행기가 됩니다.
--
-- 여행기를 따로 만들지 않습니다. 글에는 이미 사본·추천·댓글·가져오기·신고가
-- 다 있고, 여행기는 거기에 표지와 공개 범위와 장소별 자취가 붙은 것입니다.
-- 새로 만들면 그 다섯을 두 벌 갖게 됩니다.

-- 표지 사진. 사진이 지워지면 글은 남고 표지만 떨어집니다.
ALTER TABLE trip_posts ADD COLUMN cover_photo_id VARCHAR(16) REFERENCES photos (id) ON DELETE SET NULL;

-- 어디까지 보이는지.
--
--   LISTED   둘러보기에 뜹니다. 지금까지의 동작이라 기본값입니다.
--   LINK     주소를 아는 사람만. 목록·검색·인기에 안 잡힙니다.
--   PRIVATE  나만. 다녀온 것을 정리해 두기만 할 때.
--
-- 이미 올라간 글은 전부 LISTED 입니다 — 올린 사람이 그러라고 올린 것이고,
-- 여기서 조용히 감추면 남이 가져간 글이 사라진 것처럼 보입니다.
ALTER TABLE trip_posts ADD COLUMN visibility VARCHAR(12) NOT NULL DEFAULT 'LISTED';

-- 목록·검색·인기가 모두 "뜨는 글" 만 봅니다. 감춘 것과 함께 걸립니다.
CREATE INDEX idx_trip_posts_shown ON trip_posts (visibility) WHERE hidden = false;
