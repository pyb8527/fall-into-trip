-- 장소에 적어 두는 비용을, 셈할 수 있는 값으로.
--
-- 기존 cost 칸은 그대로 둡니다. 거기에는 "무료", "1인 2천엔", "￥1,200~1,800"
-- 같은 것이 들어 있어서 숫자로 읽으려 들면 틀리고, 틀린 돈은 정산에서
-- 드러납니다. 값을 옮기지 않고 숫자 칸을 옆에 답니다.
--
-- cost_amount 는 그 통화의 가장 작은 단위입니다 — expenses.amount 와 같은
-- 규칙이라야 잡아 둔 것과 쓴 것을 나란히 놓을 수 있습니다.

alter table places add column cost_amount   integer;
alter table places add column cost_currency varchar(3);
