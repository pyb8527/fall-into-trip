package net.weeniebeenie.fit.trip.domain;

/**
 * 이 여행에 가는지.
 *
 * <p>줄이 없는 것도 {@link #MAYBE} 입니다 — 아무도 답하지 않은 여행에 멤버
 * 수만큼 줄을 미리 깔지 않습니다.
 */
public enum GoingAnswer {

    /** 갈게요. */
    GOING,

    /**
     * 못 가요.
     *
     * <p><b>이 하나만</b> 셈에서 빠집니다 — 합의, 정산 나눌 사람, 일정 푸시,
     * 챙길 것 맡을 사람.
     *
     * <p>보는 것은 그대로입니다. 못 가는 사람도 그룹 여행을 봅니다.
     */
    NOT_GOING,

    /**
     * 아직 몰라요.
     *
     * <p>셈에 <b>남습니다.</b> 표 안 던진 사람을 미정으로 보는 지금
     * 규칙({@code CandidateService})과 같은 결입니다 — 안 가는 것이 분명한
     * 사람만 빠집니다.
     */
    MAYBE
}
