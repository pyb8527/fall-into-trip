-- 소식함이 서려면 칸 둘이 필요합니다.

-- 어디까지 봤는가. NULL 이면 한 번도 안 본 것이고, 그때는 전부 새것입니다.
alter table users add column news_seen_at timestamptz;

-- 넣은 것과 고친 것을 가릅니다.
--
-- 지금까지 places 에는 updated_at 만 있었습니다. 그래서 줄만 보고는 방금
-- 넣은 것인지 넣어 둔 것을 고친 것인지 알 수 없었고, 소식함이 갓 들어온
-- 장소에도 "고쳤습니다" 라고 적게 됩니다. 같은 순간에 나가는 푸시는
-- "넣었습니다" 라고 말하므로, 한 사건에 두 문장이 됩니다.
alter table places add column created_at timestamptz;
update places set created_at = updated_at where created_at is null;
alter table places alter column created_at set not null;
alter table places alter column created_at set default now();

-- 소식은 늘 "최근 것부터 30일" 로 읽습니다. 여행 여럿의 장소를 한 질의로
-- 긁으므로 시각에 색인이 없으면 매번 전부 훑습니다.
create index if not exists idx_places_updated_at on places (updated_at desc);
