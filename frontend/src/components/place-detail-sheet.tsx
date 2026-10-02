import { useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { Comment, OurStars, PlaceInfo, TravelMode } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { CommentPeek } from '@/components/comment-list';
import type { MapPlace } from '@/components/map-types';
import { PlacePhoto } from '@/components/place-photo';
import { TripMap } from '@/components/trip-map';
import { iconOf, labelOf } from '@/constants/place-icons';
import { Colors, Gutter, Radius, Spacing, Tap } from '@/constants/theme';
import { openDirections, openPlace } from '@/lib/directions';
import { awayFrom } from '@/lib/geo';
import {
  Badge,
  Band,
  Body,
  BottomSheet,
  Button,
  Caption,
  Icon,
  Loading,
  Press,
  Row,
  Split,
  Subtitle,
} from '@/ui';
import type { IconName } from '@/ui';

/**
 * 판에 바로 펼치는 줄 수.
 *
 * <p>받은 것입니다 — 「장소 상세에 최근 댓글 다섯」. 더 늘리면 판을 열었을 때
 * 평점과 영업시간이 댓글에 밀려 위로 올라갑니다.
 */
const PEEK = 5;

/**
 * 장소 하나를 들여다보는 판.
 *
 * <h3>왜 필요한가</h3>
 *
 * <p>찾은 목록에는 이름과 주소만 있었습니다. "이치란 도톤보리점" 과 "이치란
 * 난바점" 이 나란히 떠 있어도 어느 쪽을 넣을지 고를 수가 없습니다. 평점이
 * 몇인지, 그날 문을 여는지, 여기서 얼마나 먼지를 알아야 고르는 일이 됩니다.
 *
 * <p>그래서 누르면 지도가 뜨고 그 아래에 사정이 붙습니다. 넣는 것은 그다음
 * 입니다 — 고르고 나서 넣는 것이 순서입니다.
 *
 * <h3>사진과 후기는 가져오지 않습니다</h3>
 *
 * <p>그쪽은 글쓴이 이름과 프로필을 함께 띄워야 하는 별도의 의무가 붙습니다.
 * 대신 <b>구글 지도에서 열기</b> 를 둡니다. 사진도 후기도 메뉴도 거리뷰도
 * 거기 다 있고, 사람들은 어차피 그걸 켭니다.
 *
 * <h3>여기에 달린 말도 여기서 봅니다</h3>
 *
 * <p>장소 하나에 달린 말(내 여행이면 「한 줄」, 남의 일정이면 「댓글」)을
 * <b>줄에 단추로</b> 달고 있었습니다. 그래서 장소마다 단추가 하나 더 늘었고,
 * 같은 일을 하는 자리가 화면마다 다른 모양이었습니다.
 *
 * <p>이 판이 이미 "여기가 어떤 데지" 를 답하는 자리입니다. 남이 남긴 말은
 * 그 답의 일부입니다 — 평점 다음에 오는 것이 사람 말입니다. 두 화면이 같은
 * 자리에서 같은 모양으로 냅니다.
 *
 * <p>개수만 받아 단추를 내던 것을 고쳤습니다. 받은 것이 있으면 <b>최근
 * 다섯</b>을 바로 펼치고, 더 있으면 단추가 「더 보기」가 됩니다 — 읽을 것이
 * 있는 자리가 되어야 사람들이 그 단추를 누릅니다.
 *
 * <h3>넣는 단추는 밖에서 받습니다</h3>
 *
 * <p>부르는 자리마다 갈 곳이 다릅니다 — 보석함에서 열면 「빼기」와 「일정에
 * 넣기」, 추천에서 열면 일정·투표장·보석함 셋, 찾기에서 열면 「여기로
 * 고르기」. 이 판은 그것을 정하지 않고 {@code actions} 로 받아서 늘어놓기만
 * 합니다.
 *
 * <p>다만 <b>담기</b>는 갈 곳을 고르는 일이 아니라 한 번 누르면 끝나는
 * 일입니다. 그래서 글자 단추 자리가 아니라 구글 지도 옆 그림 자리를 따로
 * 둡니다({@code scrap}) — 어느 자리에서 열었든 담는 일은 같은 그림입니다.
 *
 * <h3>우리가 아는 것도 밖에서 받습니다</h3>
 *
 * <p>구글이 아는 것(평점·영업시간·전화) 말고, <b>우리 쪽에만 있는 것</b>이
 * 있습니다 — 보석함이라면 왜 담았는지와 언제 담았는지, 추천이라면 왜
 * 골라 왔는지. 그것은 부르는 자리만 알고 이 판은 모릅니다. 자리만
 * 내어 주고 무엇을 적을지는 안 정합니다.
 */
export function PlaceDetailSheet({
  place,
  /** 어느 날 기준으로 볼지. 있으면 그날 문 여는지를 봅니다. */
  onIso,
  /** 지금 서 있는 자리. 있으면 얼마나 먼지 적습니다. */
  here,
  about,
  talk,
  ours,
  scrap,
  actions,
  mode,
  onClose,
}: {
  place: Looked | null;
  onIso?: string | null;
  here?: { lat: number; lng: number } | null;
  /**
   * 부르는 자리만 아는 것. 구글에 물어서 나오는 것 위에 얹힙니다.
   *
   * <p>보석함이라면 왜 담았는지와 언제 담았는지가 여기 옵니다. 평점보다
   * 먼저 적습니다 — 별 넷이라는 사실보다 "그때 줄 서서 먹었던 집" 이
   * 이 곳을 고르는 데 더 큰 몫을 합니다.
   */
  about?: React.ReactNode;
  /**
   * 여기에 달린 말.
   *
   * <p>부르는 자리마다 무엇이 달리는지가 다릅니다 — 내 여행에서는 구글이
   * 모르는 「한 줄」이고, 남의 일정에서는 그 장소에 대한 「댓글」입니다.
   * 세는 것과 여는 것은 저쪽이 하고, 이 판은 부르는 이름과 개수를 받아
   * 같은 모양으로 냅니다.
   *
   * <p>없으면 안 냅니다. 좌표만 찍어 둔 곳에는 달 데가 없습니다.
   */
  talk?: {
    noun: string;
    count: number;
    onOpen: () => void;
    /**
     * 판에 바로 펼쳐 둘 것.
     *
     * <h3>단추 하나만 있었습니다</h3>
     *
     * <p>개수만 받아서 「댓글 3개 보기」 단추를 냈습니다. 그러면 이 판은
     * <b>구글이 아는 것만 적힌 자리</b>이고, 남이 여기서 뭐라고 했는지는 한 번
     * 더 눌러야 압니다 — 거기에 읽을 것이 있는지 모르는 채로는 대개 안
     * 누릅니다. 읽을 것이 있는 자리가 되면 담는 단추가 설 자리도 생깁니다.
     *
     * <p>개수와 함께 받습니다. 판은 받은 것 중 {@code PEEK} 개만 펼치고,
     * 개수가 그보다 많으면 단추가 「더 보기」가 됩니다.
     *
     * <p>댓글만입니다. 「한 줄」은 별점이 함께 붙는 다른 모양이라 그 판이
     * 따로 있습니다 — 안 주면 단추만 서던 전과 같습니다.
     */
    recent?: Comment[] | null;
  } | null;
  /**
   * 우리 별점.
   *
   * <p>구글 평점 옆에 섭니다. <b>다르면 그것이 정보입니다</b> — 구글 4.2 에
   * 우리 4.6 이면 「우리 같은 사람들은 더 좋게 봤다」는 말이고, 그 반대면
   * 「소문보다 별로」입니다. 같은 자리에 두지 않으면 그 비교가 안 생깁니다.
   *
   * <p>아직 아무도 안 줬으면 없습니다.
   */
  ours?: OurStars | null;
  /**
   * 보석함에 담기 — 지금 넣지 않고 담아만 두는 것.
   *
   * <h3>글자 단추에서 그림 하나로</h3>
   *
   * <p>「보석함에 담기」가 판 아래 {@code actions} 에 글자 단추로 섰습니다.
   * 그런데 이것은 <b>갈 곳을 고르는 일</b>(일정에·투표장에)과 다릅니다 —
   * 누르면 그걸로 끝나고, 목록 줄에서는 이미 같은 일을 책갈피 그림 하나로
   * 하고 있었습니다. 같은 일이 자리마다 다른 모양이면 같은 일로 안 읽힙니다.
   *
   * <p>그래서 구글 지도 옆, {@link Way} 들과 한 줄에 섭니다. 그 줄은 이제
   * <b>이 곳을 두고 바로 하는 한 번짜리 동작</b>들의 줄입니다. 담는 것만
   * 앱 안에 남는 일이라, 담긴 뒤에는 그림이 채워지고 색이 붙습니다.
   *
   * <p>안 주면 안 섭니다 — 보석함에서 열었으면 이미 담겨 있는 곳이라 담을
   * 데가 없고, 그 자리의 「빼기」는 아래 {@code actions} 에 그대로 있습니다.
   */
  scrap?: {
    /** 이미 담겨 있는지. 담긴 것은 그림이 채워지고 다시 안 눌립니다 */
    kept: boolean;
    onPress: () => void;
  } | null;
  /** 이 곳을 어디에 담을지. 부르는 자리가 정합니다. */
  actions?: React.ReactNode;
  /**
   * 어떻게 갈지. 길찾기를 열 때 미리 골라 둡니다.
   *
   * <p>일정에서는 이 곳까지 오는 구간에 이미 고른 수단이 있습니다. 안
   * 넘기면 구글이 자기 기본값으로 엽니다 — 전철로 가기로 해 둔 구간인데
   * 운전 경로가 뜹니다.
   */
  mode?: TravelMode | null;
  onClose: () => void;
}) {
  /*
    번호가 있을 때만 물어봅니다.

    좌표를 직접 넣은 곳에는 구글 번호가 없습니다. 그때는 물어볼 데가 없으니
    지도와 이름만 보여 줍니다 — 오류가 아닙니다.
  */
  const { data, loading } = useAsync<{ info: PlaceInfo | null }>(
    (signal) =>
      place?.placeId
        ? api.get(
            `/api/places/${encodeURIComponent(place.placeId)}/info${
              onIso ? `?on=${encodeURIComponent(onIso)}` : ''
            }`,
            signal,
          )
        : Promise.resolve({ info: null }),
    [place?.placeId, onIso],
  );

  const info = data?.info ?? null;

  /* 영업시간이 상자에 들어갈 것이 있는지. Hours 가 null 을 돌려주는 조건과
     같아야 합니다 — 어긋나면 빈 상자가 다시 생깁니다. */
  const hasHours = info != null && !info.permanentlyClosed
    && (info.onDay != null || info.hours.length > 0);

  /* 판에 펼칠 것이 몇 줄인지. 받은 것이 다섯보다 적을 수 있으므로 개수와
     견주는 것은 「다섯」이 아니라 <b>실제로 펼치는 수</b>입니다 — 그걸 안
     보면 셋을 다 펼쳐 놓고 「더 보기」라고 말하게 됩니다. */
  const peek = talk?.recent ?? [];
  const shown = Math.min(peek.length, PEEK);

  /*
    지도에 꽂을 핀 하나.

    <p>{@link TripMap} 은 여러 곳을 받는 자리라 {@code places} 가 배열입니다.
    여기는 늘 하나뿐이지만 그 모양에 맞춰 한 칸짜리 배열로 줍니다. 번호
    ({@code id})가 없는 곳도 있어(좌표만 찍어 둔 곳) 구글 번호나 좌표를
    엮어 만듭니다 — 판이 열려 있는 동안 같은 곳이면 같은 번호여야 지도가
    다시 안 굽습니다.
  */
  const places = useMemo<MapPlace[]>(() => {
    if (!place) {
      return [];
    }
    return [
      {
        id: place.placeId ?? `${place.lat},${place.lng}`,
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        dayIndex: 0,
        order: 1,
        emoji: iconOf(place.icon),
        color: Colors.accent,
        fit: true,
        radius: null,
        detail: { time: null, cat: null, cost: null, note: null, sub: null, dayLabel: '' },
      },
    ];
  }, [place]);

  if (!place) {
    return null;
  }

  return (
    <BottomSheet visible title={place.name} onClose={onClose}>
      {/*
        그림 한 장, 그리고 늘 사는 지도.

        <h3>스냅샷으로는 「어디인지」가 안 보였습니다</h3>

        <p>한동안 지도 자리에 서버가 미리 구워 둔 그림 한 장({@code SpotMap})
        을 썼습니다. 비용은 싸졌지만(여섯 시간 캐시, 구글 호출 0) 그 값을
        치렀습니다 — 배율이 고정이라 주변에 뭐가 있는지 가늠이 안 되고,
        손가락으로 밀어 봐도 꿈쩍 않는 그림이라 「여기가 정확히 어디지」를
        묻는 사람에게 답을 못 줬습니다.

        <p>그래서 {@link TripMap} 을 그대로 씁니다. 일정 화면에서 쓰는 것과
        같은 살아 있는 지도입니다 — 밀고 당기고, 전체화면 단추를 누르면
        이 장소를 중심에 두고 주변을 마음껏 둘러볼 수 있습니다.

        <h3>일정이 아니라 점 하나입니다</h3>

        <p>{@code link={false}} 로 둡니다. 여기는 장소 하나를 보여 주는
        자리이지 동선이 아닙니다 — 이을 다음 곳이 없습니다. 핀을 누르면
        {@code onSelect} 가 불리지만 고를 다른 곳이 없으니 아무 일도 안
        일어납니다.

        <p>{@code here} 를 그대로 넘깁니다. 받았으면 지도 위에 「내 위치로」
        단추가 서고, 그 버튼이 바로 「근처에 뭐가 있나」를 스스로 찾아보게
        해 줍니다 — 거리 숫자 한 줄보다 지도를 밀어 보는 쪽이 빠릅니다.

        <h3>값은 다시 커졌습니다</h3>

        <p>Maps JavaScript 는 지도가 뜰 때마다 셉니다({@code StaticMapService}
        의 캐시가 없는 길로 돌아간 것입니다). 이 판이 자주 열리는 자리라면
        할당량을 다시 눌러볼 일입니다 — 지금은 「어디인지 모르겠다」는
        불만이 그 값보다 급했습니다.

        <h3>사진은 그 위에 얹습니다</h3>

        <p>사진이 「어떤 곳인지」를 가장 빨리 답하는 것은 여전히 맞습니다.
        지도가 늘 서므로 사진이 오고 가도 지도가 사라지는 일은 없습니다 —
        사진이 있으면 그 자리를 내주고 지도는 120으로, 없으면 지도가
        180을 그대로 씁니다.
      */}
      {info?.photoName ? (
        <PlacePhoto name={info.photoName} by={info.photoBy} height={180} big />
      ) : null}
      <TripMap
        places={places}
        activeId={places[0]?.id ?? null}
        onSelect={() => {}}
        link={false}
        /* 이 판의 here 는 거리를 셈하려고 받은 {lat,lng} 뿐이라 정확도가
           없습니다. 지도는 그 값으로 원을 그리므로 0을 줍니다 — 점
           하나만 찍히고, 「내 위치로」 단추는 정확도와 무관하게 섭니다. */
        here={here ? { ...here, accuracy: 0 } : null}
        height={info?.photoName ? 120 : 180}
      />

      {/* 갈래와 평점과 거리. 이 곳을 고를지 정하는 데 가장 먼저 쓰이는
          셋이라 그림 바로 아래 한 줄에 섭니다. */}
      <Row gap={Spacing.s2} style={styles.facts}>
        {info?.rating ? (
          <Body small strong>
            <Caption tone="hot">★ </Caption>
            {info.rating.toFixed(1)}
            {info.ratingCount ? (
              <Caption tone="secondary">{` (${info.ratingCount.toLocaleString()})`}</Caption>
            ) : null}
          </Body>
        ) : null}
        {/*
          우리 평점.

          <p>구글 것 바로 뒤입니다. 몇 명이 줬는지를 늘 함께 적습니다 —
          한 사람이 준 5.0 과 열한 명이 준 4.6 은 같은 숫자가 아닌데,
          평균만 띄우면 앞쪽이 더 좋아 보입니다.
        */}
        {ours ? (
          <Body small strong>
            <Caption tone="brand">★ </Caption>
            {ours.average.toFixed(1)}
            <Caption tone="secondary">{` (우리 ${ours.count})`}</Caption>
          </Body>
        ) : null}
        {place.icon ? <Badge label={labelOf(place.icon)} tone="muted" /> : null}
        {here ? <Caption tone="secondary">{awayFrom(here, place)}</Caption> : null}
      </Row>

      {about}

      {loading && place.placeId ? <Loading label="정보를 가져오고 있어요" /> : null}

      {/* 아예 문 닫은 가게를 넣게 두면 안 됩니다. 가장 먼저 말합니다. */}
      {info?.permanentlyClosed ? (
        <Caption tone="danger" strong>
          문을 닫은 곳이에요.
        </Caption>
      ) : null}

      {/*
        사실 상자.

        <p>주소는 회색 글 한 줄로 그림 아래에 떠 있었고 영업시간은 또 다른
        덩어리였습니다. 둘 다 <b>이 곳에 대해 적혀 있는 것</b>이라 한 면에
        모읍니다 — 라벨을 왼쪽에 같은 폭으로 세우면 눈이 값만 따라 내려갈
        수 있습니다.
      */}
      {/*
        안이 빌 수 있습니다.

        <p>조건이 {@code place.address || info} 였습니다. 그런데 {@code info}
        가 있다고 상자에 들어갈 것이 있는 것은 아닙니다 — 주소도 없고 영업시간도
        안 알려진 곳이면 {@link Hours} 가 null 을 돌려주고, <b>빈 회색 네모</b>
        만 사진 밑에 남습니다. 뭘 못 불러온 것처럼 보입니다.
       */}
      {place.address || hasHours ? (
        <View style={styles.facts0}>
          {place.address ? (
            <Row gap={Spacing.s2} style={styles.fact}>
              <View style={styles.factLabel}>
                <Caption tone="secondary">주소</Caption>
              </View>
              <View style={styles.factValue}>
                <Body small selectable>
                  {place.address}
                </Body>
              </View>
            </Row>
          ) : null}
          {info && !info.permanentlyClosed ? <Hours info={info} onIso={onIso} /> : null}
        </View>
      ) : null}

      {/*
        한 번 누르면 끝나는 것들.

        <h3>글자 단추 넷에서 그림 줄 하나로</h3>

        <p>「전화번호」 · 「홈페이지」 · 「구글 지도에서 보기」 · 「길찾기」가
        저마다 글자 단추였습니다. 넷을 늘어놓으면 두 줄이 되고, 그 아래
        「담기」 까지 있으니 판 끝이 단추밭이었습니다.

        <h3>담는 것도 이 줄입니다</h3>

        <p>한동안 이 줄을 <b>앱 밖으로 나가는 길</b>들만의 줄로 두고, 담는
        것은 아래 글자 단추로 가렸습니다. 그런데 사람이 가리는 것은 「안이냐
        밖이냐」가 아니라 <b>한 번 눌러 끝나는 일이냐, 갈 곳을 고르는
        일이냐</b> 였습니다 — 담는 것은 앞쪽이고, 목록 줄에서는 이미 책갈피
        그림 하나로 하던 일입니다.

        <p>아래 글자 단추 자리에는 갈 곳을 고르는 것(일정에·투표장에)만
        남습니다. 담긴 뒤에 그림이 채워지는 것으로 이 하나만 <b>앱 안에
        남는 일</b>이라고 말합니다.
      */}
      <Row gap={Spacing.s2} style={styles.ways}>
        <Way
          icon="navigation"
          label="길찾기"
          onPress={() => openDirections(place, mode ?? null)}
        />
        {info?.phone ? (
          <Way
            icon="phone"
            label="전화"
            onPress={() => Linking.openURL(`tel:${info.phone}`)}
          />
        ) : null}
        {info?.website ? (
          <Way
            icon="external-link"
            label="홈페이지"
            onPress={() => Linking.openURL(info.website as string)}
          />
        ) : null}
        {/* 사진·후기·메뉴·거리뷰는 저쪽에 있습니다. 우리가 옮겨 오지 않습니다. */}
        <Way icon="map-pin" label="구글 지도" onPress={() => openPlace(place, info?.mapUrl)} />
        {scrap ? (
          <Way
            icon="bookmark"
            label={scrap.kept ? '담겼어요' : '보석함'}
            says={scrap.kept ? '보석함에 담겼어요' : '보석함에 담기'}
            on={scrap.kept}
            onPress={scrap.onPress}
          />
        ) : null}
      </Row>

      {/* 사람 말은 사실 다음입니다. 여기까지가 "여기가 어떤 데지" 에 대한
          답이고, 그다음은 이 곳을 어디에 담을지입니다. */}
      {talk ? (
        <>
          <Band />
          {shown > 0 ? (
            <>
              {/* 머리를 답니다. 단추만 있던 자리에 갑자기 사람 이름과 날짜가
                  나오면 위의 영업시간에 딸린 것으로 읽힙니다. 글 상세의 댓글
                  구역과 같은 모양입니다 — 같은 것이 같아 보여야 합니다. */}
              <Split align="baseline">
                <Subtitle>{talk.noun}</Subtitle>
                <Caption tone="secondary">{talk.count}</Caption>
              </Split>
              <CommentPeek comments={peek} max={PEEK} />
            </>
          ) : null}
          <Button
            /*
              펼친 것이 있으면 단추는 「더 보기」입니다.

              <p>개수를 그대로 적던 「댓글 3개 보기」는 셋이 이미 눈앞에
              펼쳐져 있을 때 거짓말이 됩니다. 다 펼쳤으면 남은 일은 <b>남기는
              것</b>뿐이라 그렇게 적습니다.
            */
            label={
              shown === 0
                ? talk.count > 0
                  ? `${talk.noun} ${talk.count}개 보기`
                  : `${talk.noun} 남기기`
                : talk.count > shown
                  ? `${talk.noun} 더 보기`
                  : `${talk.noun} 남기기`
            }
            variant={talk.count > shown ? 'secondary' : 'ghost'}
            compact
            onPress={talk.onOpen}
          />
        </>
      ) : null}

      {actions ? (
        <>
          <Band />
          {actions}
        </>
      ) : null}

      <Caption tone="muted">제공: Google</Caption>
    </BottomSheet>
  );
}

/**
 * 한 번 누르면 끝나는 일 하나.
 *
 * <p>회색 동그라미에 그림 하나와 아래 이름. 글자 단추로 두면 넷이 두 줄을
 * 먹는데, 이 모양이면 한 줄에 고르게 섭니다.
 *
 * <p>이름을 그림 아래 적습니다 — 그림만 두면 전화인지 문자인지, 지도인지
 * 길찾기인지가 짐작입니다. 이름은 한 줄로 자릅니다. 둘러 가며 다섯까지 서는
 * 줄이라, 긴 이름 하나가 접히면 <b>그 칸만 키가 커져</b> 줄이 들쭉날쭉합니다.
 *
 * @param says 읽어 주는 기기에 들려줄 말. 보이는 이름이 너무 짧을 때만
 * @param on   이미 끝난 일인지. 그림이 채워지고 색이 붙고, 다시 안 눌립니다
 */
function Way({
  icon,
  label,
  says,
  on,
  onPress,
}: {
  icon: IconName;
  label: string;
  says?: string;
  on?: boolean;
  onPress: () => void;
}) {
  return (
    <Press
      onPress={onPress}
      /* 이미 담긴 것을 또 누르게 두지 않습니다. 서버가 같은 곳을 두 번 담지
         않으니 눌러도 아무 일이 안 일어나는데, 그러면 안 담긴 것처럼 보입니다. */
      disabled={on}
      scale={0.96}
      accessibilityLabel={says ?? label}
      accessibilityState={{ disabled: on }}
      style={styles.way}>
      <View style={[styles.wayRing, on ? styles.wayRingOn : null]}>
        <Icon name={icon} size={20} tone={on ? 'brand' : 'secondary'} solid={on} />
      </View>
      <Caption tone={on ? 'brand' : 'secondary'} numberOfLines={1}>
        {label}
      </Caption>
    </Press>
  );
}

/**
 * 영업시간.
 *
 * <p>날짜를 정해 놓고 보는 중이면 그날 것만, 아니면 그 장소가 있는 곳의
 * 오늘 것을 앞에 둡니다. 요일 일곱 줄을 늘 펼쳐 두면 정작 볼 한 줄이 묻힙니다.
 */
function Hours({ info, onIso }: { info: PlaceInfo; onIso?: string | null }) {
  const [all, setAll] = useState(false);

  if (!info.onDay && info.hours.length === 0) {
    return null;
  }

  return (
    <>
      <Row gap={Spacing.s2} style={styles.fact}>
        <View style={styles.factLabel}>
          <Caption tone="secondary">영업</Caption>
        </View>
        <View style={styles.factValue}>
          <Row gap={Spacing.s2} style={styles.facts}>
            {info.closedOnDay ? (
              <Caption tone="danger" strong>
                {onIso ? '그날 쉬어요' : '오늘 쉬어요'}
              </Caption>
            ) : (
              <Body small>{info.onDay ?? '영업시간을 알 수 없어요'}</Body>
            )}
            {/* 구간이 둘이면 사이가 브레이크 타임입니다. 점심에 갔다가 문이 닫혀
                있는 일을 막습니다. */}
            {info.spans.length > 1 ? <Badge label="브레이크 타임 있음" tone="warning" /> : null}
            {/* 요일 일곱 줄을 늘 펼쳐 두면 정작 볼 한 줄이 묻힙니다. */}
            {info.hours.length > 0 ? (
              <Press
                onPress={() => setAll((v) => !v)}
                scale={1}
                accessibilityLabel={all ? '요일별 접기' : '요일별 보기'}
                hitSlop={Tap.compactSlop}>
                <Icon name={all ? 'chevron-up' : 'chevron-down'} size={20} tone="muted" />
              </Press>
            ) : null}
          </Row>
          {all ? (
            <View style={styles.week}>
              {info.hours.map((line, i) => (
                <Caption key={i} tone="secondary">
                  {line}
                </Caption>
              ))}
            </View>
          ) : null}
        </View>
      </Row>
    </>
  );
}

/** 찾은 장소 하나. 검색 결과와 추천 카드가 같은 모양으로 넘겨줍니다. */
export type Looked = {
  name: string;
  address?: string | null;
  lat: number;
  lng: number;
  placeId?: string | null;
  icon?: string | null;
};

const styles = StyleSheet.create({
  facts: {
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  /*
    적혀 있는 것들을 담는 면.

    <p>눌러서 들어가는 물건이 아니라 <b>읽을 것</b>이라 흰 카드가 아니고
    회색 면입니다. 테두리도 그림자도 없습니다 — 판 안에서 한 단 들어간
    것으로만 보이면 됩니다.
  */
  facts0: {
    backgroundColor: Colors.fill,
    borderRadius: Radius.r3,
    padding: Spacing.s4,
    gap: Spacing.s2,
  },
  fact: {
    alignItems: 'flex-start',
  },
  /* 라벨 칸. 폭을 못 박아 두 줄이 같은 자리에서 시작합니다. */
  factLabel: {
    width: 48,
  },
  /* 라벨은 같은 폭으로 세우고 값이 나머지를 먹습니다. 눈이 값만 따라
     내려갈 수 있어야 합니다. */
  factValue: {
    flex: 1,
    gap: Spacing.s1,
  },
  week: {
    gap: 2,
  },
  /* 나가는 길들. 칸을 고르게 나눕니다. */
  ways: {
    alignItems: 'flex-start',
  },
  way: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.s1,
  },
  wayRing: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 이미 담긴 것. 회색 원에 채운 책갈피만 두면 꺼진 것처럼 보이는데, 이것은
     꺼진 것이 아니라 <b>해 둔 것</b>입니다 — 옅은 바이올렛 면이 그 말을
     합니다. 가득 찬 브랜드색은 판에 하나뿐이라 여기는 옅은 쪽입니다. */
  wayRingOn: {
    backgroundColor: Colors.accentSoft,
  },
});
