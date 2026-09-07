import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, API_BASE, ApiError } from '@/api/client';
import type { Companion, InviteRow, NewInvite, TripRole } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import { shareLink } from '@/lib/share';
import {
  Badge,
  Body,
  BottomSheet,
  Button,
  Caption,
  Chip,
  ConfirmDialog,
  Divider,
  Empty,
  ErrorNote,
  IconButton,
  Loading,
  Row,
  Stepper,
  Subtitle,
} from '@/ui';

/**
 * 동행자와 초대.
 *
 * <p>이메일로 사람을 찾는 길은 서버가 열어 두지 않았습니다. 주인이 링크를
 * 만들어 보내고, 받은 사람이 눌러 들어옵니다. 남의 이메일을 넣어 보며
 * 계정이 있는지 떠보는 일을 막기 위해서입니다.
 *
 * <p>여기서 할 수 있는 일은 보는 사람에 따라 다릅니다. 주인은 부르고
 * 내보내고, 나머지는 누가 있는지 보고 스스로 나갑니다.
 */

/** 서버 MemberService 의 MAX_TTL·MAX_USES_LIMIT 과 같아야 합니다. */
const MAX_DAYS = 30;
const MAX_USES = 20;

export function CompanionsSheet({
  visible,
  tripId,
  ownerId,
  onClose,
  onLeft,
}: {
  visible: boolean;
  tripId: string;
  ownerId: string;
  onClose: () => void;
  /** 스스로 나갔을 때. 이 여행은 더 못 보므로 화면을 떠나야 합니다. */
  onLeft: () => void;
}) {
  return (
    <BottomSheet visible={visible} title="동행자" onClose={onClose}>
      {/* 열 때 불러옵니다. 닫혀 있는 동안 들고 있을 이유가 없습니다. */}
      {visible ? (
        <Inner tripId={tripId} ownerId={ownerId} onClose={onClose} onLeft={onLeft} />
      ) : null}
    </BottomSheet>
  );
}

function Inner({
  tripId,
  ownerId,
  onClose,
  onLeft,
}: {
  tripId: string;
  ownerId: string;
  onClose: () => void;
  onLeft: () => void;
}) {
  const { user } = useAuth();
  const amOwner = user?.id === ownerId;

  const { data, error, loading, reload } = useAsync<{ members: Companion[] }>(
    (signal) => api.get(`/api/trips/${tripId}/members`, signal),
    [tripId],
  );

  const [actionError, setActionError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dropping, setDropping] = useState<Companion | null>(null);

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setActionError(null);
    setBusy(true);
    try {
      await action();
      after ? after() : reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : '처리하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {actionError ? <ErrorNote message={actionError} /> : null}

      {data?.members.map((m) => (
        <Row key={m.id} style={styles.person}>
          <View style={styles.who}>
            <Row gap={Spacing.xs}>
              <Body strong>{m.name}</Body>
              {m.id === user?.id ? <Badge label="나" tone="accent" /> : null}
            </Row>
            <Caption tone="secondary" numberOfLines={1}>
              {m.email}
            </Caption>
          </View>

          <Row gap={Spacing.xs}>
            <Badge
              label={m.owner ? '주인' : m.role === 'EDITOR' ? '같이 고침' : '보기만'}
              tone={m.owner ? 'accent' : 'muted'}
            />
            {amOwner && !m.owner ? (
              <IconButton
                name="user-minus"
                label={`${m.name} 내보내기`}
                tone="danger"
                disabled={busy}
                onPress={() => setDropping(m)}
              />
            ) : null}
          </Row>
        </Row>
      ))}

      {data && data.members.length <= 1 ? (
        <Empty message="아직 혼자입니다. 링크를 만들어 불러 보세요." />
      ) : null}

      <Divider />

      {amOwner ? (
        <InviteSection tripId={tripId} />
      ) : (
        <>
          <Caption tone="secondary">
            부르고 내보내는 것은 여행을 만든 사람만 할 수 있습니다.
          </Caption>
          <Button
            label="이 여행에서 나가기"
            variant="secondary"
            onPress={() => setLeaving(true)}
          />
        </>
      )}

      <ConfirmDialog
        visible={dropping !== null}
        title="내보낼까요?"
        message={
          dropping
            ? `${dropping.name} 님이 이 여행을 더 볼 수 없게 됩니다. 넣어 둔 장소는 그대로 남습니다.`
            : undefined
        }
        confirmLabel="내보내기"
        danger
        busy={busy}
        onCancel={() => setDropping(null)}
        onConfirm={() => {
          const target = dropping;
          setDropping(null);
          if (target) {
            run(() => api.delete(`/api/trips/${tripId}/members/${target.id}`));
          }
        }}
      />

      <ConfirmDialog
        visible={leaving}
        title="나갈까요?"
        message="다시 들어오려면 초대 링크를 새로 받아야 합니다."
        confirmLabel="나가기"
        danger
        busy={busy}
        onCancel={() => setLeaving(false)}
        onConfirm={() => {
          setLeaving(false);
          run(
            () => api.post(`/api/trips/${tripId}/leave`),
            () => {
              onClose();
              onLeft();
            },
          );
        }}
      />
    </>
  );
}

/**
 * 초대 링크 만들기와 발급해 둔 것들.
 *
 * <p>토큰은 만들 때 딱 한 번 옵니다. 서버에는 해시만 남아서 목록으로는 다시
 * 못 봅니다. 그래서 만든 직후 화면에 띄워 두고, 잃어버리면 새로 만듭니다.
 */
