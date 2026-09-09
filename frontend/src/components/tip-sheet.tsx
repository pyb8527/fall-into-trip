import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Tip } from '@/api/types';
import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import {
  Body,
  BottomSheet,
  Button,
  Caption,
  ConfirmDialog,
  Divider,
  Empty,
  ErrorNote,
  Field,
  IconButton,
  Loading,
  Row,
} from '@/ui';

/**
 * 장소에 달린 한 줄 팁.
 *
 * <p>"지금 대기 40분", "2번 출구로 나와야 함" 처럼 구글에는 없고 방금 다녀온
 * 사람만 아는 것들입니다.
 *
 * <p>여행이 아니라 그 가게에 달립니다. 같은 곳을 넣어 둔 사람이면 누구든 같은
 * 팁을 봅니다.
 *
 * <p>일주일 지난 것은 보여 주지 않습니다. "지금 대기 40분" 은 다음 날이면 이미
 * 쓸모가 없고, 두 달 전 것은 사람을 잘못 이끕니다.
 */
export function TipSheet({
  visible,
  placeId,
  placeName,
  onClose,
  onChanged,
}: {
  visible: boolean;
  placeId: string;
  placeName: string;
  onClose: () => void;
  /** 개수가 달라졌으니 부른 쪽이 다시 세어야 합니다. */
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [tips, setTips] = useState<Tip[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [reporting, setReporting] = useState<Tip | null>(null);

  async function load() {
    try {
      const res = await api.get<{ tips: Tip[] }>(`/api/places/${encodeURIComponent(placeId)}/tips`);
      setTips(res.tips);
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  useEffect(() => {
    if (visible) {
      setText('');
      setFailed(null);
      setTips(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, placeId]);

  /**
   * 서버에 한 번 다녀옵니다.
   *
   * <p>됐는지를 돌려줍니다. 적어 둔 글을 비우는 것은 성공했을 때뿐입니다 —
   * 실패에도 비우면 길게 쓴 것이 통째로 날아가고 다시 칠 수도 없습니다.
   */
  async function run(action: () => Promise<unknown>) {
    setFailed(null);
    setBusy(true);
    try {
      await action();
      await load();
      onChanged();
      return true;
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet visible={visible} title={`${placeName} 한 줄`} onClose={onClose}>
      <Caption tone="secondary">
        최근 일주일 안에 다녀온 사람들이 남긴 것입니다. 대기 시간처럼 금방 달라지는 것은 적힌
        시각을 함께 보세요.
      </Caption>

      {failed ? <ErrorNote message={failed} /> : null}
      {tips === null ? <Loading /> : null}
      {tips && tips.length === 0 ? (
        <Empty message="아직 아무도 안 남겼습니다. 다녀오셨다면 첫 줄을 남겨 주세요." />
      ) : null}

      {tips?.map((tip) => (
        <View key={tip.id} style={styles.tip}>
          <Body>{tip.text}</Body>
          <Row style={styles.meta}>
            <Caption tone="secondary">
              {tip.authorName} · {sinceOf(tip.createdAt)}
            </Caption>
            {tip.mine ? (
              <IconButton
                name="trash-2"
                label="내가 남긴 것 지우기"
                tone="danger"
                disabled={busy}
                onPress={() => run(() => api.delete(`/api/tips/${tip.id}`))}
              />
            ) : user ? (
              <Button
                label="신고"
                variant="ghost"
                compact
                onPress={() => setReporting(tip)}
              />
            ) : null}
          </Row>
        </View>
      ))}

      {user ? (
        <>
          <Divider />
          <Field
            label="한 줄 남기기"
            value={text}
            onChangeText={setText}
            placeholder="지금 대기 40분, 2번 출구로 나와야 함"
            hint="200자까지. 같은 곳에는 하루 세 번까지 남길 수 있습니다."
            returnKeyType="done"
          />
          <Button
            label="남기기"
            busy={busy}
            disabled={!text.trim()}
            onPress={() =>
              run(() =>
                api.post(`/api/places/${encodeURIComponent(placeId)}/tips`, { text: text.trim() }),
              ).then((done) => {
                if (done) {
                  setText('');
                }
              })
            }
          />
        </>
      ) : (
        <Caption tone="secondary">로그인하면 한 줄 남길 수 있습니다.</Caption>
      )}

      <ConfirmDialog
        visible={reporting !== null}
        title="이 한 줄을 신고할까요?"
        message="여러 사람이 신고하면 운영자가 확인할 때까지 자동으로 감춰집니다."
        confirmLabel="신고"
        danger
        busy={busy}
        onCancel={() => setReporting(null)}
        onConfirm={() => {
          const target = reporting;
          setReporting(null);
          if (target) {
            run(() => api.post(`/api/tips/${target.id}/report`, {}));
          }
        }}
      />
    </BottomSheet>
  );
}

/**
 * 얼마나 지났는지.
 *
 * <p>날짜보다 "3시간 전" 이 낫습니다. 대기 시간 같은 것은 언제 적힌 것인지가
 * 내용만큼 중요합니다.
 */
function sinceOf(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) {
    return `${Math.max(1, minutes)}분 전`;
  }
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}시간 전` : `${Math.round(hours / 24)}일 전`;
}

const styles = StyleSheet.create({
  tip: {
    gap: Spacing.xs,
  },
  meta: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
