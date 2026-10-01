import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, query, UNEXPECTED } from '@/api/client';
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
  ConfirmDialog,
  Empty,
  ErrorNote,
  Field,
  Loading,
  Pager,
  Row,
  Screen,
  Split,
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

      {data && data.items.length === 0 ? <Empty message="조건에 맞는 계정이 없어요." /> : null}

      {data?.items.map((u) => (
        <UserCard key={u.id} user={u} onChanged={reload} />
      ))}

      <Pager
        page={data?.page ?? 0}
        totalPages={data?.totalPages ?? 0}
        total={data?.total}
        onPage={setPage}
      />
    </Screen>
  );
}

/** 창이 물을 것 하나. */
type Ask = {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  act: () => void;
};

function UserCard({ user, onChanged }: { user: AdminUser; onChanged: () => void }) {
  const { user: me } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  /*
    묻는 창 하나가 넷을 받습니다.

    <p>네 단추가 저마다 그 자리에서 [정말 ○○ / 취소] 로 바뀌었습니다. 단추
    다섯이 붙어 있는 줄에서 하나가 둘로 늘어나면 줄이 접히면서 옆 단추들이
    자리를 옮깁니다 — 묻는 말을 읽는 동안 누를 자리가 움직였고, 바뀐 글자가
    바로 손가락 아래 있어서 연달아 누르면 묻는 것이 그냥 지나갔습니다.

    <p>창에는 누구에게 무엇을 하는지 이름까지 적을 자리가 있습니다. 「삭제」
    만 눌러서는 이 사람의 여행까지 사라지는 것을 알 수 없습니다.
  */
  const [asking, setAsking] = useState<Ask | null>(null);

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
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Split align="start">
        <View style={styles.name}>
          <Subtitle>{user.name}</Subtitle>
          <Caption tone="secondary">{user.email}</Caption>
        </View>
        <Row gap={Spacing.xs}>
          {isMe ? <Badge label="나" tone="accent" /> : null}
          {user.role === 'ADMIN' ? <Badge label="운영자" tone="accent" /> : null}
          {user.disabled ? <Badge label="잠김" tone="danger" /> : null}
        </Row>
      </Split>

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
          <Button
            label="운영자 해제"
            variant="secondary"
            compact
            busy={busy}
            onPress={() =>
              setAsking({
                title: '운영자에서 내릴까요?',
                message: `${user.name} 님이 운영 화면에 더 들어올 수 없게 돼요. 다시 올릴 수 있어요.`,
                confirmLabel: '해제',
                act: () =>
                  run(() => api.patch(`/api/admin/users/${user.id}/role`, { role: 'MEMBER' })),
              })
            }
          />
        ) : (
          <Button
            label="운영자로"
            variant="secondary"
            compact
            busy={busy}
            onPress={() =>
              setAsking({
                title: '운영자로 올릴까요?',
                message: `${user.name} 님이 모든 계정과 신고된 글을 다룰 수 있게 돼요.`,
                confirmLabel: '올리기',
                act: () =>
                  run(() => api.patch(`/api/admin/users/${user.id}/role`, { role: 'ADMIN' })),
              })
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
          <Button
            label="잠그기"
            variant="dangerText"
            compact
            busy={busy}
            onPress={() =>
              setAsking({
                title: '이 계정을 잠글까요?',
                message: `${user.name} 님이 로그인할 수 없게 되고 열려 있던 세션도 끊겨요. 다시 풀 수 있어요.`,
                confirmLabel: '잠그기',
                danger: true,
                act: () =>
                  run(() =>
                    api.patch(`/api/admin/users/${user.id}/disabled`, { disabled: true }),
                  ),
              })
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
            run(() => api.post(`/api/admin/users/${user.id}/logout`), '모든 기기에서 내보냈어요.')
          }
        />

        <Button
          label="비밀번호 재설정"
          variant="secondary"
          compact
          onPress={() => setResetting((v) => !v)}
        />

        <Button
          label="삭제"
          variant="dangerText"
          compact
          busy={busy}
          onPress={() =>
            setAsking({
              title: '이 계정을 지울까요?',
              message: `${user.name}(${user.email}) 님의 계정이 사라져요. 소유한 여행 ${user.ownedTrips}개도 함께 사라지고, 되돌릴 수 없어요.`,
              confirmLabel: '지우기',
              danger: true,
              act: () => run(() => api.delete(`/api/admin/users/${user.id}`)),
            })
          }
        />
      </Row>

      {resetting ? (
        <>
          <Field
            label="새 비밀번호"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            hint="8자 이상. 설정하면 이 계정의 모든 세션이 끊기고, 감사 로그에 남아요."
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
                }, '비밀번호를 바꿨어요. 본인에게 직접 전달해 주세요.')
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

      <ConfirmDialog
        visible={asking !== null}
        title={asking?.title ?? ''}
        message={asking?.message}
        confirmLabel={asking?.confirmLabel}
        danger={asking?.danger}
        busy={busy}
        onCancel={() => setAsking(null)}
        onConfirm={() => {
          const ask = asking;
          setAsking(null);
          ask?.act();
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  name: {
    flexShrink: 1,
    gap: 2,
  },
});
