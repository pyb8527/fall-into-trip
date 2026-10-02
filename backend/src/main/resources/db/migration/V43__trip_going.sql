-- 이 여행에 누가 가나.
--
-- 지금 그 자리가 비어 있습니다
--
--   TripAccessPolicy.peopleOf() 는 그룹 여행이면 <b>그룹 멤버 전부</b>를
--   돌려줍니다. 그룹을 들이기 전에는 여행마다 사람을 불렀으니 「부른 사람 =
--   가는 사람」이었는데, V38 이 여행 멤버를 그룹 멤버로 합치면서 그 둘이
--   갈렸고 아무도 그 자리를 채우지 않았습니다.
--
--   그래서 열두 명 모임에서 넷이 가는 여행이면 이렇게 됩니다.
--
--     합의 셈      넷이 다 좋다고 해도 영영 합의가 안 됩니다 (4/12)
--     정산         지정 안 한 지출이 열두 명에게 나뉩니다
--     일정 푸시    안 가는 여덟 명에게도 갑니다
--     챙길 것      안 가는 사람에게도 맡길 수 있습니다
--
--   지금 쓰는 사람이 혼자라 아직 드러나지 않았을 뿐입니다.
--
-- 답은 셋입니다
--
--   GOING / NOT_GOING / MAYBE — 갈게요 / 못 가요 / 아직 몰라요.
--
--   「아직 몰라요」는 셈에 <b>남습니다.</b> 표 안 던진 사람을 미정으로 보는
--   지금 규칙(CandidateService)과 같은 결입니다 — 안 가는 것이 분명한
--   사람만 빠집니다.
--
--   보는 권한은 안 바뀝니다. 「못 가요」라고 한 사람도 그룹 여행을 그대로
--   봅니다. 셈에서만 빠집니다.
--
-- 안 받은 것
--
--   주최자만 보는 질문지(Partiful) — 알레르기 같은 것을 받아 두는 자리가
--   따로 생기고, 그건 따로 지켜야 하는 값입니다.
--   정원·대기열(Luma) — 이 앱의 모임은 닫혀 있습니다. 자리 다툼은 말로 합니다.

CREATE TABLE trip_going (
    trip_id    VARCHAR(16) NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    user_id    VARCHAR(16) NOT NULL REFERENCES users (id) ON DELETE CASCADE,

    -- GOING / NOT_GOING / MAYBE. 줄이 없는 것도 「아직 몰라요」입니다 —
    -- 아무도 답하지 않은 여행에 열두 줄을 미리 깔지 않습니다
    answer     VARCHAR(12) NOT NULL DEFAULT 'MAYBE',

    -- 「셋째 날만 못 가요」 같은 것. 모두에게 보입니다 — 주최자만 보는
    -- 자리를 두지 않기로 했으므로, 적는 사람도 그걸 알고 적어야 합니다
    note       VARCHAR(200),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (trip_id, user_id)
);

-- 「내가 가는 여행」을 묻는 자리(마이페이지 달력에서 흐리게 둘 때)가 씁니다.
CREATE INDEX idx_trip_going_user ON trip_going (user_id);
