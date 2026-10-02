import { Stack, usePathname, useNavigation, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api, ApiError, query, UNEXPECTED } from '@/api/client';
import type {
  PopularKind,
  PopularPlace,
  PopularRegion,
  TripDetail,
  TripSummary,
} from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { DayPicker } from '@/components/day-picker';
import { PlaceDetailSheet, type Looked } from '@/components/place-detail-sheet';
import { SignUpGate } from '@/components/signup-gate';
import { glyphOf, labelOf } from '@/constants/place-icons';
import { Colors, Palette, Spacing, Type, Weight } from '@/constants/theme';
import { KEEP, WANT } from '@/constants/words';
import type { Comeback } from '@/lib/comeback';
import { todayIso } from '@/lib/countdown';
import {
  Body,
  BottomSheet,
  Button,
  Caption,
  Empty,
  ErrorNote,
  Grow,
  IconButton,
  ListRow,
  Loading,
  Mark,
  Picker,
  Press,
  Row,
  Screen,
  Tabs,
  Title,
} from '@/ui';
import { NavLeft, ScreenTop } from '@/ui/nav';

type Tab = 'places' | 'regions';

const TABS: { value: Tab; label: string }[] = [
  { value: 'places', label: '장소' },
  { value: 'regions', label: '지역' },
];

/**
 * 지금 뜨는 여행지.
 *
 * <h3>왜 필요한가</h3>
 *
 * <p>처음 온 사람의 홈은 텅 비어 있습니다. "첫 여행을 만들어 보세요" 라고만
 * 하면 무엇을 만들어야 할지가 그대로 숙제로 남습니다. 남들이 어디를 갔는지
 * 보이면 거기서 시작할 수 있습니다.
 *
 * <h3>따로 채워 두지 않습니다</h3>
 *
 * <p>올라온 글을 그때그때 세어 만듭니다. 운영자가 고른 목록이 아니라서
 * 손댈 것이 없고, 글이 없으면 목록도 비어 있습니다 — 그때는 화면이 없는
 * 것을 있는 척하지 않습니다.
 *
 * <p>한 글에서 같은 곳을 두 번 넣었어도 한 번으로 셉니다. 사흘 내내 같은
 * 카페에 갔다고 그 카페가 세 배 인기 있는 것은 아닙니다.
 *
 * <h3>안내문을 걷었습니다</h3>
 *
 * <p>"어떻게 센 것인가" 를 흰 판에 담아 목록 위에 두었습니다. 그런데 그
 * 판은 <b>처음 한 번만 읽히고</b> 그다음부터는 순위를 보려면 매번 지나쳐야
 * 하는 벽이었습니다. 세는 법은 순위 줄 자체가 말합니다 — "여행 12개에
 * 담김" 이 그 말입니다.
 *
 * <h3>갈래 띠를 뗐습니다</h3>
 *
 * <p>이 화면은 홈에서 들어오는 곳이고 아래 띠에 제 칸이 없습니다. 그래도
 * 띠를 달아 두었더니 <b>켜진 칸이 하나도 없는 띠</b>가 아래에 서 있었습니다 —
 * 지금 어디인지를 말해야 하는 것이 아무 말도 안 하고 자리만 먹었습니다.
 * 돌아가는 길은 상단바 뒤로가 맡습니다.
 *
 * <h3>제목이 상단바에서 본문으로 내려왔습니다</h3>
 *
 * <p>갈래에서 바로 열리는 화면들 가운데 어떤 것은 큰 제목을 본문 맨 위에
 * 두고 어떤 것은 작은 제목을 막대 가운데에 두고 있었습니다. 같은 깊이의
 * 화면인데 제목이 서는 자리가 다르니, 옮겨 다니면 <b>제목이 위아래로
 * 뛰었습니다.</b>
 *
 * <p>여기도 큰 제목으로 내립니다. 돌아갈 길이 있어야 하는 화면이라
 * 제목 왼쪽에 뒤로·처음 단추를 함께 둡니다.
 *
 * <h3>할 수 있는 일이 둘입니다</h3>
 *
 * <p>순위를 보고 나면 하려는 일이 둘로 갈립니다 — <b>나중에 쓰려고 챙겨
 * 두는 것</b>과 <b>지금 짜고 있는 여행에 넣는 것</b>입니다. 전에는 보는
 * 것으로 끝이라, 마음에 드는 곳을 찾아도 다시 검색으로 가서 그 이름을
 * 처음부터 찾아야 했습니다.
 *
 * <p>둘을 한 단추로 묶지 않습니다. 담기는 누르면 그걸로 끝나는 일이고,
 * 여행에 추가는 <b>어느 여행 · 어느 날</b>을 물어야 하는 일입니다. 묶으면
 * 챙겨만 두려던 사람에게도 매번 여행을 묻게 됩니다.
 *
 * <p>그래서 자리도 나눕니다. 담기는 줄 끝 책갈피({@link KEEP}) — 홈의
 * 「지금 뜨는 곳」과 같은 몸짓입니다. 여행에 추가는 장소 판({@link
 * PlaceDetailSheet})의 글자 단추입니다. 그 판의 문서가 적어 둔 가름과
 * 같습니다 — 한 번 눌러 끝나는 일은 {@code scrap} 그림 자리, 갈 곳을
 * 고르는 일은 {@code actions} 글자 단추 자리. 순위 줄에 글자 단추 둘을
 * 늘어놓는 쪽은 버렸습니다. 줄에는 이미 번호·그림·이름·갈래·「여행 12개」가
 * 서 있어서 좁은 폰에서 이름이 두 자로 접혔습니다.
 *
 * <h3>모임 여행에는 날짜를 안 묻습니다</h3>
 *
 * <p>{@link aimAt} 이 모임이면 {@link WANT}, 혼자면 날짜로 갈립니다. 모임
 * 여행의 일정에 혼자 바로 넣으면 같이 가는 사람은 자기도 모르게 정해진
 * 곳을 봅니다 — 보석함이 이미 같은 규칙으로 갈라 둔 자리입니다.
 *
 * <h3>누르면 말을 합니다</h3>
 *
 * <p>홈의 같은 단추가 <b>눌러도 아무 일이 안 일어나는 것처럼</b> 보였습니다.
 * 조용히 빠져나가는 길이 셋이었던 탓입니다 — 좌표가 없으면 그냥 돌아섬,
 * 서버가 거절하면 {@code catch} 가 통째로 삼킴, 담겼다는 표시가 책갈피 색
 * 하나. 그 색도 말을 안 합니다({@link IconButton} 의 {@code active} 가 제
 * 문서에 적어 둔 그대로입니다).
 *
 * <p>여기서는 세 길을 모두 화면에 꺼냅니다. 된 일은 <b>그것이 간 자리로
 * 가는 줄</b>이 되고(보석함·투표장·그 여행), 안 된 일은 서버가 보낸 말을
 * 그대로 적습니다 — 「보석함이 가득 찼어요」 같은 것은 사람이 할 일을
 * 알려 줍니다.
 */
