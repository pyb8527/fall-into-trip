import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import { useAsync } from '@/api/use-async';
import { PhotoViewer } from '@/components/photo-viewer';
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
 *
 * <h3>알아보는 동안은 자리를 잡아 둡니다</h3>
 *
 * <p>「없으면 안 그린다」를 <b>알아보는 중</b>에도 적용하고 있었습니다. 그래서
 * 판이 열릴 때는 사진 자리가 아예 없었다가, 주소가 풀리는 순간 200픽셀이
 * 끼어들며 아래 것들이 통째로 밀려 내려갔습니다 — 읽고 있던 줄이 손가락
 * 아래에서 도망갑니다.
 *
 * <p>물어보는 동안은 빈 자리를 잡아 둡니다. 없다는 답을 받은 뒤에야 걷습니다 —
 * 그때는 한 번만 줄어들고, 아직 아무것도 안 읽고 있을 때입니다.
 *
 * <h3>눌러서 크게 봅니다</h3>
 *
 * <p>여기 뜨는 것은 400픽셀짜리 작은 판이거나 잘린 그림입니다. 간판이나
 * 메뉴를 읽으려면 크게 봐야 하고, 그 판은 {@link PhotoViewer} 한 벌을
 * 씁니다 — 우리 사진과 같은 몸짓으로 열리고 같은 자리에서 닫힙니다.
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
  const [open, setOpen] = useState(false);
  const { data, loading } = useAsync<{ url: string | null }>(
    (signal) =>
      name
        ? api.get(
            `/api/places/photo?name=${encodeURIComponent(name)}&w=${big ? 1000 : 400}`,
            signal,
          )
        : Promise.resolve({ url: null }),
    [name, big],
  );

  /* 이름조차 없으면 물어볼 것도 없습니다. */
  if (!name) {
    return null;
  }

  /* 물어보는 동안은 자리만 잡아 둡니다. 안 잡으면 주소가 풀리는 순간
     아래 것들이 통째로 밀려 내려갑니다. */
  if (loading) {
    return <View style={[styles.frame, { height }, style]} />;
  }

  if (!data?.url) {
    return null;
  }

  const shot = data.url;

  return (
    <>
      <Pressable
        style={[styles.frame, { height }, style]}
        onPress={() => setOpen(true)}
        accessibilityLabel="장소 사진 크게 보기">
        <Image
          source={{ uri: shot }}
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
      </Pressable>

      {/* 크게 볼 때도 찍은 사람을 적습니다 — 구글이 그렇게 요구합니다. */}
      <PhotoViewer uris={[shot]} visible={open} by={by} onClose={() => setOpen(false)} />
    </>
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
