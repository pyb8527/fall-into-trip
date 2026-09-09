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

    /**
     * 두 좌표 사이의 거리(미터).
     *
     * <p>지구를 공으로 놓고 잽니다. 실제 지구는 조금 눌린 타원이라 아주 먼
     * 거리에서는 몇 미터씩 어긋나지만, 우리가 이것을 쓰는 곳은 "같은 자리에
     * 또 꽂았나" 를 보는 수십 미터짜리 판단이라 그 차이가 문제되지 않습니다.
     */
    public double metersTo(Coordinates other) {
        double r = 6_371_000;
        double dLat = Math.toRadians(other.lat - lat);
        double dLng = Math.toRadians(other.lng - lng);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat)) * Math.cos(Math.toRadians(other.lat))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    public static Coordinates of(Double lat, Double lng) {
        if (lat == null || lng == null) {
            throw ApiException.badRequest("좌표를 넣어 주세요.");
        }
        return new Coordinates(lat, lng);
    }
}
