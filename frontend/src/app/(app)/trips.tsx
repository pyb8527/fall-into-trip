import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Folder, Going, TripSummary } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { TripSlot } from '@/components/trip-slot';
import { FolderSheet } from '@/components/folder-sheet';
import { TripForm } from '@/components/trip-form';
import { CountdownBadge } from '@/components/countdown-badge';
import { TripCard } from '@/components/trip-card';
import { faceOf } from '@/constants/user-marks';
import { Colors, Gutter, Radius, Spacing, Type, Weight } from '@/constants/theme';
import { countdownOf, formatNights, formatSpan, todayIso } from '@/lib/countdown';
import { money } from '@/lib/money';
import {
  Badge,
  Band,
  BottomSheet,
  Button,
  Caption,
  Chip,
  ConfirmDialog,
  Empty,
  ErrorNote,
  Field,
  Icon,
  IconButton,
  ListRow,
  Press,
  Row,
  Screen,
  SearchField,
  SectionHeader,
  SegmentedTabs,
  Skeleton,
  Split,
} from '@/ui';
import { ScreenTop } from '@/ui/nav';
import { AppTabs } from '@/ui/tab-bar';

/**
 * 내 여행.
 *
 * <h3>혼자와 모임을 먼저 가릅니다</h3>
 *
 * <p>모임 여행은 모임 사람 모두의 목록에 뜹니다. 그래서 섞어 놓으면 목록이
 * 순식간에 길어지고, 무엇보다 <b>혼자 짜던 것</b>을 찾기 어려워집니다 —
 * 혼자 여행은 나만 보는 것이라 성격이 다릅니다.
 *
 * <p>든 모임이 없으면 띠를 안 둡니다. 한 칸이 늘 비어 있는 띠는 자리만
 * 차지합니다.
 *
 * <p>그 안에서 다시 두 가지로 나눠 볼 수 있습니다.
 *
 * <ul>
 *   <li><b>일정순</b> — 가는 중 · 다가올 · 다녀온. 대개 궁금한 것은 다음
 *       여행이라 그것이 맨 위에 옵니다.</li>
 *   <li><b>폴더별</b> — 자기가 묶은 대로. 폴더는 보는 사람 것이라 같이 간
 *       사람에게는 안 보입니다.</li>
 * </ul>
 */
/**
 * 아직 폴더에 안 넣은 것들.
 *
 * <p>서버에 있는 폴더가 아니라 <b>화면에서만 쓰는 이름</b>입니다. 폴더에
 * 넣은 것과 안 넣은 것을 같은 모양으로 늘어놓기 위한 것이라, 서버에 빈
 * 폴더를 하나 만들어 두는 것보다 이쪽이 맞습니다 — 그러면 지울 수도
 * 이름을 바꿀 수도 있는 것이 되어 버립니다.
 */
const LOOSE = { id: '', name: '아직 안 넣음', tripCount: 0 } as const;

type Group = 'when' | 'folder';

const GROUPS: { value: Group; label: string }[] = [
  { value: 'when', label: '일정순' },
  { value: 'folder', label: '폴더별' },
];

/** 혼자 짠 것인지, 모임 것인지. */
type Whose = 'all' | 'solo' | 'group';

/*
  전체 · 혼자 · 모임.

  <p>혼자와 모임을 밑줄 탭으로 갈랐습니다. 그런데 탭마다 여행이 하나씩뿐이라
  어느 탭을 열어도 화면 위쪽만 차고 아래가 비었습니다. 한 목록에 모으고,
  거르는 것은 칩으로 둡니다 — 거르는 것은 앱 어디서나 칩입니다(B-4). 기본은
  전체입니다. 모임 여행에는 줄에 모임 이름표가 붙어 섞여도 가려집니다.

  <p>docs/groups/verdict.md 3절과 docs/redesign/plan.md 4-3 이 「탭 둘」로
  그렸던 것을 이것으로 바꿉니다(plan-review Q2).
*/
const WHOSE: { value: Whose; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'solo', label: '혼자' },
  { value: 'group', label: '모임' },
];

/**
 * 무엇 때문에 여행을 고르는지.
 *
 * <p>홈에서 "가계부" 를 누르면 여기로 옵니다. 그때 여행을 고르면 일정이
 * 아니라 그 여행의 가계부로 가야 합니다 — 안 그러면 가계부를 누른 사람이
 * 일정 화면에 서서 다시 길을 찾아야 합니다.
 *
 * <p>비어 있으면 여느 때처럼 일정으로 갑니다.
 */
type PickFor = 'money' | null;

