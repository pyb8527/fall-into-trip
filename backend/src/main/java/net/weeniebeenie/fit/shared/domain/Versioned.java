package net.weeniebeenie.fit.shared.domain;

import net.weeniebeenie.fit.shared.error.ApiException;

/**
 * 내가 본 판이 아직 최신인지 확인합니다.
 *
 * <p>@Version 만 붙여 두면 한 트랜잭션 안에서 부딪히는 것만 막힙니다. 화면을
 * 열어 두고 한참 뒤에 저장하는 경우는 요청과 요청 사이라, 서버가 그때그때
 * 최신을 읽어 고치면 앞사람 것이 조용히 사라집니다.
 *
 * <p>그래서 화면이 "내가 본 판"을 함께 보내고, 그 사이에 누가 고쳤으면
 * 되돌립니다. 판 번호를 보내지 않으면 검사하지 않습니다 — 새로 만들 때나
 * 충돌이 문제되지 않는 조작까지 막을 이유는 없습니다.
 */
public final class Versioned {

    private Versioned() {
    }

    public static void check(Long seen, long actual) {
        if (seen != null && seen.longValue() != actual) {
            throw ApiException.conflict("다른 사람이 먼저 고쳤습니다. 새로 불러온 뒤 다시 저장해 주세요.");
        }
    }
}
