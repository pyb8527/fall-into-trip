import { StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { metersBetween } from '@/lib/geo';
import { Chip, Row } from '@/ui';

/**
 * 목록을 무엇으로 세울지.
 *
 * <h3>왜 필요한가</h3>
 *
 * <p>구글이 준 순서는 "이 말과 얼마나 맞는가" 입니다. 그것이 대개 맞지만,
 * 고를 때 보는 눈은 그것 하나가 아닙니다 — "여기서 제일 가까운 데", "그중
 * 평이 제일 좋은 데" 는 다른 물음이고, 목록을 눈으로 훑어 답할 일이
 * 아닙니다.
 *
 * <h3>기본은 건드리지 않습니다</h3>
 *
 * <p>처음에는 늘 받은 순서 그대로입니다. 평점순을 기본으로 두면 후기 세 개에
 * 별 다섯인 곳이 늘 맨 위에 섭니다. 사람이 고를 때만 바꿉니다.
 */
export type SortBy = 'given' | 'rating' | 'near' | 'name';

/** 무엇으로 셀 수 있는지. 화면마다 가진 값이 달라 골라 넘깁니다. */
export type SortOption = { value: SortBy; label: string };

/** 어느 화면에나 있는 것들. */
export const SORT_GIVEN: SortOption = { value: 'given', label: '기본순' };
export const SORT_RATING: SortOption = { value: 'rating', label: '평점순' };
export const SORT_NEAR: SortOption = { value: 'near', label: '가까운순' };
export const SORT_NAME: SortOption = { value: 'name', label: '이름순' };

export function SortBar({
  options,
  value,
  onChange,
}: {
  options: SortOption[];
  value: SortBy;
  onChange: (next: SortBy) => void;
}) {
  /* 고를 것이 하나뿐이면 띠를 내지 않습니다. 누를 수 없는 것이 자리만
     차지합니다. */
  if (options.length < 2) {
    return null;
  }
  return (
    <Row gap={Spacing.xs} style={styles.bar}>
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          selected={value === o.value}
          onPress={() => onChange(o.value)}
        />
      ))}
    </Row>
  );
}

/** 셀 수 있는 것들. 없는 값은 비워 둡니다. */
type Sortable = {
  name: string;
  lat: number;
  lng: number;
  rating?: number | null;
  ratingCount?: number | null;
};

/**
 * 목록을 세웁니다.
 *
 * <p>원본을 건드리지 않습니다 — 세우는 것은 보는 방식이지 목록 자체가
 * 바뀌는 일이 아닙니다.
 *
 * @param from 가까운순의 기준. 없으면 그 갈래는 원래 순서로 둡니다.
 */
export function sortPlaces<T extends Sortable>(
  list: T[],
  by: SortBy,
  from?: { lat: number; lng: number } | null,
): T[] {
  if (by === 'given') {
    return list;
  }

  const out = [...list];

  if (by === 'name') {
    /* 한글·일본어·영어가 섞입니다. localeCompare 가 그 순서를 압니다. */
    return out.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }

  if (by === 'near') {
    if (!from) {
      return list;
    }
    return out.sort((a, b) => metersBetween(from, a) - metersBetween(from, b));
  }

  /*
    평점순.

    평점이 없는 곳은 뒤로 보냅니다 — 0점이 아니라 "모름" 입니다. 앞에 두면
    아직 아무도 안 남긴 새 가게가 별 넷짜리를 밀어냅니다.

    같은 평점이면 후기가 많은 쪽이 앞입니다. 별 다섯이 셋과 별 다섯이
    삼천은 같은 별 다섯이 아닙니다.
  */
  return out.sort((a, b) => {
    const ar = a.rating ?? -1;
    const br = b.rating ?? -1;
    if (ar !== br) {
      return br - ar;
    }
    return (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
  });
}

const styles = StyleSheet.create({
  bar: {
    flexWrap: 'wrap',
  },
});
