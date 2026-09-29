import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import { useAsync } from '@/api/use-async';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Caption } from '@/ui';

/**
 * 장소 사진 한 장.
 *
 * <h3>왜 이름만 받는가</h3>
 *
 * <p>구글이 주는 그림 주소는 잠깐만 삽니다. 장소 정보에 실어 두면 화면을 그릴
 * 때쯤 이미 죽어 있어서, 사진 자리가 빈 채로 남습니다. 그래서 정보에는
 * <b>이름</b>만 싣고, 그릴 때 서버에 풀어 달라고 합니다.
 *
 * <h3>찍은 사람을 함께 적습니다</h3>
 *
 * <p>구글이 그렇게 요구합니다. 밝히지 못할 사진은 아예 안 받아 오도록 서버가
 * 거르고 있지만(PlaceInfoService), 받은 것은 여기서 반드시 적습니다.
 *
 * <h3>없으면 자리를 안 만듭니다</h3>
 *
 * <p>사진이 없는 곳이 흔합니다 — 좌표만 찍어 둔 곳, 구글이 모르는 곳. 빈 회색
 * 네모를 남겨 두면 목록이 사진 있는 줄과 없는 줄로 들쭉날쭉해집니다. 아예
 * 아무것도 안 그립니다.
 */
export function PlacePhoto({
  name,
  by,
  height,
  /**
   * 큰 그림이 필요한 자리인지.
   *
   * <p>넓이는 서버가 둘 중 하나로 정합니다 — 아무 숫자나 받으면 같은 사진을
   * 넓이마다 따로 물어야 해서 그만큼 값이 듭니다.
   */
  big,
  style,
}: {
  name: string | null | undefined;
  by: string | null | undefined;
  height: number;
  big?: boolean;
  style?: object;
}) {
  const { data } = useAsync<{ url: string | null }>(
    (signal) =>
      name
        ? api.get(
            `/api/places/photo?name=${encodeURIComponent(name)}&w=${big ? 1000 : 400}`,
            signal,
          )
        : Promise.resolve({ url: null }),
    [name, big],
  );

  if (!name || !data?.url) {
    return null;
  }

  return (
    <View style={[styles.frame, { height }, style]}>
      <Image
        source={{ uri: data.url }}
        style={styles.photo}
        contentFit="cover"
        /* 뜰 때 한 번 스며들게 합니다. 툭 나타나면 그 자리에 있던 글이
           밀려난 것처럼 보입니다. */
        transition={180}
        accessibilityLabel="장소 사진"
      />
      {by ? (
        /* 그림 위에 얹습니다. 아래 줄로 빼면 사진마다 한 줄씩 늘어서,
           목록에서는 사진보다 이름이 더 많은 자리를 먹습니다. */
        <View style={styles.by}>
          <Caption tone="inverse">{by}</Caption>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    /* 받아 오는 동안 비어 있는 자리. 흰 바탕에 흰 자리를 두면 그림이 뜰 때
       화면이 덜컥합니다. */
    backgroundColor: Colors.fill,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  by: {
    position: 'absolute',
    left: Spacing.xs,
    bottom: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    /* 사진이 밝든 어둡든 글자가 읽혀야 합니다. */
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});
