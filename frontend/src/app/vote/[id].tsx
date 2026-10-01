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
import { iconOf, labelOf } from '@/constants/place-icons';
import { Colors, Elevation, Radius, Spacing, Tap, Type, Weight } from '@/constants/theme';
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
  const { data: trip } = useAsync<TripDetail>(
    (signal) => api.get(`/api/trip?trip=${encodeURIComponent(id)}`, signal),
    [id],
  );

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
  const shown = all.filter((c) =>
    view === 'all' ? true : view === 'agreed' ? c.agreed : !c.agreed,
  );

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
              <Button label="후보 올리기" variant="secondary" onPress={() => setAdding(true)} />
            </View>
            <View style={styles.footerMain}>
              <Button
                label={`정해진 ${agreed.length}곳 일정에 넣기`}
                onPress={() => setPouring(true)}
              />
            </View>
          </Row>
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
              <Mark emoji={iconOf(candidate.icon)} fallback="📍" />
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
          <Split align="center" gap={Spacing.s3}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${share(candidate.yes, candidate.memberCount)}%` },
                ]}
              />
            </View>
            <Caption tone="muted">
              👍 {candidate.yes}
              {candidate.no > 0 ? ` · 👎 ${candidate.no}` : ''}
              {` · ${candidate.memberCount}명`}
            </Caption>
          </Split>

          {/*
            고르는 단추 둘.

            <p>「좋아요」 가 바이올렛으로 꽉 차 있었습니다. 후보 여덟이면 꽉
            찬 바이올렛이 여덟인데, 색을 가득 쓰는 자리는 화면에 하나여야
            합니다 — 그 하나는 아래 고정 줄의 「일정에 넣기」 입니다.

            <p>내가 고른 쪽만 면을 깝니다. 안 고른 쪽은 테두리만 둡니다.
            그러면 한 화면에서 <b>내가 이미 누른 것</b>이 어느 것인지가 면의
            있고 없음으로 읽힙니다.
          */}
          <Row gap={Spacing.s2} style={styles.choices}>
            <Choice
              icon="thumbs-up"
              label="좋아요"
              tone="yes"
              chosen={candidate.myVote === true}
              onPress={() => vote(candidate, candidate.myVote === true ? null : true)}
            />
            <Choice
              icon="thumbs-up"
              label="별로예요"
              tone="no"
              chosen={candidate.myVote === false}
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

        <p>찾기 화면과 같은 자리, 같은 말입니다.
      */}
      <PlaceDetailSheet
        place={looking}
        onClose={() => setLooking(null)}
        actions={
          looking && !kept.has(looking.name) ? (
            <Press
              onPress={() => {
                const target = looking;
                setLooking(null);
                keep(target);
              }}
              accessibilityLabel={`${looking.name} 보석함에 줍기`}
              scale={0.98}>
              <Caption tone="brand" strong>
                보석함에 줍기
              </Caption>
            </Press>
          ) : null
        }
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
  onPress,
}: {
  icon: 'thumbs-up';
  label: string;
  /** 좋다 쪽은 브랜드색 옅은 면, 아니다 쪽은 회색 면입니다. */
  tone: 'yes' | 'no';
  chosen: boolean;
  onPress: () => void;
}) {
  const face = chosen
    ? tone === 'yes'
      ? styles.choiceYes
      : styles.choiceNo
    : styles.choiceOff;
  const color = chosen
    ? tone === 'yes'
      ? Colors.accentText
      : Colors.text
    : Colors.textSecondary;

  return (
    <Press
      onPress={onPress}
      scale={0.96}
      accessibilityState={{ selected: chosen }}
      accessibilityLabel={chosen ? `${label} 무르기` : label}
      style={[styles.choice, face]}>
      {/* 「별로예요」 는 같은 그림을 뒤집어 씁니다. 아이콘 묶음에 아래로
          향한 엄지가 따로 없어서인데, 뒤집힌 엄지는 어디서나 같은 뜻입니다. */}
      <View style={tone === 'no' ? styles.flip : undefined}>
        <Icon name={icon} size={16} tone={chosen && tone === 'yes' ? 'brand' : 'secondary'} />
      </View>
      <Text style={[styles.choiceLabel, { color }]}>{label}</Text>
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
              left={<Mark emoji={iconOf(place.icon)} fallback="📍" />}
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
    gap: Spacing.s3,
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
  choice: {
    flex: 1,
    height: Tap.compact,
    borderRadius: Radius.r2,
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
