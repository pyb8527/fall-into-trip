import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { Folder, TripSummary } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { FolderSheet } from '@/components/folder-sheet';
import { TripForm } from '@/components/trip-form';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  Badge,
  Body,
  BottomSheet,
  Button,
  Caption,
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
  SegmentedTabs,
  Subtitle,
} from '@/ui';

/**
 * 내 여행.
 *
 * <p>여행이 쌓이면 그냥 늘어놓는 것만으로는 다음 여행을 찾기 어려워집니다.
 * 두 가지로 나눠 볼 수 있게 합니다.
 *
 * <ul>
 *   <li><b>일정순</b> — 가는 중 · 다가올 · 다녀온. 대개 궁금한 것은 다음
 *       여행이라 그것이 맨 위에 옵니다.</li>
 *   <li><b>폴더별</b> — 자기가 묶은 대로. 폴더는 보는 사람 것이라 같이 간
 *       사람에게는 안 보입니다.</li>
 * </ul>
 */
type Group = 'when' | 'folder';

const GROUPS: { value: Group; label: string }[] = [
  { value: 'when', label: '일정순' },
  { value: 'folder', label: '폴더별' },
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
  const [group, setGroup] = useState<Group>('when');
  const [placing, setPlacing] = useState<TripSummary | null>(null);

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

  const all = useMemo(() => data?.trips ?? [], [data]);
  const trips = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? all.filter((t) => t.title.toLowerCase().includes(needle)) : all;
  }, [all, q]);
  const folders = useMemo(() => folderData?.folders ?? [], [folderData]);

  const sections = useMemo(() => (group === 'when' ? byWhen(trips) : []), [group, trips]);

  /** 어느 폴더에도 안 넣은 것. 폴더별로 볼 때 아래에 따로 모읍니다. */
  const loose = useMemo(() => trips.filter((t) => !t.folderId), [trips]);

  return (
    <Screen
      safeTop
      /* 주 동작은 아래에 붙입니다. 한 손으로 쥐었을 때 엄지가 닿는 자리입니다. */
      footer={<Button label="새 여행 만들기" onPress={() => setCreating(true)} />}>
      {/* 무엇 때문에 고르는 중인지. 여느 때는 말할 것이 없습니다. */}
      {goal === 'money' ? (
        <Caption tone="secondary">어느 여행의 가계부를 볼까요?</Caption>
      ) : null}

      {/* 몇 개 안 될 때는 찾을 것이 없습니다. 칸만 자리를 차지합니다. */}
      {all.length > 4 ? (
        <Field
          label="여행 찾기"
          value={q}
          onChangeText={setQ}
          placeholder="오사카, 제주"
          returnKeyType="search"
          action={{ icon: 'search', label: '여행 찾기', onPress: () => {} }}
        />
      ) : null}

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data && all.length === 0 ? (
        <Empty message="아직 그려 둔 여행이 없습니다. 아래에서 첫 줄을 그어 보세요." />
      ) : null}
      {data && all.length > 0 && trips.length === 0 ? (
        <Empty message={`"${q.trim()}" 로는 찾은 것이 없습니다.`} />
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
          {folders.length === 0 ? (
            <Empty message="아직 폴더가 없습니다. 폴더별로 볼 때 여행 오른쪽의 폴더 단추로 만듭니다." />
          ) : null}

          <Row gap={Spacing.sm} style={styles.shelf}>
            {folders.map((folder) => (
              <Press
                key={folder.id}
                onPress={() => setOpened(folder)}
                scale={0.96}
                accessibilityLabel={`${folder.name} 폴더 열기`}
                style={styles.folder}>
                <Icon name="folder" size={28} tone="accent" />
                <Body small strong numberOfLines={1}>
                  {folder.name}
                </Body>
                <Caption tone="muted">{folder.tripCount}개</Caption>
              </Press>
            ))}
          </Row>

          {loose.length > 0 ? (
            <View style={styles.section}>
              <Row style={styles.sectionHead}>
                <Subtitle>폴더 없음</Subtitle>
                <Caption tone="secondary">{loose.length}</Caption>
              </Row>
              {loose.map((trip) => (
                <TripRow
                  key={trip.id}
                  trip={trip}
                  mine={trip.ownerId === user?.id}
                  onOpen={() => open(trip.id)}
                  onFolder={() => setPlacing(trip)}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Row style={styles.sectionHead}>
            <Subtitle>{section.title}</Subtitle>
            <Caption tone="secondary">{section.trips.length}</Caption>
          </Row>

          {section.trips.map((trip) => (
            <TripRow
              key={trip.id}
              trip={trip}
              mine={trip.ownerId === user?.id}
              onOpen={() => open(trip.id)}
            />
          ))}
        </View>
      ))}

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
          {trips.filter((t) => t.folderId === opened.id).length === 0 ? (
            <Empty message="이 폴더는 아직 비어 있습니다." />
          ) : null}
          {trips
            .filter((t) => t.folderId === opened.id)
            .map((trip) => (
              <TripRow
                key={trip.id}
                trip={trip}
                mine={trip.ownerId === user?.id}
                onOpen={() => {
                  setOpened(null);
                  router.push({ pathname: '/trip/[id]', params: { id: trip.id } });
                }}
                onFolder={() => {
                  setOpened(null);
                  setPlacing(trip);
                }}
              />
            ))}
        </BottomSheet>
      ) : null}

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
 * <p>"내 여행" 표는 달지 않습니다. 대개가 내 여행이라 거의 모든 줄에 같은 표가
 * 붙어 아무것도 구별해 주지 못했습니다. 남의 여행에 끼어 있는 것만 표시합니다.
 */
function TripRow({
  trip,
  mine,
  onOpen,
  onFolder,
}: {
  trip: TripSummary;
  mine: boolean;
  onOpen: () => void;
  /** 폴더에 넣는 단추. 폴더를 다루지 않는 자리에서는 넘기지 않습니다. */
  onFolder?: () => void;
}) {
  return (
    <Row style={styles.row}>
      <View style={styles.grow}>
        <ListRow
          title={trip.title}
          subtitle={`${formatRange(trip.startIso, trip.endIso)} · ${trip.dayCount}일 · 장소 ${trip.placeCount}곳`}
          right={
            <Row gap={Spacing.xs}>
              {countdownOf(trip.startIso, trip.endIso)}
              {mine ? null : <Badge label="동행" tone="muted" />}
            </Row>
          }
          onPress={onOpen}
        />
      </View>
      {/* 일정순으로 볼 때는 폴더를 다루는 자리가 아닙니다. 줄마다 폴더
          단추가 서 있으면 무엇을 하는 화면인지 흐려지고, 이름이 그만큼
          좁아집니다. 폴더별로 볼 때만 냅니다. */}
      {onFolder ? (
        <IconButton name="folder" label={`${trip.title} 폴더에 넣기`} onPress={onFolder} />
      ) : null}
    </Row>
  );
}

/**
 * 며칠 남았는지.
 *
 * <p>목록에서 가장 먼저 보고 싶은 것입니다. 날짜를 읽고 오늘과 견주는 일을
 * 사람이 하게 두면, 그것만으로 목록을 훑는 데 시간이 걸립니다.
 *
 * <p>다녀온 여행에는 안 붙입니다. "D+40" 은 알아서 뭐 하나 싶은 값입니다.
 */
function countdownOf(startIso: string | null, endIso: string | null) {
  if (!startIso) {
    return null;
  }
  const today = todayIso();
  const end = endIso ?? startIso;

  if (end < today) {
    return null;
  }
  if (startIso <= today) {
    return <Badge label="여행 중" tone="success" />;
  }

  const left = daysBetween(today, startIso);
  return <Badge label={left === 0 ? '내일' : `D-${left}`} tone={left <= 7 ? 'accent' : 'muted'} />;
}

/** 두 날짜 사이의 날 수. 자정을 기준으로 세므로 시각은 보지 않습니다. */
function daysBetween(from: string, to: string) {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000) - 1);
}

