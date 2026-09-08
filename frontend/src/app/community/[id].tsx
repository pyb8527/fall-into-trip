import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, query } from '@/api/client';
import type { ItineraryDay, PostDetail } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { dayColor, Spacing } from '@/constants/theme';
import {
  Badge,
  Body,
  BottomSheet,
  Button,
  Caption,
  Card,
  ConfirmDialog,
  Divider,
  ErrorNote,
  Loading,
  Row,
  Screen,
  Subtitle,
  Title,
} from '@/ui';
import { DateField } from '@/ui/date-field';

/**
 * 올라온 일정 한 편.
 *
 * <p>여기 보이는 것은 <b>올릴 때 떠 둔 사본</b>입니다. 글쓴이가 나중에 자기
 * 일정을 고쳐도 이 글은 그대로고, 여행을 지워도 남습니다.
 *
 * <p>로그인 없이도 읽힙니다. 가져가거나 추천하려 할 때만 로그인을 부릅니다.
 */
export default function Post() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data, error, loading, reload, setData } = useAsync<PostDetail>(
    (signal) => api.get(`/api/posts/${id}`, signal),
    [id],
  );

  const [copying, setCopying] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  /** 로그인이 필요한 동작 앞에서 한 번 걸러 줍니다. */
  function needLogin() {
    router.push(`/(auth)/login?next=${encodeURIComponent(`/community/${id}`)}`);
  }

  function toggleLike() {
    if (!user || !data) {
      needLogin();
      return;
    }
    const next = !data.liked;
    setData((prev) =>
      prev ? { ...prev, liked: next, likeCount: prev.likeCount + (next ? 1 : -1) } : prev,
    );
    api.post(`/api/posts/${id}/like${query({ on: next })}`).catch(() => reload());
  }

  async function report(reason: string) {
    setFailed(null);
    setBusy(true);
    try {
      await api.post(`/api/posts/${id}/report`, { reason });
      setNotice('신고했습니다. 운영자가 확인합니다.');
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : '신고하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen>
        <ErrorNote message={error ?? '글을 찾을 수 없습니다.'} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Row gap={Spacing.sm}>
          <Button
            label={`${data.liked ? '♥' : '♡'} ${data.likeCount}`}
            variant="secondary"
            compact
            onPress={toggleLike}
          />
          <View style={styles.grow}>
            <Button
              label="내 여행으로 가져오기"
              onPress={() => (user ? setCopying(true) : needLogin())}
            />
          </View>
        </Row>
      }>
      <Stack.Screen options={{ title: data.title }} />

      <View style={styles.head}>
        <Title>{data.title}</Title>
        {data.summary ? <Body tone="secondary">{data.summary}</Body> : null}
        <Caption tone="secondary">
          {data.authorName} · {data.dayCount}일 · {data.placeCount}곳 · 조회{' '}
          {data.viewCount.toLocaleString()}
        </Caption>
      </View>

      {notice ? <Body tone="success">{notice}</Body> : null}
      {failed ? <ErrorNote message={failed} /> : null}

      {data.itinerary.days.map((day, i) => (
        <DayBlock key={i} day={day} index={i} />
      ))}

      <Divider />

      <Row gap={Spacing.sm}>
        {data.mine ? (
          <Button label="내리기" variant="danger" compact onPress={() => setRemoving(true)} />
        ) : (
          <Button
            label="신고"
            variant="ghost"
            compact
            onPress={() => (user ? setReporting(true) : needLogin())}
          />
        )}
      </Row>

      <CopySheet
        visible={copying}
        onCancel={() => setCopying(false)}
        onDone={(tripId) => {
          setCopying(false);
          /* 가져왔으면 바로 그 일정으로 보냅니다. 목록에서 다시 찾게 하면
             방금 만든 것이 어디 있는지 헤맵니다. */
          router.replace(`/trip/${tripId}`);
        }}
        postId={id}
        title={data.title}
      />

      <ConfirmDialog
        visible={removing}
        title="내릴까요?"
        message="게시판에서 사라집니다. 내 여행은 그대로 남습니다."
        confirmLabel="내리기"
        danger
        busy={busy}
        onCancel={() => setRemoving(false)}
        onConfirm={async () => {
          setRemoving(false);
          setBusy(true);
          try {
            await api.delete(`/api/posts/${id}`);
            router.replace('/community');
          } catch (e) {
            setFailed(e instanceof ApiError ? e.message : '내리지 못했습니다.');
          } finally {
            setBusy(false);
          }
        }}
      />

      <ConfirmDialog
        visible={reporting}
        title="이 글을 신고할까요?"
        message="여러 사람이 신고하면 운영자가 확인할 때까지 자동으로 감춰집니다."
        confirmLabel="신고"
        danger
        busy={busy}
        onCancel={() => setReporting(false)}
        onConfirm={() => {
          setReporting(false);
          report('');
        }}
      />
    </Screen>
  );
}

