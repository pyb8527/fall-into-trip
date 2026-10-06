import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { PathTitle } from '@/ui/nav';
import { LogoInline } from '@/ui/logo';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { api, API_BASE } from '@/api/client';
import type { Books, Person, TripDetail } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { PublishForm } from '@/components/publish-form';
import { TripMap } from '@/components/trip-map';
import {
  Colors,
  dayColor,
  Elevation,
  Gutter,
  Radius,
  Spacing,
} from '@/constants/theme';
import { iconOf } from '@/constants/place-icons';
import { todayIso } from '@/lib/countdown';
import { money } from '@/lib/money';
import { shareLink } from '@/lib/share';
import {
  Band,
  Body,
  Button,
  Caption,
  Chip,
  ErrorNote,
  Grow,
  Loading,
  Row,
  Screen,
  SectionHeader,
  SegmentedTabs,
  Split,
} from '@/ui';
import { TripTabs } from '@/ui/tab-bar';
import { hasTiltMaps, ReplayStage } from '@/components/replay-stage';

/**
 * 다녀온 여행을 한 장으로.
 *
 * <p>두 가지로 봅니다.
 *
 * <ul>
 *   <li><b>영수증</b> — 날마다 몇 곳을 들렀고 얼마를 썼는지 고정폭 글자로
 *       늘어놓습니다. 사진이 없어도 성립하고, 지어낸 수치를 쓰지
 *       않습니다.</li>
 *   <li><b>다시 보기</b> — 동선이 지도 위에 순서대로 그려집니다. 영상으로
 *       만들면 인코딩이 필요한데, 그릴 것을 늘려 가며 보여 주면 같은 것을
 *       훨씬 가볍게 할 수 있습니다.</li>
 * </ul>
 */
/*
  「남긴 것」 칸이 있었습니다.

  <p>장소마다 남긴 사진과 한 줄을 날짜 순으로 훑는 자리였습니다. 그런데
  그걸 남기려면 <b>장소를 먼저 골라야</b> 해서, 숙소에서 찍은 단체 사진은
  올릴 데가 없었습니다. 피드가 그 일을 대신하므로 이 칸은 걷습니다.
*/
type Face = 'receipt' | 'replay';

const FACES: { value: Face; label: string }[] = [
  { value: 'receipt', label: '영수증' },
  /* 「다시 보기」 였습니다. 무엇을 다시 보는지가 이름에 없어서, 누르기
     전에는 알 수 없었습니다. */
  { value: 'replay', label: '동선' },
];

