import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { AdminStats } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  Body,
  Button,
  Caption,
  Card,
  Divider,
  ErrorNote,
  ListRow,
  Loading,
  Row,
  Screen,
  Subtitle,
  Title,
} from '@/ui';

export default function AdminHome() {
  const router = useRouter();
  const { data, error, loading, reload } = useAsync<AdminStats>(
    (signal) => api.get('/api/admin/stats', signal),
    [],
  );

  return (
    <Screen>
      <Title>운영</Title>

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data ? (
        <>
          <Card>
            <Subtitle>계정</Subtitle>
            <Row gap={Spacing.sm}>
              <Stat label="전체" value={data.users} />
              <Stat label="운영자" value={data.admins} tone="accent" />
              <Stat
                label="잠김"
                value={data.disabledUsers}
                tone={data.disabledUsers > 0 ? 'danger' : 'muted'}
              />
            </Row>
          </Card>

          <Card>
            <Subtitle>쌓인 것</Subtitle>
            <Row gap={Spacing.sm}>
              <Stat label="여행" value={data.trips} />
              <Stat label="장소" value={data.places} />
              <Stat label="지출" value={data.expenses} />
            </Row>
          </Card>

          <Card>
            <Subtitle>최근 24시간</Subtitle>
            <Body tone="secondary">활동 {data.auditLast24h.toLocaleString()}건</Body>
            {Object.keys(data.topActions).length === 0 ? (
              <Caption>기록된 활동이 없습니다.</Caption>
            ) : (
              <>
                <Divider />
                {Object.entries(data.topActions).map(([action, count]) => (
                  <Row key={action} style={styles.actionRow}>
                    <Caption tone="secondary">{action}</Caption>
                    <Caption strong>{count.toLocaleString()}</Caption>
                  </Row>
                ))}
              </>
            )}
          </Card>
        </>
      ) : null}

      <ListRow
        title="계정 관리"
        subtitle="검색·권한·잠금·비밀번호 재설정"
        onPress={() => router.push('/admin/users')}
      />
      <ListRow
        title="감사 로그"
        subtitle="누가 무엇을 했는지"
        onPress={() => router.push('/admin/audit')}
      />

      <Button label="처음으로" variant="ghost" onPress={() => router.push('/(app)/home')} />
    </Screen>
  );
}

/** 숫자 하나를 크게. 나란히 놓아 서로 견줄 수 있게 폭을 같이 나눠 씁니다. */
function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'accent' | 'danger' | 'muted';
}) {
  const color = {
    default: Colors.text,
    accent: Colors.accent,
    danger: Colors.danger,
    muted: Colors.text,
  }[tone];

  return (
    <View style={styles.stat}>
      <Caption tone="muted">{label}</Caption>
      <Body strong style={{ color }}>
        {value.toLocaleString()}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: {
    flexGrow: 1,
    flexBasis: 80,
    backgroundColor: Colors.fill,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  actionRow: {
    justifyContent: 'space-between',
  },
});
