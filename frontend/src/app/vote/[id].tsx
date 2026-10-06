import { Stack, useLocalSearchParams } from 'expo-router';
import { PathTitle } from '@/ui/nav';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Candidate, SavedPlace, TripDetail } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { DayPicker } from '@/components/day-picker';
import { PlaceDetailSheet, type Looked } from '@/components/place-detail-sheet';
import { PlaceSearch } from '@/components/place-search';
import { glyphOf, labelOf } from '@/constants/place-icons';
import { Colors, Elevation, Radius, Spacing, Type, Weight } from '@/constants/theme';
import {
  Badge,
  BottomSheet,
  Button,
  Caption,
  Chip,
  ConfirmDialog,
  Divider,
  Empty,
  ErrorNote,
  Icon,
  IconButton,
  ListRow,
  Loading,
  Mark,
  Press,
  Row,
  Screen,
  SearchField,
  Split,
} from '@/ui';
import { TripTabs } from '@/ui/tab-bar';
import { WANT } from '@/constants/words';
import { DeadlineLine, DeadlineSheet } from '@/components/vote-deadline';
import { todayIso } from '@/lib/countdown';

/** 무엇만 볼지. 후보가 스무 개쯤 되면 한 번에 다 훑기 어렵습니다. */
type View3 = 'all' | 'agreed' | 'open';

/**
 * 가고 싶은 곳 고르기.
 *
 * <p>일정에 바로 넣으면 아직 정하지도 않은 것이 확정처럼 보이고, 나중에 빼자고
 * 말하기도 어려워집니다. 여기 올려 두고 각자 좋다·아니다를 누른 뒤, 다 좋다고
 * 한 것만 일정으로 옮깁니다.
 *
 * <p>정해지는 기준은 <b>동행자 전원</b>입니다. 표를 안 던진 사람이 있으면 아직
 * 정해지지 않은 것으로 봅니다 — 안 본 사람을 반대로 세면 한 명이 늦었다는
 * 이유로 확정됩니다.
 *
 * <h3>표는 숫자가 아니라 막대입니다</h3>
 *
 * <p>"좋아요 3/4" 라고 적어 두었습니다. 읽으면 알 수 있지만, 후보 여덟이
 * 나란히 섰을 때 <b>어느 것이 거의 다 모았는지</b>는 여덟 줄을 다 읽어야
 * 알았습니다. 막대 하나면 훑는 눈이 길이로 집습니다.
 */