export default function Card() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [face, setFace] = useState<Face>('receipt');

  const { data, error, loading } = useAsync<TripDetail>(
    (signal) => api.get(`/api/trip?trip=${encodeURIComponent(id)}`, signal),
    [id],
  );
  const { data: mates } = useAsync<{ people: Person[] }>(
    (signal) => api.get(`/api/trips/${encodeURIComponent(id)}/people`, signal),
    [id],
  );
  /* 통화마다 하나씩 옵니다. 곁다리라 못 받아 와도 영수증은 뜹니다 —
     그 줄만 빠집니다. 동행자 목록과 같은 방식입니다. */
  const { data: spent } = useAsync<{ books: Books[] }>(
    (signal) => api.get(`/api/trips/${encodeURIComponent(id)}/settlement`, signal),
    [id],
  );

  const router = useRouter();
  /* 여행기 판을 열어 두었는지. */
  /*
    다녀왔는지.

    <p>출발 이틀 전에 이 화면을 열면 「함께한 사람」 · 「이 여행을 남길까요?
    여행기 올리기」가 서 있었습니다. 아직 안 간 여행을 다녀온 것처럼 말하고,
    남길 것이 없는 때에 남기라고 했습니다. 마지막 날이 지나야 다녀온
    것입니다. 날짜가 없는 여행은 다녀온 것이 아닙니다.
  */
  const lastIso = data?.days[data.days.length - 1]?.iso ?? null;
  const back = lastIso != null && lastIso < todayIso();
  const [publishing, setPublishing] = useState(false);

  if (loading && !data) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen>
        <ErrorNote message={error ?? '여행을 찾을 수 없어요.'} />
      </Screen>
    );
  }

  return (
    <Screen tabs={<TripTabs tripId={id} active="card" title={data.trip.title} />}>
      <Stack.Screen
        options={{
          title: data.trip.title,
          headerTitle: () => <PathTitle parent={data.trip.title} title="여행 요약" />,
        }}
      />

      <SegmentedTabs items={FACES} value={face} onChange={setFace} />

      {face === 'receipt' ? (
        <Receipt trip={data} back={back} mates={mates?.people ?? []} books={spent?.books ?? []} />
      ) : (
        <Replay trip={data} />
      )}

      {/*
        여행기로 남기기.

        <p>여행이 끝난 자리에 둡니다. 이 화면을 여는 때가 대개 돌아온 뒤이고,
        그때가 "정리해 둘까" 가 드는 유일한 순간입니다. 여행 상세의 「글 올리기」
        는 여행을 짜는 동안 보는 자리라 그 생각이 안 듭니다.

        <p>장소가 하나도 없으면 안 냅니다 — 빈 일정을 여행기로 남기라고
        하는 것은 아직 이릅니다.
      */}
      <Band />

      {/*
        내놓는 길 둘을 한 자리에 모았습니다.

        <p>「여행기 쓰기」 는 흰 판 안에 있고 「링크 보내기」 는 그 밖에
        혼자 서 있었습니다. 둘 다 <b>이 여행을 남에게 보이는</b> 일인데
        한쪽만 설명이 붙어 있어서, 아래 단추는 무엇을 보내는 것인지 적혀
        있지 않았습니다. 한 구역에 담고 나란히 둡니다 — 왼쪽이 가벼운 쪽,
        오른쪽이 주된 쪽입니다.

        <h3>회색 상자를 풀었습니다</h3>

        <p>이 구역을 회색 면 상자로 감싸고 제목도 그 안에서 손으로 적고
        있었습니다. 그런데 상자는 <b>구역을 만드는 물건이 아닙니다</b> —
        구역은 위의 띠가 가르고 이름은 구역 머리가 답니다. 상자를 쓰니
        같은 구역 머리가 화면마다 다른 크기로 섰고, 상자 안쪽 여백만큼
        단추가 좌우 글자선에서 안으로 밀려 들어갔습니다.
      */}
      <SectionHeader
        title={back ? '이 여행을 남길까요?' : '이 요약을 보낼까요?'}
        note={
          back
            ? '여행기로 올리면 일정이 그대로 따라가요. 나만 볼 수도 있어요.'
            : '같이 가는 사람에게 이 요약을 보낼 수 있어요. 다녀오면 여기서 여행기로 올릴 수 있어요.'
        }
      />
      <Row gap={Spacing.s2}>
        <Grow>
          <Button
            label="링크 보내기"
            variant="secondary"
            compact
            onPress={() => shareLink(sharableUrl(id), data.trip.title)}
          />
        </Grow>
        {/* 장소가 하나도 없으면 안 냅니다 — 빈 일정을 여행기로 남기라고
            하는 것은 아직 이릅니다. */}
        {back && data.days.some((d) => d.places.length > 0) ? (
          <Grow>
            <Button label="여행기 올리기" compact onPress={() => setPublishing(true)} />
          </Grow>
        ) : null}
      </Row>
      <PublishForm
        visible={publishing}
        tripId={id}
        tripTitle={data.trip.title}
        onCancel={() => setPublishing(false)}
        onDone={(postId) => {
          setPublishing(false);
          router.push(`/community/${postId}`);
        }}
      />
    </Screen>
  );
}

/**
 * 웹 주소를 만듭니다.
 *
 * <p>앱에서는 API_BASE 가 곧 웹 주소입니다. 앱에도 window 는 있지만
 * window.location 은 없어서, 그것부터 읽으면 "링크 보내기" 를 누르는 순간
 * 화면이 죽습니다. API_BASE 를 먼저 봅니다.
 */
function sharableUrl(id: string) {
  const site =
    API_BASE ||
    (typeof window === 'undefined' || !window.location ? '' : window.location.origin);
  return `${site}/card/${id}`;
}

/**
 * 영수증.
 *
 * <p>고정폭 글자와 점선뿐입니다. 사진이 없어도 성립하고, 지어낸 점수 대신
 * 실제로 눌러 표시한 "다녀옴" 을 씁니다.
 */
