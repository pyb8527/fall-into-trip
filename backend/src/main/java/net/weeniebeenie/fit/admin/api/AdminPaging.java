package net.weeniebeenie.fit.admin.api;

/**
 * 목록 요청의 크기를 다듬습니다.
 *
 * 운영 화면은 계정과 감사 로그를 통째로 훑을 수 있는 자리입니다. size 를
 * 그대로 믿으면 실수 한 번에 수십만 줄을 끌어와 서버가 멎습니다.
 */
final class AdminPaging {

    private static final int DEFAULT = 20;
    private static final int MAX = 100;

    private AdminPaging() {
    }

    static int size(int requested) {
        if (requested < 1) {
            return DEFAULT;
        }
        return Math.min(requested, MAX);
    }
}
