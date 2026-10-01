import { Image } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { API_BASE } from '@/api/client';
import { OurPhoto } from '@/components/our-photo';
import { Colors, Radius } from '@/constants/theme';
import { Caption } from '@/ui';

/**
 * 여행기 한 장 — 표지 사진, 없으면 동선 그림.
 *
 * <h3>표지가 있으면 표지입니다</h3>
 *
 * <p>한동안 <b>늘</b> 동선 그림을 그렸습니다. "FIT 은 사진을 안 올린다" 가
 * 그때의 전제였는데, 지금은 틀립니다 — 여행기를 올릴 때 표지 사진을 고르는
 * 칸이 있고(publish-form), 서버도 목록에 {@code coverPhotoId} 를 실어
 * 보냅니다. 그런데 화면이 그 값을 한 번도 안 봤습니다.
 *
 * <p>그래서 <b>표지를 고르고 올린 사람에게도 지도만 보였습니다.</b> 고른
 * 것이 아무 데도 안 쓰이는 칸이었던 셈입니다.
 *
 * <h3>동선 그림은 뒤로 물립니다</h3>
 *
 * <p>표지가 없을 때만 그립니다. 오사카를 도는 선과 제주를 도는 선은 생김새가
 * 다르고, 그것이 곧 그 여행이 어떤 여행인지라 아무것도 없는 것보다 낫습니다.
 *
 * <p>다만 <b>구글 Static Maps 한 번</b>입니다. 한 화면에 여섯 장이 서면 여섯
 * 번이고, 그래서 표지가 있는 글은 그 호출을 아예 안 하는 편이 맞습니다 —
 * 돈이 드는 쪽을 기본값으로 두면 안 됩니다.
 *
 * <h3>글의 것은 로그인 없이 열립니다</h3>
 *
 * <p>이미 공개된 글이라서입니다. 내 여행 쪽은 반대라 부른 사람만 봅니다 —
 * 그래서 둘의 주소가 다릅니다.
 */
export function TripThumb({
  postId,
  tripId,
  coverPhotoId,
  height = 120,
  label,
}: {
  /** 올라온 글. 로그인 없이 열립니다. */
  postId?: string;
  /** 내 여행. 부른 사람만 볼 수 있습니다. */
  tripId?: string;
  /** 글쓴이가 고른 표지. 있으면 이것이 먼저입니다. */
  coverPhotoId?: string | null;
  height?: number;
  /** 그림이 없을 때 대신 적을 말. */
  label?: string;
}) {
  if (coverPhotoId) {
    return <OurPhoto id={coverPhotoId} height={height} style={styles.frame} />;
  }

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
    borderRadius: Radius.r3,
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
