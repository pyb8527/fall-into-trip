import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, query } from '@/api/client';
import type { AuditEntry, PageView } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { Spacing } from '@/constants/theme';
import {
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Empty,
  ErrorNote,
  Field,
  Loading,
  Row,
  Screen,
  Title,
} from '@/ui';

/**
 * 감사 로그.
 *
 * 기간은 from 이상 to 미만입니다. 날짜만 넣으면 그날 0시(UTC)로 봅니다.
 */
export default function AdminAudit() {
  const [action, setAction] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  /* 입력칸을 고칠 때마다 부르지 않고, 적용을 눌렀을 때만 보냅니다. */
  const [applied, setApplied] = useState({ userId: '', from: '', to: '' });
  const [page, setPage] = useState(0);

  const actions = useAsync<{ actions: string[] }>(
    (signal) => api.get('/api/admin/audit/actions', signal),
    [],
  );

  const { data, error, loading, reload } = useAsync<PageView<AuditEntry>>(
    (signal) =>
      api.get(
        `/api/admin/audit${query({
          action,
          userId: applied.userId,
          from: applied.from,
          to: applied.to,
          page,
          size: 20,
        })}`,
        signal,
      ),
    [action, applied, page],
  );

  function apply() {
    setApplied({ userId: userId.trim(), from: from.trim(), to: to.trim() });
    setPage(0);
  }

  return (
    <Screen>
      <Title>감사 로그</Title>

      <Card>
        <Row gap={Spacing.xs}>
          <Chip
            label="전체"
            selected={action === null}
            onPress={() => {
              setAction(null);
              setPage(0);
            }}
          />
          {actions.data?.actions.map((a) => (
            <Chip
              key={a}
              label={a}
              selected={action === a}
              onPress={() => {
                setAction(a);
                setPage(0);
              }}
            />
          ))}
        </Row>

        <Field
          label="계정 ID"
          value={userId}
          onChangeText={setUserId}
          placeholder="비우면 전체"
          autoCapitalize="none"
        />
        <Row gap={Spacing.sm}>
          <View style={styles.half}>
            <Field label="시작" value={from} onChangeText={setFrom} placeholder="2026-09-01" autoCapitalize="none" />
          </View>
          <View style={styles.half}>
            <Field label="끝(미만)" value={to} onChangeText={setTo} placeholder="2026-09-08" autoCapitalize="none" />
          </View>
        </Row>
        <Button label="적용" variant="secondary" onPress={apply} />
      </Card>

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data && data.items.length === 0 ? <Empty message="조건에 맞는 기록이 없습니다." /> : null}

      {data?.items.map((entry) => (
        <EntryCard key={entry.id} entry={entry} />
      ))}

      {data && data.totalPages > 1 ? (
        <Row style={styles.pager}>
          <Button
            label="이전"
            variant="secondary"
            compact
            disabled={page === 0}
            onPress={() => setPage((p) => Math.max(0, p - 1))}
          />
          <Caption>
            {data.page + 1} / {data.totalPages} · 전체 {data.total.toLocaleString()}
          </Caption>
          <Button
            label="다음"
            variant="secondary"
            compact
            disabled={page >= data.totalPages - 1}
            onPress={() => setPage((p) => p + 1)}
          />
        </Row>
      ) : null}
    </Screen>
  );
}

function EntryCard({ entry }: { entry: AuditEntry }) {
  return (
    <Card>
      <Row style={styles.head}>
        <Body>{entry.action}</Body>
        <Caption>{formatAt(entry.at)}</Caption>
      </Row>
      <Caption tone="secondary">
        {entry.userName ?? (entry.userId ? '(지워진 계정)' : '(시스템)')}
        {entry.userId ? ` · ${entry.userId}` : ''}
      </Caption>
      {entry.target ? <Caption>대상 {entry.target}</Caption> : null}
      {entry.detail ? <Caption tone="muted">{summarize(entry.detail)}</Caption> : null}
    </Card>
  );
}

/** 시각을 사람이 읽는 자리 시간대로 보여 줍니다. 저장은 UTC 입니다. */
function formatAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString();
}

/** detail 은 자유로운 JSON 입니다. 한 줄로 눌러 보여 줍니다. */
function summarize(detail: Record<string, unknown>) {
  return Object.entries(detail)
    .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join(' · ');
}

const styles = StyleSheet.create({
  head: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  half: {
    flexGrow: 1,
    flexBasis: 120,
  },
  pager: {
    justifyContent: 'space-between',
  },
});
