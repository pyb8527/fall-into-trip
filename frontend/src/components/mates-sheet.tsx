import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, API_BASE, ApiError, UNEXPECTED } from '@/api/client';
import type { InviteRow, Mate, Maybe, NewInvite } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { Colors, Gutter, Radius, Spacing, Tap } from '@/constants/theme';
import { faceOf } from '@/constants/user-marks';
import { openPerson } from '@/lib/person';
import { shareLink } from '@/lib/share';
import {
  Badge,
  Band,
  Body,
  BottomSheet,
  Button,
  Caption,
  Chip,
  ConfirmDialog,
  Empty,
  ErrorNote,
  Grow,
  Icon,
  IconButton,
  Loading,
  Mark,
  Press,
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
  const router = useRouter();

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

      {/*
        사람 한 줄.

        <p>얼굴을 이름 옆 글자 사이에 그냥 두고 있었습니다. 이모지는 글꼴이
        제 높이를 갖고 있어 기기마다 다르게 그려지고, 그러면 이름 줄이
        사람마다 들쭉날쭉합니다. 동그라미에 담으면 어느 줄에서나 같은
        자리에 섭니다.
      */}
      {mates.map((m) => (
        <Split key={m.id} gap={Spacing.s3} style={styles.mate}>
          <Grow>
            <Row gap={Spacing.s3}>
              {/* 지도에 찍히는 그림을 여기에도 답니다. 지도에서 곰을 보고
                  누구인지 알려면 어딘가에서 한 번은 짝지어져야 합니다. */}
              <Mark emoji={faceOf(m.mark, m.name)} />
              <Grow gap={2}>
                {/* 이름을 누르면 그 사람 페이지로. 판은 닫고 갑니다. */}
                <Press
                  onPress={() => {
                    onClose();
                    openPerson(router, m.id, user?.id);
                  }}
                  scale={0.98}
                  accessibilityLabel={`${m.name} 페이지`}>
                  <Body strong numberOfLines={1}>
                    {m.name}
                  </Body>
                </Press>
                {m.owner || m.id === user?.id ? (
                  <Caption tone="secondary">
                    {[m.owner ? '만든 사람' : null, m.id === user?.id ? '나' : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Caption>
                ) : null}
              </Grow>
            </Row>
          </Grow>

          <Row gap={Spacing.s2}>
            {amOwner && !m.owner ? (
              <IconButton
                name="shuffle"
                label={`${m.name} 님에게 모임 넘기기`}
                bare
                disabled={busy}
                onPress={() => setHanding(m)}
              />
            ) : null}
            {amOwner && !m.owner ? (
              <IconButton
                name="user-minus"
                label={`${m.name} 내보내기`}
                tone="danger"
                bare
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

      <Band />

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
          {/* 나가는 일은 되돌리기 어렵습니다(링크를 새로 받아야 합니다).
              그렇다고 꽉 찬 단추로 두면 사람 목록 아래에서 가장 눈에 띄는
              것이 나가기가 됩니다 — 글자만 빨간 줄로 둡니다. */}
          <Band />
          <Press
            onPress={() => setLeaving(true)}
            scale={1}
            accessibilityLabel="이 모임에서 나가기"
            style={styles.leave}>
            <Icon name="log-out" size={20} tone="danger" />
            <Body tone="danger">이 모임에서 나가기</Body>
          </Press>
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
 * 못 봅니다. 그래서 만든 직후 화면에 띄웁니다.
 *
 * <p><b>잃어버렸을 때 쓰는 길은 줄마다 있는 「다시 만들기」입니다.</b> 토큰을
 * 되돌려 주게 서버를 고치는 길도 있지만, 모임에 들어오는 열쇠를 아무 때나
 * 다시 꺼낼 수 있게 두는 쪽은 얻는 것보다 잃는 것이 큽니다. 실제로 번거로웠던
 * 것은 토큰을 못 보는 것보다 <b>못 쓰게 하고 폼을 다시 채워 만드는 두 번
 * 누르기</b>였고, 그건 단추 하나로 풀립니다.
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

  /**
   * 링크 하나 만들기.
   *
   * <p>만든 링크가 뜨는 자리는 한 곳입니다 — 위 폼이 만들든 아래 줄의 「다시
   * 만들기」가 만들든 같은 칸에 뜹니다. 방금 만든 링크가 화면 두 군데에 뜨면
   * 어느 것이 새것인지 사람이 가려야 합니다.
   *
   * <p>실패는 여기서 안 받고 던집니다. 글자를 띄울 곳이 부르는 자리마다
   * 다릅니다 — 폼 아래냐 그 줄 아래냐.
   */
  async function make(spec: { days: number; maxUses: number }) {
    /* 지난번 보내기 결과("링크를 복사했어요")는 새 링크와 상관이 없습니다. */
    setNotice(null);
    const res = await api.post<{ invite: NewInvite }>(`/api/groups/${groupId}/invites`, spec);
    setMade(res.invite);
    reload();
  }

  async function create() {
    setFailed(null);
    setBusy(true);
    try {
      /* 0 은 기한을 두지 말라는 뜻입니다. */
      await make({ days: dated ? days : 0, maxUses: uses });
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

      <Row gap={Spacing.s2}>
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
          <Band />
          <Caption tone="secondary">만들어 둔 링크</Caption>
          {data.invites.map((i) => (
            <InviteRowView key={i.id} invite={i} onChanged={reload} onRemake={make} />
          ))}
        </>
      ) : null}
    </>
  );
}

function InviteRowView({
  invite,
  onChanged,
  onRemake,
}: {
  invite: InviteRow;
  onChanged: () => void;
  /** 같은 조건으로 링크를 새로 만드는 일. {@link InviteSection} 이 맡습니다. */
  onRemake: (spec: { days: number; maxUses: number }) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [remaking, setRemaking] = useState(false);

  /* 서버는 비어 있는 값을 아예 빼고 보냅니다(non_null). null 인지 없는지를
     가르지 않아야 "기한 없음" 이 제대로 읽힙니다. */
  const expired = invite.expiresAt != null && new Date(invite.expiresAt).getTime() < Date.now();
  const spent = invite.usedCount >= invite.maxUses;

  /**
   * 새로 만들 때 물려받는 조건.
   *
   * <p><b>폼에 지금 적혀 있는 값이 아니라 이 줄의 값</b>을 씁니다. 폼은 아까
   * 다른 링크를 만들려고 건드려 둔 것일 수 있어서, 그걸 쓰면 기한이 말없이
   * 바뀝니다. 묻는 창에 이 숫자를 그대로 적어 두어 바뀌는 것이 없음을
   * 보여 줍니다.
   */
  const next = { days: daysLeftOf(invite.expiresAt), maxUses: invite.maxUses };

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

  /**
   * 못 쓰게 하고, 바로 같은 조건으로 새로 만들기.
   *
   * <p>순서는 <b>닫고 나서 만들기</b>입니다. 거꾸로 하면 만드는 것은 됐는데
   * 닫는 것이 안 된 사이에 쓸 수 있는 링크가 둘 남습니다 — 묻는 창에서 "지금
   * 링크는 못 쓰게 돼요" 라고 해 둔 말이 거짓이 됩니다. 이 순서면 안 되는
   * 경우에 링크가 하나도 없이 남는데, 그것은 위 「링크 만들기」로 바로 풉니다.
   */
  async function remake() {
    setFailed(null);
    setBusy(true);
    try {
      await api.delete(`/api/group-invites/${invite.id}`);
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
      setBusy(false);
      return;
    }
    try {
      await onRemake(next);
    } catch {
      /* 목록을 다시 받습니다 — 이미 닫은 링크가 「쓸 수 있음」으로 남아 있으면
         거짓입니다. */
      setFailed('이 링크는 못 쓰게 했어요. 그런데 새 링크를 만들지 못했어요 — 위 「링크 만들기」로 만들어 주세요.');
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.invite}>
      <Split gap={Spacing.s3}>
        <View style={styles.who}>
          <Caption strong>
            {invite.usedCount}/{invite.maxUses}명
          </Caption>
          <Caption tone="secondary">
            {invite.expiresAt ? `${invite.expiresAt.slice(0, 10)}까지` : '기한 없음'}
          </Caption>
        </View>

        <Row gap={Spacing.s2}>
          {/*
            왜 못 쓰게 되었는지를 가려 말합니다.

            <p>서버는 쓸 수 있는지(usable) 하나로 답합니다. 그 한 마디만
            옮기면 「못 씀」 세 가지가 한 말이 되어, 기한을 늘려야 하는지
            사람 수를 늘려야 하는지 알 수 없습니다.
          */}
          {!invite.usable && expired ? <Badge label="기한 지남" tone="muted" /> : null}
          {!invite.usable && !expired && spent ? <Badge label="다 씀" tone="muted" /> : null}
          {!invite.usable && !expired && !spent ? <Badge label="닫음" tone="muted" /> : null}
          {/* 잃어버린 링크를 되살리는 자리. 닫고 새로 만드는 두 걸음을 한 번에
              합니다. 그냥 닫기만 하는 길도 그대로 둡니다 — 갈아 끼울 것 없이
              닫고 싶을 때가 있습니다(링크가 새어 나간 날). */}
          {invite.usable ? (
            <Button
              label="다시 만들기"
              variant="ghost"
              compact
              disabled={busy}
              onPress={() => setRemaking(true)}
            />
          ) : null}
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

      {/*
        갈아 끼우기를 묻는 창.

        <p>묻는 말에 <b>새 링크의 조건을 숫자로</b> 적습니다. "같은 조건" 이라고만
        하면 무엇이 같은지를 사람이 믿고 넘겨야 하고, 기한이 말없이 바뀌는 쪽이
        한 번 더 묻는 것보다 나쁩니다.

        <p>빨간 단추는 아닙니다. 끝나고 남는 것은 쓸 수 있는 링크 하나라 지우는
        일이 아닙니다 — 없어지는 쪽은 묻는 말이 적어 둡니다.
      */}
      <ConfirmDialog
        visible={remaking}
        title="새 링크로 갈아 끼울까요?"
        message={`지금 링크는 못 쓰게 되고, 같은 조건(${
          next.days === 0 ? '기한 없음' : `${next.days}일 동안`
        } · ${next.maxUses}명까지)으로 새 링크가 나와요. 몇 명 들어왔는지는 0부터 다시 세요. 이미 들어온 사람은 그대로 남고, 링크를 받아 두고 아직 안 들어온 사람은 못 들어와요 — 새 링크를 보내 주세요. 새 링크도 만든 직후 한 번만 보여요.`}
        confirmLabel="다시 만들기"
        busy={busy}
        onCancel={() => setRemaking(false)}
        onConfirm={() => {
          setRemaking(false);
          remake();
        }}
      />
    </View>
  );
}

/**
 * 남은 기한을 날 수로.
 *
 * <p>서버에 보내는 것은 「며칠 동안」이고 줄이 쥐고 있는 것은 「언제까지」라
 * 되돌려 세야 합니다. 올림입니다 — 반나절 남은 링크를 0일로 보내면 그 0 이
 * 「기한을 두지 말라」는 뜻이 되어 기한 없는 링크가 나옵니다.
 */
function daysLeftOf(expiresAt: Maybe<string>): number {
  if (expiresAt == null) {
    return 0;
  }
  const left = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  return Math.min(MAX_DAYS, Math.max(1, left));
}

const styles = StyleSheet.create({
  who: {
    flexShrink: 1,
    gap: 2,
  },
  /* 사람 한 줄. 손가락이 닿을 높이를 채웁니다. */
  mate: {
    minHeight: Tap.min + Spacing.s3,
  },
  /* 되돌리기 어려운 일. 단추가 아니라 줄입니다. */
  leave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s3,
    minHeight: Tap.min,
  },
  /*
    만들어 둔 링크.

    <p>눌러서 들어가는 물건이 아니라 <b>적혀 있는 것</b>이라 흰 카드가
    아니고 회색 면입니다.
  */
  made: {
    gap: Spacing.s2,
    backgroundColor: Colors.fill,
    borderRadius: Radius.r3,
    padding: Spacing.s4,
  },
  link: {
    /* 주소는 길고 띄어쓰기가 없어 그냥 두면 한 줄로 삐져나갑니다. */
    flexShrink: 1,
  },
  invite: {
    gap: Spacing.s2,
  },
});
