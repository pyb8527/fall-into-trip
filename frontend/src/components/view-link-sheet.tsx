import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, API_BASE, ApiError, UNEXPECTED } from '@/api/client';
import { useAsync } from '@/api/use-async';
import { Spacing } from '@/constants/theme';
import { canShareToKakao, shareToKakao } from '@/lib/kakao-share';
import { formatSpan } from '@/lib/countdown';
import { shareLink } from '@/lib/share';
import { Body, BottomSheet, Button, Caption, ErrorNote, Loading } from '@/ui';

/**
 * 로그인 없이 보는 일정 링크를 만들고 보냅니다.
 *
 * <h3>무엇이 보이는지 먼저 말합니다</h3>
 *
 * <p>「링크」라고만 하면 가계부까지 다 보이는 줄 압니다. 보이는 것과 안
 * 보이는 것을 단추보다 위에 적습니다.
 *
 * <h3>링크는 만들 때 한 번만 보입니다</h3>
 *
 * <p>서버에는 해시만 있어서 다시 꺼낼 수 없습니다. 다시 보내려면 새로
 * 만들고, 그러면 옛 링크는 죽습니다.
 */
export function ViewLinkSheet({
  visible,
  tripId,
  tripTitle,
  onClose,
}: {
  visible: boolean;
  tripId: string;
  tripTitle: string;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} title="일정 링크 보내기" onClose={onClose}>
      {visible ? <Inner tripId={tripId} tripTitle={tripTitle} /> : null}
    </BottomSheet>
  );
}

function Inner({ tripId, tripTitle }: { tripId: string; tripTitle: string }) {
  const path = `/api/trips/${encodeURIComponent(tripId)}/view-link`;
  const { data, loading, reload } = useAsync<{ on: boolean; until?: string | null }>(
    (signal) => api.get(path, signal),
    [tripId],
  );
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function issue() {
    setBusy(true);
    setError(null);
    try {
      const got = await api.post<{ path: string }>(path);
      const origin =
        API_BASE || (typeof window !== 'undefined' && window.location ? window.location.origin : '');
      setUrl(origin + got.path);
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      await api.delete(path);
      setUrl(null);
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {loading && !data ? <Loading /> : null}
      <Body small tone="secondary">
        계정이 없어도 이 링크로 날짜·장소·시각·메모를 볼 수 있어요. 가계부·위치·안내판·사람 이름은
        안 보여요.
      </Body>
      {data?.until ? (
        <Caption tone="muted">
          여행 마지막 날({formatSpan(data.until, data.until)})이 지나면 저절로 닫혀요.
        </Caption>
      ) : null}

      {url ? (
        <View style={styles.box}>
          <Caption tone="warning">링크는 지금만 보여요. 받은 사람은 누구나 일정을 볼 수 있어요.</Caption>
          <Body small selectable>
            {url}
          </Body>
          {canShareToKakao ? (
            <Button
              label="카카오톡으로 보내기"
              onPress={() => {
                shareToKakao(url, `「${tripTitle}」 일정이에요.`).catch((e: Error) =>
                  setError(e.message || UNEXPECTED),
                );
              }}
            />
          ) : null}
          <Button
            label="다른 곳으로 보내기 · 복사"
            variant="secondary"
            onPress={async () => {
              const done = await shareLink(url, `${tripTitle} 일정`);
              setNote(done === 'copied' ? '복사했어요.' : null);
            }}
          />
          {note ? <Caption tone="success">{note}</Caption> : null}
        </View>
      ) : (
        <Button
          label={data?.on ? '링크 새로 만들기' : '링크 만들기'}
          busy={busy}
          onPress={issue}
        />
      )}

      {data?.on && !url ? (
        <Caption tone="muted">
          이미 만든 링크가 있어요. 다시 볼 수는 없어서, 새로 만들면 옛 링크는 끊겨요.
        </Caption>
      ) : null}
      {error ? <ErrorNote message={error} /> : null}
      {data?.on ? (
        <Button label="링크 끊기" variant="dangerText" busy={busy} onPress={revoke} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: Spacing.s2,
  },
});
