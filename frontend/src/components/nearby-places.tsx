import { usePathname, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, query, UNEXPECTED } from '@/api/client';
import type { PopularPlace } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { PlaceDetailSheet, type Looked } from '@/components/place-detail-sheet';
import { SignUpGate } from '@/components/signup-gate';
import { SpotMap } from '@/components/spot-map';
import { glyphOf, labelOf } from '@/constants/place-icons';
import { Spacing } from '@/constants/theme';
import type { Comeback } from '@/lib/comeback';
import { readableMeters } from '@/lib/geo';
import { useHereOnce } from '@/lib/here-once';
import { Body, Button, Caption, ErrorNote, ListRow, Loading, Mark, Split } from '@/ui';

/**
 * 거리와 함께 내려오는 장소 한 곳.
 *
 * <p>{@code PopularPlace} 에 서버가 잰 거리가 하나 붙은 모양입니다. 그 칸은
 * 자리를 줬을 때만 값이 있습니다({@code /api/popular/places?near=}).
 *
 * <p>여기 적어 둔 까닭: {@code api/types.ts} 는 다른 사람이 쥐고 있어 이번에
 * 못 건드립니다. 자리가 나면 {@code PopularPlace} 에 {@code distanceM} 을
 * 옵셔널로 얹고 이 선언을 지우는 것이 맞습니다 — 한 화면에만 쓰이는 모양이
 * 아닙니다.
 */
type NearPlace = PopularPlace & { distanceM: number | null };

type NearResult = {
  places: NearPlace[];
  /** 서버가 내 자리를 <b>실제로 썼는지</b>. 못 읽었으면 인기순 그대로입니다. */
  near: boolean;
  /** 「근처」라고 부르는 거리(미터). 문구를 여기서 가져다 적습니다. */
  radiusM: number;
};

/** 판에 늘어놓는 줄 수. 다섯을 넘으면 묶음 하나가 화면을 다 먹습니다. */
const ROWS = 5;

/**
 * 지금 내 자리에서 갈 만한 곳.
 *
 * <h3>왜 서버가 세우는가</h3>
 *
 * <p>「지금 뜨는 곳」은 이미 있었습니다. 없던 것은 <b>그것을 내 좌표로 세우는
 * 일</b>이고, 그 일을 화면에서 하면 열 줄을 받아 그 열 줄만 세우게 됩니다 —
 * 내 옆 가게가 그 열에 없으면 아무리 세워도 안 나옵니다. 그래서 {@code near=}
 * 를 서버에 넘기고 거르고 세운 결과를 받습니다.
 *
 * <h3>눌러야 묻습니다</h3>
 *
 * <p>화면을 열 때 위치를 묻지 않습니다. 구경하러 들어왔을 뿐인데 권한 창이
 * 먼저 뜨면 대개 거절하고, 폰에서 한 번 거절하면 시스템 설정까지 들어가야
 * 되돌립니다({@link useHereOnce}). 단추를 누른 그때는 무엇 때문에 묻는지가
 * 분명합니다.
 *
 * <p>못 쓰는 기기에서는 이 묶음이 <b>아예 안 섭니다.</b> 눌러도 안 되는
 * 단추를 두면 그 자리가 고장으로 읽힙니다.
 *
 * <p>자리는 한 번만 잡습니다 — 목록이 걸음마다 다시 세워지면 안 되기 때문이고,
 * 그 까닭은 {@link useHereOnce} 에 적혀 있습니다. 옮겼으면 「다시 보기」입니다.
 *
 * <h3>지도는 가장 가까운 한 곳입니다</h3>
 *
 * <p>내 점과 다섯 곳을 한 장에 찍는 쪽이 보기에는 낫습니다. 그런데 그 그림의
 * 열쇠에는 <b>내 좌표</b>가 들어갑니다 — 사람마다 자리가 달라 캐시가 한 번도
 * 안 맞고, 그러면 묶음이 뜰 때마다 구글에 지도 한 장입니다. 그 값을 줄이려고
 * 그림 지도로 바꾼 것이었습니다({@link SpotMap}).
 *
 * <p>장소 한 곳의 그림은 열쇠가 그 장소라 여러 사람이 같은 장을 씁니다.
 * 가장 가까운 곳 하나를 그리고, 나머지는 줄이 맡습니다 — 줄을 누르면 그 곳의
 * 그림이 판에서 다시 뜹니다.
 */
