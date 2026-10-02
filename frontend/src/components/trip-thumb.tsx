import { Image } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { API_BASE } from '@/api/client';
import { OurPhoto } from '@/components/our-photo';
import { Colors, Radius } from '@/constants/theme';
import { Caption } from '@/ui';

/**
 * 여행기 한 장 — 고른 표지, 없으면 첫 사진, 사진도 없을 때만 동선 그림.
 *
 * <h3>칸이 셋입니다</h3>
 *
 * <pre>
 *   1. coverPhotoId  글쓴이가 고른 표지
 *   2. firstPhotoId  그 여행의 첫 사진
 *   3. /…/map        동선 그림 — 사진이 한 장도 없을 때만
 * </pre>
 *
 * <p>한동안 1번과 3번뿐이었습니다. 표지를 고른 사람의 글은 사진이 섰지만,
 * <b>사진을 스무 장 올리고 표지만 안 고른 글은 선 그림이 섰습니다.</b> 표지
 * 고르기는 안 해도 되는 칸이라 대부분 비워 두고 올립니다 — 그러니 사진이
 * 넘치는 글의 기본값이 「사진 없음」이었던 셈입니다.
 *
 * <h3>칸을 하나 넣는 것이 값을 줄입니다</h3>
 *
 * <p>동선 그림 한 장이 <b>구글 Static Maps 한 번</b>입니다. 한 화면에 여섯
 * 장이 서면 여섯 번이고, 로그인 안 한 사람이 보는 문에는 넷이 깔립니다
 * ({@code (auth)/welcome.tsx}). 2번 칸이 생기면 그 글들이 그 호출을 아예 안
 * 합니다. 돈이 드는 쪽을 기본값으로 두면 안 됩니다.
 *
 * <p>2번은 <b>서버가 실어 보냅니다</b>({@code coverPhotoId} 옆의
 * {@code firstPhotoId}). 화면이 글마다 사진을 따로 물으면 목록 한 쪽에 스무
 * 번이 붙고, 그것은 호출 하나를 스무 개로 바꾸는 일입니다.
 *
 * <h3>그래도 3번을 안 버립니다</h3>
 *
 * <p>사진이 한 장도 없는 글은 아직 많습니다. 오사카를 도는 선과 제주를 도는
 * 선은 생김새가 다르고, 그것이 곧 그 여행이 어떤 여행인지라 아무것도 없는
 * 것보다 낫습니다.
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
  firstPhotoId,
  height = 120,
  label,
  style,
}: {
  /** 올라온 글. 로그인 없이 열립니다. */
  postId?: string;
  /** 내 여행. 부른 사람만 볼 수 있습니다. */
  tripId?: string;
  /** 글쓴이가 고른 표지. 있으면 이것이 먼저입니다. */
  coverPhotoId?: string | null;
  /**
   * 표지가 없을 때 쓸 그 여행의 첫 사진.
   *
   * <p><b>안 넘겨도 됩니다.</b> 안 넘기면 표지와 동선 그림 둘뿐이던 예전 그대로
   * 입니다 — 부르는 자리가 여럿이라, 서버가 이 값을 싣기 시작한 것과 화면들이
   * 그것을 넘기기 시작하는 것이 같은 날이어야 할 이유가 없습니다.
   */
  firstPhotoId?: string | null;
  height?: number;
  /** 그림이 없을 때 대신 적을 말. */
  label?: string;
  /**
   * 바탕 틀에 덧씌울 모양.
   *
   * <p>이미 모서리를 쥐고 있는 판 안에 들어갈 때 쓰입니다 — 그 자리에서는
   * 모서리를 두 겹으로 두르면 안쪽 둥근 선이 바탕색으로 비칩니다.
   */
  style?: object;
}) {
  /* 표지가 먼저, 없으면 첫 사진. 둘 다 우리 서버의 사진이라 그리는 법이
     같습니다 — 어느 쪽인지는 이 자리에서만 따지고, 아래로는 안 넘깁니다. */
  const photoId = coverPhotoId ?? firstPhotoId;
  if (photoId) {
    return <OurPhoto id={photoId} height={height} style={[styles.frame, style]} />;
  }

  const path = postId
    ? `/api/posts/${encodeURIComponent(postId)}/map`
    : tripId
      ? `/api/trips/${encodeURIComponent(tripId)}/map`
      : null;

  if (!path) {
    return (
      <View style={[styles.frame, styles.empty, { height }, style]}>
        <Caption tone="muted">{label ?? '그림 없음'}</Caption>
      </View>
    );
  }

  return (
    <View style={[styles.frame, { height }, style]}>
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
