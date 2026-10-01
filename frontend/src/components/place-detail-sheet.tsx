import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { PlaceInfo, TravelMode } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { PlacePhoto } from '@/components/place-photo';
import { SpotMap } from '@/components/spot-map';
import { labelOf } from '@/constants/place-icons';
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
} from '@/ui';
import type { IconName } from '@/ui';

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
 * <h3>넣는 단추는 밖에서 받습니다</h3>
 *
 * <p>부르는 자리마다 갈 곳이 다릅니다 — 보석함에서 열면 "담기" 하나, 추천
 * 에서 열면 일정·투표장·보석함 셋. 이 판은 그것을 정하지 않고 받아서
 * 늘어놓기만 합니다.
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
   * 세는 것과 여는 것은 저쪽이 하고, 이 판은 부르는 이름과 개수만 받아
   * 같은 모양으로 냅니다.
   *
   * <p>없으면 안 냅니다. 좌표만 찍어 둔 곳에는 달 데가 없습니다.
   */
  talk?: { noun: string; count: number; onOpen: () => void } | null;
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

  if (!place) {
    return null;
  }

  return (
    <BottomSheet visible title={place.name} onClose={onClose}>
      {/*
        그림 한 장.

        <h3>사진과 지도를 둘 다 깔고 있었습니다</h3>

        <p>200짜리 둘이면 판의 첫 400픽셀이 그림입니다. 좁은 폰에서는 판을
        열었을 때 평점도 영업시간도 안 보이고, 그것을 보려면 그림 두 장을
        지나쳐 내려가야 했습니다. 게다가 사진이 없는 곳에서는 회색 자리와
        지도가 겹쳐 아래위로 두 덩어리였습니다.

        <p>하나만 냅니다. 사진이 있으면 사진이 — 여행 앱에서 "여기가 어떤
        곳인지" 에 가장 빨리 답하는 것은 사진이고, 이름과 평점만으로는
        골목 안 작은 집인지 큰 건물인지 알 수 없습니다. 사진이 없으면
        지도가 그 자리에 섭니다.

        <h3>지도는 살아 있지 않습니다</h3>

        <p>상호작용 지도를 띄우고 있었습니다. 그런데 여기 지도는 누를 것도
        이을 것도 없었습니다 — onSelect 가 빈 함수였고 link 가 꺼져 있었습니다.

        <p>Maps JavaScript 는 지도가 뜰 때마다 셉니다. 혼자 쓰는데도 하루
        할당량의 20%가 나갔고 그중 상당수가 이 판이었습니다. 그림은 서버가
        받아서 여섯 시간 들고 있어, 같은 장소를 다시 열면 구글에 아예 안
        나갑니다.
      */}
      {info?.photoName ? (
        <PlacePhoto name={info.photoName} by={info.photoBy} height={180} big />
      ) : (
        <SpotMap lat={place.lat} lng={place.lng} name={place.name} height={180} />
      )}

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
        {place.icon ? <Badge label={labelOf(place.icon)} tone="muted" /> : null}
        {here ? <Caption tone="secondary">{awayFrom(here, place)}</Caption> : null}
      </Row>

      {about}

      {loading && place.placeId ? <Loading label="사정을 보는 중" /> : null}

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
      {place.address || info ? (
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
        나가는 길들.

        <h3>글자 단추 넷에서 그림 줄 하나로</h3>

        <p>「전화번호」 · 「홈페이지」 · 「구글 지도에서 보기」 · 「길찾기」가
        저마다 글자 단추였습니다. 넷을 늘어놓으면 두 줄이 되고, 그 아래
        「담기」 까지 있으니 판 끝이 단추밭이었습니다. 무엇보다 이 넷은 다
        <b>앱 밖으로 나가는</b> 같은 종류인데, 아래의 「담기」 와 같은 모양
        이라 어느 것이 이 앱에서 하는 일인지 안 갈렸습니다.
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
      </Row>

      {/* 사람 말은 사실 다음입니다. 여기까지가 "여기가 어떤 데지" 에 대한
          답이고, 그다음은 이 곳을 어디에 담을지입니다. */}
      {talk ? (
        <>
          <Band />
          <Button
            label={talk.count > 0 ? `${talk.noun} ${talk.count}개 보기` : `${talk.noun} 남기기`}
            variant={talk.count > 0 ? 'secondary' : 'ghost'}
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
 * 앱 밖으로 나가는 길 하나.
 *
 * <p>회색 동그라미에 그림 하나와 아래 이름. 글자 단추로 두면 넷이 두 줄을
 * 먹는데, 이 모양이면 한 줄에 넷이 고르게 섭니다.
 *
 * <p>이름을 그림 아래 적습니다 — 그림만 두면 전화인지 문자인지, 지도인지
 * 길찾기인지가 짐작입니다.
 */
function Way({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Press onPress={onPress} scale={0.96} accessibilityLabel={label} style={styles.way}>
      <View style={styles.wayRing}>
        <Icon name={icon} size={20} tone="secondary" />
      </View>
      <Caption tone="secondary">{label}</Caption>
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
});
