package net.weeniebeenie.fit.shared.domain;

import net.weeniebeenie.fit.shared.error.ApiException;

/**
 * 좌표.
 *
 * 범위 검증을 이 자리에 모아 둡니다. 장소를 만들 때도 고칠 때도, 구글 링크를
 * 펼쳐 좌표를 채울 때도 같은 규칙을 통과해야 하므로 값 자체가 스스로를
 * 지키게 두는 편이 낫습니다.
 */
public record Coordinates(double lat, double lng) {

    public Coordinates {
        if (!Double.isFinite(lat) || !Double.isFinite(lng)) {
            throw ApiException.badRequest("좌표가 올바르지 않습니다.");
        }
        if (lat < -90 || lat > 90) {
            throw ApiException.badRequest("위도는 -90 에서 90 사이여야 합니다.");
        }
        if (lng < -180 || lng > 180) {
            throw ApiException.badRequest("경도는 -180 에서 180 사이여야 합니다.");
        }
    }

    public static Coordinates of(Double lat, Double lng) {
        if (lat == null || lng == null) {
            throw ApiException.badRequest("좌표를 입력해 주세요.");
        }
        return new Coordinates(lat, lng);
    }
}
