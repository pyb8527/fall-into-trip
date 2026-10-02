import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { FeedPost } from '@/api/types';
import { Radius } from '@/constants/theme';
import { Caption, Press, SectionHeader } from '@/ui';
import { OurPhoto } from './our-photo';

/** 한 줄에 몇 장. */
const COLS = 3;
/** 접었을 때 보여 줄 줄 수. 두 줄이면 여섯 장입니다. */
const FOLDED = COLS * 2;

/**
 * 이 여행의 사진.
 *
 * <h3>서버를 안 고칩니다</h3>
 *
 * <p>피드 글에 여행이 이미 붙어 있고({@code Post.tripId}), 여행으로 걸러
 * 읽는 길도 이미 있습니다({@code /api/feed?trip=}). 앨범은 <b>그 사진을
 * 모아 보여 주는 화면</b>일 뿐입니다 — 새 표도, 새 길도, 새 저장도
 * 없습니다.
 *
 * <h3>버린 것 둘</h3>
 *
 * <p><b>원본 화질 보관</b>을 안 합니다. 올라오는 사진은 긴 변 1600 으로 다시
 * 굽고 사람당 1000장까지입니다({@code PhotoService}). 앨범을 위해 원본을
 * 따로 쌓으면 그 한도를 깨는 일이고, 사진 한 장이 열 배로 무거워집니다.
 *
 * <p><b>「아직 안 올린 사람」 표시</b>를 안 합니다. 안 올린 사람이 드러나는
 * 것은 눈치입니다 — 좋아요를 안 하기로 한 것과 같은 자리입니다
 * ({@code docs/groups/verdict.md}).
 */
export function TripAlbum({
  tripId,
  onOpen,
}: {
  tripId: string;
  /** 사진을 누르면 그 글로. 글 하나를 여는 일은 부르는 쪽이 압니다 */
  onOpen: (post: FeedPost) => void;
}) {
  const [shots, setShots] = useState<{ id: string; post: FeedPost }[] | null>(null);
  const [all, setAll] = useState(false);

  const load = useCallback(async () => {
    try {
      /*
        첫 쪽만 받습니다.

        <p>여행 하나의 피드가 몇 쪽이 될 수 있는데, 앨범은 「이 여행에서
        찍은 것들」을 흘긋 보는 자리입니다. 다 보려면 피드로 갑니다 —
        여기서 쪽을 넘기게 하면 피드가 둘이 됩니다.
      */
      const got = await api.get<{ posts: FeedPost[] }>(
        `/api/feed?trip=${encodeURIComponent(tripId)}&page=0`,
      );
      setShots(
        got.posts.flatMap((post) => post.photoIds.map((id) => ({ id, post }))),
      );
    } catch {
      /* 앨범은 곁다리입니다. 못 받아도 일정은 보여야 합니다. */
      setShots([]);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  /* 사진이 한 장도 없으면 칸을 안 세웁니다. 「아직 없어요」를 띄우면
     올리라는 재촉으로 읽힙니다. */
  if (shots === null || shots.length === 0) {
    return null;
  }

  const shown = all ? shots : shots.slice(0, FOLDED);

  return (
    <View>
      <SectionHeader
        title="이 여행의 사진"
        tight
        note={`피드에 올린 ${shots.length}장`}
        action={
          shots.length > FOLDED ? (
            <Press onPress={() => setAll((was) => !was)} scale={1}>
              <Caption tone="brand">{all ? '접기' : '전체보기 ›'}</Caption>
            </Press>
          ) : undefined
        }
      />
      <View style={styles.grid}>
        {shown.map(({ id, post }) => (
          <Press
            key={id}
            onPress={() => onOpen(post)}
            accessibilityLabel="이 사진이 올라간 글 보기"
            scale={0.98}
            style={styles.cellBox}>
            <OurPhoto id={id} height={CELL} style={styles.shot} />
          </Press>
        ))}
      </View>
    </View>
  );
}

/*
  한 칸의 크기.

  <p>화면 폭을 재지 않고 고정값을 씁니다. 재면 첫 그림에서 폭을 몰라 한 번
  그린 뒤 다시 그리게 되고, 그 사이에 격자가 번쩍입니다. 좁은 폰(360)에서
  좌우 여백 40 을 떼면 320 이고, 셋으로 나누고 사이 4 를 빼면 104 입니다.
*/
const CELL = 104;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    /* 왼쪽 글자선에 맞춥니다. 가운데로 모으면 마지막 줄이 덜 찼을 때
       그 줄만 가운데로 몰려 격자가 흐트러집니다. */
    justifyContent: 'flex-start',
  },
  cellBox: {
    borderRadius: Radius.r2,
    overflow: 'hidden',
  },
  shot: {
    width: CELL,
  },

});