/** 하루치. 지도는 두지 않습니다 — 구경하는 화면이라 목록이면 충분합니다. */
function DayBlock({ day, index }: { day: ItineraryDay; index: number }) {
  const color = day.color || dayColor(index);

  return (
    <Card>
      <Row gap={Spacing.md} style={styles.dayHead}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Subtitle>{day.shortName || day.label || `${index + 1}일차`}</Subtitle>
        <Badge label={`${day.places.length}곳`} tone="muted" />
      </Row>

      {day.theme ? (
        <Body small tone="secondary">
          {day.theme}
        </Body>
      ) : null}

      {day.places.map((place, i) => (
        <Row key={i} gap={Spacing.md} style={styles.place}>
          <View style={[styles.order, { backgroundColor: color }]}>
            <Body small strong style={styles.orderText}>
              {i + 1}
            </Body>
          </View>
          <View style={styles.placeText}>
            <Row gap={Spacing.sm}>
              {place.time ? (
                <Body small strong tone="accent">
                  {place.time}
                </Body>
              ) : null}
              <Body strong numberOfLines={2}>
                {place.name}
              </Body>
            </Row>
            {place.note ? (
              <Caption tone="secondary" numberOfLines={2}>
                {place.note}
              </Caption>
            ) : null}
            {place.cat || place.cost ? (
              <Row gap={Spacing.sm}>
                {place.cat ? <Caption>{place.cat}</Caption> : null}
                {place.cost ? <Caption>{place.cost}</Caption> : null}
              </Row>
            ) : null}
          </View>
        </Row>
      ))}
    </Card>
  );
}

/**
 * 가져오기.
 *
 * <p>첫날을 새로 받습니다. 남이 작년에 다녀온 날짜를 그대로 물려받으면 이미
 * 지나간 일정이 됩니다.
 */
function CopySheet({
  visible,
  postId,
  title,
  onDone,
  onCancel,
}: {
  visible: boolean;
  postId: string;
  title: string;
  onDone: (tripId: string) => void;
  onCancel: () => void;
}) {
  const [startIso, setStartIso] = useState(today());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function submit() {
    setFailed(null);
    setBusy(true);
    try {
      const res = await api.post<{ tripId: string }>(`/api/posts/${postId}/copy`, { startIso });
      onDone(res.tripId);
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : '가져오지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title="언제 떠나시나요?"
      onClose={onCancel}
      footer={<Button label="내 여행으로 가져오기" onPress={submit} busy={busy} />}>
      <Caption tone="secondary">
        「{title}」 의 일정이 그대로 복사됩니다. 첫날을 정하면 나머지 날짜가 따라옵니다. 가져온
        뒤에는 마음대로 고칠 수 있습니다.
      </Caption>
      <DateField label="떠나는 날" value={startIso} onChange={setStartIso} />
      {failed ? <ErrorNote message={failed} /> : null}
    </BottomSheet>
  );
}

function today() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const styles = StyleSheet.create({
  head: {
    gap: Spacing.xs,
  },
  grow: {
    flex: 1,
  },
  dayHead: {
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  place: {
    alignItems: 'flex-start',
  },
  placeText: {
    flex: 1,
    gap: 2,
  },
  order: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: {
    color: '#FFFFFF',
  },
});
