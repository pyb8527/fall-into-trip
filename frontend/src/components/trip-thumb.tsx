import { Image } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { API_BASE } from '@/api/client';
import { Colors, Radius } from '@/constants/theme';
import { Caption } from '@/ui';

/**
 * 여행 한 장 — 동선을 그린 그림.
 *
 * <h3>왜 사진이 아닌가</h3>
 *
 * <p>FIT 은 사진을 안 올립니다. 서버에 쌓아 둘 자리가 없고, 구글 장소 사진은
 * 글쓴이 이름과 프로필을 함께 띄워야 하는 별도의 의무가 붙습니다
 * (place-detail-sheet 에 같은 이야기가 적혀 있습니다).
 *
 * <p>대신 <b>이미 그리고 있던 것</b>이 있습니다. 안 터질 때 쓰려고 만들어 둔
 * 한 장짜리 동선 그림입니다. 오사카를 도는 선과 제주를 도는 선은 생김새가
 * 다르고, 그것이 곧 그 여행이 어떤 여행인지입니다.
 *
 * <p>사진만큼 눈을 끌지는 않습니다. 다만 <b>진짜 그 글의 내용</b>이고,
 * 새로 쌓아 둘 것이 하나도 없습니다.
 *
 * <h3>글의 것은 로그인 없이 열립니다</h3>
 *
 * <p>이미 공개된 글이라서입니다. 내 여행 쪽은 반대라 부른 사람만 봅니다 —
 * 그래서 둘의 주소가 다릅니다.
 */
export function TripThumb({
  postId,
  tripId,
  height = 120,
  label,
}: {
  /** 올라온 글. 로그인 없이 열립니다. */
  postId?: string;
  /** 내 여행. 부른 사람만 볼 수 있습니다. */
  tripId?: string;
  height?: number;
  /** 그림이 없을 때 대신 적을 말. */
  label?: string;
}) {
  const path = postId
    ? `/api/posts/${encodeURIComponent(postId)}/map`
    : tripId
      ? `/api/trips/${encodeURIComponent(tripId)}/map`
      : null;

  if (!path) {
    return (
      <View style={[styles.frame, styles.empty, { height }]}>
        <Caption tone="muted">{label ?? '그림 없음'}</Caption>
      </View>
    );
  }

  return (
    <View style={[styles.frame, { height }]}>
      {/*
        못 받아 와도 조용합니다. 장소가 하나도 없는 여행은 그릴 것이 없고,
        구글 키가 없는 자리에서도 안 나옵니다. 그럴 때 빈 회색 칸이 남는
        것은 괜찮습니다 — 글 자체는 아래 글자로 읽힙니다.
      */}
      <Image
        source={{ uri: `${API_BASE}${path}` }}
        style={styles.image}
        resizeMode="cover"
        accessibilityLabel={label ? `${label} 동선` : '동선 그림'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.fill,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