export function NearbyPlaces({
  kind = null,
  region = null,
}: {
  /**
   * 갈래·지역으로 함께 거를 때.
   *
   * <p>지금 뜨는 여행지 화면에는 고르는 칸 둘이 이미 섭니다. 그 칸을 「카페」로
   * 두었는데 바로 아래 묶음이 그것을 무시하면, 같은 화면에서 조건이 한쪽만
   * 듣는 셈입니다. 내 여행 쪽에서는 거를 칸이 없어 안 넘깁니다.
   */
  kind?: string | null;
  region?: string | null;
}) {
  const router = useRouter();
  /* 가입하고 돌아올 자리. 이 묶음이 여러 화면에 서므로 부르는 쪽에 묻지 않고
     지금 어느 화면인지를 봅니다. */
  const where = usePathname();
  const { user } = useAuth();
  /* 한 번 잡고 멈춥니다. 목록이 걸음마다 다시 세워지면 읽는 동안 줄이
     움직입니다({@link useHereOnce}). */
  const me = useHereOnce();
  const at = me.at;

  const [looking, setLooking] = useState<Looked | null>(null);
  /** 이미 담은 곳. 담긴 그림으로 바뀌고 다시 안 눌립니다. */
  const [kept, setKept] = useState<Record<string, boolean>>({});
  const [gate, setGate] = useState<Comeback | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const { data, loading } = useAsync<NearResult | null>(
    (signal) =>
      at
        ? api.get(
            /* 소수 넷째 자리까지만 보냅니다 — 11미터쯤입니다. GPS 가 그보다
               정확하지 않고, 주소는 접근 기록에 남는 값이라 뜻 없는 자리를
               더 실어 보낼 이유가 없습니다. */
            `/api/popular/places${query({
              near: `${at.lat.toFixed(4)},${at.lng.toFixed(4)}`,
              kind,
              region,
            })}`,
            signal,
          )
        : Promise.resolve(null),
    [at?.lat, at?.lng, kind, region],
  );

  /* 못 쓰는 기기에서는 묶음이 아예 없습니다. */
  if (!me.supported) {
    return null;
  }

  const places = (data?.near ? data.places : []).slice(0, ROWS);
  const nearest = places[0];
  /* 판에 떠 있는 곳이 목록의 어느 줄인지. 담았는지를 기억하는 것은 묶음
     열쇠 쪽인데 판은 그것을 안 들고 갑니다. */
  const lookingRow = rowFor(places, looking);

  async function keep(place: NearPlace) {
    if (!user) {
      setGate({ where, what: 'save' });
      return;
    }
    if (place.lat == null || place.lng == null) {
      return;
    }
    try {
      await api.post('/api/saved', {
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        placeId: place.placeId,
        icon: place.icon,
      });
      setKept((was) => ({ ...was, [place.key]: true }));
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  return (
    <View style={styles.shelf}>
      <Split>
        <Body strong>지금 내 근처</Body>
        {at ? (
          /* 자리를 옮겼으면 다시 잡습니다. 추적을 껐으니 저절로 바뀌지
             않는다는 것을 단추가 말해 줍니다. */
          <Button label="다시 보기" variant="text" size="xs" onPress={me.start} />
        ) : null}
      </Split>

      {!at && !me.waiting ? (
        <>
          <Caption tone="secondary">
            {me.error
              ? /* 거절은 한 번만 말합니다. 다시 묻는 단추를 안 냅니다 —
                   계속 물으면 화면을 쓸 수 없습니다. */
                me.error
              : '지금 있는 자리를 알면 여행기에 담긴 곳 중 가까운 데부터 보여 드려요.'}
          </Caption>
          {me.error ? null : (
            <Button label="내 근처 보기" variant="outline" size="m" onPress={me.start} />
          )}
        </>
      ) : null}

      {/* 자리를 잡는 동안과 목록을 받는 동안. 둘 다 끝이 있는 기다림입니다 —
          거절은 위에서 글자로 끝나므로 여기서 바퀴가 돌지 않습니다. */}
      {me.waiting || (at && loading && !data) ? <Loading /> : null}

      {/*
        빈 자리는 비었다고 말합니다.

        <p>근처에 아무것도 없는 일은 정상입니다 — 올라온 글이 대개 남의 나라
        여행이라 작은 도시에서 열면 자주 빕니다. 그때 바퀴를 돌리거나 멀리
        있는 곳을 「근처」라고 내밀지 않습니다.

        <p>서버가 자리를 못 읽었을 때는 <b>다른 말</b>입니다. 「30km 안에
        없다」고 적으면 없는 사실을 말하는 셈입니다.
      */}
      {at && data && places.length === 0 ? (
        <Caption tone="secondary">
          {data.near
            ? `${Math.round(data.radiusM / 1000)}km 안에는 아직 올라온 곳이 없어요. 여행기에 담긴 곳이 쌓이면 여기 섭니다.`
            : '지금 자리로는 못 찾았어요. 잠시 뒤에 다시 눌러 주세요.'}
        </Caption>
      ) : null}

      {nearest ? (
        <SpotMap lat={nearest.lat} lng={nearest.lng} name={nearest.name} height={140} />
      ) : null}

      {places.map((place, i, rows) => (
        <ListRow
          key={place.key}
          left={<Mark icon={glyphOf(place.icon)} />}
          title={place.name}
          subtitle={[
            place.distanceM == null ? null : `여기서 ${readableMeters(place.distanceM)}`,
            labelOf(place.icon) || null,
            `여행 ${place.posts}개`,
          ]
            .filter(Boolean)
            .join(' · ')}
          last={i === rows.length - 1}
          onPress={
            place.lat != null && place.lng != null
              ? () =>
                  setLooking({
                    name: place.name,
                    lat: place.lat as number,
                    lng: place.lng as number,
                    placeId: place.placeId,
                    icon: place.icon,
                  })
              : undefined
          }
        />
      ))}

      {failed ? <ErrorNote message={failed} /> : null}

      {/*
        누르면 그 곳을 들여다봅니다.

        <p>보여 주고 끝이 아니라 <b>다음 한 걸음</b>이 있어야 합니다. 여기서
        하는 일은 담기 하나입니다 — 일정에 바로 넣으려면 어느 여행 몇째 날인지
        부터 물어야 하고, 그 물음은 보석함이 이미 더 좋은 자리에서 합니다.
        담은 뒤에 그 길을 가리킵니다.
      */}
      <PlaceDetailSheet
        place={looking}
        here={at}
        scrap={
          lookingRow
            ? { kept: !!kept[lookingRow.key], onPress: () => keep(lookingRow) }
            : null
        }
        actions={
          lookingRow && kept[lookingRow.key] ? (
            <Button
              label="보석함에서 일정에 넣기"
              variant="outline"
              onPress={() => {
                setLooking(null);
                router.push('/(app)/saved');
              }}
            />
          ) : null
        }
        onClose={() => setLooking(null)}
      />

      <SignUpGate intent={gate} onClose={() => setGate(null)} />
    </View>
  );
}

/**
 * 판에 떠 있는 곳이 목록의 어느 줄인지.
 *
 * <p>판은 이름과 좌표만 들고 가고 묶음 열쇠는 안 들고 갑니다. 담았는지를
 * 기억하는 것은 열쇠 쪽이라 되짚습니다 — 이름이 같은 다른 가게가 한 목록에
 * 둘 설 수 있어 좌표까지 함께 봅니다.
 */
function rowFor(places: NearPlace[], looking: Looked | null): NearPlace | null {
  if (!looking) {
    return null;
  }
  return (
    places.find(
      (p) => p.name === looking.name && p.lat === looking.lat && p.lng === looking.lng,
    ) ?? null
  );
}

const styles = StyleSheet.create({
  shelf: {
    gap: Spacing.s2,
    paddingBottom: Spacing.s3,
  },
});