type Section = { title: string; trips: TripSummary[] };

/**
 * 일정으로 나눕니다.
 *
 * <p>대개 궁금한 것은 다음 여행이므로 가는 중과 다가올 것이 위에 옵니다.
 * 다녀온 것은 최근에 다녀온 것부터 — 지난 여행을 볼 때는 대개 방금 다녀온
 * 것을 찾습니다.
 *
 * <p>날짜가 없는 여행은 아직 짜는 중인 것이라 다가올 쪽에 둡니다.
 */
function byWhen(trips: TripSummary[]): Section[] {
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
    { title: '곧 떠납니다', trips: coming },
    { title: '다녀왔습니다', trips: done },
  ].filter((s) => s.trips.length > 0);
}

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function formatRange(start: string | null, end: string | null) {
  if (!start) {
    return '아직 날짜 없음';
  }
  if (!end || end === start) {
    return start;
  }
  return `${start} ~ ${end}`;
}

const styles = StyleSheet.create({
  /* 폴더를 늘어놓는 선반. 좁은 폰에서는 두 칸, 넓으면 더 들어갑니다. */
  shelf: {
    alignItems: 'stretch',
  },
  folder: {
    flexGrow: 1,
    flexBasis: 104,
    maxWidth: 160,
    alignItems: 'flex-start',
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: Radius.none,
    padding: Spacing.lg,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHead: {
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  row: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  grow: {
    flex: 1,
  },
});
