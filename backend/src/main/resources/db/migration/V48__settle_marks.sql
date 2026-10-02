-- 정산 「보냈어요 / 받았어요」 표시.
--
-- 송금 줄 하나마다 보낸 사람이 「보냈어요」를, 받은 사람이 「받았어요」를
-- 누릅니다. 둘 다 눌리면 그 줄이 접힙니다.
--
-- 앱이 독촉하지 않습니다
--
--   「안 보낸 사람에게 앱이 대신 알림」은 껄끄러움을 없애는 듯하지만, 앱이
--   독촉하면 받는 사람에게는 공개 망신이 됩니다. 표시만 받습니다. 실제
--   송금(결제 연동)도 하지 않습니다.
--
-- 금액이 같은 줄에만 남습니다
--
--   송금 줄은 지출이 바뀔 때마다 다시 셉니다(저장하지 않습니다). 그래서 표시를
--   (누가 → 누구에게, 통화) 로 묶고 그때의 금액을 함께 적어 둡니다. 다시 센
--   금액이 다르면 그 표시는 없는 것으로 봅니다 — 3만 원을 보냈다고 했는데 줄이
--   4만 원이 됐으면, 그 「보냈어요」는 지금 줄에 대한 말이 아닙니다.

CREATE TABLE settle_marks (
    trip_id     VARCHAR(16) NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    from_id     VARCHAR(16) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    to_id       VARCHAR(16) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    currency    VARCHAR(3)  NOT NULL,

    -- 표시를 단 때의 금액. 다시 센 줄과 다르면 이 표시는 안 보입니다
    amount      INTEGER     NOT NULL,

    sent_at     TIMESTAMPTZ,
    received_at TIMESTAMPTZ,

    PRIMARY KEY (trip_id, from_id, to_id, currency)
);
