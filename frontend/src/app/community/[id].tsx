import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { PathTitle } from '@/ui/nav';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, query, UNEXPECTED } from '@/api/client';
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
import { PlaceDetailSheet } from '@/components/place-detail-sheet';
import { PostMap } from '@/components/post-map';
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
  type IconName,
  Loading,
  Press,
  Row,
  Screen,
  Subtitle,
  Title,
} from '@/ui';
import { DateField } from '@/ui/date-field';
import { KEEP, UNKEEP } from '@/constants/words';

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
  /*
    내 보석함에 이미 있는 것들. 이름 → 담아 둔 번호.

    <h3>왜 처음에 받아 오는가</h3>

    <p>이 화면에서 담은 것만 기억하고 있었습니다. 그래서 <b>어제 담아 둔
    곳</b>은 표시가 비어 있었고, 남의 일정을 보면서 "이거 담았던가" 를 알
    길이 없어 같은 곳을 또 눌렀습니다.

    <p>번호까지 들고 있어야 빼는 것도 됩니다. 이름만으로는 무엇을 빼야
    하는지 서버에 말할 수 없습니다.

    <p>이름으로 맞춰 봅니다. 사본의 장소에는 우리 보석함 번호가 없고,
    구글 번호도 좌표만 찍어 넣은 곳에는 없습니다. 같은 글 안에서 이름이
    겹치는 일은 드뭅니다.
  */
  const [savedIds, setSavedIds] = useState<Map<string, string>>(new Map());
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
  /** 들여다보는 중인 곳. 판이 지도를 덮으므로 지도는 안 움직입니다. */
  const [looking, setLooking] = useState<ItineraryPlace | null>(null);

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
  /*
    로그인한 사람의 보석함을 한 번 읽어 둡니다.

    <p>로그인 안 했으면 부르지 않습니다 — 401 이 돌아오고, 그 화면에서는
    어차피 담을 수도 없습니다.
  */
  useEffect(() => {
    if (!user) {
      setSavedIds(new Map());
      return;
    }
    let alive = true;
    api
      .get<{ places: { id: string; name: string }[] }>('/api/saved')
      .then((res) => {
        if (alive) {
          setSavedIds(new Map(res.places.map((p) => [p.name, p.id])));
        }
      })
      .catch(() => {
        /* 못 읽어도 화면은 돕니다. 표시가 비어 있을 뿐입니다. */
      });
    return () => {
      alive = false;
    };
  }, [user]);

  /**
   * 담고, 다시 누르면 뺍니다.
   *
   * <p>담는 길만 있었습니다. 잘못 누르면 보석함으로 가서 찾아 빼야 했는데,
   * 그건 한 번 누른 것을 되돌리는 값으로는 너무 비쌉니다.
   */
  async function toggleSave(place: ItineraryPlace) {
    const had = savedIds.get(place.name);
    if (had) {
      await unsave(place.name, had);
      return;
    }
    await save(place);
  }

  async function unsave(name: string, savedId: string) {
    setFailed(null);
    try {
      await api.delete(`/api/saved/${savedId}`);
      setSavedIds((prev) => {
        const next = new Map(prev);
        next.delete(name);
        return next;
      });
      setNotice(`「${name}」 를 보석함에서 뺐습니다.`);
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  async function save(place: ItineraryPlace) {
    setFailed(null);
    try {
      const res = await api.post<{ place: { id: string } }>('/api/saved', {
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
      setSavedIds((prev) => new Map(prev).set(place.name, res.place.id));
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
          <TripMap
            places={pins}
            activeId={activeId}
            onSelect={setActiveId}
            /* 닷새치 스무 곳이 한 지도에 얹히면 어느 것이 몇째 날인지는
               색으로만 남습니다. 날짜를 고르면 그 하루만 봅니다 — 전체화면도
               같이 걸립니다. */
            dayFilter
            height={220}
          />
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
      <Stack.Screen
        options={{
          title: data.title,
          headerTitle: () => <PathTitle parent="여행 둘러보기" title={data.title} />,
        }}
      />

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
          onSave={(place, at) => (user ? toggleSave(place) : needLogin('save', `${i}:${at}`))}
          savedIds={savedIds}
          feedback={data.feedback}
          countAt={(placeIndex) => perPlace.get(`${i}:${placeIndex}`) ?? 0}
          onComment={(placeIndex) => setAt({ dayIndex: i, placeIndex })}
          activeId={activeId}
          onFocus={(placeIndex) => setActiveId(`${i}:${placeIndex}`)}
          onLook={setLooking}
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

      {/*
        들여다보는 판.

        지도·평점·영업시간은 구글에서 옵니다. 담는 단추를 여기도 둡니다 —
        사정을 보고 나서 담는 것이 순서이고, 판을 닫고 목록에서 다시 별을
        찾게 하면 방금 본 것을 잊습니다.
      */}
      <PlaceDetailSheet
        place={looking}
        onClose={() => setLooking(null)}
        actions={
          looking ? (
            <Button
              label={savedIds.has(looking.name) ? UNKEEP : KEEP}
              variant={savedIds.has(looking.name) ? 'secondary' : 'primary'}
              compact
              onPress={() => {
                const target = looking;
                setLooking(null);
                if (user) {
                  toggleSave(target);
                } else {
                  needLogin('save', target.name);
                }
              }}
            />
          ) : null
        }
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
  savedIds,
  feedback,
  countAt,
  onComment,
  activeId,
  onFocus,
  onLook,
}: {
  day: ItineraryDay;
  index: number;
  /** 펼쳐 두었는지. 접혀 있으면 제목 줄만 보입니다. */
  open: boolean;
  onToggle: () => void;
  /** @param at 이 날에서 몇 번째 장소인지. 가입하고 돌아왔을 때 그 자리를 다시 찾는 데 씁니다. */
  onSave: (place: ItineraryPlace, at: number) => void;
  /** 이미 담은 곳. 별을 채워 두면 두 번 누르지 않습니다. */
  /** 보석함에 이미 있는 것들. 이름 → 담아 둔 번호. */
  savedIds: Map<string, string>;
  /** 댓글을 받는 글인지. 안 열었으면 댓글 단추를 두지 않습니다. */
  feedback: boolean;
  /** 이 장소에 달린 댓글 수. */
  countAt: (placeIndex: number) => number;
  onComment: (placeIndex: number) => void;
  /** 지도에서 켜 둔 곳. 목록의 그 줄도 함께 켜집니다. */
  activeId: string | null;
  onFocus: (placeIndex: number) => void;
  /** 이 곳을 들여다보는 판을 엽니다. */
  onLook: (place: ItineraryPlace) => void;
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
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={26} tone="muted" />
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
        <View
          key={i}
          style={[styles.place, activeId === `${index}:${i}` ? styles.placeOn : null]}>
          {/*
            누르면 지도가 그리로 갑니다. 어디쯤인지 모르는 채로 이름만 읽어서는
            가져올지를 정할 수 없습니다.

            <p>손대는 것들은 <b>줄 아래</b>에 따로 섭니다. 이름 옆에 두었더니
            긴 가게 이름이 그만큼 잘렸고, 읽는 것과 누르는 것이 한 줄에 끼어
            어느 쪽도 넉넉하지 않았습니다. 위는 읽는 자리, 아래는 누르는 자리.
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
            내 여행 상세와 같은 모양으로 둡니다.

            <h3>글자 단추 셋이 오른쪽에 몰려 있었습니다</h3>

            <p>"댓글 3 · 자세히 · 보석함에 담기" 가 줄 오른쪽에 모여 있었고,
            폭이 남으면 왼쪽 절반이 비었습니다. 같은 일을 하는 줄이 내 여행
            상세에서는 칸을 고르게 나눈 그림 단추인데, 남의 일정에서만 글자
            단추였습니다 — 같은 앱에서 같은 일을 두 모양으로 하고 있었습니다.

            <p>그림으로 바꾸면서 글자를 잃지는 않습니다. 눌러 주는 이름
            (accessibilityLabel)에 몇 개 달렸는지까지 그대로 담고, 댓글이
            있는 곳에는 점을 찍습니다.
          */}
          <Row gap={0} style={styles.placeActs}>
            {[
              feedback
                ? {
                    key: 'comment',
                    name: 'message-square' as IconName,
                    label: countAt(i) > 0 ? `댓글 ${countAt(i)}개 보기` : '댓글 남기기',
                    active: countAt(i) > 0,
                    dot: countAt(i) > 0,
                    onPress: () => onComment(i),
                  }
                : null,
              /*
                남의 일정에서 한 곳을 보고 가져올지 정하려면 이름과 메모만으로는
                모자랍니다. 평점이 몇인지 그날 문을 여는지가 있어야 고르는 일이
                됩니다. 장소 찾기에서 쓰는 것과 같은 판을 엽니다.
              */
              {
                key: 'look',
                name: 'info' as IconName,
                label: `${place.name} 자세히 보기`,
                onPress: () => onLook(place),
              },
              /* 일정을 통째로 가져오지 않고 이 집만 담을 수 있어야 합니다.
                 담긴 것은 눌러서 뺍니다 — 담는 길만 있으면 잘못 누른 뒤에
                 보석함까지 찾아가야 합니다. */
              {
                key: 'keep',
                name: 'bookmark' as IconName,
                label: savedIds.has(place.name) ? UNKEEP : KEEP,
                active: savedIds.has(place.name),
                onPress: () => onSave(place, i),
              },
            ]
              .filter((a) => a !== null)
              .map((a, at) => (
                <View key={a.key} style={[styles.placeAct, at > 0 && styles.placeActEdge]}>
                  <IconButton
                    bare
                    name={a.name}
                    label={a.label}
                    active={a.active}
                    dot={a.dot}
                    onPress={a.onPress}
                  />
                </View>
              ))}
          </Row>
        </View>
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
    borderRadius: 0,
  },
  place: {
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  /* 손대는 자리. 위와 선 하나로 가르고 오른쪽 끝에 모읍니다 — 왼쪽은 위
     글자들이 시작하는 자리라 비워 둬야 줄이 가지런합니다. */
  /* 줄 아래에 한 줄로 깔고 칸을 고르게 나눕니다. 위쪽과는 선 하나로
     가릅니다 — 읽는 곳과 누르는 곳입니다. */
  placeActs: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  placeAct: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 첫 칸 빼고 왼쪽에 칸막이. 댓글을 안 받는 글에서는 둘뿐이라 세어서 답니다. */
  placeActEdge: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.border,
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
