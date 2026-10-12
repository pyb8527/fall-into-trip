-- 정산 — 「주고받았어요」를 셈 줄에 붙은 표시가 아니라 실제로 오간 돈으로 적습니다.
--
-- 무엇이 틀렸나
--
--   V48 은 「보냈어요 / 받았어요」를 (누가 → 누구에게, 통화) 줄에 붙이고, 다시
--   센 금액이 표시를 단 때와 같을 때만 보여 줬습니다. 그런데 송금 줄은 지출로
--   다시 셉니다 — 이미 오간 돈은 셈에 들어가지 않습니다. 그래서 1,900엔을
--   주고받고 나서 500엔짜리 지출을 하나 더 적으면
--
--     · 금액이 그대로인 경우(낸 사람 혼자 나누는 지출 등) — 줄이 여전히
--       1,900엔이라 옛 「주고받았어요」가 그대로 붙어, 이제 끝난 셈처럼 보이고
--     · 금액이 바뀐 경우 — 줄이 「1,650 보내세요」로 다시 서고 표시는
--       사라집니다. 이미 보낸 1,900엔을 앱이 말없이 잊은 것입니다
--
--   둘 다 같은 뿌리입니다. 오간 돈을 셈에 넣지 않고 셈 결과에 스티커로 붙였기
--   때문입니다.
--
-- 그래서
--
--   양쪽이 다 누른 순간, 그 금액을 「가 → 나, 얼마」 한 건으로 적습니다
--   (settle_payments). 셈은 지출에 이 건들을 더해서 냅니다 — 보낸 사람은 그만큼
--   덜 줄 것이 되고 받은 사람은 그만큼 덜 받을 것이 됩니다. 그러면 나중에
--   지출이 늘어도 남은 줄은 「아직 오가지 않은 몫」만 말합니다.
--
--   settle_marks 는 그대로 둡니다. 한쪽만 누른 동안(「보냈대요」)의 자리입니다.
--   그 표시는 여전히 금액이 같은 줄에만 보입니다 — 아직 돈이 오갔다고 둘이
--   맞춘 것이 아니라, 줄이 바뀌면 다시 누르는 편이 맞습니다.
--
-- 사람 칸은 CASCADE 가 아닙니다
--
--   expenses.payer_id 와 같은 까닭입니다(V58). 탈퇴한 사람이 받은 돈이 통째로
--   사라지면 남은 사람의 셈이 말없이 바뀝니다 — 「민수에게 1,900엔 보냈다」가
--   없어지면 그 1,900엔을 다시 보내라고 나옵니다. 탈퇴할 때 이 칸들도 「탈퇴한
--   사람」으로 옮깁니다(AccountDeletionService). 여행이 지워지면 함께 지웁니다.

CREATE TABLE settle_payments (
    id           VARCHAR(16) PRIMARY KEY,
    trip_id      VARCHAR(16) NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    from_id      VARCHAR(16) NOT NULL REFERENCES users (id),
    to_id        VARCHAR(16) NOT NULL REFERENCES users (id),
    currency     VARCHAR(3)  NOT NULL,

    -- 그 통화의 가장 작은 단위(expenses.amount 와 같습니다). 0 원을 주고받은
    -- 기록은 뜻이 없습니다
    amount       INTEGER     NOT NULL CHECK (amount > 0),

    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- 둘째 사람이 누른 때. 화면이 「언제 주고받았나」로 보여 줍니다
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (from_id <> to_id)
);

CREATE INDEX settle_payments_trip ON settle_payments (trip_id);

-- 이미 양쪽이 다 누른 표시는 오간 돈으로 옮깁니다.
--
-- 표시를 단 때의 금액이 곧 주고받은 금액입니다. 지금 다시 센 줄과 금액이
-- 달라 화면에서 사라져 있던 표시도 옮깁니다 — 그 돈은 실제로 오갔고, 이번에
-- 고치려는 것이 바로 그것을 잊는 일입니다.
--
-- [옮기기 시작] — 이 아래 두 문장은 settle-mark.test.mjs 가 그대로 떼어 돌려 봅니다.
INSERT INTO settle_payments (id, trip_id, from_id, to_id, currency, amount, created_at, confirmed_at)
SELECT substr(md5(random()::text || clock_timestamp()::text || m.trip_id || m.from_id || m.to_id || m.currency), 1, 12),
       m.trip_id, m.from_id, m.to_id, m.currency, m.amount,
       greatest(m.sent_at, m.received_at), greatest(m.sent_at, m.received_at)
FROM settle_marks m
WHERE m.sent_at IS NOT NULL AND m.received_at IS NOT NULL
  AND m.amount > 0 AND m.from_id <> m.to_id;

DELETE FROM settle_marks WHERE sent_at IS NOT NULL AND received_at IS NOT NULL;
-- [옮기기 끝]