export default function Popular() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  /* 가입하고 돌아올 자리. 주소를 손으로 적지 않습니다 — 이 화면이 갈래
     띠 밖에 있어 경로가 한 군데 적혀 있지 않습니다. */
  const where = usePathname();
  const [tab, setTab] = useState<Tab>('places');
  /** 갈래로 거르고 있는 것. 비우면 전부. */
  const [kind, setKind] = useState<string | null>(null);
  /*
    지역으로도 거릅니다.

    <p>갈래만으로 거르면 "카페" 를 눌렀을 때 도쿄와 제주가 한 목록에 섞여
    나옵니다. 정작 보는 사람은 대개 <b>갈 곳을 하나 정해 두고</b> 봅니다.
  */
  const [region, setRegion] = useState<string | null>(null);

  /*
    들여다보는 중인 곳 — 곳 자체가 아니라 그 열쇠만 듭니다.

    <p>{@code Looked} 를 그대로 들고 있었습니다. 그런데 판에도 담기가 서야
    하고(판의 {@code scrap}), 담았는지를 기억하는 것은 <b>열쇠 쪽</b>입니다 —
    판이 들고 가는 꼴에는 열쇠가 없어서, 이름과 좌표로 목록을 되짚어
    찾아야 했습니다. 열쇠만 들면 되짚을 것이 없습니다.
  */
  const [lookingKey, setLookingKey] = useState<string | null>(null);

  /**
   * 「여행에 추가」로 겨눈 곳. 여행 고르는 판이 이것으로 섭니다.
   *
   * <p>열쇠가 아니라 꼴 그대로 듭니다. 이쪽은 <b>판이 닫힌 뒤에도</b> 들고
   * 있어야 하고(판 위에 판을 겹치지 않으므로 장소 판을 먼저 닫습니다),
   * 거르는 조건이 바뀌어 목록에서 사라져도 넣던 일은 끝나야 합니다.
   */
  const [aiming, setAiming] = useState<Looked | null>(null);
  /** 날짜 고르는 판 — 혼자 여행을 골랐을 때만 섭니다. */
  const [pouring, setPouring] = useState<{
    place: Looked;
    trip: TripSummary;
    days: TripDetail['days'];
  } | null>(null);

  /** 보석함에 담은 곳. 다시 누르면 또 담기지 않게 표만 해 둡니다. */
  const [kept, setKept] = useState<Set<string>>(new Set());
  /** 계정이 없어서 막은 일. */
  const [gate, setGate] = useState<Comeback | null>(null);
  /**
   * 하고 나서 할 말과 그것이 간 자리.
   *
   * <p>「담았어요」로 끝내지 않습니다. 담은 사람이 다음에 하려는 일은 대개
   * <b>그것을 꺼내 쓰는 것</b>이라, 간 자리로 가는 길을 같은 줄에 둡니다.
   */
  const [said, setSaid] = useState<{ text: string; label: string; go: () => void } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  /* 글에 실제로 쓰인 갈래만 받습니다. 열여섯 개를 다 늘어놓으면 대부분
     눌러도 아무것도 안 걸립니다. */
  const { data: kinds } = useAsync<{ kinds: PopularKind[] }>(
    (signal) => api.get('/api/popular/kinds', signal),
    [],
  );

  const {
    data: places,
    loading: loadingPlaces,
    error: placeError,
    reload: reloadPlaces,
  } = useAsync<{ places: PopularPlace[] }>(
    (signal) => api.get(`/api/popular/places${query({ kind, region })}`, signal),
    [kind, region],
  );

  const {
    data: regions,
    loading: loadingRegions,
    error: regionError,
    reload: reloadRegions,
  } = useAsync<{ regions: PopularRegion[] }>(
    (signal) => api.get('/api/popular/regions', signal),
    [],
  );

  /*
    내 여행 — 여행 고르는 판을 열었을 때만 묻습니다.

    <p>이 화면은 계정 없이도 열립니다. 늘 물으면 구경하러 들어온 사람에게
    401 이 한 번씩 나가고, 계정이 있어도 「여행에 추가」를 한 번도 안 누르는
    사람에게는 쓰지 않을 요청입니다.

    <p>안 물을 때는 {@code null} 을 돌려줍니다. 빈 목록({@code trips: []})
    으로 두면 {@link useAsync} 가 그것을 <b>받아 둔 값</b>으로 들고 있어서,
    판을 열고 받아 오는 동안 「다가오는 여행이 없어요」가 먼저 떴습니다 —
    없는 사실을 말하는 셈입니다.
  */
  const { data: tripData } = useAsync<{ trips: TripSummary[] } | null>(
    (signal) => (user && aiming ? api.get('/api/trips', signal) : Promise.resolve(null)),
    [user?.id, aiming != null],
  );
  /* 이미 끝난 여행에는 넣을 일이 없습니다. 끝나는 날이 없으면 시작하는
     날로 봅니다 — 날짜를 아직 안 정한 여행은 늘 남습니다. */
  const upcoming = useMemo(
    () => (tripData?.trips ?? []).filter((t) => (t.endIso ?? t.startIso ?? '9999') >= todayIso()),
    [tripData],
  );

  const looking = places?.places.find((p) => p.key === lookingKey) ?? null;
  const lookedAt = looking ? lookedOf(looking) : null;

  /**
   * 보석함에 담습니다. 담기만 합니다.
   *
   * <p>여행을 묻지 않습니다. 「담아 두기」는 <b>아직 안 정한 것</b>을 챙기는
   * 일이라, 여기서 여행을 물으면 여행이 없는 사람은 담을 수가 없습니다.
   */
  async function keep(place: PopularPlace) {
    setSaid(null);
    setFailed(null);
    if (!user) {
      /*
        말없이 로그인 화면으로 보내지 않습니다.

        <p>홈의 같은 단추는 바로 밀어 넣습니다. 그쪽은 이미 내 여행이 서는
        화면이지만, 여기는 <b>계정을 만들기 전에 보는 화면</b>입니다 — 화면
        제 문서가 「처음 온 사람의 홈은 텅 비어 있다」로 시작합니다. 구경하던
        사람에게 낯선 화면이 갑자기 뜨면 대개 그냥 닫습니다
        ({@link SignUpGate} 가 그 때문에 있습니다). 가입을 마치면 여기로
        돌아옵니다.
      */
      setGate({ where, what: 'save' });
      return;
    }
    if (kept.has(place.key)) {
      setSaid({
        text: `「${place.name}」 는 이미 보석함에 있어요.`,
        label: '보석함으로',
        go: () => router.push('/(app)/saved'),
      });
      return;
    }
    /* 좌표 없이는 담아도 지도에 안 섭니다. 말없이 돌아서면 눌린 적이 없는
       것처럼 보입니다. */
    if (place.lat == null || place.lng == null) {
      setFailed(`「${place.name}」 는 자리를 몰라서 담을 수 없어요.`);
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
      setKept((was) => new Set(was).add(place.key));
      setSaid({
        text: `「${place.name}」 를 보석함에 담았어요.`,
        label: '보석함으로',
        go: () => router.push('/(app)/saved'),
      });
    } catch (e) {
      /* 삼키지 않습니다. 서버가 보낸 말이 그대로 쓸모 있습니다 — 「보석함이
         가득 찼어요」 같은 것은 사람이 할 일을 알려 줍니다. */
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  /**
   * 여행 고르는 판을 엽니다.
   *
   * <p>장소 판을 먼저 닫습니다. 판 위에 판을 겹치면 뒤엣것을 닫을 때
   * 앞엣것까지 함께 닫히거나, 기기에 따라 아예 안 뜹니다.
   *
   * <p>계정이 없어도 엽니다. 「여행이 없다」와 「계정이 없다」는 둘 다 이
   * 판에서 말할 것이고, 가입하라는 말을 하려고 다른 판을 하나 더 띄울
   * 이유가 없습니다 — {@link SignUpGate} 의 「보석함은 사람마다 따로예요」는
   * 여행에 넣으려던 사람에게 할 말이 아닙니다.
   */
  function aim(place: Looked) {
    setSaid(null);
    setFailed(null);
    setLookingKey(null);
    setAiming(place);
  }

  /**
   * 고른 여행에 넣습니다 — 모임이면 가고 싶은 곳, 혼자면 날짜.
   *
   * <p>모임 여행의 일정에 혼자 바로 넣으면, 같이 가는 사람은 자기도 모르게
   * 정해진 곳을 봅니다. 가고 싶은 곳에 올리면 모두가 좋다고 해야 일정이
   * 됩니다. 혼자 여행에는 물을 사람이 없으니 날짜로 바로 넣는 편이 빠릅니다.
   *
   * <p>보석함을 거치지 않습니다. 보석함 쪽 길({@code /api/days/.../from-saved})
   * 은 <b>담아 둔 번호</b>를 받으므로, 그 길로 가려면 먼저 몰래 담아야
   * 합니다 — 담기를 따로 둔 까닭이 바로 그것을 안 하는 데 있습니다. 후보와
   * 일정은 장소를 그대로 받는 길이 이미 있습니다.
   */
  async function aimAt(trip: TripSummary) {
    const place = aiming;
    if (!place) {
      return;
    }
    setFailed(null);
    const body = {
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      placeId: place.placeId,
      icon: place.icon,
    };
    if (trip.groupId) {
      try {
        await api.post(`/api/trips/${encodeURIComponent(trip.id)}/candidates`, body);
        setAiming(null);
        setSaid({
          text: `「${place.name}」 를 「${trip.title}」 ${WANT}에 올렸어요. 모두 좋다고 하면 일정이 돼요.`,
          /* 투표장으로 밀어 넣지 않습니다. 순위를 훑던 중이라 화면이 바뀌면
             몇 번째를 보고 있었는지 잃습니다 — 줄로 가리키고 손에 맡깁니다. */
          label: '투표장 보기',
          go: () => router.push({ pathname: '/vote/[id]', params: { id: trip.id } }),
        });
      } catch (e) {
        setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
      }
      return;
    }
    try {
      const got = await api.get<TripDetail>(`/api/trip?trip=${encodeURIComponent(trip.id)}`);
      setAiming(null);
      setPouring({ place, trip, days: got.days });
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  return (
    <Screen
      safeTop
      /* 줄 높이는 {@link ScreenTop} 이 한 자리에서 정합니다 — 홈에서 눌러
         들어오는 화면 넷(알림함·검색·가계부·여기)이 같은 높이로 서야 오갈
         때 윗줄이 들썩이지 않습니다. */
      header={
        <ScreenTop
          left={
            <Row gap={Spacing.s2}>
              <NavLeft navigation={navigation} up="/(app)/home" />
              <Grow>
                <Title>지금 뜨는 여행지</Title>
              </Grow>
            </Row>
          }
        />
      }>
      {/* 큰 제목이 본문 위에 서므로 상단바는 걷습니다. 둘 다 두면 같은 말이
          한 화면에 두 번 적힙니다. */}
      <Stack.Screen options={{ headerShown: false }} />

      {/*
        알약이 아니라 밑줄 탭입니다.

        <p>장소와 지역은 <b>같은 목록을 다르게 늘어놓는 것이 아닙니다.</b>
        장소 쪽에는 「어떤 곳」·「지역」 고르는 칸 둘이 함께 서고 누르면 장소
        시트가 열리는데, 지역 쪽에는 그 칸들이 없고 누르면 둘러보기로
        떠납니다. 아래가 통째로 다른 화면이라 알약으로 묶어 둘 것이
        아닙니다.
      */}
      <Tabs items={TABS} value={tab} onChange={setTab} />

      {tab === 'places' ? (
        <>
          {/*
            고르는 칸 둘.

            <p>갈래를 칩으로 늘어놓고 있었습니다. 열댓 개가 두세 줄로 접혀
            화면 위쪽을 통째로 먹었는데, 고르는 일은 가끔 한 번이고 나머지
            시간에는 고른 결과를 봅니다.

            <p>한 줄로 접습니다. 그러면서 남은 자리에 지역을 하나 더
            들입니다 — 전에는 칩만으로도 꽉 차 둘째 조건을 놓을 데가
            없었습니다.

            <p>판에서 꺼냈습니다. 흰 바탕 위의 흰 판은 아무것도 가르지
            못하면서 칸 둘을 안으로 16픽셀 밀어 넣기만 했습니다.
          */}
          <Row gap={Spacing.s2} style={styles.chips}>
            {(kinds?.kinds.length ?? 0) > 1 ? (
              <Picker
                /* "갈래" 는 일상에서 잘 안 쓰는 말이라 무엇을 고르는 칸인지
                   한 번 생각해야 했습니다. 옆 칸이 "지역" 이니 같은 무게의
                   쉬운 말로 맞춥니다. */
                label="어떤 곳"
                value={kind}
                onChange={setKind}
                options={(kinds?.kinds ?? []).map((k) => ({
                  value: k.kind,
                  label: labelOf(k.kind),
                }))}
              />
            ) : null}
            {(regions?.regions.length ?? 0) > 1 ? (
              <Picker
                label="지역"
                value={region}
                onChange={setRegion}
                options={(regions?.regions ?? []).map((r) => ({
                  value: r.region,
                  label: r.region,
                  hint: `여행 ${r.posts}개`,
                }))}
              />
            ) : null}
          </Row>

          {/*
            담거나 넣고 나서 할 말.

            <p>목록 위, 고르는 칸 바로 아래입니다. 누른 줄 옆에 띄우면 줄
            높이가 흔들려 다음 줄을 누르려던 손이 빗나갑니다.

            <p>줄 전체가 누르는 자리입니다 — 간 자리로 갑니다.
          */}
          {said ? (
            <Press
              onPress={said.go}
              scale={0.99}
              accessibilityLabel={said.label}
              style={styles.said}>
              <Grow>
                <Caption tone="brand" strong>
                  {said.text}
                </Caption>
              </Grow>
              <Caption tone="secondary">{said.label}</Caption>
            </Press>
          ) : null}
          {failed ? <ErrorNote message={failed} /> : null}

          {loadingPlaces && !places ? <Loading /> : null}
          {placeError ? <ErrorNote message={placeError} onRetry={reloadPlaces} /> : null}

            {/*
              한 줄만 있으면 「없다」로 끝납니다.

              <p>빈 화면을 보는 사람은 대개 <b>무엇을 잘못 눌렀나</b>를 먼저
              생각합니다. 조건 때문에 비었으면 그 조건을 가리켜 줘야 하고,
              아직 아무것도 없어서 비었으면 그 말을 해 줘야 합니다 — 둘이
              같은 문장이면 조건을 풀어 볼 생각을 못 합니다.
            */}
          {places && places.places.length === 0 ? (
            <Empty
              icon="map-pin"
              message={
                kind ? '이런 곳은 아직 올라온 것이 없어요.' : '아직 올라온 일정이 없어요.'
              }
              note={
                kind
                  ? '조건을 줄이면 더 보일 수 있어요.'
                  : '누군가 여행을 내놓으면 여기 쌓입니다. 첫 번째가 되어 보세요.'
              }
              action={
                kind || region
                  ? {
                      label: '조건 지우기',
                      onPress: () => {
                        setKind(null);
                        setRegion(null);
                      },
                    }
                  : undefined
              }
            />
          ) : null}

          {places?.places.map((place, i, all) => (
            <Rank
              key={place.key}
              at={i + 1}
              last={i === all.length - 1}
              mark={<Mark icon={glyphOf(place.icon)} />}
              title={place.name}
              sub={labelOf(place.icon)}
              meta={`여행 ${place.posts}개`}
              /*
                담기는 줄 끝에 섭니다.

                <p>좌표가 없는 줄에도 냅니다. 안 내면 그 줄만 단추가 빠진
                꼴이 되어 목록이 고장 난 것으로 보이고, 눌러 보면
                {@link keep} 이 왜 못 담는지 말해 줍니다 — 숨기는 것보다
                말하는 쪽이 낫습니다.
              */
              tail={
                <IconButton
                  name="bookmark"
                  label={`${place.name} ${KEEP}`}
                  active={kept.has(place.key)}
                  /* {@link IconButton} 의 문서가 적어 둔 그대로입니다 —
                     켜진 것이 보여야 하는 자리에서 {@code active} 만 주면
                     회색에서 검정으로만 바뀌어 아무 말도 안 합니다. */
                  tone={kept.has(place.key) ? 'brand' : undefined}
                  onPress={() => keep(place)}
                />
              }
              onPress={
                place.lat != null && place.lng != null
                  ? () => setLookingKey(place.key)
                  : undefined
              }
            />
          ))}
        </>
      ) : (
        <>
          {loadingRegions && !regions ? <Loading /> : null}
          {regionError ? <ErrorNote message={regionError} onRetry={reloadRegions} /> : null}

          {regions && regions.regions.length === 0 ? (
            <Empty
              icon="map-pin"
              message="아직 올라온 일정이 없어요."
              note="누군가 여행을 내놓으면 그 지역이 여기 쌓입니다. 첫 번째가 되어 보세요."
            />
          ) : null}

          {regions?.regions.map((r, i, all) => (
            <Rank
              key={r.region}
              at={i + 1}
              last={i === all.length - 1}
              title={r.region}
              sub={r.likes > 0 ? `♥ ${r.likes}` : '그 지역 글 보기'}
              meta={`여행 ${r.posts}개`}
              onPress={() => router.push(`/community?region=${encodeURIComponent(r.region)}`)}
            />
          ))}
        </>
      )}

      {/*
        들여다보는 판.

        <p>담기는 그림 자리({@code scrap}), 여행에 추가는 글자 단추 자리
        ({@code actions}) 입니다. 그 가름은 판이 정해 둔 것입니다 — 한 번
        눌러 끝나는 일과 갈 곳을 고르는 일.
      */}
      <PlaceDetailSheet
        place={lookedAt}
        scrap={
          looking
            ? { kept: kept.has(looking.key), onPress: () => keep(looking) }
            : null
        }
        actions={
          lookedAt ? (
            <>
              {/* 판 안에서 담다가 거절당하면 그 말이 판 <b>뒤에</b> 적혔습니다 —
                  목록 위에 세워 둔 줄은 판이 가리고 있어서, 누른 사람에게는
                  아무 일도 안 일어난 것으로 보입니다. 판 안에서도 말합니다. */}
              {failed ? <ErrorNote message={failed} /> : null}
              <Button label="여행에 추가" onPress={() => aim(lookedAt)} />
            </>
          ) : null
        }
        onClose={() => setLookingKey(null)}
      />

      {/*
        어느 여행에 넣을지.

        <p>세 가지 사정을 이 한 판이 말합니다 — 계정이 없는 사람, 여행이
        아직 없는 사람, 고를 여행이 있는 사람. 사정마다 판을 따로 띄우면
        같은 물음에 답하는 자리가 셋이 됩니다.
      */}
      <BottomSheet
        visible={aiming != null}
        title="어느 여행에 추가할까요?"
        onClose={() => setAiming(null)}
        footer={
          !user ? (
            <>
              {/* {@link SignUpGate} 와 같은 두 단추입니다. 그 판을 겹쳐 띄우지
                  않는 까닭은 {@link aim} 에 적어 두었습니다. */}
              <Button
                label="가입하고 이어서 하기"
                onPress={() => router.push(`/(auth)/register?next=${encodeURIComponent(where)}`)}
              />
              <Button
                label="이미 계정이 있어요"
                variant="text"
                onPress={() => router.push(`/(auth)/login?next=${encodeURIComponent(where)}`)}
              />
            </>
          ) : tripData && upcoming.length === 0 ? (
            <Button label="여행 만들기" onPress={() => router.push('/(app)/trips?new=1')} />
          ) : undefined
        }>
        {!user ? (
          <Body tone="secondary">
            여행은 계정마다 따로예요. 가입하면 여기에 내 여행이 서고, 고른 곳을 바로 넣을 수
            있어요.
          </Body>
        ) : null}

        {/* 여행을 골랐는데 서버가 거절했을 때. 판 뒤의 줄은 판이 가립니다. */}
        {failed ? <ErrorNote message={failed} /> : null}

        {/* 받아 오는 동안에는 「없어요」라고 말하지 않습니다. 아직 모르는
            것과 없는 것은 다릅니다. */}
        {user && !tripData ? <Loading /> : null}

        {user && tripData && upcoming.length === 0 ? (
          <Caption tone="muted">다가오는 여행이 없어요. 내 여행에서 먼저 만들어 주세요.</Caption>
        ) : null}

        {upcoming.length > 0 ? (
          <Caption tone="secondary">
            모임 여행이면 「{WANT}」에 올라가요 — 모두 좋다고 하면 일정이 돼요. 혼자 여행이면
            고른 날에 바로 들어가요.
          </Caption>
        ) : null}
        {upcoming.map((t, i) => (
          <ListRow
            key={t.id}
            left={<Mark icon={t.groupId ? 'users' : 'calendar'} />}
            title={t.title}
            subtitle={t.groupId ? `${t.groupName ?? '모임'} · ${WANT}에 올리기` : '날짜 골라 넣기'}
            last={i === upcoming.length - 1}
            onPress={() => aimAt(t)}
          />
        ))}
      </BottomSheet>

      {/*
        며칟날에 넣을지 — 혼자 여행에만 섭니다.

        <p>{@code days} 를 주므로 이 판은 날짜만 묻습니다. 여행은 위에서
        이미 골랐고, 그때 모임이냐 혼자냐를 갈랐습니다.
      */}
      <DayPicker
        days={pouring?.days}
        visible={pouring != null}
        note={`「${pouring?.place.name ?? ''}」 가 그 날 맨 뒤에 붙어요. 순서는 넣은 뒤 바꿀 수 있어요.`}
        onPour={async (dayId) => {
          if (!pouring) {
            return;
          }
          const { place, trip, days } = pouring;
          await api.post('/api/places', {
            dayId,
            name: place.name,
            lat: place.lat,
            lng: place.lng,
            placeId: place.placeId,
            icon: place.icon,
          });
          /* 며칟날에 들어갔는지를 적어 둡니다. 「넣었어요」만으로는 날을
             잘못 골랐는지 알 수가 없습니다. */
          const at = days.findIndex((d) => d.id === dayId);
          const day = days[at];
          setSaid({
            text: `「${place.name}」 를 「${trip.title}」 ${day?.label || `${at + 1}일차`}에 넣었어요.`,
            label: '여행 보기',
            go: () => router.push({ pathname: '/trip/[id]', params: { id: trip.id } }),
          });
        }}
        onCancel={() => setPouring(null)}
        onDone={() => setPouring(null)}
      />

      <SignUpGate intent={gate} onClose={() => setGate(null)} />
    </Screen>
  );
}

/**
 * 판에 넘길 꼴.
 *
 * <p>좌표가 없으면 열지 않습니다 — 판이 하는 일의 절반이 지도와 영업시간인데
 * 그 둘이 다 좌표에서 나옵니다. 여행에 넣는 길도 좌표를 받아야 합니다.
 */
function lookedOf(place: PopularPlace): Looked | null {
  if (place.lat == null || place.lng == null) {
    return null;
  }
  return {
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    placeId: place.placeId,
    icon: place.icon,
  };
}

/**
 * 순위 한 줄.
 *
 * <p>번호를 답니다. 순위는 위에서부터 읽으면 알 수 있지만, 번호가 없으면
 * 훑어 내려가다 지금 몇 번째를 보고 있는지 놓칩니다.
 *
 * <h3>판을 벗고 줄이 되었습니다</h3>
 *
 * <p>줄마다 흰 판을 두르고 있었습니다. 열 줄이면 흰 바탕 위에 흰 사각형이
 * 열 개 — 테두리도 그림자도 거의 안 보이니 <b>판을 둘렀다는 사실만</b>
 * 남고, 줄 사이가 4픽셀씩 벌어져 순위가 한 묶음으로 안 읽혔습니다.
 *
 * <p>판을 벗기고 줄로 둡니다. 카드는 눌러서 들어가는 <b>물건</b>에만
 * 씁니다 — 순위는 물건이 아니라 목록입니다.
 *
 * <h3>앞의 셋만 색을 씁니다</h3>
 *
 * <p>열 줄이 모두 같은 무게면 순위가 아니라 그냥 목록입니다. 1·2·3 만
 * 브랜드색으로 두고 나머지는 흐린 회색입니다 — 색은 "여기가 위" 라는
 * 말만 하고 물러섭니다.
 *
 * <h3>{@code ListRow} 를 안 쓰는 까닭</h3>
 *
 * <p>목록 줄은 {@code ListRow} 로 통일했지만 그것은 <b>누르는 줄</b>입니다.
 * 좌표가 없는 곳은 들여다볼 판을 열 수 없어 누를 데가 없는데, 누르는 줄로
 * 두면 눌러도 아무 일이 안 일어나는 줄이 목록에 섞입니다.
 *
 * <p>생김새는 맞춥니다. 높이·사이·아래 선을 {@code ListRow} 와 같게 두고
 * 마지막 줄에는 선을 안 긋습니다 — 눌리는 줄과 안 눌리는 줄이 나란히 서도
 * 한 목록으로 읽혀야 합니다.
 */
function Rank({
  at,
  mark,
  title,
  sub,
  meta,
  tail,
  last,
  onPress,
}: {
  at: number;
  mark?: React.ReactNode;
  title: string;
  sub: string;
  /** 줄 오른쪽에 붙는 수. 몇 번 담겼는지. */
  meta: string;
  /**
   * 줄 끝에 붙는 단추.
   *
   * <p>누르는 자리 <b>밖</b>에 섭니다. 줄 안에 두면 단추 안에 단추가 들어가고,
   * 누른 자리가 줄인지 단추인지 흔들립니다 — 홈의 같은 목록이 같은 까닭으로
   * 단추를 줄 옆에 세웁니다.
   */
  tail?: React.ReactNode;
  /** 목록의 마지막 줄인지. 마지막에는 선을 안 긋습니다. */
  last?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <Row gap={Spacing.s3} style={styles.rank}>
      <Text style={[styles.at, at <= 3 ? styles.atTop : null]}>{at}</Text>
      {mark}
      <Grow gap={2}>
        <Body strong numberOfLines={1}>
          {title}
        </Body>
        <Caption tone="secondary">{sub}</Caption>
      </Grow>
      <Caption tone="secondary">{meta}</Caption>
    </Row>
  );

  /* 선은 겉껍데기가 긋습니다. 누르는 자리에 그으면 눌릴 때 선까지 함께
     움직이는 것으로 보입니다. 단추가 붙어도 선은 줄 끝까지 갑니다 —
     단추 앞에서 끊기면 줄이 토막난 것으로 보입니다. */
  return (
    <View style={last ? null : styles.rankLine}>
      <Row gap={Spacing.s2} style={styles.rankWhole}>
        <Grow>
          {onPress ? (
            <Press onPress={onPress} scale={1} accessibilityLabel={`${title} 자세히`}>
              {body}
            </Press>
          ) : (
            body
          )}
        </Grow>
        {tail}
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  /*
    탭 아래 선은 좌우 여백을 뚫고 나갑니다.

    <p>여백 안에 가두면 선이 양쪽에서 20픽셀씩 모자라, 화면을 가르는
    가닥이 아니라 내용 위에 얹힌 상자의 밑변으로 보입니다.
  */

  chips: {
    flexWrap: 'wrap',
  },
  /* 담거나 넣었다는 말. 줄 전체가 누르는 자리라 간 자리로 갑니다. */
  said: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s2,
    paddingVertical: Spacing.s2,
  },
  /* 줄과 줄 끝 단추. 단추는 제 크기만 쓰고 줄이 나머지를 먹습니다. */
  rankWhole: {
    alignItems: 'center',
  },
  rank: {
    alignItems: 'center',
    /* 썸네일이 드는 줄의 높이. 번호와 표식이 함께 서도 글자가 눌리지
       않습니다. */
    minHeight: 72,
  },
  /* 줄을 가르는 선. 목록 줄({@code ListRow})과 같은 굵기·색입니다. */
  rankLine: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  /*
    순위 번호.

    <p>한 자리든 두 자리든 이름이 같은 자리에서 시작해야 합니다. 번호가
    흔들리면 목록 전체가 들쭉날쭉해 보입니다.
  */
  at: {
    ...Type.title3,
    fontWeight: Weight.bold,
    color: Palette.gray[400],
    width: 22,
    textAlign: 'center',
  },
  atTop: {
    color: Colors.accentInk,
  },
});
