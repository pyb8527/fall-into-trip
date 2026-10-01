import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, API_BASE, ApiError, UNEXPECTED } from '@/api/client';
import type { InviteRow, Mate, NewInvite } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import { faceOf } from '@/constants/user-marks';
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
  Split,
  Stepper,
  Subtitle,
} from '@/ui';

/**
 * 모임의 사람들과, 부르는 링크.
 *
 * <p>이메일로 사람을 찾는 길은 서버가 열어 두지 않았습니다. 링크를 만들어
 * 보내고 받은 사람이 눌러 들어옵니다 — 남의 이메일을 넣어 보며 계정이
 * 있는지 떠보는 일을 막기 위해서입니다.
 *
 * <p><b>부르는 것은 멤버도 합니다.</b> 주인만 할 수 있게 하면 주인이 안
 * 들어온 날에는 아무도 못 부릅니다. 내보내고 주인을 넘기는 것만 주인
 * 몫입니다.
 */

/** 서버 GroupInviteService 의 MAX_TTL·MAX_USES_LIMIT 과 같아야 합니다. */
const MAX_DAYS = 30;
const MAX_USES = 20;

export function MatesSheet({
  visible,
  groupId,
  mates,
  amOwner,
  onClose,
  onChanged,
  onLeft,
}: {
  visible: boolean;
  groupId: string;
  /** 모임 화면이 이미 받아 둔 사람들. 같은 것을 두 번 묻지 않습니다. */
  mates: Mate[];
  amOwner: boolean;
  onClose: () => void;
  onChanged: () => void;
  /** 스스로 나갔을 때. 이 모임은 더 못 보므로 화면을 떠나야 합니다. */
  onLeft: () => void;
}) {
  return (
    <BottomSheet visible={visible} title="모임 사람들" onClose={onClose}>
      {visible ? (
        <Inner
          groupId={groupId}
          mates={mates}
          amOwner={amOwner}
          onClose={onClose}
          onChanged={onChanged}
          onLeft={onLeft}
        />
      ) : null}
    </BottomSheet>
  );
}

