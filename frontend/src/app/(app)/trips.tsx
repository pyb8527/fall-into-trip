import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { Folder, TripSummary } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { FolderSheet } from '@/components/folder-sheet';
import { TripForm } from '@/components/trip-form';
import { Spacing } from '@/constants/theme';
import {
  Badge,
  Body,
  Button,
  Caption,
  Empty,
  ErrorNote,
  IconButton,
  ListRow,
  Loading,
  Row,
  Screen,
  SegmentedTabs,
  Subtitle,
  Title,
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

export default function Trips() {
  const { user } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
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

  const sections = useMemo(
    () => (group === 'when' ? byWhen(data?.trips ?? []) : byFolder(data?.trips ?? [], folderData?.folders ?? [])),
    [group, data, folderData],
  );

  return (
    <Screen
      safeTop
      /* 주 동작은 아래에 붙입니다. 한 손으로 쥐었을 때 엄지가 닿는 자리입니다. */
      footer={<Button label="새 여행 만들기" onPress={() => setCreating(true)} />}>
      <View style={styles.headText}>
        <Title>내 여행</Title>
        <Body tone="secondary">{user?.name ? `${user.name} 님의 일정` : '함께 짜는 일정'}</Body>
      </View>

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data && data.trips.length === 0 ? (
        <Empty message="아직 여행이 없습니다. 아래에서 하나 만들어 보세요." />
      ) : null}

      {data && data.trips.length > 1 ? (
        <SegmentedTabs items={GROUPS} value={group} onChange={setGroup} />
      ) : null}

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Row style={styles.sectionHead}>
            <Subtitle>{section.title}</Subtitle>
            <Caption tone="secondary">{section.trips.length}</Caption>
          </Row>

          {section.trips.map((trip) => (
            <Row key={trip.id} style={styles.row}>
              <View style={styles.grow}>
                <ListRow
                  title={trip.title}
                  subtitle={`${formatRange(trip.startIso, trip.endIso)} · ${trip.dayCount}일 · 장소 ${trip.placeCount}곳`}
                  right={
                    trip.ownerId === user?.id ? (
                      <Badge label="내 여행" tone="accent" />
                    ) : (
                      <Badge label="동행" tone="muted" />
                    )
                  }
                  onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
                />
              </View>
              <IconButton
                name="folder"
                label={`${trip.title} 폴더에 넣기`}
                onPress={() => setPlacing(trip)}
              />
            </Row>
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
    { title: '가는 중', trips: going },
    { title: '다가올 여행', trips: coming },
    { title: '다녀온 여행', trips: done },
  ].filter((s) => s.trips.length > 0);
}

/** 폴더로 나눕니다. 안 넣은 것은 맨 아래에 모읍니다. */
function byFolder(trips: TripSummary[], folders: Folder[]): Section[] {
  const sections: Section[] = folders.map((folder) => ({
    title: folder.name,
    trips: trips.filter((t) => t.folderId === folder.id),
  }));
  const loose = trips.filter((t) => !t.folderId);
  if (loose.length > 0) {
    sections.push({ title: '폴더 없음', trips: loose });
  }
  return sections.filter((s) => s.trips.length > 0);
}

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function formatRange(start: string | null, end: string | null) {
  if (!start) {
    return '날짜 미정';
  }
  if (!end || end === start) {
    return start;
  }
  return `${start} ~ ${end}`;
}

const styles = StyleSheet.create({
  headText: {
    gap: Spacing.xs,
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
