import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { ItineraryDay, PostDetail } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { glyphOf, labelOf } from '@/constants/place-icons';
import { Spacing } from '@/constants/theme';
import { Body, Button, Caption, Chip, ListRow, Mark } from '@/ui';

/**
 * 남이 짠 일정 한 장을 <b>그 자리에서 만져 보는</b> 자리.
 *
 * <h3>왜 필요한가</h3>
 *
 * <p>문에 여행기 카드를 넷 깔아 두었습니다. 카드는 그림과 제목이라
 * "여기가 뭐 하는 곳인지" 까지는 말하지만, <b>이 앱으로 만든 것이 어떻게
 * 생겼는지</b>는 안 보여 줍니다. 그것을 보려면 글 하나에 들어가야 하고,
 * 들어가면 문을 떠난 것입니다.
 *
 * <p>구경하러 온 사람이 가입을 결심하는 자리는 설명이 아니라 <b>제품을
 * 만져 본 순간</b>입니다. 그래서 글 한 편의 일정을 문 안에 그대로 펼치고,
 * 날을 눌러 옮겨 다닐 수 있게 둡니다. 날을 누르면 장소가 바뀝니다 — 그것이
 * 이 앱의 본 화면이 하는 일의 전부입니다.
 *
 * <h3>지어낸 예시가 아닙니다</h3>
 *
 * <p>「3일차 · 아침에 카페, 점심에 …」 같은 꾸민 일정을 박아 둘 수도
 * 있었습니다. 그러면 서버가 비어도 늘 예쁘게 서고 호출도 0입니다.
 *
 * <p>안 합니다. 이 저장소가 문에서 <b>말을 걷어내고 서버가 센 것으로
 * 바꾼</b> 까닭이 그것입니다 — 읽는 사람은 꾸민 것이 참인지 알 길이
 * 없습니다. 꾸민 일정은 꾸민 후기와 같은 종류의 물건입니다. 진짜 글
 * 하나를 받아서 그대로 펼칩니다.
 *
 * <h3>옆으로 미는 쪽을 안 골랐습니다</h3>
 *
 * <p>날마다 한 장씩 {@code pagingEnabled} 로 넘기는 쪽이 손에는 더
 * 좋습니다. 그런데 날마다 장소 수가 다릅니다 — 가로로 미는 판의 높이는
 * 가장 긴 날에 맞춰지므로, 두 곳만 있는 날에서는 아래가 텅 비고, 높이를
 * 박아 두면 긴 날이 잘립니다.
 *
 * <p>칩으로 고르면 아래 목록만 갈립니다. 고르는 자리가 늘 같은 높이라
 * 화면이 안 뜁니다. 이 앱의 여행 화면도 날을 띠로 고릅니다
 * ({@code day-picker}) — 문에서 배운 몸짓이 안에서 그대로 쓰입니다.
 *
 * <h3>값</h3>
 *
 * <p>서버를 한 번 더 부릅니다({@code /api/posts/{id}} — 계정 없이
 * 열립니다). 그림은 <b>안 받습니다</b> — 사진도 지도도 걸지 않아 구글
 * 호출이 0입니다. 어느 장소인지는 선 그림({@link Mark})과 이름이
 * 말합니다.
 *
 * <p>이 묶음은 문의 아래쪽에 섭니다. 받는 동안은 <b>아무것도 안
 * 그립니다</b> — 아직 안 온 것을 「없어요」라고 하지 않고, 자리만 잡아
 * 두었다가 글이 닿으면 들어섭니다.
 */

/** 한 날에 보여 줄 장소 수. 넘는 것은 숫자로 적습니다. */
const ROWS = 4;

/**
 * @param postId 펼쳐 볼 글. 대개 인기순 첫 글입니다
 * @param onOpen 「전체 보기」를 눌렀을 때. 그 글로 보냅니다
 */