export default function Trips() {
  const { user } = useAuth();
  const router = useRouter();
  const { for: pickFor, new: fresh } = useLocalSearchParams<{ for?: string; new?: string }>();
  const goal: PickFor = pickFor === 'money' ? 'money' : null;

  /** 고른 여행을 어디로 데려갈지. */
  const open = (tripId: string) =>
    goal === 'money'
      ? router.push({ pathname: '/money/[id]', params: { id: tripId } })
      : router.push({ pathname: '/trip/[id]', params: { id: tripId } });
  /* 첫걸음 안내에서 "첫 여행 만들기" 로 들어왔으면 만드는 판을 바로 엽니다.
     목록만 띄워 놓고 어디를 눌러야 하는지 다시 찾게 하면 안내가 아닙니다. */
  const [creating, setCreating] = useState(fresh === '1');
  const [whose, setWhose] = useState<Whose>('all');
  const [group, setGroup] = useState<Group>('when');
  const [placing, setPlacing] = useState<TripSummary | null>(null);
  /** 점 세 개를 누른 여행. 무엇을 할지 고르는 판이 뜹니다. */
  const [acting, setActing] = useState<TripSummary | null>(null);
  const [dropping, setDropping] = useState<TripSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function drop(trip: TripSummary) {
    setBusy(true);
    setFailed(null);
    try {
      await api.delete(`/api/trips/${encodeURIComponent(trip.id)}`);
      reload();
      reloadFolders();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  const { data, error, loading, reload } = useAsync<{ trips: TripSummary[] }>(
    (signal) => api.get('/api/trips', signal),
    [],
  );
  const { data: folderData, reload: reloadFolders } = useAsync<{ folders: Folder[] }>(
    (signal) => api.get('/api/folders', signal),
    [],
  );

  /** 폴더별로 볼 때 열어 둔 폴더. 없으면 폴더들만 늘어놓습니다. */
  const [opened, setOpened] = useState<Folder | null>(null);

  /*
    이름으로 거르기.

    둘러보기에는 찾기를 넣어 두고 정작 내 여행에는 없었습니다. 폴더로 묶는
    것만으로는 스무 개가 넘어가면 훑어 내려가야 합니다.

    친 대로 바로 거릅니다 — 서버를 부르는 것이 아니라 이미 받아 둔 목록에서
    골라내는 것이라, 확인을 누르게 할 이유가 없습니다.
  */
  const [q, setQ] = useState('');

  const everything = useMemo(() => data?.trips ?? [], [data]);

  /** 모임 여행이 하나라도 있는지. 없으면 가를 것이 없습니다. */
  const hasGroupTrips = useMemo(() => everything.some((t) => t.groupId != null), [everything]);

  /*
    고른 칸의 것들만.

    찾기와 묶기는 <b>이 칸 안에서</b> 돕니다. 혼자 칸을 보면서 모임 여행이
    셈에 들어가면 「셋」 이라고 적혀 있는데 둘만 보이는 일이 생깁니다.
  */
  const all = useMemo(
    () =>
      hasGroupTrips && whose !== 'all'
        ? everything.filter((t) => (whose === 'group' ? t.groupId != null : t.groupId == null))
        : everything,
    [everything, hasGroupTrips, whose],
  );

  const trips = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? all.filter((t) => t.title.toLowerCase().includes(needle)) : all;
  }, [all, q]);
  const folders = useMemo(() => folderData?.folders ?? [], [folderData]);

  const sections = useMemo(() => (group === 'when' ? byWhen(trips) : []), [group, trips]);

  /*
    모임 이름을 줄마다 달지 말지.

    <p>모임이 하나뿐이면 그 이름이 모든 줄에 똑같이 붙습니다 — 아무것도
    구별해 주지 못하면서 제목이 설 자리만 먹습니다. 폰에서는 그 한 칸 때문에
    여행 이름이 한 글자로 줄어듭니다.

    <p>둘 이상일 때만 답니다. 그때부터는 어느 모임의 것인지가 실제로 갈리는
    정보입니다.
  */
  const manyGroups = useMemo(
    () => new Set(trips.map((t) => t.groupId).filter(Boolean)).size > 1,
    [trips],
  );

  /** 어느 폴더에도 안 넣은 것. 폴더별로 볼 때 아래에 따로 모읍니다. */
  const loose = useMemo(() => trips.filter((t) => !t.folderId), [trips]);

  /** 그 폴더에 든 여행들. 미분류(LOOSE)면 아직 아무 데도 안 넣은 것들입니다. */
  const inFolder = useCallback(
    (folder: { id: string }): TripSummary[] =>
      folder.id === LOOSE.id ? loose : trips.filter((t) => t.folderId === folder.id),
    [trips, loose],
  );

  /** 새 폴더 이름을 받는 판. */
  const [naming, setNaming] = useState(false);

  return (
    <Screen
      safeTop
      tabs={<AppTabs />}
      /*
        맨 윗줄은 찾는 칸입니다.

        <h3>이름을 걷고 그 자리를 썼습니다</h3>

        <p>「내 여행」이라고 큰 제목으로 적고 있었습니다. 그런데 지금 어디인지는
        <b>아래 갈래 띠가 이미 말합니다</b> — 「내 여행」 칸이 채워져 있는 채로
        위에 같은 말이 한 번 더 적혀 있었습니다. 걷습니다.

        <p>그 자리에 찾는 칸을 세웁니다. 돋보기로 접어 두고 있었습니다 —
        「찾는 일은 가끔 한 번」이 그때의 까닭이었는데, 접고 펴는 몸짓이
        있으면 펼 때마다 목록이 한 줄 아래로 밀렸고 <b>돋보기가 생기는 순간
        (여행이 다섯째가 될 때) 윗줄이 32 에서 44 로 자랐습니다.</b> 칸을
        그냥 세우면 둘 다 없어집니다.

        <p>여행이 몇 개 안 되면 칸은 안 냅니다 — 다섯 줄을 눈으로 훑는 것이
        치는 것보다 빠릅니다. 다만 <b>줄은 그대로 섭니다.</b> 줄째 걷으면
        이 화면만 첫 줄이 위로 올라붙고, 다섯째 여행이 생기는 날 화면이
        한 번 들썩입니다 — 35번이 말하는 것이 바로 그것입니다.
      */
      header={
        <ScreenTop
          left={
            all.length > 4 ? (
              <SearchField
                label="여행 찾기"
                value={q}
                onChangeText={setQ}
                placeholder="오사카, 제주"
              />
            ) : null
          }
        />
      }
      /* 주 동작은 아래에 붙입니다. 한 손으로 쥐었을 때 엄지가 닿는 자리입니다. */
      footer={<Button label="새 여행 만들기" onPress={() => setCreating(true)} />}>
      {/*
        상단바는 걷습니다.

        <p>갈래 띠로 오는 화면입니다. 뒤로 갈 데가 없으니 상단바가 할 일이
        없는데, 작은 제목 하나를 위해 56픽셀을 먹고 있었습니다 — 그 제목은
        아래 띠가 이미 하고 있는 말입니다.
      */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* 무엇 때문에 고르는 중인지. 여느 때는 말할 것이 없습니다. */}
      {goal === 'money' ? (
        <Caption tone="secondary">어느 여행의 가계부를 볼까요?</Caption>
      ) : null}

      {/*
        처음 받는 동안 — 줄이 올 자리를 미리 세웁니다.

        <p>{@link Loading} 이 섰습니다. 가운데에서 점 셋이 돌다가 목록이 닿는
        순간 줄들이 한꺼번에 들어서서, 화면이 한 번 들썩였습니다 — 목록이
        어디서 시작하는지가 <b>받고 나서야</b> 정해졌습니다.

        <p>{@link Skeleton} 의 회색 칸은 두 줄짜리 {@link ListRow} 와 높이가
        같고(72), 앞의 네모도 {@link TripSlot} 과 같은 48 입니다. 그래서 줄이
        닿아도 자리가 안 움직입니다.

        <p>셋입니다. 여행은 대개 몇 개뿐이라 넷 다섯을 세우면 실제보다 긴
        목록을 약속하는 셈이고, 하나만 세우면 「거의 다 왔다」로 읽힙니다.

        <p><b>다시 받을 때는 안 섭니다.</b> {@link useAsync} 는 새로 받는 동안
        먼저 받아 둔 것을 들고 있어서, 화면으로 돌아왔을 때 목록은 비지 않고
        그대로 보입니다. 거기에 이것을 또 세우면 있는 줄들을 일부러 걷는
        일이 됩니다.
      */}
      {loading && !data ? <Skeleton /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {/*
        혼자와 모임.

        <p>묶기 띠(일정순·폴더별) <b>위에</b> 섭니다. 먼저 가르는 것이
        이쪽이라 아래에 두면 묶기를 고친 뒤에 다시 칸을 고르게 됩니다.

        <p>이쪽만 밑줄 탭으로 바꿉니다. 혼자와 모임은 <b>서로 다른 여행
        묶음</b>이고(빈 자리에 나오는 말도 다릅니다), 일정순·폴더별은 그
        묶음을 다르게 늘어놓는 것입니다. 여태 둘 다 알약이라 화면 위쪽에
        회색 알약 묶음이 둘이나 섰고, 어느 쪽이 먼저 가르는 칸인지가
        생김새로 안 보였습니다.
      */}
      {data && hasGroupTrips ? (
        <Row gap={Spacing.s2}>
          {WHOSE.map((w) => (
            <Chip key={w.value} label={w.label} selected={whose === w.value} onPress={() => setWhose(w.value)} />
          ))}
        </Row>
      ) : null}

      {/*
        빈 화면에 할 일을 답니다.

        <p>한 줄만 떠 있었습니다. 이 화면은 처음 들어온 사람이 가장 먼저
        보는 자리인데, 다음에 무엇을 하면 되는지를 말하지 않았습니다.

        <p>단추는 「모임 것이 없다」 에만 답니다. 나머지 둘이 할 일은
        <b>새 여행 만들기</b>이고 그것은 이미 바닥에 고정돼 있습니다 —
        같은 단추를 둘 세우면 둘 다 주 동작으로 안 보입니다(계획서 원칙 5).
        그 둘은 바닥 단추를 가리키기만 합니다.
      */}
      {data && all.length === 0 ? (
        !hasGroupTrips ? (
          <Empty
            icon="map-pin"
            message="아직 그려 둔 여행이 없어요."
            note="아래 「새 여행 만들기」로 첫 줄을 그어 보세요."
          />
        ) : whose === 'group' ? (
          <Empty
            icon="users"
            message="모임에서 짠 여행이 아직 없어요."
            note="모임에서 만든 여행은 모두가 함께 고칠 수 있어요."
            action={{ label: '모임 보기', onPress: () => router.push('/(app)/groups') }}
          />
        ) : (
          /* 「혼자」를 골라서 비었을 때만 옵니다(전체에서는 다른 여행이 보입니다).
             그 자리에서 바로 만들고, 남이 혼자 다녀온 길도 봅니다. */
          <Empty
            icon="map-pin"
            message="혼자 짜 둔 여행이 없어요."
            note="남이 혼자 다녀온 길을 밑그림 삼아도 돼요."
            action={{ label: '혼자 여행 둘러보기', onPress: () => router.push({ pathname: '/community', params: { q: '혼자' } }) }}
          />
        )
      ) : null}
      {data && all.length > 0 && trips.length === 0 ? (
        <Empty icon="search" message={`"${q.trim()}" 로는 찾은 것이 없어요.`} />
      ) : null}

      {/* 폴더를 하나라도 만들었으면 여행이 하나뿐이어도 띠를 둡니다. 안 그러면
          폴더에 넣어 놓고도 폴더별로 볼 방법이 없습니다. */}
      {data && (all.length > 1 || folders.length > 0) ? (
        <SegmentedTabs items={GROUPS} value={group} onChange={setGroup} />
      ) : null}

      {/*
        폴더별로 볼 때는 폴더를 먼저 보여 줍니다.

        전에는 폴더 이름을 제목으로 달고 그 아래에 여행을 죽 늘어놓았습니다.
        폴더가 서넛만 되어도 화면이 길어져, 정리한 보람이 없고 무엇보다
        "폴더에 넣었는데 어디 있지" 가 됩니다. 탐색기처럼 폴더는 폴더로 두고,
        누르면 그 안이 열립니다.
      */}
      {group === 'folder' ? (
        <Row gap={Spacing.s3} style={styles.shelf}>
          {folders.map((folder) => (
            <Press
              key={folder.id}
              onPress={() => setOpened(folder)}
              scale={0.98}
              accessibilityLabel={`${folder.name} 폴더 열기`}
              style={styles.folder}>
              <Icon name="folder" size={24} tone="brand" />
              <Text style={styles.folderName} numberOfLines={1}>
                {folder.name}
              </Text>
              <Caption tone="muted">여행 {folder.tripCount}개</Caption>
            </Press>
          ))}

          {/*
            미분류도 폴더 한 칸으로 냅니다.

            <p>전에는 폴더 선반 <b>아래에</b> "폴더 없음" 이라는 목록으로
            길게 늘어놓았습니다. 그러면 폴더를 셋 만들어 놓고도 정작 화면의
            대부분은 안 넣은 여행들이 차지합니다 — 정리한 보람이 없습니다.

            <p>같은 칸으로 둡니다. 폴더에 넣는 것과 안 넣는 것은 <b>같은
            종류의 자리</b>이고, 누르면 그 안이 열리는 것도 같습니다.
          */}
          {loose.length > 0 ? (
            <Press
              onPress={() => setOpened(LOOSE)}
              scale={0.98}
              accessibilityLabel="아직 안 넣은 여행 보기"
              style={styles.folder}>
              <Icon name="folder" size={24} tone="muted" />
              <Text style={styles.folderName} numberOfLines={1}>
                {LOOSE.name}
              </Text>
              <Caption tone="muted">여행 {loose.length}개</Caption>
            </Press>
          ) : null}

          {/*
            새 폴더.

            <p>전에는 폴더를 만드는 길이 <b>여행 줄의 폴더 단추 안에만</b>
            있었습니다. 그래서 폴더를 먼저 만들어 두고 나중에 넣는 순서로는
            시작할 수가 없었고, 빈 화면의 안내도 "여행 오른쪽의 폴더 단추로
            만듭니다" 라고 길을 설명해야 했습니다.
          */}
          <Press
            onPress={() => setNaming(true)}
            scale={0.98}
            accessibilityLabel="새 폴더 만들기"
            style={[styles.folder, styles.folderNew]}>
            <Icon name="plus" size={24} tone="muted" />
            <Text style={styles.folderName} numberOfLines={1}>
              새 폴더
            </Text>
          </Press>
        </Row>
      ) : null}

      {/*
        묶음을 카드에서 꺼냈습니다.

        <p>묶음마다 흰 카드 한 장이었습니다. 바닥이 흰색이 되면서 그 카드는
        바닥에 녹아 없어졌고, 옅은 그림자만 남아 화면이 흐릿해졌습니다.

        <p>묶음 사이는 <b>회색 띠</b>가 가릅니다. 머리는 공용 부품
        ({@code SectionHeader})이 그립니다 — 여기서 손으로 만들고 있었더니
        글자 크기도 여백도 이 화면만의 값이었고, 홈의 구역 제목과 나란히
        놓으면 둘이 다른 앱처럼 보였습니다. 개수는 머리 오른쪽에 붙입니다.
      */}
      {sections.map((section, at) => (
        <View key={section.title}>
          {at > 0 ? <Band /> : null}
          <SectionHeader
            tight={at > 0}
            title={section.title}
            action={<Caption tone="muted">{section.trips.length}</Caption>}
          />
          {section.kind === 'done' ? (
            /*
              다녀온 여행 — 영수증 모양 작은 카드를 가로로.

              <p>한 줄씩 늘어놓으면 쌓일수록 목록 아래가 길어지기만 합니다.
              가로로 흘리면 한 줄 높이로 몇 년치가 들어가고, 누르면 그 여행의
              영수증(요약)이 열립니다 — 다녀온 여행에서 다시 보는 것은 일정이
              아니라 무엇을 했나입니다.
            */
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.receipts}>
              {section.trips.map((trip) => (
                <ReceiptCard
                  key={trip.id}
                  trip={trip}
                  onPress={() =>
                    goal === 'money'
                      ? open(trip.id)
                      : router.push({ pathname: '/card/[id]', params: { id: trip.id } })
                  }
                />
              ))}
            </ScrollView>
          ) : (
            section.trips.map((trip, i) =>
              section.kind === 'coming' && i === 0 && goal == null ? (
                /* 가장 가까운 것 하나만 크게. 홈의 큰 카드와 같은 부품이고,
                   할 일 칩만 뺍니다 — 할 일은 홈이 말합니다. */
                <View key={trip.id} style={styles.big}>
                  <NextCard trip={trip} onOpen={() => open(trip.id)} onMore={() => setActing(trip)} />
                </View>
              ) : (
                <TripRow
                  key={trip.id}
                  trip={trip}
                  showGroup={manyGroups || whose === 'all'}
                  /* 묶음의 마지막 줄에는 선을 안 긋습니다. 아래가 띠로 끊기는데
                     선까지 있으면 줄이 하나 더 있는 줄 압니다. */
                  last={i === section.trips.length - 1}
                  onOpen={() => open(trip.id)}
                  onFolder={() => setActing(trip)}
                />
              ),
            )
          )}
        </View>
      ))}

      {/*
        가계부 모아 보기.

        <p>아래 갈래 띠에 「가계부」 칸이 있었습니다. 그런데 가계부는 여행
        하나에 딸린 것이라, 그 칸을 누르면 여행을 <b>먼저 고르는</b> 화면이
        떴습니다 — 갈래 하나가 "어느 여행?" 을 묻는 데 쓰이고 있었습니다.

        <p>여행을 고르는 자리는 여기입니다. 띠에서 내려오고 이 줄로 들어
        갑니다. 여행이 하나도 없으면 안 답니다 — 적을 것이 없습니다.
      */}
      {data && everything.length > 0 && goal == null ? (
        <View>
          <Band />
          <MoneyCard onPress={() => router.push('/(app)/money')} />
        </View>
      ) : null}

      <TripForm
        visible={creating}
        onCancel={() => setCreating(false)}
        onCreated={(trip) => {
          setCreating(false);
          router.push({ pathname: '/trip/[id]', params: { id: trip.id } });
        }}
      />

      {/* 폴더 안. 화면을 갈아 끼우지 않고 판으로 엽니다 — 닫으면 보던
          자리로 그대로 돌아옵니다. */}
      {opened ? (
        <BottomSheet visible title={opened.name} onClose={() => setOpened(null)}>
          {inFolder(opened).length === 0 ? (
            <Empty
              icon="folder"
              message="이 폴더는 아직 비어 있어요."
              /* 폴더를 만들어 놓고 넣는 길을 못 찾는 자리입니다. 옮기는
                 길은 줄 오른쪽 점 셋인데, 빈 폴더 안에는 그 줄이 하나도
                 없어서 어디서 넣는지가 안 보입니다. */
              note="여행 목록에서 줄 오른쪽 ⋯ 를 누르면 이 폴더로 옮길 수 있어요."
            />
          ) : null}
          {inFolder(opened).map((trip, i, rows) => (
              <TripRow
                key={trip.id}
                trip={trip}
                showGroup={manyGroups}
                last={i === rows.length - 1}
                onOpen={() => {
                  setOpened(null);
                  router.push({ pathname: '/trip/[id]', params: { id: trip.id } });
                }}
                onFolder={() => {
                  setOpened(null);
                  setActing(trip);
                }}
              />
            ))}
        </BottomSheet>
      ) : null}

      {/* 폴더만 하나 만들어 두는 자리. 여행을 고르지 않고도 시작할 수
          있어야 합니다. */}
      <NewFolderSheet
        visible={naming}
        onClose={() => setNaming(false)}
        onMade={() => {
          setNaming(false);
          reloadFolders();
        }}
      />

      {failed ? <ErrorNote message={failed} /> : null}

      {/*
        점 세 개가 여는 판.

        <p>전에는 누르면 <b>곧바로 폴더 판</b>이 떴습니다. 그래서 이 여행에
        할 수 있는 일이 폴더에 넣는 것 하나뿐인 것처럼 보였고, 지우려면
        여행에 들어가 점 세 개를 또 눌러야 했습니다 — 목록에서 지우는 것이
        가장 자연스러운 자리인데 거기에만 길이 없었습니다.

        <p>지우기는 <b>맨 아래에 빨간 글씨</b>로 둡니다. 되돌릴 수 없는 것은
        손이 먼저 닿는 자리에 있으면 안 됩니다. 만든 사람만 보입니다 —
        남의 여행은 서버가 막으므로, 눌러 보고 거절당하는 것보다 안 보이는
        편이 낫습니다.
      */}
      {acting ? (
        <BottomSheet visible title={acting.title} onClose={() => setActing(null)}>
          <ListRow
            left={<Icon name="folder" tone="muted" />}
            title="폴더에 넣기"
            last
            onPress={() => {
              const trip = acting;
              setActing(null);
              setPlacing(trip);
            }}
          />

          {acting.ownerId === user?.id ? (
            <>
              <Band />
              <ListRow
                left={<Icon name="trash-2" tone="danger" />}
                title={<Text style={styles.dangerRow}>여행 지우기</Text>}
                last
                onPress={() => {
                  const trip = acting;
                  setActing(null);
                  setDropping(trip);
                }}
              />
            </>
          ) : null}
        </BottomSheet>
      ) : null}

      <ConfirmDialog
        visible={dropping !== null}
        title="이 여행을 지울까요?"
        message={
          dropping
            ? `${dropping.title} 의 날짜와 장소가 모두 사라져요. 같이 보던 사람도 더 볼 수 없게 돼요. 되돌릴 수 없어요.`
            : undefined
        }
        confirmLabel="지우기"
        danger
        busy={busy}
        onCancel={() => setDropping(null)}
        onConfirm={() => {
          const trip = dropping;
          setDropping(null);
          if (trip) {
            drop(trip);
          }
        }}
      />

      {placing ? (
        <FolderSheet
          visible
          tripId={placing.id}
          tripTitle={placing.title}
          current={placing.folderId ?? null}
          onClose={() => setPlacing(null)}
          onChanged={() => {
            reload();
            reloadFolders();
          }}
        />
      ) : null}
    </Screen>
  );
}

