package net.weeniebeenie.fit.trip.domain;

/**
 * 그날 되는지.
 *
 * <p>칸이 셋입니다. 「돼요 / 안 돼요」 둘만 두면 「되긴 되는데 연차를
 * 써야 해요」가 둘 중 하나로 뭉개집니다 — 그런 날을 고르면 누군가
 * 말없이 손해를 봅니다.
 */
public enum DateChoice {

    /** 돼요. */
    YES,

    /** 어쩔 수 없으면 돼요. 「안 돼요」는 아니므로 2순위 셈에 남습니다. */
    IF_NEED,

    /** 안 돼요. */
    NO
}
