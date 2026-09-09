package net.weeniebeenie.fit.trip.domain;

import net.weeniebeenie.fit.shared.domain.Coordinates;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * 하루 동선을 짧게 다시 세웁니다.
 *
 * <p>손으로 넣다 보면 지도에서 갈지자가 됩니다. 북쪽 절을 보고 남쪽 시장에
 * 갔다가 다시 북쪽 카페로 올라가는 식입니다. 넣을 때는 생각난 순서대로 넣게
 * 되니 어쩔 수 없는 일이고, 다 넣은 뒤 한 번 정리해 주는 편이 맞습니다.
 *
 * <h3>지키는 것</h3>
 *
 * <p><b>시간을 적어 둔 곳은 움직이지 않습니다.</b> 12:30 예약은 12:30 입니다.
 * 그것들이 기둥이 되고, 시간을 안 적은 곳들만 기둥 사이 가장 덜 돌아가는
 * 자리에 끼워 넣습니다. 동선이 조금 길어지더라도 예약을 어기는 것보다 낫습니다.
 *
 * <p>시간이 하나도 없으면 첫 곳만 그대로 두고 나머지를 다시 세웁니다. 첫 곳은
 * 대개 숙소나 아침에 들르는 데라, 거기서 출발한다는 것 자체가 뜻을 가집니다.
 *
 * <h3>재는 법</h3>
 *
 * <p>길이 아니라 직선거리로 잽니다. 실제 길을 물으면 장소 수의 제곱만큼
 * 구글에 물어야 하고, 열 곳이면 아흔 번입니다. 요금도 요금이지만 그만큼
 * 기다려야 합니다. 갈지자를 펴는 데는 직선거리로 충분합니다 — 어차피 사람이
 * 보고 받아들일지 정합니다.
 */
public final class RouteTidy {

    private RouteTidy() {
    }

    /** 다시 세운 결과. 원래와 새 길이를 함께 돌려줘 얼마나 나아지는지 보입니다. */
    public record Tidied(List<Place> order, double beforeMeters, double afterMeters) {

        /** 눈에 띄게 짧아졌는지. 몇 미터 차이로 바꾸자고 물으면 성가십니다. */
        public boolean worthIt() {
            return afterMeters < beforeMeters - 200;
        }
    }

    /**
     * @param current 지금 순서대로의 장소들
     */
    public static Tidied tidy(List<Place> current) {
        double before = totalOf(current);
        if (current.size() < 3) {
            /* 둘 이하면 바꿀 순서가 없습니다. */
            return new Tidied(List.copyOf(current), before, before);
        }

        List<Place> pinned = current.stream()
                .filter(p -> p.getTime() != null && !p.getTime().isBlank())
                .sorted(Comparator.comparing(Place::getTime))
                .toList();
        List<Place> loose = current.stream()
                .filter(p -> p.getTime() == null || p.getTime().isBlank())
                .toList();

        List<Place> built;
        if (pinned.isEmpty()) {
            built = fromNearest(current);
            built = untangle(built);
        } else {
            built = new ArrayList<>(pinned);
            for (Place p : loose) {
                insertCheapest(built, p);
            }
        }

        return new Tidied(built, before, totalOf(built));
    }

    /**
     * 가장 가까운 데를 차례로 집습니다.
     *
     * <p>첫 곳은 그대로 둡니다. 여기서 출발한다는 뜻이 이미 담겨 있습니다.
     */
    private static List<Place> fromNearest(List<Place> places) {
        List<Place> rest = new ArrayList<>(places);
        List<Place> out = new ArrayList<>();
        out.add(rest.remove(0));

        while (!rest.isEmpty()) {
            Place last = out.get(out.size() - 1);
            int best = 0;
            double bestGap = Double.MAX_VALUE;
            for (int i = 0; i < rest.size(); i++) {
                double gap = metersBetween(last, rest.get(i));
                if (gap < bestGap) {
                    bestGap = gap;
                    best = i;
                }
            }
            out.add(rest.remove(best));
        }
        return out;
    }

    /**
     * 꼬인 데를 풉니다(2-opt).
     *
     * <p>가까운 데부터 집으면 마지막에 혼자 멀리 떨어진 곳이 남아 되돌아가는
     * 일이 생깁니다. 길이 스스로 교차하는 자리를 찾아 그 구간을 뒤집으면
     * 반드시 짧아집니다. 열 곳 남짓이라 몇 번 돌아도 눈 깜짝할 사이입니다.
     */
    private static List<Place> untangle(List<Place> route) {
        List<Place> best = new ArrayList<>(route);
        boolean moved = true;
        int guard = 0;

        while (moved && guard++ < 40) {
            moved = false;
            /* 첫 곳은 건드리지 않으므로 i 는 1 부터입니다. */
            for (int i = 1; i < best.size() - 1; i++) {
                for (int k = i + 1; k < best.size(); k++) {
                    List<Place> tried = new ArrayList<>(best);
                    /* i..k 구간을 통째로 뒤집습니다. */
                    for (int a = i, b = k; a < b; a++, b--) {
                        Place swap = tried.get(a);
                        tried.set(a, tried.get(b));
                        tried.set(b, swap);
                    }
                    if (totalOf(tried) < totalOf(best) - 1) {
                        best = tried;
                        moved = true;
                    }
                }
            }
        }
        return best;
    }

    /** 가장 덜 돌아가는 자리에 끼워 넣습니다. */
    private static void insertCheapest(List<Place> route, Place p) {
        int best = route.size();
        double bestCost = Double.MAX_VALUE;

        for (int i = 0; i <= route.size(); i++) {
            double cost;
            if (i == 0) {
                cost = metersBetween(p, route.get(0));
            } else if (i == route.size()) {
                cost = metersBetween(route.get(i - 1), p);
            } else {
                /* 사이에 끼우면 원래 있던 한 구간이 두 구간이 됩니다.
                   늘어난 만큼이 값입니다. */
                cost = metersBetween(route.get(i - 1), p)
                        + metersBetween(p, route.get(i))
                        - metersBetween(route.get(i - 1), route.get(i));
            }
            if (cost < bestCost) {
                bestCost = cost;
                best = i;
            }
        }
        route.add(best, p);
    }

    /** 이어서 걸었을 때의 총 길이(미터). */
    public static double totalOf(List<Place> route) {
        double sum = 0;
        for (int i = 1; i < route.size(); i++) {
            sum += metersBetween(route.get(i - 1), route.get(i));
        }
        return sum;
    }

    private static double metersBetween(Place a, Place b) {
        return new Coordinates(a.getLat(), a.getLng())
                .metersTo(new Coordinates(b.getLat(), b.getLng()));
    }
}
