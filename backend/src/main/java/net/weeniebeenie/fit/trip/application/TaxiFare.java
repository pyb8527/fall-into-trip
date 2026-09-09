package net.weeniebeenie.fit.trip.application;

/**
 * 택시로 가면 얼마쯤 나올지.
 *
 * <p>"지하철 25분 / 택시 10분" 만 보여 주면 고를 수가 없습니다. 15분을 아끼려고
 * 얼마를 더 내는지가 붙어야 그 자리에서 결정이 됩니다.
 *
 * <p><b>구글은 택시 요금을 알려 주지 않습니다.</b> 대중교통 요금은 구글이 주는
 * 것을 그대로 쓰지만, 택시는 여기서 어림합니다. 그래서 화면에도 반드시
 * "어림값" 이라고 적습니다 — 정확한 값인 척하면 그 돈을 들고 탔다가 모자랍니다.
 *
 * <p>어림하는 방법은 기본요금 + 거리요금뿐입니다. 시간요금·심야할증·유료도로는
 * 넣지 않았습니다. 넣으려면 그 나라의 규정을 정확히 알아야 하는데, 반쯤 아는
 * 것으로 계산하면 틀린 값을 더 그럴듯하게 만들 뿐입니다. 그래서 실제로는
 * 여기서 나온 값보다 조금 더 나옵니다.
 *
 * <p>나라는 좌표로 가릅니다. 정확한 국경이 아니라 사각형입니다. 국경 근처에서는
 * 옆 나라 요금이 나올 수 있지만, 어차피 어림값이라 그 정도는 감수합니다. 표에
 * 없는 곳은 <b>아무것도 내놓지 않습니다</b> — 모르는 것을 지어내지 않습니다.
 */
final class TaxiFare {

    private TaxiFare() {
    }

    /**
     * 한 나라의 요금 얼개.
     *
     * @param base   기본요금
     * @param within 기본요금에 포함된 거리(m)
     * @param perKm  그 뒤 1km 마다
     * @param step   화면에 내놓을 때 반올림할 자리. 원 단위까지 보여 주면
     *               어림값이 정확한 값처럼 보입니다.
     */
    private record Rate(String currency, double base, int within, double perKm, int step) {
    }

    /**
     * 좌표 사각형과 요금.
     *
     * <p>좁은 것을 앞에 둡니다. 한국 상자와 일본 상자는 대한해협에서 겹치는데,
     * 먼저 걸리는 쪽이 이깁니다.
     */
    private record Zone(double minLat, double maxLat, double minLng, double maxLng, Rate rate) {
        boolean has(double lat, double lng) {
            return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
        }
    }

    /* 2025년 기준 각 도시의 대표 요금입니다. 지역마다 다르므로 어디까지나 어림. */
    private static final Zone[] ZONES = {
            /* 한국 — 서울 중형 기본 4,800원(1.6km), 이후 약 1,000원/km */
            new Zone(33.0, 38.7, 124.5, 132.0, new Rate("KRW", 4800, 1600, 1000, 100)),
            /* 대만 — 타이베이 NT$85(1.25km), 이후 약 NT$25/km */
            new Zone(21.8, 25.4, 119.3, 122.1, new Rate("TWD", 85, 1250, 25, 5)),
            /* 홍콩 — 도심 HK$29(2km), 이후 약 HK$10.5/km */
            new Zone(22.1, 22.6, 113.8, 114.5, new Rate("HKD", 29, 2000, 10.5, 1)),
            /* 일본 — 도쿄 ¥500(1.096km), 이후 약 ¥400/km */
            new Zone(24.0, 45.8, 122.5, 146.0, new Rate("JPY", 500, 1096, 400, 50)),
            /* 싱가포르 — S$4.4 기본, 이후 약 S$0.9/km */
            new Zone(1.15, 1.5, 103.5, 104.1, new Rate("SGD", 4.4, 1000, 0.9, 1)),
            /* 태국 — 방콕 ฿35(1km), 이후 약 ฿7/km */
            new Zone(5.5, 20.5, 97.3, 105.7, new Rate("THB", 35, 1000, 7, 5)),
            /* 베트남 — ₫11,000 기본, 이후 약 ₫15,000/km */
            new Zone(8.2, 23.4, 102.1, 109.5, new Rate("VND", 11000, 1000, 15000, 1000)),
            /* 미국 — 도시별 편차가 큽니다. $3.5 기본, 이후 약 $2.2/km */
            new Zone(24.5, 49.4, -125.0, -66.9, new Rate("USD", 3.5, 1000, 2.2, 1)),
    };

    /**
     * 어림 요금. 표에 없는 나라이거나 거리가 없으면 null 입니다.
     *
     * @param lat    출발한 자리. 요금은 탄 곳의 나라를 따릅니다.
     * @param meters 이동 거리
     */
    static Money estimate(double lat, double lng, int meters) {
        if (meters <= 0) {
            return null;
        }
        for (Zone zone : ZONES) {
            if (zone.has(lat, lng)) {
                Rate r = zone.rate();
                double extraKm = Math.max(0, meters - r.within()) / 1000.0;
                double raw = r.base() + extraKm * r.perKm();
                long rounded = Math.round(raw / r.step()) * (long) r.step();
                return new Money(r.currency(), Math.max(r.step(), rounded), true);
            }
        }
        return null;
    }

    /**
     * 돈.
     *
     * @param estimated 우리가 어림한 값인지. 구글이 준 대중교통 요금은 false 라,
     *                  화면이 "어림" 이라고 붙일지 말지를 이것만 보고 정합니다.
     */
    record Money(String currency, long amount, boolean estimated) {
    }
}
