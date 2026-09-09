-- 장소마다 지도에 찍힐 그림.
--
-- 같은 모양 핀이 스무 개 꽂혀 있으면 지도는 그냥 점의 무리입니다. 라멘집인지
-- 온천인지가 핀만 보고 읽히면, 다 짜 놓은 지도를 한 장으로 찍었을 때 그것이
-- 곧 여행의 요약이 됩니다.
--
-- 이모지 자체를 넣지 않고 짧은 이름(ramen, onsen …)만 둡니다. 이모지는 기기마다
-- 다르게 생겼고, 나중에 그림을 바꾸고 싶을 때 저장된 값을 전부 고쳐야 합니다.
ALTER TABLE places ADD COLUMN icon VARCHAR(24);
ALTER TABLE saved_places ADD COLUMN icon VARCHAR(24);
ALTER TABLE trip_candidates ADD COLUMN icon VARCHAR(24);
