import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { api, API_BASE, ApiError, query } from '@/api/client';
import type { ItineraryDay, ItineraryPlace, PostDetail } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { CommentList } from '@/components/comment-list';
import { Colors, dayColor, Radius, Spacing } from '@/constants/theme';
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
  IconButton,
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
  const [savedNames, setSavedNames] = useState<Set<string>>(new Set());
  /** 장소 하나를 두고 의견을 보는 중이면 그 자리. */
  const [at, setAt] = useState<{ dayIndex: number; placeIndex: number } | null>(null);
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

  /**
   * 이 장소만 보관함에 담습니다.
   *
   * <p>담긴 것을 이름으로 기억해 별을 채워 둡니다. 서버는 같은 구글 번호를
   * 두 번 담지 않지만, 화면이 그것을 모르면 눌러도 아무 일도 안 일어나는
   * 것처럼 보입니다.
   */
  async function save(place: ItineraryPlace) {
    setFailed(null);
    try {
      await api.post('/api/saved', {
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        placeId: place.placeId,
        cat: place.cat,
        note: place.note,
        fromPost: id,
      });
      setSavedNames((prev) => new Set(prev).add(place.name));
      setNotice(`「${place.name}」 를 보관함에 담았습니다.`);
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : '담지 못했습니다.');
    }
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

      <Image
        source={{ uri: `${API_BASE}/api/posts/${id}/map` }}
        style={styles.thumb}
        resizeMode="cover"
        accessibilityLabel={`${data.title} 동선`}
      />

      <View style={styles.head}>
        <Title>{data.title}</Title>
        {data.summary ? <Body tone="secondary">{data.summary}</Body> : null}
        <Caption tone="secondary">
          {data.authorName} · {data.dayCount}일 · {data.placeCount}곳 · 조회{' '}
          {data.viewCount.toLocaleString()}
          {data.feedback ? ` · 의견 ${data.commentCount}` : ''}
        </Caption>
        {data.feedback ? <Badge label="의견 환영" tone="accent" /> : null}
      </View>

      {notice ? <Body tone="success">{notice}</Body> : null}
      {failed ? <ErrorNote message={failed} /> : null}

      {data.itinerary.days.map((day, i) => (
        <DayBlock
          key={i}
          day={day}
          index={i}
          onSave={(place) => (user ? save(place) : needLogin())}
          savedNames={savedNames}
          feedback={data.feedback}
          onComment={(placeIndex) => setAt({ dayIndex: i, placeIndex })}
        />
      ))}

      {data.feedback ? (
        <>
          <Divider />
          <CommentList
            postId={id}
            itinerary={data.itinerary}
            at={at}
            onNeedLogin={needLogin}
            onCountChanged={reload}
          />
          {at ? (
            <Button
              label="모든 의견 보기"
              variant="ghost"
              compact
              onPress={() => setAt(null)}
            />
          ) : null}
        </>
      ) : null}

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
function DayBlock({
  day,
  index,
  onSave,
  savedNames,
  feedback,
  onComment,
}: {
  day: ItineraryDay;
  index: number;
  onSave: (place: ItineraryPlace) => void;
  /** 이미 담은 곳. 별을 채워 두면 두 번 누르지 않습니다. */
  savedNames: Set<string>;
  /** 의견을 받는 글인지. 안 열었으면 말풍선을 두지 않습니다. */
  feedback: boolean;
  onComment: (placeIndex: number) => void;
}) {
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

          {/* "여기 말고 옆집" 은 어느 집인지가 붙어야 뜻이 통합니다. */}
          {feedback ? (
            <IconButton
              name="message-square"
              label={`${place.name}에 의견 남기기`}
              onPress={() => onComment(i)}
            />
          ) : null}
          {/* 일정을 통째로 가져오지 않고 이 집만 담을 수 있어야 합니다. */}
          <IconButton
            name="star"
            label={`${place.name} 담기`}
            tone={savedNames.has(place.name) ? 'accent' : 'default'}
            active={savedNames.has(place.name)}
            onPress={() => onSave(place)}
          />
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
  thumb: {
    width: '100%',
    height: 190,
    borderRadius: Radius.lg,
    backgroundColor: Colors.fill,
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
