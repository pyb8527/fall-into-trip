import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Group, Person } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { Colors, Gutter, Spacing, Tap } from '@/constants/theme';
import { faceOf } from '@/constants/user-marks';
import {
  Band,
  Body,
  BottomSheet,
  Button,
  Caption,
  Chip,
  ConfirmDialog,
  ErrorNote,
  Grow,
  Loading,
  Mark,
  Row,
  Subtitle,
} from '@/ui';

/**
 * 이 여행을 같이 보는 사람들.
 *
 * <h3>여기서는 부르지 않습니다</h3>
 *
 * <p>여행에 사람을 따로 부르는 길을 없앴습니다. 같이 볼 사람은 모임
 * 사람이고, 부르는 자리는 모임 화면입니다. 그 길을 여기 두면 「여행 멤버」와
 * 「모임 멤버」 둘이 다시 생기고, 그것이 바로 없앤 것입니다.
 *
 * <p>대신 <b>옮기는 길</b>이 있습니다. 혼자 짜 둔 여행을 모임 것으로 돌리는
 * 일은 흔합니다 — 혼자 생각하다가 같이 가기로 정해지는 순서입니다.
 */
export function PeopleSheet({
  visible,
  tripId,
  groupId,
  amOwner,
  onClose,
  onChanged,
}: {
  visible: boolean;
  tripId: string;
  /** 모임 여행이면 그 모임. 비어 있으면 혼자 여행입니다. */
  groupId: string | null;
  /** 내가 만든 여행인지. 모임을 옮기는 것은 만든 사람만 합니다. */
  amOwner: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  return (
    <BottomSheet visible={visible} title="같이 보는 사람" onClose={onClose}>
      {visible ? (
        <Inner
          tripId={tripId}
          groupId={groupId}
          amOwner={amOwner}
          onClose={onClose}
          onChanged={onChanged}
        />
      ) : null}
    </BottomSheet>
  );
}

function Inner({
  tripId,
  groupId,
  amOwner,
  onClose,
  onChanged,
}: {
  tripId: string;
  groupId: string | null;
  amOwner: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();

  const { data, error, loading, reload } = useAsync<{ people: Person[] }>(
    (signal) => api.get(`/api/trips/${encodeURIComponent(tripId)}/people`, signal),
    [tripId],
  );

  return (
    <>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {/* 모임 사람들 판(MatesSheet)과 같은 줄 모양입니다. 같은 것을 두 군데서
          다른 모양으로 내면 같은 앱으로 안 읽힙니다. */}
      {data?.people.map((p) => (
        <Row key={p.id} gap={Spacing.s3} style={styles.mate}>
          {/* 지도에 찍히는 그림을 여기에도 답니다. 지도에서 곰을 보고
              누구인지 알려면 어딘가에서 한 번은 짝지어져야 합니다. */}
          <Mark emoji={faceOf(p.mark, p.name)} />
          <Grow gap={2}>
            <Body strong numberOfLines={1}>
              {p.name}
            </Body>
            {p.owner || p.id === user?.id ? (
              <Caption tone="secondary">
                {[p.owner ? '만든 사람' : null, p.id === user?.id ? '나' : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Caption>
            ) : null}
          </Grow>
        </Row>
      ))}

      <Band />

      {groupId ? (
        <>
          <Caption tone="secondary">
            이 모임에 든 사람 모두가 이 여행을 보고 고칠 수 있어요. 부르고 내보내는
            일은 모임 화면에서 해요.
          </Caption>
          <Button
            label="모임 보기"
            variant="secondary"
            onPress={() => {
              onClose();
              router.push({ pathname: '/group/[id]', params: { id: groupId } });
            }}
          />
        </>
      ) : (
        <Caption tone="secondary">
          혼자 보는 여행이에요. 같이 짜려면 모임으로 옮겨 주세요.
        </Caption>
      )}

      {amOwner ? (
        <MoveSection tripId={tripId} groupId={groupId} onMoved={onChanged} />
      ) : null}
    </>
  );
}

/**
 * 모임을 바꾸거나 뺍니다.
 *
 * <p>만든 사람만 합니다. 모임 사람 아무나 할 수 있게 하면, 내 여행이 내가
 * 모르는 사이에 다른 사람들이 보는 것이 됩니다.
 */
function MoveSection({
  tripId,
  groupId,
  onMoved,
}: {
  tripId: string;
  groupId: string | null;
  onMoved: () => void;
}) {
  const { data } = useAsync<{ groups: Group[] }>((signal) => api.get('/api/groups', signal), []);
  const groups = data?.groups ?? [];

  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /** 뺄 것인지. 모임에 들어 있을 때만 물을 말입니다. */
  const [pulling, setPulling] = useState(false);

  async function move(to: string | null) {
    setBusy(true);
    setFailed(null);
    try {
      await api.patch(`/api/trips/${encodeURIComponent(tripId)}/group`, { groupId: to ?? '' });
      onMoved();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  /* 든 모임이 없으면 옮길 데가 없습니다. 모임을 만들러 가는 길은 아래 띠에
     있으므로 여기서 다시 안내하지 않습니다. */
  const others = groups.filter((g) => g.id !== groupId);
  if (others.length === 0 && !groupId) {
    return null;
  }

  return (
    <View style={styles.move}>
      <Band />
      <Subtitle>어느 모임의 여행으로</Subtitle>

      {failed ? <ErrorNote message={failed} /> : null}

      {others.length > 0 ? (
        <>
          <Row gap={Spacing.s2} style={styles.wrap}>
            {others.map((g) => (
              <Chip
                key={g.id}
                label={`${g.emoji ?? '🧳'} ${g.name}`}
                selected={pick === g.id}
                onPress={() => setPick(pick === g.id ? null : g.id)}
              />
            ))}
          </Row>
          <Button
            label="이 모임으로 옮기기"
            variant="secondary"
            disabled={pick === null}
            busy={busy}
            onPress={() => {
              if (pick) {
                move(pick);
              }
            }}
          />
          <Caption tone="secondary">
            옮기면 그 모임 사람 모두에게 보이고, 모두가 일정을 고칠 수 있어요.
          </Caption>
        </>
      ) : null}

      {groupId ? (
        <Button
          label="모임에서 빼고 혼자 보기"
          variant="danger"
          busy={busy}
          onPress={() => setPulling(true)}
        />
      ) : null}

      <ConfirmDialog
        visible={pulling}
        title="모임에서 뺄까요?"
        message="모임 사람들이 이 여행을 더 볼 수 없게 돼요. 적어 둔 것은 그대로 남아요."
        confirmLabel="빼기"
        danger
        busy={busy}
        onCancel={() => setPulling(false)}
        onConfirm={() => {
          setPulling(false);
          move(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  who: {
    flexShrink: 1,
  },
  /* 사람 한 줄. 손가락이 닿을 높이를 채웁니다. */
  mate: {
    alignItems: 'center',
    minHeight: Tap.min + Spacing.s3,
  },
  move: {
    gap: Spacing.s2,
  },
  wrap: {
    flexWrap: 'wrap',
  },
});