/**
 * 여행 한 줄.
 *
 * <h3>오른쪽에 뭘 안 쌓습니다</h3>
 *
 * <p>표를 셋 달아 봤습니다 — 남은 날, 모임 이름, 「같이」. 폰에서 그 셋이
 * 오른쪽을 다 먹어서 <b>여행 이름이 한 글자로 줄었습니다.</b> 날짜 줄은 한
 * 글자씩 세로로 흘렀습니다.
 *
 * <p>남은 날 하나만 늘 답니다. 목록에서 가장 먼저 보고 싶은 것이고, 짧습니다.
 *
 * <p>「내 여행」도 「같이」도 안 답니다. 혼자 칸은 전부 내 것이고 모임 칸은
 * 대개 같이 가는 것이라, 어느 쪽이든 거의 모든 줄에 같은 표가 붙습니다 —
 * 모든 줄에 붙는 표는 아무것도 구별해 주지 못합니다.
 *
 * <p>모임 이름은 <b>모임이 둘 이상일 때만</b> 답니다. 하나뿐이면 역시 모든
 * 줄에 같은 이름입니다.
 */
/**
 * 폴더 하나 만들기.
 *
 * <p>폴더를 만드는 길이 <b>여행 줄의 단추 안에만</b> 있었습니다(FolderSheet).
 * 그래서 "폴더부터 만들어 두고 나중에 넣는" 순서로는 시작할 수가 없었고,
 * 빈 화면의 안내도 길을 설명해야 했습니다 — 안내가 길을 설명하고 있으면
 * 대개 길이 잘못 난 것입니다.
 */
