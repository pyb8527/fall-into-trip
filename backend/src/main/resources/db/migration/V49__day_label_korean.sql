-- 「Day 1」 → 「1일차」.
--
-- 날 이름의 기본값이 영어였습니다(DayLabels.labelOf). 화면은 전부 한국어인데
-- 일정의 날 머리만 「Day 1 · 10.08(목)」이라, 거기서만 다른 앱처럼 읽혔습니다.
-- 일정을 짜면서 세는 말도 「며칠째」입니다.
--
-- 사람이 고쳐 둔 이름은 안 건드립니다 — 「Day 숫자」 꼴 그대로인 것만 바꿉니다.
-- 그 꼴은 사람이 고른 것이 아니라 앱이 깔아 둔 기본값입니다.

UPDATE days
SET label = substring(label FROM 5) || '일차'
WHERE label ~ '^Day [0-9]+$';

-- 둘러보기에 내놓은 여행기는 내놓을 때 날 이름을 그대로 떠 둡니다(snapshot).
-- 같은 기본값이 거기에도 들어 있습니다.
UPDATE trip_posts
SET snapshot = jsonb_set(
        snapshot,
        '{days}',
        (SELECT jsonb_agg(
                    CASE
                        WHEN d ->> 'label' ~ '^Day [0-9]+$'
                            THEN jsonb_set(d, '{label}',
                                           to_jsonb(substring(d ->> 'label' FROM 5) || '일차'))
                        ELSE d
                    END
                    ORDER BY ord)
         FROM jsonb_array_elements(snapshot -> 'days') WITH ORDINALITY AS t(d, ord)))
WHERE jsonb_typeof(snapshot -> 'days') = 'array'
  AND jsonb_array_length(snapshot -> 'days') > 0
  AND EXISTS (SELECT 1
              FROM jsonb_array_elements(snapshot -> 'days') AS x(d)
              WHERE d ->> 'label' ~ '^Day [0-9]+$');
