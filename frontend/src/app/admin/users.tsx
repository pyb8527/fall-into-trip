import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, query } from '@/api/client';
import type { AdminUser, PageView, Role } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  ConfirmButton,
  Empty,
  ErrorNote,
  Field,
  Loading,
  Row,
  Screen,
  Subtitle,
  Title,
} from '@/ui';

type Filter = 'all' | 'admin' | 'member' | 'locked';

const FILTERS: { key: Filter; label: string; params: { role?: Role; disabled?: boolean } }[] = [
  { key: 'all', label: '전체', params: {} },
  { key: 'admin', label: '운영자', params: { role: 'ADMIN' } },
  { key: 'member', label: '회원', params: { role: 'MEMBER' } },
  { key: 'locked', label: '잠김', params: { disabled: true } },
];

export default function AdminUsers() {
  const [text, setText] = useState('');
  /* 글자를 칠 때마다 부르면 요청이 쏟아집니다. 확인 버튼으로만 보냅니다. */
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);

  const params = FILTERS.find((f) => f.key === filter)!.params;
  const { data, error, loading, reload } = useAsync<PageView<AdminUser>>(
    (signal) =>
      api.get(
        `/api/admin/users${query({ q, role: params.role, disabled: params.disabled, page, size: 20 })}`,
        signal,
      ),
    [q, filter, page],
  );

  function apply(next: Filter) {
    setFilter(next);
    setPage(0);
  }

  return (
    <Screen>
      <Title>계정 관리</Title>

      <Card>
        <Field
          label="검색"
          value={text}
          onChangeText={setText}
          placeholder="이메일 또는 이름"
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={() => {
            setQ(text.trim());
            setPage(0);
          }}
        />
        <Row gap={Spacing.xs}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => apply(f.key)} />
          ))}
        </Row>
      </Card>

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data && data.items.length === 0 ? <Empty message="조건에 맞는 계정이 없습니다." /> : null}

      {data?.items.map((u) => (
        <UserCard key={u.id} user={u} onChanged={reload} />
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

function UserCard({ user, onChanged }: { user: AdminUser; onChanged: () => void }) {
  const { user: me } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const isMe = me?.id === user.id;

  async function run(action: () => Promise<unknown>, done?: string) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await action();
      if (done) {
        setNotice(done);
      }
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '처리하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Row style={styles.head}>
        <View style={styles.name}>
          <Subtitle>{user.name}</Subtitle>
          <Caption tone="secondary">{user.email}</Caption>
        </View>
        <Row gap={Spacing.xs}>
          {isMe ? <Badge label="나" tone="accent" /> : null}
          {user.role === 'ADMIN' ? <Badge label="운영자" tone="accent" /> : null}
          {user.disabled ? <Badge label="잠김" tone="danger" /> : null}
        </Row>
      </Row>

      <Row gap={Spacing.md}>
        <Caption>가입 {user.createdAt.slice(0, 10)}</Caption>
        <Caption>마지막 로그인 {user.lastLoginAt ? user.lastLoginAt.slice(0, 10) : '없음'}</Caption>
      </Row>
      <Row gap={Spacing.md}>
        <Caption>소유 여행 {user.ownedTrips}</Caption>
        <Caption tone={user.activeSessions > 0 ? 'success' : 'muted'}>
          로그인 중 {user.activeSessions}
        </Caption>
      </Row>

      {error ? <ErrorNote message={error} /> : null}
      {notice ? <Body tone="success">{notice}</Body> : null}

      <Row gap={Spacing.xs}>
        {user.role === 'ADMIN' ? (
          <ConfirmButton
            label="운영자 해제"
            confirmLabel="정말 해제"
            variant="secondary"
            busy={busy}
            onConfirm={() =>
              run(() => api.patch(`/api/admin/users/${user.id}/role`, { role: 'MEMBER' }))
            }
          />
        ) : (
          <ConfirmButton
            label="운영자로"
            confirmLabel="정말 올리기"
            variant="secondary"
            busy={busy}
            onConfirm={() =>
              run(() => api.patch(`/api/admin/users/${user.id}/role`, { role: 'ADMIN' }))
            }
          />
        )}

        {user.disabled ? (
          <Button
            label="잠금 해제"
            variant="secondary"
            compact
            busy={busy}
            onPress={() =>
              run(() => api.patch(`/api/admin/users/${user.id}/disabled`, { disabled: false }))
            }
          />
        ) : (
          <ConfirmButton
            label="잠그기"
            confirmLabel="정말 잠그기"
            busy={busy}
            onConfirm={() =>
              run(() => api.patch(`/api/admin/users/${user.id}/disabled`, { disabled: true }))
            }
          />
        )}

        <Button
          label="세션 끊기"
          variant="secondary"
          compact
          busy={busy}
          disabled={user.activeSessions === 0}
          onPress={() =>
            run(() => api.post(`/api/admin/users/${user.id}/logout`), '모든 기기에서 내보냈습니다.')
          }
        />

        <Button
          label="비밀번호 재설정"
          variant="secondary"
          compact
          onPress={() => setResetting((v) => !v)}
        />

        <ConfirmButton
          label="삭제"
          confirmLabel="정말 삭제"
          busy={busy}
          onConfirm={() => run(() => api.delete(`/api/admin/users/${user.id}`))}
        />
      </Row>

      {resetting ? (
        <>
          <Field
            label="새 비밀번호"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            hint="8자 이상. 설정하면 이 계정의 모든 세션이 끊기고, 감사 로그에 남습니다."
          />
          <Row gap={Spacing.sm}>
            <Button
              label="설정"
              compact
              busy={busy}
              disabled={newPassword.length < 8}
              onPress={() =>
                run(async () => {
                  await api.post(`/api/admin/users/${user.id}/password`, { password: newPassword });
                  setNewPassword('');
                  setResetting(false);
                }, '비밀번호를 바꿨습니다. 본인에게 직접 전달해 주세요.')
              }
            />
            <Button
              label="취소"
              variant="ghost"
              compact
              onPress={() => {
                setResetting(false);
                setNewPassword('');
              }}
            />
          </Row>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  name: {
    flexShrink: 1,
    gap: 2,
  },
  pager: {
    justifyContent: 'space-between',
  },
});
