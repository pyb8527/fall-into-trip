import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { api, API_BASE, ApiError, query, UNEXPECTED } from '@/api/client';
import type { ItineraryDay, ItineraryPlace, PostDetail } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import {
  CommentList,
  PlaceComments,
  countByPlace,
  useComments,
} from '@/components/comment-list';
import type { MapPlace } from '@/components/map-types';
import { SignUpGate } from '@/components/signup-gate';
import { TripMap } from '@/components/trip-map';
import { iconOf } from '@/constants/place-icons';
import { Colors, dayColor, Radius, Spacing } from '@/constants/theme';
import { takeComeback, type Comeback, type ComebackDo } from '@/lib/comeback';
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
  Icon,
  IconButton,
  Loading,
  Press,
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
  /** 펼쳐 둔 날. 첫날만 열어 둡니다 — 다 접히면 제목만 늘어선 화면이 됩니다. */
  const [opened, setOpened] = useState<Set<number>>(() => new Set([0]));
  const [savedNames, setSavedNames] = useState<Set<string>>(new Set());
  /** 댓글 판을 열어 둔 장소. */
  const [at, setAt] = useState<{ dayIndex: number; placeIndex: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  /** 계정이 있어야 되는 것을 눌렀을 때 올라오는 판. */
  const [gate, setGate] = useState<Comeback | null>(null);

  /*
    댓글은 한 번만 받아 옵니다. 장소마다 몇 개인지 세는 것과 판에 펼쳐 보여
    주는 것이 같은 것을 봐야 합니다 — 따로 받아 오면 하나 남긴 뒤 한쪽 숫자만
    늘어납니다.
  */
  const talk = useComments(id, !!data?.feedback);
  const perPlace = useMemo(() => countByPlace(talk.comments), [talk.comments]);

  /** 지도에서 켜 둔 곳. */
  const [activeId, setActiveId] = useState<string | null>(null);

  /** 사본의 장소를 지도에 얹을 모양으로. 자리(몇째 날 몇 번째)가 곧 이름표입니다. */
  const pins = useMemo<MapPlace[]>(
    () =>
      (data?.itinerary.days ?? []).flatMap((day, di) =>
        day.places
          .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
          .map((p, i) => ({
            id: `${di}:${i}`,
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            dayIndex: di,
            order: i + 1,
            emoji: iconOf(p.icon),
            color: day.color || dayColor(di),
            fit: true,
            radius: null,
            detail: {
              time: p.time,
              cat: p.cat,
              cost: p.cost,
              note: p.note,
              sub: null,
              dayLabel: day.shortName || day.label || `${di + 1}일차`,
              visited: false,
            },
          })),
      ),
    [data],
  );

  /**
   * 계정이 필요한 동작 앞에서 한 번 걸러 줍니다.
   *
   * <p>튕겨 보내는 대신 왜 필요한지를 그 자리에서 말합니다. 무엇을 하려
   * 했는지도 함께 적어 두어, 가입하고 돌아오면 그 자리에서 이어집니다.
   */
  function needLogin(what: ComebackDo = 'copy', arg?: string) {
    setGate({ where: `/community/${id}`, what, arg });
  }

  function toggleLike() {
    if (!user || !data) {
      needLogin('like');
      return;
    }
    const next = !data.liked;
    setData((prev) =>
      prev ? { ...prev, liked: next, likeCount: prev.likeCount + (next ? 1 : -1) } : prev,
    );
    api.post(`/api/posts/${id}/like${query({ on: next })}`).catch(() => reload());
  }

  /**
   * 이 장소만 보석함에 담습니다.
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
        /* 담을 때 그림도 함께 갑니다. 안 넘기면 남의 일정에서 담아 온 곳만
           내 지도에서 민무늬가 됩니다. */
        icon: place.icon,
        note: place.note,
        fromPost: id,
      });
      setSavedNames((prev) => new Set(prev).add(place.name));
      setNotice(`「${place.name}」 를 보석함에 담았습니다.`);
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  async function report(reason: string) {
    setFailed(null);
    setBusy(true);
    try {
      await api.post(`/api/posts/${id}/report`, { reason });
      setNotice('신고했습니다. 운영자가 확인합니다.');
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  /*
    가입하고 돌아왔으면 하려던 것을 이어서 합니다.

    이것이 없으면 가입을 마치고 돌아온 사람이 방금 무엇을 누르려 했는지
    다시 찾아 다시 눌러야 합니다. 거기서 많이 빠집니다.

    기억은 이 탭의 메모리에만 있고(lib/intent), 꺼내면 지워집니다. 주소에
    싣지 않으므로 링크를 받은 남에게 옮아가지 않습니다.
  */
  useEffect(() => {
    if (!user || !data) {
      return;
    }
    const back = takeComeback(`/community/${id}`);
    if (!back) {
      return;
    }
    if (back.what === 'copy') {
      setCopying(true);
    } else if (back.what === 'report') {
      setReporting(true);
    } else if (back.what === 'like') {
      /* 이미 눌러져 있으면 그대로 둡니다. 되풀이하면 방금 누른 것이 취소됩니다. */
      if (!data.liked) {
        toggleLike();
      }
    } else if (back.what === 'save' && back.arg) {
      const [di, pi] = back.arg.split(':').map(Number);
      const place = data.itinerary.days[di]?.places[pi];
      if (place) {
        save(place);
      }
    } else if (back.what === 'comment' && back.arg) {
      const [dayIndex, placeIndex] = back.arg.split(':').map(Number);
      if (data.itinerary.days[dayIndex]?.places[placeIndex]) {
        setAt({ dayIndex, placeIndex });
      }
    }
    /* data 가 바뀔 때마다 다시 돌지만, 위에서 이미 꺼내 비웠으므로
       두 번째부터는 곧장 빠져나옵니다. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, data, id]);

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
      /*
        지도는 위에 붙여 둡니다.

        아래 일정을 훑는 내내 "여기가 어디쯤인가" 를 봐야 하는데, 함께
        흘려보내면 장소 하나를 누를 때마다 위로 되감아야 했습니다. 이제
        누르면 붙어 있는 지도가 그 자리로 갑니다.
      */
      header={
        pins.length > 0 ? (
          <TripMap places={pins} activeId={activeId} onSelect={setActiveId} height={220} />
        ) : (
          <PostMap postId={id} title={data.title} height={160} />
        )
      }
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
              onPress={() => (user ? setCopying(true) : needLogin('copy'))}
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
          {data.feedback ? ` · 댓글 ${data.commentCount}` : ''}
        </Caption>
      </View>

      {notice ? <Body tone="success">{notice}</Body> : null}
      {failed ? <ErrorNote message={failed} /> : null}

      {/*
        여러 날짜를 한꺼번에 펼쳐 두면 닷새짜리 일정은 스무 번을 내려야
        끝까지 갑니다. 접어 두고 궁금한 날만 엽니다.

        첫날은 열어 둡니다. 다 접혀 있으면 무엇이 들었는지 모르는 채로
        제목만 늘어선 화면이 됩니다.
      */}
      {data.itinerary.days.map((day, i) => (
        <DayBlock
          key={i}
          day={day}
          index={i}
          open={opened.has(i)}
          onToggle={() =>
            setOpened((was) => {
              const next = new Set(was);
              if (!next.delete(i)) {
                next.add(i);
              }
              return next;
            })
          }
          onSave={(place, at) => (user ? save(place) : needLogin('save', `${i}:${at}`))}
          savedNames={savedNames}
          feedback={data.feedback}
          countAt={(placeIndex) => perPlace.get(`${i}:${placeIndex}`) ?? 0}
          onComment={(placeIndex) => setAt({ dayIndex: i, placeIndex })}
          activeId={activeId}
          onFocus={(placeIndex) => setActiveId(`${i}:${placeIndex}`)}
        />
      ))}

      {/*
        아래 목록은 거르지 않고 전부 보여 줍니다. 장소에 달린 것도 어디에
        달렸는지 표를 붙여 함께 둡니다 — 글 하나를 열었을 때 무슨 이야기가
        오갔는지는 한자리에서 훑을 수 있어야 합니다.

        특정 장소에 대해 말하려면 그 장소 줄의 "댓글" 을 누릅니다.
      */}
      {data.feedback ? (
        <>
          <Divider />
          <CommentList
            postId={id}
            itinerary={data.itinerary}
            comments={talk.comments}
            failed={talk.failed}
            reload={talk.reload}
            onNeedLogin={() => needLogin('comment')}
            onCountChanged={reload}
          />
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
            onPress={() => (user ? setReporting(true) : needLogin('report'))}
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

      {at ? (
        <PlaceComments
          visible
          placeName={data.itinerary.days[at.dayIndex]?.places[at.placeIndex]?.name ?? '이 장소'}
          onClose={() => setAt(null)}
          postId={id}
          itinerary={data.itinerary}
          comments={talk.comments}
          failed={talk.failed}
          reload={talk.reload}
          onNeedLogin={() => needLogin('comment', `${at.dayIndex}:${at.placeIndex}`)}
          onCountChanged={reload}
          at={at}
        />
      ) : null}

      <ConfirmDialog
        visible={removing}
        title="내릴까요?"
        message="둘러보기에서 사라집니다. 내 여행은 그대로 남습니다."
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
            setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
          } finally {
            setBusy(false);
          }
        }}
      />

      <SignUpGate intent={gate} onClose={() => setGate(null)} />

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
  open,
  onToggle,
  onSave,
  savedNames,
  feedback,
  countAt,
  onComment,
  activeId,
  onFocus,
}: {
  day: ItineraryDay;
  index: number;
  /** 펼쳐 두었는지. 접혀 있으면 제목 줄만 보입니다. */
  open: boolean;
  onToggle: () => void;
  /** @param at 이 날에서 몇 번째 장소인지. 가입하고 돌아왔을 때 그 자리를 다시 찾는 데 씁니다. */
  onSave: (place: ItineraryPlace, at: number) => void;
  /** 이미 담은 곳. 별을 채워 두면 두 번 누르지 않습니다. */
  savedNames: Set<string>;
  /** 댓글을 받는 글인지. 안 열었으면 댓글 단추를 두지 않습니다. */
  feedback: boolean;
  /** 이 장소에 달린 댓글 수. */
  countAt: (placeIndex: number) => number;
  onComment: (placeIndex: number) => void;
  /** 지도에서 켜 둔 곳. 목록의 그 줄도 함께 켜집니다. */
  activeId: string | null;
  onFocus: (placeIndex: number) => void;
}) {
  const color = day.color || dayColor(index);

  return (
    <Card>
      {/* 제목 줄 전체가 여닫는 자리입니다. 화살표만 눌러야 하면 손끝으로는
          맞히기 어렵습니다. */}
      <Press
        onPress={onToggle}
        scale={0.995}
        accessibilityLabel={`${day.shortName || day.label || `${index + 1}일차`} ${open ? '접기' : '펼치기'}`}>
        <Row gap={Spacing.md} style={styles.dayHead}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Subtitle>{day.shortName || day.label || `${index + 1}일차`}</Subtitle>
          <Badge label={`${day.places.length}곳`} tone="muted" />
          <View style={styles.grow} />
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} tone="muted" />
        </Row>
      </Press>

      {/* 접혀 있어도 그날의 주제는 남겨 둡니다. 어느 날을 열지 고르는 데
          가장 도움이 되는 한 줄입니다. */}
      {day.theme ? (
        <Body small tone="secondary">
          {day.theme}
        </Body>
      ) : null}

      {!open
        ? null
        : day.places.map((place, i) => (
        <Row
          key={i}
          gap={Spacing.md}
          style={[styles.place, activeId === `${index}:${i}` ? styles.placeOn : null]}>
          {/*
            누르면 지도가 그리로 갑니다. 어디쯤인지 모르는 채로 이름만 읽어서는
            가져올지를 정할 수 없습니다.

            누르는 자리는 이름 쪽까지입니다. 옆의 담기·댓글은 따로 눌립니다 —
            겹쳐 두면 담으려다 지도만 움직입니다.
          */}
          <Press
            onPress={() => onFocus(i)}
            scale={0.99}
            accessibilityLabel={`${place.name} 지도에서 보기`}
            style={styles.placeTap}>
          {/* 같은 이유로 여기도 상자를 걷습니다. 날짜는 위 제목 줄의
              점이 말하고 있습니다. */}
          <View style={styles.order}>
            <Body small style={styles.orderText}>
              {iconOf(place.icon) || i + 1}
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
          </Press>

          {/*
            말풍선 그림만 두었을 때는 눌러도 아래 목록이 걸러질 뿐이라, 무슨
            일이 일어났는지 보이지 않았습니다. 몇 개 달렸는지를 글자로 적고,
            누르면 그 장소의 댓글만 담긴 판이 올라옵니다.
          */}
          {feedback ? (
            <Row gap={2}>
              <IconButton
                name="message-square"
                label={
                  countAt(i) > 0
                    ? `${place.name} 댓글 ${countAt(i)}개 보기`
                    : `${place.name}에 댓글 남기기`
                }
                tone="accent"
                active={countAt(i) > 0}
                onPress={() => onComment(i)}
              />
              {countAt(i) > 0 ? (
                <Caption tone="accent" strong>
                  {countAt(i)}
                </Caption>
              ) : null}
            </Row>
          ) : null}
          {/* 일정을 통째로 가져오지 않고 이 집만 담을 수 있어야 합니다. */}
          <IconButton
            name="star"
            label={`${place.name} 담기`}
            tone={savedNames.has(place.name) ? 'accent' : 'default'}
            active={savedNames.has(place.name)}
            onPress={() => onSave(place, i)}
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
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
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


/**
 * 동선 그림.
 *
 * <p>서버가 구글에서 받아 우리 주소로 내보냅니다. 키를 안 넣어 두었거나
 * 좌표가 하나도 없는 일정이면 못 받아 오는데, 그때 자리를 그대로 두면 회색
 * 상자만 덩그러니 남습니다. 아예 비웁니다.
 */
function PostMap({ postId, title, height }: { postId: string; title: string; height: number }) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return null;
  }
  return (
    <Image
      source={{ uri: `${API_BASE}/api/posts/${postId}/map` }}
      style={[styles.thumb, { height }]}
      resizeMode="cover"
      accessibilityLabel={`${title} 동선`}
      onError={() => setBroken(true)}
    />
  );
}

const styles = StyleSheet.create({
  head: {
    gap: Spacing.xs,
  },
  thumb: {
    width: '100%',
    borderRadius: Radius.none,
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
    borderRadius: 0,
  },
  place: {
    alignItems: 'flex-start',
    flexWrap: 'nowrap',
    borderRadius: Radius.none,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  /* 지도에서 켜 둔 줄. 목록과 지도가 같은 곳을 가리킨다는 것이 보여야 합니다. */
  placeOn: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  placeTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  placeText: {
    flex: 1,
    gap: 2,
  },
  order: {
    width: 22,
    alignItems: 'center',
  },
  orderText: {
    color: Colors.textMuted,
  },
});