function Inner({
  groupId,
  mates,
  amOwner,
  onClose,
  onChanged,
  onLeft,
}: {
  groupId: string;
  mates: Mate[];
  amOwner: boolean;
  onClose: () => void;
  onChanged: () => void;
  onLeft: () => void;
}) {
  const { user } = useAuth();

  const [actionError, setActionError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dropping, setDropping] = useState<Mate | null>(null);
  const [handing, setHanding] = useState<Mate | null>(null);

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setActionError(null);
    setBusy(true);
    try {
      await action();
      after ? after() : onChanged();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {actionError ? <ErrorNote message={actionError} /> : null}

      {mates.map((m) => (
        <Split key={m.id} gap={Spacing.md}>
          <View style={styles.who}>
            <Row gap={Spacing.xs}>
              {/* 지도에 찍히는 그림을 여기에도 답니다. 지도에서 곰을 보고
                  누구인지 알려면 어딘가에서 한 번은 짝지어져야 합니다. */}
              <Body>{faceOf(m.mark, m.name)}</Body>
              <Body strong>{m.name}</Body>
              {m.id === user?.id ? <Badge label="나" tone="accent" /> : null}
            </Row>
          </View>

          <Row gap={Spacing.xs}>
            {m.owner ? <Badge label="만든 사람" tone="accent" /> : null}
            {amOwner && !m.owner ? (
              <IconButton
                name="shuffle"
                label={`${m.name} 님에게 모임 넘기기`}
                disabled={busy}
                onPress={() => setHanding(m)}
              />
            ) : null}
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
        </Split>
      ))}

      {mates.length <= 1 ? (
        <Empty message="아직 혼자예요. 링크를 만들어 불러 보세요." />
      ) : null}

      <Divider />

      {/* 부르는 것은 멤버도 합니다. 주인이 안 들어온 날에도 사람을 부를 수
          있어야 합니다. */}
      <InviteSection groupId={groupId} />

      {amOwner ? (
        <Caption tone="secondary">
          모임을 만든 사람은 바로 나갈 수 없어요. 다른 사람에게 넘기거나 모임을 지워
          주세요.
        </Caption>
      ) : (
        <>
          <Divider />
          <Button
            label="이 모임에서 나가기"
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
            ? `${dropping.name} 님이 이 모임의 여행을 더 볼 수 없게 돼요. 그 사람이 만든 여행은 그 사람 것으로 남아요.`
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
            run(() => api.delete(`/api/groups/${groupId}/members/${target.id}`));
          }
        }}
      />

      <ConfirmDialog
        visible={handing !== null}
        title="모임을 넘길까요?"
        message={
          handing
            ? `${handing.name} 님이 모임을 만든 사람이 돼요. 이름을 고치고 사람을 내보내는 일은 그때부터 그 사람 몫이에요.`
            : undefined
        }
        confirmLabel="넘기기"
        busy={busy}
        onCancel={() => setHanding(null)}
        onConfirm={() => {
          const target = handing;
          setHanding(null);
          if (target) {
            run(() => api.patch(`/api/groups/${groupId}/owner`, { userId: target.id }));
          }
        }}
      />

      <ConfirmDialog
        visible={leaving}
        title="나갈까요?"
        message="이 모임의 여행이 안 보이게 돼요. 내가 만든 여행은 내 것이라 그대로 보여요. 다시 들어오려면 링크를 새로 받아야 해요."
        confirmLabel="나가기"
        danger
        busy={busy}
        onCancel={() => setLeaving(false)}
        onConfirm={() => {
          setLeaving(false);
          run(
            () => api.delete(`/api/groups/${groupId}/members/me`),
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
 * 부르는 링크 만들기와 만들어 둔 것들.
 *
 * <p>토큰은 만들 때 딱 한 번 옵니다. 서버에는 해시만 남아서 목록으로는 다시
 * 못 봅니다. 그래서 만든 직후 화면에 띄워 두고, 잃어버리면 새로 만듭니다.
 */
function InviteSection({ groupId }: { groupId: string }) {
  const { data, error, loading, reload } = useAsync<{ invites: InviteRow[] }>(
    (signal) => api.get(`/api/groups/${groupId}/invites`, signal),
    [groupId],
  );

  /* 기한을 둘지부터 고릅니다. 0 을 고르게 두면 "0일" 이라는 이상한 말이
     화면에 남습니다. */
  const [dated, setDated] = useState(true);
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
  const site = API_BASE || (typeof window === 'undefined' ? '' : window.location.origin);
  const link = made ? `${site}/invite/${made.token}` : '';

  async function create() {
    setFailed(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await api.post<{ invite: NewInvite }>(`/api/groups/${groupId}/invites`, {
        /* 0 은 기한을 두지 말라는 뜻입니다. */
        days: dated ? days : 0,
        maxUses: uses,
      });
      setMade(res.invite);
      reload();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const how = await shareLink(link, '모임에 초대해요');
    setNotice(
      how === 'copied'
        ? '링크를 복사했어요.'
        : how === 'failed'
          ? '보내기가 열리지 않았어요. 아래 주소를 직접 붙여 넣어 주세요.'
          : null,
    );
  }

  return (
    <>
      <Subtitle>부르는 링크</Subtitle>

      <Row gap={Spacing.xs}>
        <Chip label="기한 두기" selected={dated} onPress={() => setDated(true)} />
        <Chip label="기한 없음" selected={!dated} onPress={() => setDated(false)} />
      </Row>

      {dated ? (
        <Stepper
          label="며칠 동안 쓸 수 있게"
          value={days}
          onChange={setDays}
          min={1}
          max={MAX_DAYS}
          unit="일"
        />
      ) : (
        <Caption tone="secondary">
          닫을 때까지 계속 열려 있어요. 링크가 새어 나갔다 싶으면 아래 목록에서 못 쓰게
          해 주세요.
        </Caption>
      )}
      <Stepper
        label="몇 명까지"
        value={uses}
        onChange={setUses}
        min={1}
        max={MAX_USES}
        unit="명"
        hint="이 횟수만큼 쓰이면 링크가 닫혀요."
      />

      {failed ? <ErrorNote message={failed} /> : null}

      <Button label="링크 만들기" onPress={create} busy={busy} />

      {made ? (
        <View style={styles.made}>
          <Caption tone="success" strong>
            링크를 만들었어요. 이 창을 닫으면 다시 볼 수 없어요.
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

  /* 서버는 비어 있는 값을 아예 빼고 보냅니다(non_null). null 인지 없는지를
     가르지 않아야 "기한 없음" 이 제대로 읽힙니다. */
  const expired = invite.expiresAt != null && new Date(invite.expiresAt).getTime() < Date.now();
  const spent = invite.usedCount >= invite.maxUses;

  async function revoke() {
    setFailed(null);
    setBusy(true);
    try {
      await api.delete(`/api/group-invites/${invite.id}`);
      onChanged();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.invite}>
      <Split gap={Spacing.md}>
        <View style={styles.who}>
          <Caption strong>
            {invite.usedCount}/{invite.maxUses}명
          </Caption>
          <Caption tone="secondary">
            {invite.expiresAt ? `${invite.expiresAt.slice(0, 10)}까지` : '기한 없음'}
          </Caption>
        </View>

        <Row gap={Spacing.xs}>
          {/*
            왜 못 쓰게 되었는지를 가려 말합니다.

            <p>서버는 쓸 수 있는지(usable) 하나로 답합니다. 그 한 마디만
            옮기면 「못 씀」 세 가지가 한 말이 되어, 기한을 늘려야 하는지
            사람 수를 늘려야 하는지 알 수 없습니다.
          */}
          {!invite.usable && expired ? <Badge label="기한 지남" tone="muted" /> : null}
          {!invite.usable && !expired && spent ? <Badge label="다 씀" tone="muted" /> : null}
          {!invite.usable && !expired && !spent ? <Badge label="닫음" tone="muted" /> : null}
          {invite.usable ? (
            <IconButton
              name="x"
              label="이 링크 못 쓰게 하기"
              tone="danger"
              disabled={busy}
              onPress={() => setAsking(true)}
            />
          ) : null}
        </Row>
      </Split>

      {failed ? <ErrorNote message={failed} /> : null}

      <ConfirmDialog
        visible={asking}
        title="이 링크를 못 쓰게 할까요?"
        message="이미 이 링크로 들어온 사람은 그대로 남아요. 앞으로 이 링크로는 못 들어와요."
        confirmLabel="못 쓰게 하기"
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
