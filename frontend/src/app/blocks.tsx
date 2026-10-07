import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { BlockedPerson } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { ProfileFace } from '@/components/profile-face';
import { Colors, Spacing } from '@/constants/theme';
import { faceOf } from '@/constants/user-marks';
import { formatInstant } from '@/lib/countdown';
import {
  Body,
  Button,
  Caption,
  Empty,
  ErrorNote,
  Loading,
  Row,
  Screen,
  Split,
} from '@/ui';

/**
 * 내가 막은 사람들.
 *
 * <h3>왜 따로 있나</h3>
 *
 * <p>막는 것은 글 · 댓글 · 프로필 옆에서 합니다. 그런데 막고 나면 그 사람의
 * 글이 안 보이므로 <b>푸는 자리를 다시 찾을 길이 없습니다</b> — 프로필로
 * 가려 해도 그 사람의 이름이 서 있던 글이 사라졌습니다. 그래서 설정에 목록을
 * 둡니다. 스토어도 「차단한 사람을 풀 수 있는 곳」을 봅니다.
 *
 * <h3>푸는 것은 묻지 않습니다</h3>
 *
 * <p>막는 것은 한 번 묻습니다(무엇이 달라지는지 말해야 합니다). 푸는 것은
 * 되돌릴 수 있는 일이고, 풀린 사람에게도 알리지 않으므로 바로 합니다.
 *
 * <p>나를 막은 사람의 목록은 없습니다 — 조용히 막는 것이 약속입니다.
 */
export default function Blocks() {
  const { data, error, loading, reload } = useAsync<{ blocks: BlockedPerson[] }>(
    (signal) => api.get('/api/me/blocks', signal),
    [],
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function unblock(person: BlockedPerson) {
    setFailed(null);
    setBusy(person.id);
    try {
      await api.delete(`/api/users/${encodeURIComponent(person.id)}/block`);
      reload();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Caption tone="secondary">
        차단한 사람과는 서로의 글 · 댓글 · 한 줄이 안 보이고, 내가 만든 초대 링크로 들어오지
        못해요. 함께 쓰던 여행과 모임은 그대로예요.
      </Caption>

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {failed ? <ErrorNote message={failed} /> : null}

      {data && data.blocks.length === 0 ? (
        <Empty icon="check" message="차단한 사람이 없어요." />
      ) : null}

      {data?.blocks.map((person, i) => (
        <View key={person.id} style={[styles.row, i === 0 ? null : styles.rowEdge]}>
          <Split gap={Spacing.s3}>
            <Row gap={Spacing.s3} style={styles.who}>
              <ProfileFace
                photoId={person.photoId}
                mark={faceOf(person.mark, person.name)}
                size={40}
                label={`${person.name}의 얼굴`}
              />
              <View style={styles.name}>
                <Body strong numberOfLines={1}>
                  {person.name}
                </Body>
                <Caption tone="muted">{formatInstant(person.blockedAt)}에 차단</Caption>
              </View>
            </Row>
            <Button
              label="차단 풀기"
              variant="secondary"
              compact
              busy={busy === person.id}
              disabled={busy !== null && busy !== person.id}
              onPress={() => unblock(person)}
            />
          </Split>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: Spacing.s3,
  },
  /* 첫 줄 위에는 안 긋습니다 — 위의 안내문과 사이가 선으로 막히면 그
     안내문이 첫 줄처럼 보입니다. */
  rowEdge: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  who: {
    flexShrink: 1,
  },
  name: {
    flexShrink: 1,
    gap: 2,
  },
});