function Receipt({
  trip,
  back,
  mates,
  books,
}: {
  trip: TripDetail;
  /** 다녀왔는지. 아직이면 「같이 가는 사람」입니다. */
  back: boolean;
  mates: Person[];
  /** 통화마다 하나. 적어 둔 것이 없으면 빈 배열입니다. */
  books: Books[];
}) {
  /*
    들른 곳만 셉니다.

    <p>도쿄 3박 4일 「63곳」 가운데 서른 남짓이 역이었습니다 — 갈아타는 역을
    장소로 넣어 두고 메모에 노선을 적는 사람이 많습니다. 숙소도 하루에 서너 번
    들어갑니다. 영수증의 「몇 곳」은 다녀온 데를 말하는 자리라 둘을 뺍니다.
  */
  const stops = (list: { icon?: string | null }[]) =>
    list.filter((p) => p.icon !== 'move' && p.icon !== 'stay');
  const places = stops(trip.days.flatMap((d) => d.places));

  return (
    <View style={styles.paper}>
      <View style={styles.center}>
        {/* 영수증 머리. 「FIT」 을 제목 글꼴로 적어 두었는데, 로고가 아니라
            그냥 굵은 낱말로 읽혔습니다. */}
        <LogoInline size={28} />
        <Caption tone="secondary">FALL INTO TRIP</Caption>
      </View>

      <View style={styles.center}>
        <Body strong>{trip.trip.title}</Body>
        <Caption tone="secondary">
          {trip.days[0]?.date ?? ''} ~ {trip.days[trip.days.length - 1]?.date ?? ''}
        </Caption>
      </View>

      {/* 점선입니다. 종이 영수증에서 떼어 내는 자리의 모양이라, 실선보다
          「여기까지가 머리」 라는 말을 더 잘합니다. */}
      <View style={styles.tear} />

      {trip.days.map((day) => (
        <Split key={day.id}>
          <Body small>{day.date || day.label}</Body>
          <Body small>{stops(day.places).length}곳</Body>
        </Split>
      ))}

      <View style={styles.tear} />

      <Split>
        <Caption>{back ? '들른 곳' : '들를 곳'}</Caption>
        <Caption>{places.length}곳</Caption>
      </Split>
      {/*
        쓴 돈.

        통화를 더하지 않습니다. 엔과 원을 합치려면 "언제 환율로" 가 남고 —
        여행 중 환율인지, 카드 청구 환율인지, 오늘 환율인지 — 그 답은
        사람마다 다릅니다. 서버가 이미 통화별로 갈라 두었으므로 화면도
        갈라 둡니다.

        1인당 얼마도 안 적습니다. 정산은 균등 분할이 아니라서, 총액을 사람
        수로 나눈 값은 아무와도 맞지 않습니다. 그 답은 가계부가 정확히
        보여 줍니다.

        적어 둔 것이 없으면 줄이 아예 안 나옵니다 — 아래 "함께한 사람" 이
        혼자일 때 빠지는 것과 같습니다.
      */}
      {books.map((book, i) => (
        <Split key={book.currency}>
          <Caption>{i === 0 ? '쓴 돈' : ''}</Caption>
          <Caption>{money(book.total, book.currency, book.decimals)}</Caption>
        </Split>
      ))}
      {mates.length > 1 ? (
        <Split>
          <Caption>{back ? '함께한 사람' : '같이 가는 사람'}</Caption>
          <Caption>{mates.length}명</Caption>
        </Split>
      ) : null}

      <View style={styles.tear} />

      <View style={styles.center}>
        <Caption tone="muted">FIT.WEENIE-BEENIE.NET</Caption>
      </View>
    </View>
  );
}

/**
 * 다시 보기.
 *
 * <p>일정에 넣어 둔 순서대로 한 곳씩 훑습니다. 지도가 따라 움직이고 핀이
 * 하나씩 커졌다가, 마지막에 뒤로 물러나 다녀온 곳 전부를 한 화면에 담습니다.
 *
 * <p>전에는 실제 이동 경로를 받아 와 선을 늘려 가며 그렸습니다. 그런데 경로는
 * 일정 화면에서 수단을 한 번 골라 둬야 생기는 것이라, 대개는 "그릴 동선이
 * 없습니다" 만 나왔습니다. 돌아보려고 연 화면에서 "가서 수단부터 고르고
 * 오세요" 라고 하는 셈이었습니다.
 *
 * <p>이제 아무것도 받아 오지 않습니다. 넣어 둔 곳과 그 순서만으로 됩니다.
 * 구글에 묻지 않으니 요금도 들지 않습니다.
 */
