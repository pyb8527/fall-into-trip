import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Folder, TripSummary } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { TripMark } from '@/components/trip-mark';
import { FolderSheet } from '@/components/folder-sheet';
import { TripForm } from '@/components/trip-form';
import { Colors, Gutter, Radius, Spacing, Type, Weight } from '@/constants/theme';
import { countdownIsNear, countdownLabel, countdownOf, formatNights, formatSpan, todayIso } from '@/lib/countdown';
import {
  Badge,
  Band,
  BottomSheet,
  Button,
  Caption,
  ConfirmDialog,
  Empty,
  ErrorNote,
  Field,
  Icon,
  IconButton,
  ListRow,
  Loading,
  Press,
  Row,
  Screen,
  SearchField,
  SegmentedTabs,
  Split,
} from '@/ui';
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
type Whose = 'solo' | 'group';

const WHOSE: { value: Whose; label: string }[] = [
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
  const [whose, setWhose] = useState<Whose>('solo');
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
  /*
    찾는 칸을 접어 둡니다.

    <p>안내 한 줄과 찾기 칸을 흰 카드에 담아 목록 위에 늘 세워 두었습니다.
    그런데 찾는 일은 <b>가끔 한 번</b>이고, 이 화면을 여는 대부분의 경우는
    목록을 보러 오는 것입니다 — 늘 서 있는 칸이 여행 한 줄을 영영 아래로
    밀고 있었습니다.

    <p>막대 오른쪽의 돋보기가 칸을 엽니다. 닫으면 친 말도 함께 지웁니다 —
    접힌 칸에 글이 남아 있으면 목록이 왜 짧아졌는지 알 수 없습니다.
  */
  const [searching, setSearching] = useState(false);

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
      hasGroupTrips
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
      /* 주 동작은 아래에 붙입니다. 한 손으로 쥐었을 때 엄지가 닿는 자리입니다. */
      footer={<Button label="새 여행 만들기" onPress={() => setCreating(true)} />}>
      {/*
        돋보기는 막대 오른쪽에.

        <p>막대는 이 층(_layout)이 만들어 주는데, 화면마다 더 달 것이 있으면
        이렇게 덧붙입니다 — 여행 상세와 가계부도 같은 방식으로 제목을
        바꿔 답니다.

        <p>몇 개 안 될 때는 안 답니다. 다섯 줄을 눈으로 훑는 것이 치는 것보다
        빠릅니다.
      */}
      <Stack.Screen
        options={{
          /* 조건은 안쪽에서 가립니다. 이 줄 자체를 조건으로 두면, 여행이
             다섯 아래로 줄어들 때 막대에 돋보기가 그대로 남습니다 — 안
             그려진 것은 옛 값을 지우지도 못합니다. */
          headerRight:
            all.length > 4
              ? () => (
                  <IconButton
                    name={searching ? 'x' : 'search'}
                    label={searching ? '찾기 닫기' : '여행 찾기'}
                    bare
                    onPress={() => {
                      setSearching((was) => !was);
                      setQ('');
                    }}
                  />
                )
              : undefined,
        }}
      />

      {/* 무엇 때문에 고르는 중인지. 여느 때는 말할 것이 없습니다. */}
      {goal === 'money' ? (
        <Caption tone="secondary">어느 여행의 가계부를 볼까요?</Caption>
      ) : null}

      {searching ? (
        <SearchField
          label="여행 찾기"
          value={q}
          onChangeText={setQ}
          placeholder="오사카, 제주"
        />
      ) : null}

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {/*
        혼자와 모임.

        <p>묶기 띠(일정순·폴더별) <b>위에</b> 섭니다. 먼저 가르는 것이
        이쪽이라 아래에 두면 묶기를 고친 뒤에 다시 칸을 고르게 됩니다.
      */}
      {data && hasGroupTrips ? (
        <SegmentedTabs items={WHOSE} value={whose} onChange={setWhose} />
      ) : null}

      {data && all.length === 0 ? (
        <Empty
          message={
            !hasGroupTrips
              ? '아직 그려 둔 여행이 없어요. 아래에서 첫 줄을 그어 보세요.'
              : whose === 'group'
                ? '모임에서 짠 여행이 아직 없어요.'
                : '혼자 짜 둔 여행이 없어요.'
          }
        />
      ) : null}
      {data && all.length > 0 && trips.length === 0 ? (
        <Empty message={`"${q.trim()}" 로는 찾은 것이 없어요.`} />
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
        <>
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
        </>
      ) : null}

      {/*
        묶음을 카드에서 꺼냈습니다.

        <p>묶음마다 흰 카드 한 장이었습니다. 바닥이 흰색이 되면서 그 카드는
        바닥에 녹아 없어졌고, 옅은 그림자만 남아 화면이 흐릿해졌습니다.

        <p>묶음 사이는 <b>회색 띠</b>가 가릅니다. 제목은 띠 아래에 작게
        앉습니다 — 제목은 묶음의 이름이고, 읽는 것은 그 아래 여행 이름들
        입니다.
      */}
      {sections.map((section, at) => (
        <View key={section.title}>
          {at > 0 ? <Band /> : null}
          <Split align="baseline" style={styles.bunchHead}>
            <Text style={styles.bunchTitle}>{section.title}</Text>
            <Caption tone="muted">{section.trips.length}</Caption>
          </Split>
          {section.trips.map((trip) => (
            <TripRow
              key={trip.id}
              trip={trip}
              showGroup={manyGroups}
              onOpen={() => open(trip.id)}
              onFolder={() => setActing(trip)}
            />
          ))}
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
      {data && everything.length > 0 ? (
        <>
          <Band />
          <ListRow
            left={<Icon name="credit-card" size={24} tone="secondary" />}
            title="가계부 모아 보기"
            subtitle="여행마다 얼마 썼는지 한 자리에서"
            right={<Icon name="chevron-right" size={20} tone="muted" />}
            onPress={() => router.push('/(app)/money')}
          />
        </>
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
            <Empty message="이 폴더는 아직 비어 있어요." />
          ) : null}
          {inFolder(opened).map((trip) => (
              <TripRow
                key={trip.id}
                trip={trip}
                showGroup={manyGroups}
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
  onOpen,
  onFolder,
}: {
  trip: TripSummary;
  /** 모임 이름을 달지. 모임이 둘 이상일 때만 뜻이 있습니다. */
  showGroup?: boolean;
  onOpen: () => void;
  /** 폴더에 넣는 단추. 폴더를 다루지 않는 자리에서는 넘기지 않습니다. */
  onFolder?: () => void;
}) {
  return (
    <ListRow
      left={<TripMark theme={trip.theme} emoji={trip.emoji} />}
      title={trip.title}
      subtitle={`${formatSpan(trip.startIso, trip.endIso)} · ${formatNights(trip.dayCount)} · 장소 ${trip.placeCount}곳`}
      /* 안 줄어드는 자리입니다. 줄어들 수 있게 두면 제목이 아니라 이쪽이
         버티면서 제목만 한 글자로 눌립니다 — 그 반대여야 합니다. */
      right={
        <Row gap={Spacing.s1} style={styles.tail}>
          {countdownBadge(trip.startIso, trip.endIso)}
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

/**
 * 며칠 남았는지, 뱃지로.
 *
 * <p>목록에서 가장 먼저 보고 싶은 것입니다. 날짜를 읽고 오늘과 견주는 일을
 * 사람이 하게 두면, 그것만으로 목록을 훑는 데 시간이 걸립니다.
 *
 * <p>세는 일은 <code>lib/countdown</code> 이 합니다. 홈도 같은 답을 써야
 * 하는데, 같은 셈을 각자 들고 있으면 한쪽만 고치는 날이 옵니다. 여기서는
 * 그 답을 뱃지로 그리는 일만 합니다.
 *
 * <p>여행 중은 초록입니다. 남은 날과 다른 종류의 소식이라 색으로 가릅니다.
 */
function countdownBadge(startIso: string | null, endIso: string | null) {
  const at = countdownOf(startIso, endIso);
  if (!at) {
    return null;
  }
  return (
    <Badge
      label={countdownLabel(at)}
      tone={at.kind === 'going' ? 'success' : countdownIsNear(at) ? 'accent' : 'muted'}
    />
  );
}

/*
  한 묶음과 그 안의 여행들.

  <p>Section 이라 불렀는데 화면의 Section(흰 판)과 겹쳤고, Group 은 이미
  「무엇으로 묶을지」(when·folder)가 쓰고 있습니다. 묶인 결과라서 Bunch 입니다.
*/
type Bunch = { title: string; trips: TripSummary[] };

/**
 * 일정으로 나눕니다.
 *
 * <p>대개 궁금한 것은 다음 여행이므로 가는 중과 다가올 것이 위에 옵니다.
 * 다녀온 것은 최근에 다녀온 것부터 — 지난 여행을 볼 때는 대개 방금 다녀온
 * 것을 찾습니다.
 *
 * <p>날짜가 없는 여행은 아직 짜는 중인 것이라 다가올 쪽에 둡니다.
 */
function byWhen(trips: TripSummary[]): Bunch[] {
  const today = todayIso();
  const going: TripSummary[] = [];
  const coming: TripSummary[] = [];
  const done: TripSummary[] = [];

  for (const trip of trips) {
    const start = trip.startIso;
    const end = trip.endIso ?? trip.startIso;
    if (!start) {
      coming.push(trip);
    } else if (end && end < today) {
      done.push(trip);
    } else if (start <= today) {
      going.push(trip);
    } else {
      coming.push(trip);
    }
  }

  coming.sort((a, b) => (a.startIso ?? '9999').localeCompare(b.startIso ?? '9999'));
  done.sort((a, b) => (b.endIso ?? '').localeCompare(a.endIso ?? ''));

  return [
    { title: '지금 그 길 위', trips: going },
    { title: '곧 떠나요', trips: coming },
    { title: '다녀왔어요', trips: done },
  ].filter((s) => s.trips.length > 0);
}


const styles = StyleSheet.create({
  /* 되돌릴 수 없는 줄. 빨간 글씨 하나로 말합니다 — 면을 칠하면 그 줄이
     주 동작처럼 보입니다. */
  dangerRow: {
    ...Type.headline,
    fontWeight: Weight.semibold,
    color: Colors.danger,
  },
  /*
    묶음의 이름.

    <p>위는 띠가 이미 띄워 놓았으므로 아래만 좁힙니다 — 제목은 아래 것의
    이름이라 아래와 가까워야 합니다.
  */
  bunchHead: {
    paddingBottom: Spacing.s1,
  },
  bunchTitle: {
    ...Type.caption,
    fontWeight: Weight.semibold,
    color: Colors.textSecondary,
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