function NewFolderSheet({
  visible,
  onClose,
  onMade,
}: {
  visible: boolean;
  onClose: () => void;
  onMade: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function make() {
    const clean = name.trim();
    if (!clean || busy) {
      return;
    }
    setBusy(true);
    setFailed(null);
    try {
      await api.post('/api/folders', { name: clean });
      setName('');
      onMade();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet visible={visible} title="새 폴더" onClose={onClose}>
      <Caption tone="secondary">폴더는 나에게만 보여요. 같이 간 사람은 자기 식대로 정리해요.</Caption>
      {failed ? <ErrorNote message={failed} /> : null}
      <Field
        label="이름"
        value={name}
        onChangeText={setName}
        placeholder="제주 갈 때마다"
        returnKeyType="done"
        onSubmitEditing={make}
      />
      <Button label="만들기" busy={busy} disabled={!name.trim()} onPress={make} />
    </BottomSheet>
  );
}

function TripRow({
  trip,
  showGroup,
  last,
  onOpen,
  onFolder,
}: {
  trip: TripSummary;
  /** 모임 이름을 달지. 모임이 둘 이상일 때만 뜻이 있습니다. */
  showGroup?: boolean;
  /** 목록의 마지막 줄인지. 그 줄에는 아래 선을 안 긋습니다. */
  last?: boolean;
  onOpen: () => void;
  /** 폴더에 넣는 단추. 폴더를 다루지 않는 자리에서는 넘기지 않습니다. */
  onFolder?: () => void;
}) {
  return (
    <ListRow
      last={last}
      /*
        앞 칸은 사진이 있으면 사진, 없으면 표식입니다({@link TripSlot}).

        <p>겹치는 쪽 — 사진을 깔고 표식을 배지로 얹는 것 — 은 48 에서 안
        됩니다. 더 센 까닭은 셈이 어긋나는 쪽입니다: 배지가 뜻을 갖는 것은
        <b>색이나 이모지를 정한 여행</b>인데 새 구글 호출을 치르는 것은
        <b>사진이 없는 여행</b>이고, 그 두 묶음은 서로 상관이 없습니다 —
        아무것도 안 정한 여행은 배지로 얻는 것이 없으면서 값만 냅니다.

        <p>가르면 호출이 하나도 안 늡니다. 서버가 목록에 이미 실어 보낸
        번호만 쓰고, 없으면 여태 그대로 표식입니다. 자세한 것과
        {@link TripThumb} 을 안 쓰는 까닭은 {@link TripSlot} 에 적어 두었습니다.

        <p>칸은 48 그대로이고 줄 높이도 72 그대로입니다 — 사진을 담겠다고
        칸을 넓히면 이 줄을 쓰는 두 화면이 같이 자랍니다.
      */
      left={<TripSlot theme={trip.theme} emoji={trip.emoji} firstPhotoId={trip.firstPhotoId} />}
      title={trip.title}
      subtitle={`${formatSpan(trip.startIso, trip.endIso)} · ${formatNights(trip.dayCount)} · 장소 ${trip.placeCount}곳`}
      /* 안 줄어드는 자리입니다. 줄어들 수 있게 두면 제목이 아니라 이쪽이
         버티면서 제목만 한 글자로 눌립니다 — 그 반대여야 합니다. */
      right={
        <Row gap={Spacing.s1} style={styles.tail}>
          <CountdownBadge startIso={trip.startIso} endIso={trip.endIso} />
          {showGroup && trip.groupName ? (
            <Badge label={shortGroup(trip.groupName)} tone="muted" />
          ) : null}
        </Row>
      }
      /*
        줄마다 답니다.

        <p>폴더별로 볼 때만 냈었습니다. 그런데 "이 여행 폴더에 넣어야지" 는
        대개 <b>여행을 보다가</b> 드는 생각이라, 그때마다 보기를 폴더별로
        바꿔야 했습니다. 정리하려고 보기를 바꾸는 것이 아니라 정리하다 보니
        폴더별로 가는 것이 순서입니다.

        <p>폴더 그림 대신 점 세 개입니다. 폴더 그림은 "이미 폴더에 들어
        있다" 로도 읽혀서, 안 넣은 여행 옆에 서 있으면 헷갈립니다.

        <p>판 <b>안</b>에 섭니다. 옆에 붙여 두었더니 점 세 개가 붙은 줄만
        판이 그만큼 짧아져서 목록 오른쪽 끝이 들쭉날쭉했습니다.
      */
      action={
        onFolder ? (
          <IconButton
            name="more-horizontal"
            label={`${trip.title} 다루기`}
            bare
            onPress={onFolder}
          />
        ) : null
      }
      onPress={onOpen}
    />
  );
}

/** 긴 모임 이름은 자릅니다. 표 하나가 줄을 다 먹으면 안 됩니다. */
function shortGroup(name: string) {
  return name.length > 8 ? name.slice(0, 8) + '…' : name;
}

/*
  한 묶음과 그 안의 여행들.

  <p>Section 이라 불렀는데 화면의 Section(흰 판)과 겹쳤고, Group 은 이미
  「무엇으로 묶을지」(when·folder)가 쓰고 있습니다. 묶인 결과라서 Bunch 입니다.
*/
type Bunch = { kind: 'going' | 'coming' | 'planning' | 'done'; title: string; trips: TripSummary[] };

/**
 * 여행 시기로 나눕니다 — 여행 중 · 곧 떠나요 · 계획 중 · 다녀온 여행.
 *
 * <p>대개 궁금한 것은 다음 여행이므로 가는 중과 다가올 것이 위에 옵니다.
 * 날짜를 아직 안 정한 것은 「계획 중」으로 따로 둡니다 — 다가올 것에 섞으면
 * 맨 위 큰 카드 자리를 날짜도 없는 여행이 차지할 수 있습니다. 다녀온 것은
 * 최근 것부터입니다.
 */
function byWhen(trips: TripSummary[]): Bunch[] {
  const today = todayIso();
  const going: TripSummary[] = [];
  const coming: TripSummary[] = [];
  const planning: TripSummary[] = [];
  const done: TripSummary[] = [];

  for (const trip of trips) {
    const start = trip.startIso;
    const end = trip.endIso ?? trip.startIso;
    if (!start) {
      planning.push(trip);
    } else if (end && end < today) {
      done.push(trip);
    } else if (start <= today) {
      going.push(trip);
    } else {
      coming.push(trip);
    }
  }

  coming.sort((a, b) => (a.startIso ?? '').localeCompare(b.startIso ?? ''));
  done.sort((a, b) => (b.endIso ?? '').localeCompare(a.endIso ?? ''));

  const out: Bunch[] = [
    { kind: 'going', title: '여행 중', trips: going },
    { kind: 'coming', title: '곧 떠나요', trips: coming },
    { kind: 'planning', title: '계획 중', trips: planning },
    { kind: 'done', title: '다녀온 여행', trips: done },
  ];
  return out.filter((s) => s.trips.length > 0);
}

/** 곧 떠나요의 큰 카드. 함께 가는 사람 얼굴은 이 카드 하나 몫만 받습니다. */
function NextCard({
  trip,
  onOpen,
  onMore,
}: {
  trip: TripSummary;
  onOpen: () => void;
  onMore: () => void;
}) {
  const going = useAsync<{ going: Going[] }>(
    (signal) =>
      trip.groupId
        ? api.get(`/api/trips/${encodeURIComponent(trip.id)}/going`, signal)
        : Promise.resolve({ going: [] }),
    [trip.id, trip.groupId],
  );
  const faces = (going.data?.going ?? [])
    .filter((g) => g.answer === 'GOING')
    .map((g) => faceOf(g.mark, g.name));
  return (
    <TripCard
      trip={trip}
      at={countdownOf(trip.startIso, trip.endIso)}
      faces={faces}
      middle={<Caption tone="secondary">장소 {trip.placeCount}곳</Caption>}
      actions={[{ icon: 'more-horizontal', label: `${trip.title} 다루기`, onPress: onMore }]}
      onPress={onOpen}
    />
  );
}

/**
 * 다녀온 여행 한 장 — 영수증 모양.
 *
 * <p>위는 이름과 날짜, 점선 아래는 장소 수. 요약 화면의 영수증과 같은 꼴이라
 * 누르면 그 영수증이 열린다는 것이 모양으로 읽힙니다.
 */
function ReceiptCard({ trip, onPress }: { trip: TripSummary; onPress: () => void }) {
  return (
    <Press onPress={onPress} scale={0.97} accessibilityLabel={`${trip.title} 영수증 보기`} style={styles.receipt}>
      <Text style={styles.receiptTitle} numberOfLines={2}>
        {trip.emoji ? `${trip.emoji} ` : ''}
        {trip.title}
      </Text>
      <Caption tone="muted" numberOfLines={1}>
        {formatSpan(trip.startIso, trip.endIso)}
      </Caption>
      <View style={styles.receiptCut} />
      <Split>
        <Caption tone="secondary">{formatNights(trip.dayCount)}</Caption>
        <Caption tone="secondary">{trip.placeCount}곳</Caption>
      </Split>
    </Press>
  );
}

type Spent = {
  id: string;
  title: string;
  startIso?: string | null;
  sums: { currency: string; decimals: number; total: number; krw?: number | null }[];
};

/**
 * 가계부 모아 보기 — 링크 한 줄이던 것을 숫자로.
 *
 * <h3>원화로 합치는 것은 환율을 적어 둔 여행만</h3>
 *
 * <p>통화를 합치려면 「언제 환율로」가 남습니다. 그래서 그 여행에 적어 둔
 * 환전 환율이 있는 것만 원화로 바꿔 더하고, 못 바꾼 것은 「엔 · 달러 따로」
 * 한 줄로 남깁니다 — 엔만 빼고 더한 값을 합계라고 내놓으면 실제보다 적은
 * 금액이 그럴듯하게 뜹니다.
 *
 * <p>올해 것만 셉니다. 몇 년치를 더한 금액은 볼 일이 없습니다.
 */
function MoneyCard({ onPress }: { onPress: () => void }) {
  const { data } = useAsync<{ trips: Spent[] }>((signal) => api.get('/api/expenses/summary', signal), []);
  const year = todayIso().slice(0, 4);
  /* 올해 떠난(떠날) 여행 전부를 셉니다. 돈을 안 적은 여행도 「여행 n번」에는 듭니다. */
  const thisYear = (data?.trips ?? []).filter((t) => (t.startIso ?? '').startsWith(year));
  const rows = thisYear.filter((t) => t.sums.length > 0);
  let krw = 0;
  const loose = new Map<string, { total: number; decimals: number }>();
  for (const t of rows) {
    for (const sm of t.sums) {
      if (sm.krw != null) {
        krw += sm.krw;
      } else {
        const was = loose.get(sm.currency) ?? { total: 0, decimals: sm.decimals };
        loose.set(sm.currency, { total: was.total + sm.total, decimals: sm.decimals });
      }
    }
  }
  /* 여행마다 원화로 바꿀 수 있는 몫. 막대 길이에 씁니다. */
  const bars = rows
    .map((t) => ({ id: t.id, title: t.title, krw: t.sums.reduce((n, sm) => n + (sm.krw ?? 0), 0) }))
    .filter((b) => b.krw > 0)
    .sort((a, b) => b.krw - a.krw)
    .slice(0, 3);
  const top = bars[0]?.krw ?? 1;
  return (
    <Press onPress={onPress} scale={0.99} accessibilityLabel="가계부 모아 보기" style={styles.moneyCard}>
      <Split>
        <Caption tone="secondary">{`올해 여행 ${thisYear.length}번`}</Caption>
        <Icon name="chevron-right" size={18} tone="muted" />
      </Split>
      <Text style={styles.moneyTotal}>{krw > 0 ? money(krw, 'KRW', 0) : '아직 적은 돈이 없어요'}</Text>
      {loose.size > 0 ? (
        <Caption tone="muted">
          {[...loose.entries()].map(([c, t]) => money(t.total, c, t.decimals)).join(' · ')} 따로
          {' '}(환율을 안 적어 둔 몫)
        </Caption>
      ) : null}
      {bars.map((b) => (
        <View key={b.id} style={styles.moneyBarRow}>
          <Caption tone="secondary" numberOfLines={1}>
            {b.title}
          </Caption>
          <View style={styles.moneyTrack}>
            <View style={[styles.moneyFill, { width: `${Math.max(4, Math.round((b.krw / top) * 100))}%` }]} />
          </View>
        </View>
      ))}
    </Press>
  );
}

const styles = StyleSheet.create({
  big: {
    paddingVertical: Spacing.s2,
  },
  receipts: {
    gap: Spacing.s3,
    paddingBottom: Spacing.s3,
  },
  /* 영수증 한 장. 목록 카드라 모서리 12(plan-review Q1). */
  receipt: {
    width: 148,
    padding: Spacing.s3,
    gap: Spacing.s1,
    borderRadius: 12,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  receiptTitle: {
    ...Type.bodySmall,
    fontWeight: Weight.semibold,
    color: Colors.text,
    minHeight: 40,
  },
  /* 영수증 자르는 선. */
  receiptCut: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.borderStrong,
    marginVertical: Spacing.s1,
  },
  moneyCard: {
    gap: Spacing.s2,
    padding: Spacing.s4,
    borderRadius: 12,
    backgroundColor: Colors.fill,
  },
  moneyTotal: {
    ...Type.title2,
    fontWeight: Weight.bold,
    color: Colors.text,
  },
  moneyBarRow: {
    gap: 2,
  },
  moneyTrack: {
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.fillPressed,
    overflow: 'hidden',
  },
  moneyFill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },
  /*
    탭 아래 선은 좌우 여백을 뚫고 나갑니다.

    <p>여백 안에 가두면 선이 양쪽에서 20픽셀씩 모자라, 화면을 가르는
    가닥이 아니라 내용 위에 얹힌 상자의 밑변으로 보입니다.
  */

  /* 되돌릴 수 없는 줄. 빨간 글씨 하나로 말합니다 — 면을 칠하면 그 줄이
     주 동작처럼 보입니다. */
  dangerRow: {
    ...Type.headline,
    fontWeight: Weight.semibold,
    color: Colors.danger,
  },
  /* 줄 오른쪽 꼬리. 안 줄어듭니다 — 줄어들 수 있게 두면 표가 버티고 제목이
     눌립니다. 대신 표를 적게 답니다. */
  tail: {
    flexShrink: 0,
    flexWrap: 'nowrap',
  },
  /* 폴더를 늘어놓는 선반. 좁은 폰에서 두 칸이 들어갑니다. */
  shelf: {
    alignItems: 'stretch',
  },
  /* 새 폴더는 채우지 않습니다. 이미 있는 폴더들과 같은 무게로 서 있으면
     그중 하나로 읽힙니다. */
  folderNew: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  /*
    폴더 한 칸.

    <p>흰 카드였습니다. 바닥이 흰색이 되면서 테두리 없는 흰 칸은 아무것도
    아니게 되었습니다 — <b>면 카드</b>(회색 면)로 바꿉니다. 폴더는 눌러서
    들어가는 물건이지만 그 안이 판으로 열리는 것이라, 떠 있는 카드보다
    가라앉은 면이 맞습니다.

    <p>두 칸으로 나눕니다. 폰에서 셋을 넣으면 폴더 이름이 두 글자에서
    잘립니다.
  */
  folder: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 88,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: Spacing.s1,
    backgroundColor: Colors.fill,
    borderRadius: Radius.r3,
    padding: Spacing.s4,
  },
  folderName: {
    ...Type.headline,
    fontWeight: Weight.semibold,
    color: Colors.text,
  },
});
