import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { PlaceInfo, TravelMode } from '@/api/types';
import { useAsync } from '@/api/use-async';
import type { MapPlace } from '@/components/map-types';
import { TripMap } from '@/components/trip-map';
import { iconOf, labelOf } from '@/constants/place-icons';
import { Colors, Spacing } from '@/constants/theme';
import { openDirections, openPlace } from '@/lib/directions';
import { awayFrom } from '@/lib/geo';
import {
  Badge,
  Body,
  BottomSheet,
  Button,
  Caption,
  Divider,
  Loading,
  Row,
  Subtitle,
} from '@/ui';

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

  const pin: MapPlace = {
    id: 'looked',
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    dayIndex: 0,
    order: 1,
    emoji: iconOf(place.icon) || '',
    color: Colors.accent,
    fit: true,
    radius: null,
    detail: {
      time: null,
      cat: place.address ?? null,
      cost: null,
      note: null,
      sub: null,
      dayLabel: labelOf(place.icon) || '',
      visited: false,
    },
  };

  return (
    <BottomSheet visible title={place.name} onClose={onClose}>
      {/* 어디쯤인지가 먼저입니다. 이름만 읽어서는 그 동네인지 알 수 없습니다. */}
      <TripMap places={[pin]} activeId="looked" onSelect={() => {}} link={false} height={200} />

      {place.address ? <Caption tone="secondary">{place.address}</Caption> : null}

      {about}

      <Row gap={Spacing.sm} style={styles.facts}>
        {info?.rating ? (
          <Body small strong>
            ★ {info.rating.toFixed(1)}
            {info.ratingCount ? (
              <Caption tone="secondary">{` (${info.ratingCount.toLocaleString()})`}</Caption>
            ) : null}
          </Body>
        ) : null}
        {place.icon ? <Badge label={labelOf(place.icon)} tone="muted" /> : null}
        {here ? <Caption tone="secondary">{awayFrom(here, place)}</Caption> : null}
      </Row>

      {loading && place.placeId ? <Loading label="사정을 보는 중" /> : null}

      {/* 아예 문 닫은 가게를 넣게 두면 안 됩니다. 가장 먼저 말합니다. */}
      {info?.permanentlyClosed ? (
        <Caption tone="danger" strong>
          문을 닫은 곳입니다.
        </Caption>
      ) : null}

      {info && !info.permanentlyClosed ? <Hours info={info} onIso={onIso} /> : null}

      {info?.phone || info?.website ? (
        <Row gap={Spacing.sm}>
          {info.phone ? (
            <Button
              label={info.phone}
              variant="ghost"
              compact
              onPress={() => Linking.openURL(`tel:${info.phone}`)}
            />
          ) : null}
          {info.website ? (
            <Button
              label="홈페이지"
              variant="ghost"
              compact
              onPress={() => Linking.openURL(info.website as string)}
            />
          ) : null}
        </Row>
      ) : null}

      {/* 사람 말은 평점 다음, 구글로 나가는 단추 앞입니다. 여기까지가
          "여기가 어떤 데지" 에 대한 답이고, 그다음은 나가는 길입니다. */}
      {talk ? (
        <>
          <Divider />
          <Button
            label={talk.count > 0 ? `${talk.noun} ${talk.count}개 보기` : `${talk.noun} 남기기`}
            variant={talk.count > 0 ? 'secondary' : 'ghost'}
            compact
            onPress={talk.onOpen}
          />
        </>
      ) : null}

      <Divider />

      <Row gap={Spacing.sm}>
        {/* 사진·후기·메뉴·거리뷰는 저쪽에 있습니다. 우리가 옮겨 오지 않습니다. */}
        <Button
          label="구글 지도에서 보기"
          variant="secondary"
          compact
          onPress={() => openPlace(place, info?.mapUrl)}
        />
        <Button
          label="길찾기"
          variant="ghost"
          compact
          onPress={() => openDirections(place, mode ?? null)}
        />
      </Row>

      {actions ? (
        <>
          <Divider />
          {actions}
        </>
      ) : null}

      <Caption tone="muted">제공: Google</Caption>
    </BottomSheet>
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
    <View style={styles.hours}>
      <Row gap={Spacing.sm} style={styles.facts}>
        {info.closedOnDay ? (
          <Caption tone="danger" strong>
            {onIso ? '그날 쉽니다' : '오늘 쉽니다'}
          </Caption>
        ) : (
          <Body small>{info.onDay ?? '영업시간을 알 수 없습니다'}</Body>
        )}
        {/* 구간이 둘이면 사이가 브레이크 타임입니다. 점심에 갔다가 문이 닫혀
            있는 일을 막습니다. */}
        {info.spans.length > 1 ? <Badge label="브레이크 타임 있음" tone="warning" /> : null}
      </Row>

      {info.hours.length > 0 ? (
        <>
          <Button
            label={all ? '요일별 접기' : '요일별 보기'}
            variant="ghost"
            compact
            onPress={() => setAll((v) => !v)}
          />
          {all ? (
            <View style={styles.week}>
              {info.hours.map((line, i) => (
                <Caption key={i} tone="secondary">
                  {line}
                </Caption>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
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
  hours: {
    gap: Spacing.xs,
  },
  week: {
    gap: 2,
    paddingLeft: Spacing.sm,
  },
});