export function TripTaste({
  postId,
  onOpen,
}: {
  postId: string;
  onOpen: () => void;
}) {
  const { data } = useAsync<PostDetail>(
    (signal) => api.get(`/api/posts/${postId}`, signal),
    [postId],
  );

  /** 지금 보고 있는 날. 글이 바뀌면 첫날로 돌아갑니다. */
  const [at, setAt] = useState(0);

  /* 아직 안 왔습니다. 여기서 먼저 끊어 두면 아래에서 글 제목을 물음표
     없이 읽을 수 있습니다. */
  if (!data) {
    return null;
  }

  /*
    장소가 하나라도 있는 날만 셉니다. 빈 날을 끼워 두면 눌렀을 때
    아무것도 없는 목록이 뜨는데, 그것이 이 앱의 모습은 아닙니다.

    <p>걸러 내면서 <b>적힌 차례를 들고 갑니다.</b> 걸러 낸 뒤의 자리로
    번호를 붙이면, 2일차가 빈 글에서 3일차가 「2일차」가 되어 그 글을
    열었을 때 번호가 안 맞습니다.
  */
  const days = data.itinerary.days
    .map((day, index) => ({ day, index }))
    .filter((d) => d.day.places.length > 0);

  /* 받는 중이거나 펼칠 것이 없는 글. 아무것도 안 그립니다 — 부르는
     쪽에서 이 묶음 전체가 사라집니다. */
  if (days.length === 0) {
    return null;
  }

  /* 글이 바뀌어 날 수가 줄면 고른 번호가 범위 밖으로 나갑니다. 상태를
     고치지 않고 읽을 때 가둡니다 — 그려는 중에 상태를 바꾸면 한 번 더
     그립니다. */
  const shown = Math.min(at, days.length - 1);
  const day = days[shown].day;
  const places = day.places.slice(0, ROWS);
  const more = day.places.length - places.length;

  return (
    <View style={styles.taste}>
      <Body strong>이렇게 짜요</Body>
      <Caption tone="secondary">
        {`「${data.title}」 에서 가져온 일정이에요. 날을 눌러 보세요.`}
      </Caption>

      {/*
        날 고르는 띠.

        <p>하루짜리 글에는 안 냅니다 — 고를 것이 하나인 띠는 누를 수
        있다는 말만 하고 아무 일도 안 합니다.

        <p>밖으로 밀지 <b>않습니다.</b> 이 묶음은 부르는 쪽에서 겹을 둘
        더 쓰고 있어서(머리글 묶음과 떠오르는 겹), 좌우로 삐져나온 칩이
        잘리는지 여기서 확인할 길이 없습니다. 칩은 좁아서 대개 다
        들어옵니다.
      */}
      {days.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.days}>
          {days.map((d, i) => (
            <Chip
              key={d.index}
              label={labelOfDay(d.day, d.index)}
              selected={i === shown}
              onPress={() => setAt(i)}
            />
          ))}
        </ScrollView>
      ) : null}

      {/*
        그 날의 장소들.

        <p>누를 데를 안 둡니다. 여기서 할 일은 <b>어떻게 생겼는지 보는
        것</b>이고, 담거나 가져가는 일은 계정이 필요합니다 — 만져 보라고
        펼쳐 둔 자리에서 두 줄 아래 또 벽을 세우면, 만져 본 것이 벽을
        만난 기억으로 남습니다. 막는 자리는 이 화면에 하나뿐입니다.
      */}
      {places.map((place, i) => (
        <ListRow
          key={`${days[shown].index}-${i}-${place.name}`}
          left={<Mark icon={glyphOf(place.icon)} />}
          title={place.name}
          subtitle={[place.time, labelOf(place.icon) || null, place.note]
            .filter(Boolean)
            .join(' · ')}
          last={i === places.length - 1 && more <= 0}
        />
      ))}

      {/* 잘라 낸 만큼을 숫자로 적습니다. 넷에서 끊어 두고 아무 말도 안
          하면 이 글이 하루에 네 곳만 가는 일정으로 읽힙니다. */}
      {more > 0 ? <Caption tone="muted">{`이 날에 ${more}곳 더 있어요.`}</Caption> : null}

      {/* 다음 한 걸음. 문을 떠나는 길이지만 공개 화면이라 벽이 없습니다. */}
      <Button label="이 여행기 전체 보기" variant="text" size="xs" onPress={onOpen} />
    </View>
  );
}

/**
 * 칩에 적을 날 이름.
 *
 * <p>글쓴이가 적은 짧은 이름이 있으면 그것, 없으면 긴 이름, 둘 다
 * 없으면 「n일차」입니다. 이 앱이 날을 부르는 순서가 어디서나 같아야
 * 합니다({@code comment-list} · {@code day-picker} · {@code sheet}).
 *
 * <p>빈 날을 걸러 낸 뒤의 차례가 아니라 <b>적힌 차례</b>를 셉니다 —
 * 2일차에 아무것도 없는 글에서 3일차를 「2일차」라고 부르면 그 글을
 * 열었을 때 번호가 안 맞습니다.
 */
function labelOfDay(day: ItineraryDay, index: number) {
  return day.shortName || day.label || `${index + 1}일차`;
}

const styles = StyleSheet.create({
  taste: {
    gap: Spacing.s2,
  },
  days: {
    gap: Spacing.s2,
  },
});