/** 한 자리에 머무는 동안. 내려앉고, 잠깐 서고, 다시 뜹니다. */
const STAY_MS = 620;
/** 한 구간을 나는 동안. */
const FLY_MS = 1250;
/** 몇 번에 나눠 그릴지. 50 이면 1초에 스무 번입니다. */
const TICK_MS = 50;

/**
 * 두 자리 사이 어느 쪽을 보고 나는지.
 *
 * <p>정확한 대권 항로를 셀 것까지는 없습니다. 도시 몇 개 사이라 평면으로
 * 봐도 눈에는 같고, 무엇보다 <b>코끝이 가는 쪽을 향하는가</b>만 보입니다.
 * 다만 경도는 위도가 높을수록 촘촘해지므로 그만큼 줄여 줍니다 — 안 그러면
 * 북쪽 도시에서 코가 옆으로 틀어집니다.
 */
function headingOf(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const mid = ((from.lat + to.lat) / 2) * (Math.PI / 180);
  const dx = (to.lng - from.lng) * Math.cos(mid);
  const dy = to.lat - from.lat;
  if (dx === 0 && dy === 0) {
    return 0;
  }
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

/**
 * 뜨고, 날고, 내린다.
 *
 * <p>같은 속도로 가면 <b>끌려가는 점</b>입니다. 뜰 때 밀어내고 내릴 때
 * 늦추면 그제야 오가는 것으로 보입니다. 가운데가 가장 빠른 곡선입니다.
 */
function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 다녀온 길을 처음부터 다시.
 *
 * <h3>점이 튀는 것이 아니라 오가는 것으로</h3>
 *
 * <p>1.1초마다 다음 곳으로 <b>건너뛰었습니다.</b> 지도가 따라 옮겨 가기는
 * 했지만 그 사이가 비어 있어서, 무엇이 어디로 가는지가 아니라 화면이
 * 갈아 끼워지는 것으로 보였습니다.
 *
 * <p>사이를 채웁니다. 자리에 내려앉아 잠깐 섰다가, 다음 곳을 향해 돌아서서,
 * 뜨고, 날고, 내립니다. 셈은 여기서 하고 지도는 받은 자리에 그리기만
 * 합니다 — 지도가 웹과 앱 두 벌이라, 셈까지 두 벌이면 언젠가 둘이 다르게
 * 납니다.
 *
 * <h3>날짜별로 볼 수 있습니다</h3>
 *
 * <p>여행 전체를 한 번에 돌리면 닷새치 스무 곳이 이어져, 어느 날 무엇을
 * 했는지가 아니라 <b>지도가 한참 움직였다</b>만 남습니다. 날짜를 고르면
 * 그 하루만 돕니다.
 */
function Replay({ trip }: { trip: TripDetail }) {
  /** 어느 날만 볼지. null 이면 처음부터 끝까지. */
  const [dayPick, setDayPick] = useState<number | null>(null);
  /** 지금 몇 번째 자리에서 출발했는지. 곳의 수와 같아지면 다 본 것입니다. */
  const [step, setStep] = useState(0);
  /** 그 자리에서 다음 자리까지 얼마나 왔는지. 0 은 아직 서 있는 것. */
  const [gone, setGone] = useState(0);
  const [playing, setPlaying] = useState(true);
  /** 뒤로 물러나 전부 보여 달라는 신호. 값이 바뀌면 지도가 맞춥니다. */
  const [fitAt, setFitAt] = useState(0);
  /*
    지도가 떴는지.

    <p>지도를 받는 동안 비행기가 먼저 출발해서, 지도가 뜰 즈음에는 이미 두세
    곳을 지나 있었습니다 — 첫 곳을 못 봤습니다. 뜰 때까지 가리고 기다렸다가,
    뜨면 경로 전체가 들어오게 맞춘 뒤 출발합니다.
  */
  const [mapReady, setMapReady] = useState(false);

  const all = useMemo(
    () =>
      trip.days.flatMap((day, dayIndex) =>
        day.places
          .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
          .map((p, i) => ({
            id: p.id,
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            order: i + 1,
            emoji: iconOf(p.icon),
            dayIndex,
            color: day.color || dayColor(dayIndex),
            /* 다음 곳까지 적어 둔 이동 — 동선에서 무엇을 타고 갈지 고릅니다. */
            mode: p.move?.mode ?? null,
            fit: p.fit,
            radius: p.radius,
            detail: {
              time: p.time,
              cat: p.cat,
              cost: p.cost,
              note: p.note,
              sub: p.ja ?? p.en,
              dayLabel: day.date || day.label,
            },
          })),
      ),
    [trip],
  );

  const places = useMemo(
    () => (dayPick === null ? all : all.filter((p) => p.dayIndex === dayPick)),
    [all, dayPick],
  );

  /** 찍을 곳이 있는 날만 냅니다. 빈 날을 고르면 아무 일도 안 일어납니다. */
  const days = useMemo(() => {
    const seen = new Map<number, string>();
    all.forEach((p) => {
      if (!seen.has(p.dayIndex)) {
        seen.set(p.dayIndex, p.detail.dayLabel);
      }
    });
    return [...seen.entries()];
  }, [all]);

  /* 날짜를 바꾸면 처음부터. 열두 번째에서 멈춘 채로 세 곳짜리 하루로
     옮겨 가면 시작하자마자 끝나 있습니다. */
  useEffect(() => {
    setStep(0);
    setGone(0);
    setPlaying(true);
  }, [dayPick]);

  useEffect(() => {
    if (!mapReady) {
      return;
    }
    if (!playing || places.length === 0) {
      return;
    }
    /*
      한 자리에 머무는 동안(STAY_MS)과 나는 동안(FLY_MS)을 이어 붙여 한
      묶음으로 셉니다. 머무는 동안에는 자리가 안 바뀌고 크기만 낮아졌다
      오르므로, 내려앉아 섰다가 다시 뜨는 것으로 보입니다.
    */
    const span = STAY_MS + FLY_MS;
    let spent = 0;
    const timer = setInterval(() => {
      spent += TICK_MS;
      if (spent < STAY_MS) {
        setGone(0);
        return;
      }
      if (spent < span) {
        setGone((spent - STAY_MS) / FLY_MS);
        return;
      }
      spent = 0;
      setGone(0);
      setStep((at) => {
        if (at >= places.length - 1) {
          /* 마지막 곳까지 갔으면 멈추고 뒤로 물러납니다. 한 곳에 붙어 끝나면
             무엇을 다녀왔는지가 아니라 마지막 한 곳만 남습니다. */
          setPlaying(false);
          setFitAt((n) => n + 1);
          return places.length;
        }
        return at + 1;
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing, places.length, mapReady]);

  const done = step >= places.length;
  const now = done ? null : places[step];
  const next = done ? null : (places[step + 1] ?? null);

  /*
    지금 어디쯤 떠 있는지.

    <p>마지막 자리에는 갈 곳이 없으므로 그 위에 내려앉은 채로 둡니다.
    다 본 뒤에는 아예 안 그립니다 — 전부를 한눈에 보는 자리에 비행기 하나가
    남아 있으면 아직 도는 중인 줄 압니다.
  */
  const traveler = useMemo(() => {
    if (done || !now) {
      return null;
    }
    if (!next) {
      return { lat: now.lat, lng: now.lng, heading: 0, lift: 0, color: now.color };
    }
    const held = Math.min(1, Math.max(0, gone));
    const t = ease(held);
    return {
      lat: now.lat + (next.lat - now.lat) * t,
      lng: now.lng + (next.lng - now.lng) * t,
      heading: headingOf(now, next),
      /* 가운데에서 가장 높이. 뜨고 내리는 양 끝에서 0 으로 내려앉습니다. */
      lift: Math.sin(held * Math.PI),
      color: now.color,
    };
  }, [done, now, next, gone]);

  return (
    <View style={styles.replay}>
      {/* 날짜가 둘 이상일 때만. 하루짜리 여행에 "전체/1일차" 를 두면 고를
          것이 없는 띠가 한 줄 자리만 먹습니다. */}
      {days.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Row gap={Spacing.s2} style={styles.dayRail}>
            <Chip label="전체" selected={dayPick === null} onPress={() => setDayPick(null)} />
            {days.map(([index, label]) => (
              <Chip
                key={index}
                label={label}
                selected={dayPick === index}
                onPress={() => setDayPick(dayPick === index ? null : index)}
              />
            ))}
          </Row>
        </ScrollView>
      ) : null}

      <View>
        {/* 바퀴와 글자를 손으로 그리고 있었습니다. 기다리는 모양은 앱에 하나
            뿐이어야 하는데, 여기만 기기가 그려 주는 바퀴였습니다 —
            {@link Loading} 이 점 셋으로 바뀐 뒤로는 같은 자리에서 다른 것이
            보였을 자리입니다. 문구도 같은 결로 맞춥니다. */}
        {!mapReady ? (
          <View style={styles.replayVeil}>
            <Loading label="지도를 가져오고 있어요" />
          </View>
        ) : null}
        {/* 지도 ID 가 있으면 기울인 지도에서 돕니다({@link ReplayStage}). 없으면
            지금까지의 평평한 지도입니다 — 같은 박자(step · gone)를 씁니다. */}
        {hasTiltMaps() ? (
          <ReplayStage
            places={places}
            step={Math.min(step, Math.max(0, places.length - 1))}
            gone={gone}
            done={done}
            onReady={() => setMapReady(true)}
            height={360}
          />
        ) : (
          <TripMap
            onReady={() => {
              setMapReady(true);
              /* 출발 전에 경로 전체가 들어오게 한 번 맞춥니다. */
              setFitAt((n) => n + 1);
            }}
            places={places}
            /* 지금 떠난 자리로 지도가 따라갑니다. follow 가 앞뒤 곳까지 한 화면에
               넣으므로, 나는 동안 떠난 곳과 닿을 곳이 함께 보입니다. */
            activeId={now?.id ?? null}
            onSelect={() => {}}
            traveler={traveler}
            /* 따라가되 당기지 않습니다. 바짝 당기면 먼 다음 곳이 늘 화면 밖이고,
               옮겨 가는 도중에 다음 옮김이 시작돼 앞엣것이 잘립니다 — 그것이
               "멀리 있으면 끊긴다" 의 정체였습니다. */
            follow
            fitAt={fitAt}
            height={360}
          />
        )}
      </View>

      <Row gap={Spacing.s2}>
        <Button
          label={playing ? '멈추기' : done ? '처음부터' : '이어서'}
          variant="secondary"
          compact
          onPress={() => {
            if (done) {
              setStep(0);
              setGone(0);
            }
            setPlaying((v) => !v);
          }}
        />
        <Caption tone="secondary">
          {done ? `${places.length}곳 다 봤어요` : `${step + 1} / ${places.length}`}
        </Caption>
      </Row>

      {now ? (
        <Row gap={Spacing.s2}>
          <Body strong>
            {now.emoji ? `${now.emoji} ` : ''}
            {now.name}
          </Body>
          {/* 전체를 돌 때는 날짜가 넘어가는 것이 이야기의 일부입니다. 하루만
              보고 있으면 띠에 이미 적혀 있어 두 번 말하는 셈입니다. */}
          {dayPick === null ? (
            <Caption tone="secondary">{now.detail.dayLabel}</Caption>
          ) : null}
        </Row>
      ) : null}

      {places.length === 0 ? (
        <Caption tone="secondary">지도에 찍을 곳이 아직 없어요.</Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /* 지도가 뜨기 전 덮개. 지도와 같은 자리를 차지해 뜰 때 자리가 안 튑니다.
     안의 간격은 {@link Loading} 이 제 안에 가지고 있어 여기서 안 둡니다. */
  replayVeil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.fill,
    borderRadius: Radius.r3,
  },
  /*
    영수증 한 장.

    <p>테두리를 걷고 옅은 그림자를 둘렀습니다. 바닥이 흰색이 된 뒤로 흰
    종이와 바닥을 가르는 것이 선밖에 없었는데, 선은 <b>칸</b>으로 보이고
    그림자는 <b>얹힌 종이</b>로 보입니다. 이 화면에서 영수증은 얹힌
    종이여야 합니다.
  */
  paper: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.r4,
    padding: Spacing.s5,
    gap: Spacing.s2,
    ...Elevation.card,
  },
  /* 떼어 내는 자리. 영수증의 점선입니다. */
  tear: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    borderStyle: 'dashed',
    marginVertical: Spacing.s1,
  },
  center: {
    alignItems: 'center',
    gap: 2,
  },
  replay: {
    gap: Spacing.s3,
  },
  /* 끝을 띄워 둬야 마지막 날짜가 잘린 것처럼 안 보입니다. */
  dayRail: {
    flexWrap: 'nowrap',
    paddingRight: Spacing.s4,
  },
});