export default function Vote() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, error, loading, reload } = useAsync<{ candidates: Candidate[] }>(
    (signal) => api.get(`/api/trips/${encodeURIComponent(id)}/candidates`, signal),
    [id],
  );
  const tripQ = useAsync<TripDetail>(
    (signal) => api.get(`/api/trip?trip=${encodeURIComponent(id)}`, signal),
    [id],
  );
  const trip = tripQ.data;
  /* 마감. 그날까지(그날 포함) 표를 받고, 지나면 표와 새 후보를 서버가 막습니다. */
  const until = trip?.trip.voteUntil ?? null;
  const closed = until != null && until < todayIso();
  const [deadlining, setDeadlining] = useState(false);

  const [adding, setAdding] = useState(false);
  /* 눌러서 보고 있는 곳. 판이 이걸로 열립니다. */
  const [looking, setLooking] = useState<Looked | null>(null);
  /* 방금 보석함에 담은 것. 같은 곳을 두 번 담게 두지 않습니다. */
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [pouring, setPouring] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  /* 내리는 것은 되돌릴 수 없고, 남이 올린 것도 내릴 수 있습니다. 다른
     화면과 마찬가지로 한 번 묻습니다 — 여기만 곧장 지워지고 있었습니다. */
  const [dropping, setDropping] = useState<Candidate | null>(null);
  const [view, setView] = useState<View3>('all');

  const all = data?.candidates ?? [];
  const agreed = useMemo(() => all.filter((c) => c.agreed), [all]);
  /* 보기를 걸러도 아래 단추는 <b>정해진 전부</b>를 넣습니다. 거르는 것은
     보는 방식이고, 넣는 것은 실제로 일어나는 일입니다. */
  /*
    줄 세우는 순서 (verdict 3번).

    <h3>정하는 규칙은 안 바꿉니다</h3>

    <p>조사한 앱들은 <b>득표순에 마감</b>을 붙입니다 — 마감까지 답이 없으면
    많이 받은 것으로 정해집니다. 이 앱은 그렇게 안 합니다. 「합의는 전원
    동의」이고, 표 안 던진 사람은 <b>미정</b>입니다({@code CandidateService}).
    마감으로 밀어붙이면 안 간다고 한 사람을 끌고 가는 셈입니다.

    <p>받은 것은 <b>순서만</b>입니다. 결정 규칙도 기본값도 안 받습니다.
    순서는 아무 말도 강요하지 않으면서 「지금 어디까지 왔나」를 보여 줍니다.

    <p>마감은 나중에 들였습니다(2026-10-06 운영 점검 — 출발 이틀 전에도 「2명 중
    0명 찬성」으로 열려 있었습니다). 다만 <b>정하는 규칙은 그대로</b>입니다.
    마감이 지나면 표와 새 후보를 안 받을 뿐, 득표가 많은 곳을 정해진 것으로
    올리지 않습니다 — 모두 좋다고 한 곳만 정해진 것이고, 마감은 「이제 정해진
    것을 옮기자」는 신호입니다.

    <p>차례는 셋입니다.
    <ol>
      <li>합의된 것 — 이미 모두 좋다고 한 것</li>
      <li>반대가 없는 것 — 아직 덜 모였지만 막는 사람은 없는 것</li>
      <li>나머지 — 반대가 있는 것. 좋아요가 많은 쪽을 위로</li>
    </ol>

    <p>「누가 아직 안 답했나」는 여전히 안 보여 줍니다. 그것은 눈치입니다.
  */
  const shown = useMemo(() => {
    const picked = all.filter((c) =>
      view === 'all' ? true : view === 'agreed' ? c.agreed : !c.agreed,
    );
    const rank = (c: Candidate) => (c.agreed ? 0 : c.no === 0 ? 1 : 2);
    return [...picked].sort((a, b) => {
      const byRank = rank(a) - rank(b);
      if (byRank !== 0) {
        return byRank;
      }
      /* 같은 자리에서는 좋아요가 많은 쪽이 위입니다. 그것도 같으면 들어온
         차례 그대로 둡니다 — 흔들면 볼 때마다 순서가 바뀝니다. */
      return b.yes - a.yes;
    });
  }, [all, view]);

  async function vote(candidate: Candidate, yes: boolean | null) {
    setFailed(null);
    try {
      await api.put(`/api/candidates/${candidate.id}/vote`, { yes });
      reload();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  async function drop(candidate: Candidate) {
    setFailed(null);
    try {
      await api.delete(`/api/candidates/${candidate.id}`);
      reload();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  /*
    보석함에 담습니다.

    <p>담은 것은 이름으로 기억해 둡니다. 서버에 다시 물으면 판을 열 때마다
    한 번씩 더 불러야 하고, 여기서 알아야 하는 것은 <b>방금 내가 담았는지</b>
    뿐입니다 — 화면을 나갔다 오면 다시 담을 수 있는 것이 맞습니다.
  */
  async function keep(place: Looked) {
    setFailed(null);
    try {
      await api.post('/api/saved', {
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        placeId: place.placeId,
        icon: place.icon,
      });
      setKept((was) => new Set(was).add(place.name));
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  return (
    <Screen
      /* 넓은 화면에서는 이 띠가 왼쪽 기둥입니다. 기둥 위쪽에 여행 이름이
         서므로 넘겨 줍니다 — 아래 띠에서는 안 씁니다. */
      tabs={<TripTabs tripId={id} active="vote" title={trip?.trip.title} />}
      /*
        아래 줄에 두 가지 일이 섭니다.

        <p>정해진 곳이 생기면 이 화면에 할 일이 둘입니다 — 더 올리는 것과
        정해진 것을 옮기는 것. 전에는 올리는 단추를 <b>목록 끝</b>에 따로
        두었는데, 거기까지 굴려 내려가야 보이는 자리였습니다.

        <p>둘을 나란히 두고 1:2 로 나눕니다. 넓은 쪽이 지금 할 일입니다.
      */
      footer={
        agreed.length > 0 ? (
          <Row gap={Spacing.s2} style={styles.footerRow}>
            <View style={styles.footerSide}>
              <Button
                label="후보 올리기"
                variant="secondary"
                disabled={closed}
                onPress={() => setAdding(true)}
              />
            </View>
            <View style={styles.footerMain}>
              <Button
                label={`정해진 ${agreed.length}곳 일정에 넣기`}
                onPress={() => setPouring(true)}
              />
            </View>
          </Row>
        ) : closed ? (
          /* 마감 뒤에 정해진 곳이 없으면 할 일은 마감을 늦추는 것뿐입니다. */
          <Button label="마감 늦추기" variant="secondary" onPress={() => setDeadlining(true)} />
        ) : (
          <Button label="가고 싶은 곳 올리기" onPress={() => setAdding(true)} />
        )
      }>
      <Stack.Screen
        options={{
          title: trip?.trip.title ?? WANT,
          headerTitle: () => (
            <PathTitle parent={trip?.trip.title ?? '여행'} title="가고 싶은 곳" />
          ),
        }}
      />

      {/*
        무엇을 하는 화면인지.

        <p>제목이 막대에도 있고 본문 맨 위에도 24픽셀로 또 있었습니다. 같은
        말을 두 번 하면서 화면 위 한 자락을 먹었습니다. 본문의 것은 <b>묻는
        말</b>로 바꿉니다 — 여기서 하는 일이 답을 고르는 것이라서입니다.
      */}
      <Split align="start" style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.ask}>어디 가고 싶어요?</Text>
          <Caption tone="secondary">
            다 좋다고 한 곳만 일정으로 옮겨요. 아직 안 누른 사람이 있으면 정해지지 않아요.
          </Caption>
          <DeadlineLine until={until} closed={closed} onEdit={() => setDeadlining(true)} />
        </View>
        {all.length > 0 ? (
          <Caption tone="muted">
            후보 {all.length}곳 · 정해짐 {agreed.length}곳
          </Caption>
        ) : null}
      </Split>

      {/* 거르는 칩. 셋뿐이라 판에 접지 않고 한 줄로 둡니다. */}
      {all.length > 0 ? (
        <Row gap={Spacing.s2} style={styles.views}>
          <Chip label="전체" selected={view === 'all'} onPress={() => setView('all')} />
          <Chip label="정해짐" selected={view === 'agreed'} onPress={() => setView('agreed')} />
          <Chip label="아직" selected={view === 'open'} onPress={() => setView('open')} />
        </Row>
      ) : null}

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {failed ? <ErrorNote message={failed} /> : null}

      {data && all.length === 0 ? (
        <Empty message="아직 올라온 곳이 없어요. 가고 싶은 데를 먼저 던져 보세요." />
      ) : null}

      {data && all.length > 0 && shown.length === 0 ? (
        <Empty
          message={view === 'agreed' ? '아직 정해진 곳이 없어요.' : '정해지지 않은 곳이 없어요.'}
        />
      ) : null}

      {shown.map((candidate) => (
        <View key={candidate.id} style={styles.card}>
          {/*
            눌러서 어떤 데인지 봅니다.

            <p>이름과 갈래만 있었습니다. 그런데 여기서 하는 일은 <b>좋다·아니다를
            고르는 것</b>이라, 어떤 데인지 모르면 고를 수가 없습니다 — 남이 올린
            곳이면 더욱 그렇습니다. 사진도 평점도 영업시간도 없이 이름만 보고
            좋다고 누를 사람은 없습니다.

            <p>고르는 단추는 밖에 둡니다. 판을 열어야 표를 던질 수 있으면 이미
            아는 곳까지 한 번씩 더 들어가야 합니다.
          */}
          <Split align="center" gap={Spacing.s3}>
            <Press
              onPress={() =>
                setLooking({
                  name: candidate.name,
                  lat: candidate.lat,
                  lng: candidate.lng,
                  placeId: candidate.placeId,
                  icon: candidate.icon,
                })
              }
              scale={0.99}
              accessibilityLabel={`${candidate.name} 자세히 보기`}
              style={styles.cardHead}>
              <Mark icon={glyphOf(candidate.icon)} />
              <View style={styles.grow}>
                <Text style={styles.name} numberOfLines={1}>
                  {candidate.name}
                </Text>
                <Caption tone="muted" numberOfLines={1}>
                  {[labelOf(candidate.icon), candidate.note ?? candidate.cat]
                    .filter(Boolean)
                    .join(' · ')}
                </Caption>
              </View>
            </Press>

            {candidate.agreed ? <Badge label="정해짐" tone="success" /> : null}
            {/*
              내리는 것은 점 세 개 안으로.

              <p>줄 끝에 빨간 휴지통이 서 있었습니다. 후보 여덟이면 빨간
              그림이 여덟이고, 그러면 이 화면에서 가장 눈에 걸리는 것이
              <b>지우기</b>가 됩니다 — 여기서 할 일은 고르는 것입니다.

              <p>누르면 곧장 묻습니다. 점 세 개 뒤에 줄 하나뿐인 판을
              세우면 한 번 더 눌러야 같은 자리에 닿습니다.
            */}
            <IconButton
              name="more-horizontal"
              label={`${candidate.name} 내리기`}
              bare
              onPress={() => setDropping(candidate)}
            />
          </Split>

          {/*
            찬반 막대.

            <p>동행자 수를 바닥으로 깔고, 좋다고 한 몫만 칠합니다. 아직 아무도
            안 누른 것은 회색 선 한 가닥으로 남아 "표를 받는 자리" 라는 것만
            말합니다.
          */}
          {/*
            찬반 막대와 고르는 단추 둘을 한 줄에.

            <p>단추 둘이 카드 폭을 반씩 나눠 가진 줄을 따로 먹었습니다. 후보
            여덟이면 그 줄만 여덟이라 화면에 카드 세 장도 안 들어왔습니다.
            단추를 줄 오른쪽의 작은 둘로 줄이고 막대 옆에 붙입니다 — 막대가
            「지금 몇 명이」, 단추가 「나는」이라 한 줄에 읽힙니다.

            <p>내가 고른 쪽만 면을 깝니다. 안 고른 쪽은 테두리만 둡니다.
            색을 가득 쓰는 자리는 아래 고정 줄의 「일정에 넣기」 하나입니다.
          */}
          <Row gap={Spacing.s3} style={styles.voteRow}>
            <View style={styles.voteInfo}>
              <View style={[styles.barTrack, styles.barInline]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${share(candidate.yes, candidate.memberCount)}%` },
                  ]}
                />
              </View>
              <Caption tone="muted">
                {`${candidate.memberCount}명 중 ${candidate.yes}명 찬성`}
                {candidate.no > 0 ? ` · ${candidate.no}명 반대` : ''}
              </Caption>
            </View>
            <Choice
              icon="thumbs-up"
              label="좋아요"
              tone="yes"
              chosen={candidate.myVote === true}
              disabled={closed}
              onPress={() => vote(candidate, candidate.myVote === true ? null : true)}
            />
            <Choice
              icon="thumbs-down"
              label="별로예요"
              tone="no"
              chosen={candidate.myVote === false}
              disabled={closed}
              onPress={() => vote(candidate, candidate.myVote === false ? null : false)}
            />
          </Row>
        </View>
      ))}

      {/*
        판에서 보석함에 담습니다.

        <p>여기 올라온 곳은 누군가 가 보고 싶어 한 데입니다. 표에서 떨어져도
        <b>내 마음에는 든</b> 곳일 수 있는데, 지금은 내려가면 그대로 사라집니다 —
        다시 찾으려면 이름을 기억해 뒀다가 검색해야 합니다.

        <p>찾기 화면과 같은 자리, 같은 모양입니다.

        <h3>글자 한 줄에서 그림으로</h3>

        <p>「보석함에 줍기」라는 글자 한 줄이 판 맨 아래에 섰습니다. 담는 일은
        누르면 그걸로 끝나는 것이라 판이 구글 지도 옆에 그림 자리를 가지고
        있고, 목록에서도 같은 책갈피로 하는 일입니다 — 같은 일을 자리마다
        다른 모양으로 두면 같은 일로 안 읽힙니다.

        <p>담은 뒤에 판을 안 닫습니다. 전에는 닫고 나서 담았는데, 그러면 담긴
        것을 <b>볼 수가 없었습니다</b> — 이제 책갈피가 채워지는 것으로 받았다는
        말을 합니다.
      */}
      <PlaceDetailSheet
        place={looking}
        onClose={() => setLooking(null)}
        scrap={looking ? { kept: kept.has(looking.name), onPress: () => keep(looking) } : null}
      />

      <DeadlineSheet
        visible={deadlining}
        tripId={id}
        until={until}
        startIso={trip?.days[0]?.iso ?? null}
        onClose={() => setDeadlining(false)}
        onDone={() => {
          setDeadlining(false);
          tripQ.reload();
        }}
      />

      <AddSheet
        visible={adding}
        tripId={id}
        onCancel={() => setAdding(false)}
        onAdded={() => {
          setAdding(false);
          reload();
        }}
      />

      <ConfirmDialog
        visible={dropping !== null}
        title="목록에서 내릴까요?"
        message={
          dropping
            ? `${dropping.name} 과(와) 지금까지 받은 표가 사라져요. 되돌릴 수 없어요.`
            : undefined
        }
        confirmLabel="내리기"
        danger
        onCancel={() => setDropping(null)}
        onConfirm={() => {
          const target = dropping;
          setDropping(null);
          if (target) {
            drop(target);
          }
        }}
      />

      <DayPicker
        visible={pouring}
        note={`정해진 ${agreed.length}곳이 그 날 맨 뒤에 붙고, 여기 목록에서는 사라져요.`}
        days={trip?.days ?? []}
        onPour={(dayId) =>
          api.post(`/api/days/${dayId}/places/from-candidates`, {
            candidateIds: agreed.map((c) => c.id),
          })
        }
        onCancel={() => setPouring(false)}
        onDone={() => {
          setPouring(false);
          reload();
        }}
      />
    </Screen>
  );
}

/**
 * 좋다·아니다 한 짝.
 *
 * <p>공용 단추를 안 씁니다. 공용 단추에는 「테두리만」 이 아직 없고, 여기에
 * 필요한 것이 정확히 그것입니다 — 고른 쪽은 면을 깔고 안 고른 쪽은 테두리만
 * 둬야 둘이 한 짝으로 읽힙니다. 부품에 그 종류가 생기면 이것은 지웁니다.
 */
function Choice({
  icon,
  label,
  tone,
  chosen,
  disabled,
  onPress,
}: {
  icon: 'thumbs-up' | 'thumbs-down';
  label: string;
  /** 좋다 쪽은 브랜드색 옅은 면, 아니다 쪽은 회색 면입니다. */
  tone: 'yes' | 'no';
  chosen: boolean;
  /** 마감이 지나 표를 안 받습니다. 고른 쪽은 그대로 보입니다. */
  disabled?: boolean;
  onPress: () => void;
}) {
  const face = chosen
    ? tone === 'yes'
      ? styles.choiceYes
      : styles.choiceNo
    : styles.choiceOff;

  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      scale={0.96}
      accessibilityState={{ selected: chosen, disabled }}
      accessibilityLabel={chosen ? `${label} 무르기` : label}
      style={[styles.choice, face, disabled ? styles.choiceDisabled : null]}>
      {/* 그림만 둡니다 — 글자는 읽어 주는 기기(accessibilityLabel)가 말합니다.
          엄지 위·아래는 어디서나 같은 뜻이라 글자 없이도 읽힙니다. */}
      <Icon name={icon} size={18} tone={chosen && tone === 'yes' ? 'brand' : 'secondary'} />
    </Press>
  );
}

/** 좋다고 한 몫. 아무도 없는 여행(0명)에서 0으로 나누지 않습니다. */
function share(yes: number, members: number) {
  if (members <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((yes / members) * 100));
}

/**
 * 후보 올리기.
 *
 * <p>보석함에서 꺼내거나 바로 검색합니다. 담아 둔 것을 다시 적게 하면 같은
 * 일을 두 번 합니다.
 */
function AddSheet({
  visible,
  tripId,
  onAdded,
  onCancel,
}: {
  visible: boolean;
  tripId: string;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  /** 보석함에서 고를 때 이름으로 거르기. */
  const [pick, setPick] = useState('');
  const { data: saved } = useAsync<{ places: SavedPlace[] }>(
    (signal) => (visible ? api.get('/api/saved', signal) : Promise.resolve({ places: [] })),
    [visible],
  );

  async function add(body: unknown) {
    setFailed(null);
    try {
      await api.post(`/api/trips/${tripId}/candidates`, body);
      onAdded();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  return (
    <BottomSheet visible={visible} title="가고 싶은 곳 올리기" onClose={onCancel}>
      <PlaceSearch
        onPick={(found) =>
          add({ name: found.name, lat: found.lat, lng: found.lng, placeId: found.placeId })
        }
      />

      {failed ? <ErrorNote message={failed} /> : null}

      {saved && saved.places.length > 0 ? (
        <>
          <Divider />
          <Caption tone="secondary">저장한 곳에서</Caption>
          {/* 담아 둔 것이 여럿이면 여기서도 훑어 내려가야 합니다. */}
          {saved.places.length > 5 ? (
            <SearchField
              label="저장한 곳에서 찾기"
              value={pick}
              onChangeText={setPick}
              placeholder="국밥, 온천"
            />
          ) : null}
          {saved.places
            .filter((place) =>
              [place.name, place.cat, place.note]
                .filter(Boolean)
                .some((f) => String(f).toLowerCase().includes(pick.trim().toLowerCase())),
            )
            /* 찾기로 걸러진 뒤의 줄 수를 봐야 합니다 — 담아 둔 전체를 세면
               걸러져 사라진 줄이 마지막일 때 선이 하나 남아 떴습니다. */
            .map((place, i, shown) => (
            <ListRow
              key={place.id}
              title={place.name}
              left={<Mark icon={glyphOf(place.icon)} />}
              subtitle={place.note ?? place.cat ?? '메모 없음'}
              last={i === shown.length - 1}
              onPress={() => add({ savedId: place.id })}
            />
            ))}
        </>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingTop: Spacing.s2,
  },
  headText: {
    flex: 1,
    gap: Spacing.s1,
  },
  /* 묻는 말. 구역 제목과 같은 단입니다 — 이 화면에서 가장 큰 글자입니다. */
  ask: {
    ...Type.title2,
    fontWeight: Weight.bold,
    color: Colors.text,
  },
  views: {
    flexWrap: 'wrap',
  },

  /*
    후보 한 장.

    <p>눌러서 들어가는 물건이라 카드입니다. 바닥이 흰색이므로 테두리 대신
    옅은 그림자로 떠 있게 합니다 — 테두리를 두르면 여덟 장이 「네모의 더미」
    가 됩니다.
  */
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.r3,
    padding: Spacing.s4,
    gap: Spacing.s2,
    ...Elevation.card,
  },
  cardHead: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s3,
  },
  grow: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...Type.headline,
    fontWeight: Weight.semibold,
    color: Colors.text,
  },

  /* 표를 받는 바닥. 높이 6, 끝이 둥근 선 하나입니다. */
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.fillPressed,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },

  choices: {
    flexWrap: 'nowrap',
  },
  /*
    줄 안에 드는 단추. 보이는 높이는 36 이고, 누르는 넓이는 좌우로 꽉 차서
    손가락이 모자라지 않습니다.
  */
  voteRow: {
    alignItems: 'center',
  },
  voteInfo: {
    flex: 1,
    gap: Spacing.s1,
  },
  /* 세로로 쌓이는 자리에서는 flex 로 자라면 높이가 0 이 됩니다. 폭만 채웁니다. */
  barInline: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    minHeight: 6,
    alignSelf: 'stretch',
  },
  /* 막대 옆 작은 단추. 보이는 크기는 40 — 손가락이 닿는 44 에 가깝게. */
  choiceDisabled: {
    opacity: 0.4,
  },
  choice: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.s2,
  },
  choiceOff: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  choiceYes: {
    backgroundColor: Colors.accentSoft,
  },
  choiceNo: {
    backgroundColor: Colors.fill,
  },
  choiceLabel: {
    ...Type.caption,
    fontSize: 14,
    fontWeight: Weight.medium,
  },
  /* 엄지를 아래로. */
  flip: {
    transform: [{ rotate: '180deg' }],
  },

  footerRow: {
    flexWrap: 'nowrap',
  },
  /* 곁들이는 쪽과 지금 할 일의 넓이를 1:2 로 나눕니다. */
  footerSide: {
    flex: 1,
  },
  footerMain: {
    flex: 2,
  },
});