function InviteSection({ tripId }: { tripId: string }) {
  const { data, error, loading, reload } = useAsync<{ invites: InviteRow[] }>(
    (signal) => api.get(`/api/trips/${tripId}/invites`, signal),
    [tripId],
  );

  const [role, setRole] = useState<TripRole>('EDITOR');
  const [days, setDays] = useState(7);
  const [uses, setUses] = useState(1);
  const [made, setMade] = useState<NewInvite | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /**
   * 링크 주소.
   *
   * 웹에서는 API_BASE 가 비어 있습니다(같은 주소에서 nginx 가 넘겨 줍니다).
   * 그때는 지금 보고 있는 주소를 씁니다. 앱에서는 API_BASE 가 곧 웹 주소라
   * 그대로 붙입니다.
   */
  const site =
    API_BASE || (typeof window === 'undefined' ? '' : window.location.origin);
  const link = made ? `${site}/invite/${made.token}` : '';

  async function create() {
    setFailed(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await api.post<{ invite: NewInvite }>(`/api/trips/${tripId}/invites`, {
        role,
        days,
        maxUses: uses,
      });
      setMade(res.invite);
      reload();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : '만들지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const how = await shareLink(link, '여행에 초대합니다');
    setNotice(
      how === 'copied'
        ? '링크를 복사했습니다.'
        : how === 'failed'
          ? '보내지 못했습니다. 아래 주소를 직접 붙여 넣어 주세요.'
          : null,
    );
  }

  return (
    <>
      <Subtitle>초대 링크</Subtitle>

      <Row gap={Spacing.xs}>
        <Chip label="같이 고침" selected={role === 'EDITOR'} onPress={() => setRole('EDITOR')} />
        <Chip label="보기만" selected={role === 'VIEWER'} onPress={() => setRole('VIEWER')} />
      </Row>

      <Stepper
        label="며칠 동안 쓸 수 있게"
        value={days}
        onChange={setDays}
        min={1}
        max={MAX_DAYS}
        unit="일"
      />
      <Stepper
        label="몇 명까지"
        value={uses}
        onChange={setUses}
        min={1}
        max={MAX_USES}
        unit="명"
        hint="이 횟수만큼 쓰이면 링크가 닫힙니다."
      />

      {failed ? <ErrorNote message={failed} /> : null}

      <Button label="링크 만들기" onPress={create} busy={busy} />

      {made ? (
        <View style={styles.made}>
          <Caption tone="success" strong>
            링크를 만들었습니다. 이 창을 닫으면 다시 볼 수 없습니다.
          </Caption>
          {/* 눌러서 옮길 수 있게 두고, 안 되는 경우를 위해 글자로도 띄웁니다. */}
          <Body small selectable style={styles.link}>
            {link}
          </Body>
          <Button label="보내기" variant="secondary" onPress={send} />
          {notice ? <Caption tone="secondary">{notice}</Caption> : null}
        </View>
      ) : null}

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data && data.invites.length > 0 ? (
        <>
          <Divider />
          <Caption tone="secondary">만들어 둔 링크</Caption>
          {data.invites.map((i) => (
            <InviteRowView key={i.id} invite={i} onChanged={reload} />
          ))}
        </>
      ) : null}
    </>
  );
}

function InviteRowView({ invite, onChanged }: { invite: InviteRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const expired = new Date(invite.expiresAt).getTime() < Date.now();
  const spent = invite.usedCount >= invite.maxUses;
  const dead = invite.revoked || expired || spent;

  async function revoke() {
    setFailed(null);
    setBusy(true);
    try {
      await api.delete(`/api/invites/${invite.id}`);
      onChanged();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : '취소하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.invite}>
      <Row style={styles.person}>
        <View style={styles.who}>
          <Caption strong>{invite.role === 'EDITOR' ? '같이 고침' : '보기만'}</Caption>
          <Caption tone="secondary">
            {invite.usedCount}/{invite.maxUses}명 · {invite.expiresAt.slice(0, 10)}까지
          </Caption>
        </View>

        <Row gap={Spacing.xs}>
          {invite.revoked ? <Badge label="취소함" tone="muted" /> : null}
          {!invite.revoked && expired ? <Badge label="기한 지남" tone="muted" /> : null}
          {!invite.revoked && !expired && spent ? <Badge label="다 씀" tone="muted" /> : null}
          {dead ? null : (
            <IconButton
              name="x"
              label="이 링크 취소"
              tone="danger"
              disabled={busy}
              onPress={() => setAsking(true)}
            />
          )}
        </Row>
      </Row>

      {failed ? <ErrorNote message={failed} /> : null}

      <ConfirmDialog
        visible={asking}
        title="링크를 취소할까요?"
        message="이미 이 링크로 들어온 사람은 그대로 남습니다. 앞으로 못 쓰게 될 뿐입니다."
        confirmLabel="취소하기"
        danger
        busy={busy}
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          revoke();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  person: {
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
  },
  who: {
    flexShrink: 1,
    gap: 2,
  },
  made: {
    gap: Spacing.sm,
  },
  link: {
    /* 주소는 길고 띄어쓰기가 없어 그냥 두면 한 줄로 삐져나갑니다. */
    flexShrink: 1,
  },
  invite: {
    gap: Spacing.xs,
  },
});
