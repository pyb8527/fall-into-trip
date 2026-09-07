import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { AdminStats } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  Body,
  Button,
  Caption,
  Card,
  ErrorNote,
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
          <Row gap={Spacing.two}>
            <Stat label="계정" value={data.users} />
            <Stat label="운영자" value={data.admins} />
            <Stat label="잠긴 계정" value={data.disabledUsers} tone={data.disabledUsers > 0 ? 'warning' : 'muted'} />
          </Row>
          <Row gap={Spacing.two}>
            <Stat label="여행" value={data.trips} />
            <Stat label="장소" value={data.places} />
            <Stat label="지출" value={data.expenses} />
          </Row>

          <Card>
            <Subtitle>최근 24시간</Subtitle>
            <Body tone="secondary">활동 {data.auditLast24h.toLocaleString()}건</Body>
            {Object.keys(data.topActions).length === 0 ? (
              <Caption>기록된 활동이 없습니다.</Caption>
            ) : (
              Object.entries(data.topActions).map(([action, count]) => (
                <Row key={action} style={styles.actionRow}>
                  <Caption tone="secondary">{action}</Caption>
                  <Caption>{count.toLocaleString()}</Caption>
                </Row>
              ))
            )}
          </Card>
        </>
      ) : null}

      <Button label="계정 관리" variant="secondary" onPress={() => router.push('/admin/users')} />
      <Button label="감사 로그" variant="secondary" onPress={() => router.push('/admin/audit')} />
    </Screen>
  );
}

function Stat({
  label,
  value,
  tone = 'muted',
}: {
  label: string;
  value: number;
  tone?: 'muted' | 'warning';
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      <Body>{value.toLocaleString()}</Body>
      <Caption tone={tone === 'warning' ? 'danger' : 'muted'}>{label}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: {
    flexGrow: 1,
    flexBasis: 90,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.small,
    padding: Spacing.two + 2,
    gap: 2,
  },
  actionRow: {
    justifyContent: 'space-between',
  },
});
