import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { PathTitle } from '@/ui/nav';
import { AppTabs } from '@/ui/tab-bar';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError, query, UNEXPECTED } from '@/api/client';
import type { ItineraryDay, ItineraryPlace, Maybe, PostDetail, Story } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import {
  CommentList,
  PlaceComments,
  countByPlace,
  useComments,
} from '@/components/comment-list';
import type { MapPlace } from '@/components/map-types';
import { PhotoStrip } from '@/components/photo-strip';
import { PlaceDetailSheet } from '@/components/place-detail-sheet';
import { StoryBlock } from '@/components/story-block';
import { PostFields, type PostShape } from '@/components/post-fields';
import { formatNights } from '@/lib/countdown';
import { PostMap } from '@/components/post-map';
import { SignUpGate } from '@/components/signup-gate';
import { TripMap } from '@/components/trip-map';
import { iconOf } from '@/constants/place-icons';
import {
  Colors,
  Gutter,
  Radius,
  Spacing,
  TabDock,
  Tap,
  Type,
  dayColor,
} from '@/constants/theme';
import { takeComeback, type Comeback, type ComebackDo } from '@/lib/comeback';
import {
  Badge,
  Band,
  Body,
  BottomSheet,
  Button,
  Caption,
  Chip,
  ConfirmDialog,
  ErrorNote,
  Icon,
  IconButton,
  ListRow,
  Loading,
  Press,
  Row,
  Screen,
  SectionHeader,
  Snack,
  Subtitle,
  Title,
  type IconName,
  useUndo,
} from '@/ui';
import { DateField } from '@/ui/date-field';
import { SidePanelWidth, useWide } from '@/ui/layout';
import { MapAside } from '@/ui/map-aside';
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
  /**
   * 글에서 빼려고 고른 장소.
   *
   * <p>되돌릴 수 없는 일이라 먼저 묻습니다. 여기 달린 댓글도 함께 사라지므로
   * 「먼저 하고 나중에 알리기」 로 둘 수 없습니다.
   */
  const [dropping, setDropping] = useState<{ dayIndex: number; placeIndex: number } | null>(null);
  const [removing, setRemoving] = useState(false);
  /** 글의 겉을 고치는 판을 열어 두었는지. */
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { undo, show: showUndo, hide: hideUndo } = useUndo();
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
  /*
    판이 덮고 있는 높이와, 판을 내렸을 때 보여야 할 머리 줄의 높이.

    <p>지도는 덮인 만큼 비켜 담고(bottomInset), 판은 머리 줄까지는 늘
    보이게 섭니다. 둘 다 재서 씁니다 — 화면 높이로 어림하면 작은 폰에서
    단추가 반쯤 잘립니다.
  */
  const [covered, setCovered] = useState(0);
  const [headTall, setHeadTall] = useState(0);
  const insets = useSafeAreaInsets();
  /*
    넓은 화면에서는 아래 띠가 없습니다.

    <p>갈래가 왼쪽 기둥으로 서고(ui/tab-bar), 끌어올리던 판도 왼쪽 패널이
    됩니다(ui/map-aside). 아래를 먹는 것이 없으니 비워 둘 것도 없습니다.
  */
  const wide = useWide();
  const dock = wide ? 0 : Math.max(insets.bottom, Spacing.s2) + TabDock;

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
  /*
    들여다보고 있는 곳.

    <p>장소만 들고 있었습니다. 그런데 판 안에서 댓글을 열려면 <b>몇째 날 몇째
    곳</b>인지가 있어야 합니다 — 댓글은 사본의 자리 번호에 달립니다. 줄만 알던
    것이라 판까지 함께 넘깁니다.
  */
  const [looking, setLooking] = useState<{
    place: ItineraryPlace;
    at: { dayIndex: number; placeIndex: number };
  } | null>(null);

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
      setNotice(`「${name}」 를 보석함에서 뺐어요.`);
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
      /*
        담은 다음이 더 중요합니다.

        <p>전에는 판 안에 "담았습니다" 한 줄이 떴습니다. 그런데 판을 내려
        두고 지도를 보다가 담으면 그 줄이 안 보이고, 무엇보다 <b>담아서
        뭘 하려던 것인지</b>는 아직 남아 있습니다 — 대개 내 일정에 넣으려던
        것입니다.

        <p>떠 있는 띠로 알리고 보석함으로 가는 길을 함께 냅니다. 안 누르면
        잠시 뒤 사라지므로 하던 일을 막지 않습니다.
      */
      showUndo({
        message: `「${place.name}」 를 보석함에 담았어요. 일정에 추가하러 가실까요?`,
        label: '보석함으로',
        onUndo: () => router.push('/(app)/saved'),
      });
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  /**
   * 올린 글에서 장소 하나를 뺍니다.
   *
   * <p>사본을 고치는 것입니다 — 원본 여행은 그대로입니다. 마지막 곳을 빼면
   * 그 날이 없어지고, 하나도 안 남게 되는 것은 서버가 막습니다(그때 하려던
   * 일은 고치기가 아니라 내리기입니다).
   */
  async function dropPlace(at: { dayIndex: number; placeIndex: number }) {
    setFailed(null);
    setBusy(true);
    try {
      await api.delete(`/api/posts/${id}/days/${at.dayIndex}/places/${at.placeIndex}`);
      /* 판에서 보고 있던 곳일 수도 있습니다. 없어진 자리를 가리킨 채로 두면
         판이 빈 곳을 들여다봅니다. */
      setLooking(null);
      setActiveId(null);
      reload();
      setNotice('글에서 뺐어요.');
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  async function report(reason: string) {
    setFailed(null);
    setBusy(true);
    try {
      await api.post(`/api/posts/${id}/report`, { reason });
      setNotice('신고했어요. 운영자가 확인해요.');
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
        <ErrorNote message={error ?? '글을 찾을 수 없어요.'} onRetry={reload} />
      </Screen>
    );
  }

  return (
    /*
      지도가 바탕, 글이 그 위의 판.

      <h3>왜 바꿨나</h3>

      <p>지도를 화면 위에 220px 로 박아 두고 그 아래로 글과 장소 목록이
      흘렀습니다. 그런데 남의 일정에서 보려는 것의 절반은 <b>어디를 어떤
      순서로 돌았나</b>입니다 — 220px 짜리 띠로는 닷새치 동선이 좁쌀만 하게
      들어갑니다.

      <p>내 여행 상세와 같은 얼개로 둡니다. 지도는 화면 전체를 쓰고, 읽는
      것들은 끌어 올리는 판에 담습니다. 판을 내리면 동선이 통째로 보이고,
      올리면 글과 댓글을 읽습니다. 보는 사람이 그때그때 정합니다.

      <p>대신 늘 펼쳐져 있던 단추들은 접었습니다(장소 줄의 댓글·자세히·
      보석함). 판이 좁아졌으니 <b>지금 고른 한 곳</b>의 것만 냅니다 —
      내 여행 상세가 이미 같은 규칙입니다.
    */
    <View style={styles.stage}>
      <Stack.Screen
        options={{
          title: data.title,
          headerTitle: () => <PathTitle parent="여행 둘러보기" title={data.title} />,
        }}
      />

      {/*
        지도가 앉는 자리. 넓은 화면에서는 왼쪽 420 을 패널에 내줍니다 —
        패널은 떠 있어서 자리를 차지하지 못하므로, 비켜 주지 않으면 지도
        왼쪽이 패널 뒤로 들어갑니다.
      */}
      <View style={[styles.mapPane, wide ? styles.mapPaneWide : null]}>
      {pins.length > 0 ? (
        <TripMap
          places={pins}
          activeId={activeId}
          onSelect={setActiveId}
          /* 닷새치 스무 곳이 한 지도에 얹히면 어느 것이 몇째 날인지는 색으로만
             남습니다. 날짜를 고르면 그 하루만 봅니다. */
          dayFilter
          bleed
          /* 읽는 자리라 전체화면은 안 냅니다. 펼쳐도 할 일이 없고, 펼치면
             정작 읽던 글이 가려집니다. */
          full={false}
          /* 판이 덮는 만큼 지도가 알아서 비켜 담습니다. */
          bottomInset={covered + dock}
        />
      ) : (
        <PostMap postId={id} title={data.title} height={260} />
      )}
      </View>

      <MapAside
        /* 아래 띠만큼 띄웁니다. 안 띄우면 판이 띠 뒤로 들어갑니다. */
        lift={dock}
        /* 내렸을 때 제목 줄과 단추까지는 보여야 합니다. 재서 그만큼 알려
           줍니다 — 화면 높이로 어림하면 작은 폰에서 단추가 반쯤 잘립니다. */
        revealAtLow={headTall > 0 ? headTall + Spacing.s4 : undefined}
        onHeightChange={setCovered}
        peek={
          <View
            style={styles.head}
            onLayout={(e) => setHeadTall(e.nativeEvent.layout.height)}>
            <Title>{data.title}</Title>
            {/*
              지역 → 기간 → 장소 수 → 쓴 사람 → 반응 순서로 적습니다. 목록
              카드와 같은 순서여야 같은 것을 읽고 있다는 것이 보입니다.

              <p>0 인 것은 뺍니다 — "댓글 0" 은 댓글이 없다는 말을 굳이 자리를
              차지하며 하는 것이고, 조회수는 아예 안 냅니다(목록과 같은
              까닭입니다).
            */}
            <Caption tone="secondary">
              {[
                data.region,
                formatNights(data.dayCount),
                `${data.placeCount}곳`,
                data.authorName,
                data.feedback && data.commentCount > 0 ? `댓글 ${data.commentCount}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Caption>
            {/*
              판을 내려 두어도 이 둘은 누를 수 있어야 합니다. 이 화면에
              들어온 까닭이 대개 둘 중 하나입니다.

              <h3>하나는 숫자, 하나는 동작</h3>

              <p>둘을 같은 알약 단추로 두었습니다. 그래서 하트가 「누르는
              동작」 으로만 보이고 <b>몇 사람이 눌렀는지</b>는 그 안에 끼인
              숫자였습니다. 하트는 네모 한 칸으로 떼어 내 숫자를 아래에
              적고, 남은 폭은 전부 주 동작이 먹습니다 — 왼쪽은 상태, 오른쪽은
              할 일입니다.
            */}
            <Row gap={Spacing.s2}>
              <Press
                onPress={toggleLike}
                scale={0.96}
                accessibilityLabel={data.liked ? '하트 빼기' : '하트 누르기'}
                accessibilityState={{ selected: data.liked }}
                style={styles.heartBox}>
                <Text style={[styles.heartMark, data.liked ? styles.heartOn : null]}>
                  {data.liked ? '♥' : '♡'}
                </Text>
                <Text style={styles.heartCount}>{data.likeCount}</Text>
              </Press>
              <View style={styles.grow}>
                {/* 이 화면에 들어온 까닭입니다. 옅은 코랄로 두었더니 흰 판
                    위에서 못 누르는 단추처럼 보였습니다. */}
                <Button
                  label="내 여행으로 가져오기"
                  strong
                  onPress={() => (user ? setCopying(true) : needLogin('copy'))}
                />
              </View>
            </Row>
          </View>
        }>
        {/* 표지. 제목 바로 아래입니다 — 글을 열었을 때 가장 먼저 보이는
            것이 그 여행이 어땠는지여야 합니다. */}
        {data.coverPhotoId ? (
          <PhotoStrip ids={[data.coverPhotoId]} height={200} />
        ) : null}

        {data.summary ? <Body tone="secondary">{data.summary}</Body> : null}

      {notice ? <Body tone="success">{notice}</Body> : null}
      {failed ? <ErrorNote message={failed} /> : null}

      {/*
        여러 날짜를 한꺼번에 펼쳐 두면 닷새짜리 일정은 스무 번을 내려야
        끝까지 갑니다. 접어 두고 궁금한 날만 엽니다.

        첫날은 열어 둡니다. 다 접혀 있으면 무엇이 들었는지 모르는 채로
        제목만 늘어선 화면이 됩니다.
      */}
      {/*
        일정과, 그 사이에 끼인 글.

        <p>글은 날마다 걸려 있습니다(stories[].dayIndex). 날 하나를 그리고
        거기 걸린 글을 바로 아래 세웁니다 — 뒤에 모아 두면 읽는 사람이 일정을
        다 지나간 뒤에야 사진을 보게 되고, 그 사진이 어느 날의 것인지 다시
        거슬러 올라가야 합니다.

        <p><b>옛 글에는 stories 가 없습니다.</b> 장소마다 기록을 남기던 시절에
        올린 글이고, 사본은 그때의 모습이라 고쳐 쓰지 않습니다. 없으면 그냥
        일정만 섭니다.
      */}
      {data.itinerary.days.map((day, i) => (
        <View key={`day-${i}`} style={styles.lane}>
        {/* 날과 날 사이를 띠가 가릅니다. 날마다 흰 판을 두르고 있었는데,
            판 바탕과 시트 바탕이 둘 다 흰색이라 가르는 일을 못 했습니다. */}
        {i > 0 ? <Band /> : null}
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
          activeId={activeId}
          onFocus={(placeIndex) => setActiveId(`${i}:${placeIndex}`)}
          onLook={(place, placeIndex) =>
            setLooking({ place, at: { dayIndex: i, placeIndex } })
          }
          mine={data.mine}
          onDrop={(placeIndex) => setDropping({ dayIndex: i, placeIndex })}
        />
        {storiesOn(data.itinerary.stories, i).map((s, at) => (
          <StoryBlock key={`story-${i}-${at}`} story={s} />
        ))}
        </View>
      ))}

      {/* 날이 안 적힌 글. 돌아와서 올린 것이라 일정 뒤에 섭니다. */}
      {storiesOn(data.itinerary.stories, null).length > 0 ? (
        <>
          {/* 흐린 작은 글씨 한 줄이었습니다. 그러면 위 일정의 꼬리말처럼
              읽혀, 여기서부터 다른 이야기라는 것이 안 보였습니다. 띠로
              가르고 다른 화면과 같은 구역 머리를 답니다. */}
          <Band />
          <SectionHeader title="다녀와서 남긴 것" tight />
          {storiesOn(data.itinerary.stories, null).map((s, at) => (
            <StoryBlock key={`tail-${at}`} story={s} />
          ))}
        </>
      ) : null}

      {/*
        아래 목록은 거르지 않고 전부 보여 줍니다. 장소에 달린 것도 어디에
        달렸는지 표를 붙여 함께 둡니다 — 글 하나를 열었을 때 무슨 이야기가
        오갔는지는 한자리에서 훑을 수 있어야 합니다.

        특정 장소에 대해 말하려면 그 장소를 누르고 「자세히」 를 엽니다 —
        댓글은 그 판 안에 있습니다.
      */}
      {data.feedback ? (
        <>
          <Band />
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

      {/*
        글을 다루는 일들.

        <h3>빨간 단추를 줄로 낮췄습니다</h3>

        <p>「내리기」 가 꽉 채운 빨간 단추였습니다. 그러면 읽기를 끝낸
        자리에서 가장 눈에 띄는 것이 <b>가장 하면 안 되는 일</b>입니다.
        채운 빨강은 「정말 내릴까요?」 를 묻는 다이얼로그의 확인 단추에만
        씁니다 — 여기서는 글자만 빨간 줄입니다.
      */}
      <Band />

      {/* 손으로 그린 줄들이었습니다. 목록 줄 부품을 쓰면 높이·여백·선이
          위 목록들과 같아져, 글을 다 읽은 뒤에 나오는 「또 하나의 줄
          묶음」 으로 읽힙니다. */}
      {data.mine ? (
        <>
          {/*
            고치기가 내리기보다 앞입니다.

            <p>내리는 길만 있었습니다. 그런데 제목을 잘못 적었거나 태그를
            빼먹은 것 때문에 내리면 그동안 받은 추천과 조회수와 댓글이 함께
            사라집니다 — 그 값이 너무 커서 대개 틀린 채로 둡니다.
          */}
          <ListRow
            left={<Icon name="edit-2" size={20} tone="muted" />}
            title="고치기"
            onPress={() => setEditing(true)}
          />
          <ListRow
            left={<Icon name="trash-2" size={20} tone="danger" />}
            title={
              <Body strong tone="danger">
                내리기
              </Body>
            }
            last
            onPress={() => setRemoving(true)}
          />
        </>
      ) : (
        <ListRow
          left={<Icon name="flag" size={20} tone="muted" />}
          title={
            <Body strong tone="secondary">
              신고
            </Body>
          }
          last
          onPress={() => (user ? setReporting(true) : needLogin('report'))}
        />
      )}
      </MapAside>

      {/* 아래 띠. 이 화면은 Screen 이 아니라 지도 위에 판을 얹는 얼개라
          직접 답니다. */}
      <AppTabs />

      {/* 떠 있는 띠도 직접 얹습니다. 아래 띠보다 위에 서야 가려지지
          않습니다. */}
      <View
        pointerEvents="box-none"
        style={[
          styles.snackRail,
          wide ? styles.snackRailPast : null,
          { bottom: dock + Spacing.s3 },
        ]}>
        <Snack undo={undo} onHide={hideUndo} />
      </View>

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
        days={data.itinerary.days}
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
        message="둘러보기에서 사라져요. 내 여행은 그대로 남아요."
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
        place={looking?.place ?? null}
        onClose={() => setLooking(null)}
        /*
          댓글이 줄에서 판 안으로 들어왔습니다.

          <p>내 여행 상세에서 「한 줄」이 같은 자리에 서는 것과 같습니다 — 남이
          이 곳에 대해 무슨 말을 남겼는지는 "여기가 어떤 데지" 에 대한 답의
          일부이고, 같은 일을 하는 자리가 화면마다 다를 이유가 없습니다.

          <p>댓글을 안 받는 글에는 안 냅니다.
        */
        talk={
          looking && data.feedback
            ? {
                noun: '댓글',
                count: perPlace.get(`${looking.at.dayIndex}:${looking.at.placeIndex}`) ?? 0,
                onOpen: () => {
                  const at = looking.at;
                  setLooking(null);
                  if (user) {
                    setAt(at);
                  } else {
                    needLogin('comment', `${at.dayIndex}:${at.placeIndex}`);
                  }
                },
              }
            : null
        }
        actions={
          looking ? (
            <Button
              label={savedIds.has(looking.place.name) ? UNKEEP : KEEP}
              variant={savedIds.has(looking.place.name) ? 'secondary' : 'primary'}
              compact
              onPress={() => {
                const target = looking.place;
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

      {/* 댓글까지 함께 사라지는 일이라 먼저 묻습니다. */}
      <ConfirmDialog
        visible={dropping !== null}
        title="이 장소를 글에서 뺄까요?"
        message={
          dropping
            ? `${
                data.itinerary.days[dropping.dayIndex]?.places[dropping.placeIndex]?.name ??
                '이 장소'
              } 이(가) 이 글에서 사라져요. 여기 달린 댓글도 함께 사라져요. 내 여행은 그대로 남아요.`
            : ''
        }
        confirmLabel="빼기"
        danger
        busy={busy}
        onCancel={() => setDropping(null)}
        onConfirm={() => {
          const at = dropping;
          setDropping(null);
          if (at) {
            dropPlace(at);
          }
        }}
      />

      <EditSheet
        visible={editing}
        postId={id}
        now={{
          title: data.title,
          summary: data.summary ?? '',
          region: data.region,
          tags: data.tags,
          feedback: data.feedback,
          coverPhotoId: data.coverPhotoId,
          visibility: data.visibility,
        }}
        onCancel={() => setEditing(false)}
        onDone={() => {
          setEditing(false);
          reload();
        }}
      />

      <SignUpGate intent={gate} onClose={() => setGate(null)} />

      <ConfirmDialog
        visible={reporting}
        title="이 글을 신고할까요?"
        message="여러 사람이 신고하면 운영자가 확인할 때까지 자동으로 감춰져요."
        confirmLabel="신고"
        danger
        busy={busy}
        onCancel={() => setReporting(false)}
        onConfirm={() => {
          setReporting(false);
          report('');
        }}
      />
    </View>
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
  activeId,
  onFocus,
  onLook,
  mine,
  onDrop,
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
  /** 댓글을 받는 글인지. 안 열었으면 달린 것이 있다는 점도 안 찍습니다. */
  feedback: boolean;
  /** 이 장소에 달린 댓글 수. */
  countAt: (placeIndex: number) => number;
  /** 지도에서 켜 둔 곳. 목록의 그 줄도 함께 켜집니다. */
  activeId: string | null;
  onFocus: (placeIndex: number) => void;
  /** 이 곳을 들여다보는 판을 엽니다. */
  /** 들여다보는 판을 엽니다. 댓글도 그 판 안에 있습니다. */
  onLook: (place: ItineraryPlace, placeIndex: number) => void;
  /** 내가 올린 글인지. 그때만 장소를 뺄 수 있습니다. */
  mine: boolean;
  /** 이 장소를 글에서 빼려고 합니다. */
  onDrop: (placeIndex: number) => void;
}) {
  const color = day.color || dayColor(index);

  return (
    <View style={styles.day}>
      {/* 제목 줄 전체가 여닫는 자리입니다. 화살표만 눌러야 하면 손끝으로는
          맞히기 어렵습니다. */}
      <Press
        onPress={onToggle}
        scale={0.995}
        accessibilityLabel={`${day.shortName || day.label || `${index + 1}일차`} ${open ? '접기' : '펼치기'}`}>
        <Row gap={Spacing.s3} style={styles.dayHead}>
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
          {/* 번호는 언제나 있습니다. 그림은 이름 옆으로 — 내 여행 상세와
              같은 규칙입니다. */}
          <View style={styles.order}>
            <Body small style={styles.orderText}>
              {i + 1}
            </Body>
          </View>
          <View style={styles.placeText}>
            <Row gap={Spacing.s2}>
              {place.time ? (
                <Body small strong tone="accent">
                  {place.time}
                </Body>
              ) : null}
              {iconOf(place.icon) ? (
                <Body small>{iconOf(place.icon)}</Body>
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
              <Row gap={Spacing.s2}>
                {place.cat ? <Caption>{place.cat}</Caption> : null}
                {place.cost ? <Caption>{place.cost}</Caption> : null}
              </Row>
            ) : null}
          </View>
          </Press>

          {/*
            그 자리에서 남긴 것.

            <p>메모는 <b>가기 전에</b> 적어 둔 것이고 이것은 <b>다녀와서</b>
            남긴 것입니다. 둘을 같은 회색 글로 붙여 두면 어느 것이 계획이고
            어느 것이 겪은 일인지 안 갈립니다 — 별과 사진이 그것을 가릅니다.

            <h3>왜 이름 칸 밖인가</h3>

            <p>이름·메모와 같은 칸에 있었습니다. 그 칸은 번호 열과 좌우 여백을
            뺀 나머지라, 가로로 긴 사진이 그만큼 좁은 자리에 들어갔습니다.
            여기는 남의 여행기를 <b>읽는</b> 자리이고, 어디를 갔는지는 위의
            이름이 말하고 거기가 어땠는지는 사진이 말합니다 — 그러면 사진이
            제 폭을 다 써야 합니다.

            <p>누르는 자리 밖으로 나오면서 눌렀을 때 지도가 움직이는 대신
            사진이 크게 열립니다. 내 여행 상세와 같은 모양입니다.

            <p>한 줄도 자르지 않습니다. 두 줄에서 끊어 놓고 "더 보기" 도
            없으면, 쓴 사람은 썼는데 읽는 사람은 못 읽습니다.
          */}
          <PhotoStrip ids={place.photos} height={220} style={styles.shot} />
          {place.stars || place.review ? (
            <View style={styles.said}>
              {place.stars ? <Caption tone="brand">{'★'.repeat(place.stars)}</Caption> : null}
              {place.review ? <Body small>{place.review}</Body> : null}
            </View>
          ) : null}

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
          {/*
            고른 줄에서만 펼칩니다.

            <p>장소마다 셋이 늘 서 있으면 판이 단추밭이 됩니다. 이제 판은
            화면의 절반 남짓이고, 남의 일정에서 한 곳을 손대는 일은 한 번에
            한 곳입니다. 지도와 목록은 이미 이어져 있어(누르면 핀이 커집니다)
            고르는 몸짓이 자연스럽습니다 — 내 여행 상세가 같은 규칙입니다.
          */}
          {activeId === `${index}:${i}` ? (
          <Row gap={0} style={styles.placeActs}>
            {[
              /*
                남의 일정에서 한 곳을 보고 가져올지 정하려면 이름과 메모만으로는
                모자랍니다. 평점이 몇인지 그날 문을 여는지가 있어야 고르는 일이
                됩니다. 장소 찾기에서 쓰는 것과 같은 판을 엽니다.

                <p>댓글도 그 판 안에 있습니다. 줄에 따로 세워 두었더니 같은 일을
                하는 자리가 내 여행 상세와 달랐고, 무엇보다 <b>남이 무슨 말을
                남겼는지</b>는 "여기가 어떤 데지" 에 대한 답의 일부입니다.

                <p>달린 것이 있으면 점을 찍습니다. 댓글 단추가 줄에서 사라졌으니
                그 말을 이 단추가 대신해야 합니다.
              */
              {
                key: 'look',
                name: 'info' as IconName,
                label:
                  countAt(i) > 0
                    ? `${place.name} 자세히 보기 · 댓글 ${countAt(i)}개`
                    : `${place.name} 자세히 보기`,
                dot: feedback && countAt(i) > 0,
                onPress: () => onLook(place, i),
              },
              /* 일정을 통째로 가져오지 않고 이 집만 담을 수 있어야 합니다.
                 담긴 것은 눌러서 뺍니다 — 담는 길만 있으면 잘못 누른 뒤에
                 보석함까지 찾아가야 합니다. */
              {
                key: 'keep',
                name: 'bookmark' as IconName,
                label: savedIds.has(place.name) ? UNKEEP : KEEP,
                /*
                  담긴 것은 그림에 색이 듭니다. 회색 네모가 돋아나는 것보다
                  담겼다는 말에 가깝습니다.

                  <p>accent 가 아니라 brand 입니다. 글자와 그림의 "accent" 는
                  이 앱에서 <b>검정</b>입니다(ui/index toneColor 참고) — 강조색을
                  코랄로 들이면서 그것까지 코랄로 돌리면 한 화면에 코랄이 열
                  군데씩 생기기 때문입니다. 그래서 tone="accent" 로는 회색에서
                  검정으로만 바뀌어, 담겼는지 안 담겼는지 알 수 없었습니다.
                  코랄을 그림 색으로 써야 하는 자리가 brand 입니다.
                */
                active: savedIds.has(place.name),
                tone: 'brand' as const,
                onPress: () => onSave(place, i),
              },
              /*
                내 글이면 여기서 뺄 수 있습니다.

                <p>고치는 길이 「내리고 다시 올리기」 뿐이었습니다. 그런데
                내리면 그동안 받은 추천과 댓글이 함께 사라집니다 — 가운데 한
                곳이 틀렸다는 이유로 그것을 다 버리게 되니 대개 틀린 채로
                둡니다.
              */
              mine
                ? {
                    key: 'drop',
                    name: 'more-horizontal' as IconName,
                    label: `${place.name} 이 글에서 빼기`,
                    onPress: () => onDrop(i),
                  }
                : null,
            ]
              .filter((a) => a !== null)
              .map((a, at) => (
                <View key={a.key} style={[styles.placeAct, at > 0 && styles.placeActEdge]}>
                  <IconButton
                    bare
                    name={a.name}
                    label={a.label}
                    active={a.active}
                    tone={a.tone}
                    dot={a.dot}
                    onPress={a.onPress}
                  />
                </View>
              ))}
          </Row>
          ) : null}
        </View>
          ))}
    </View>
  );
}

/**
 * 올린 글의 겉을 고칩니다.
 *
 * <p>일정 자체는 여기서 안 고칩니다. 장소는 줄마다 점 세 개로 하나씩 빼고,
 * 날을 다시 고르는 것은 고치기가 아니라 다시 올리기입니다.
 *
 * <p>올리는 판과 <b>같은 칸</b>을 씁니다(components/post-fields). 적는 것이
 * 같은데 두 군데에 따로 적어 두면 한쪽만 고치는 날이 옵니다.
 */
function EditSheet({
  visible,
  postId,
  now,
  onDone,
  onCancel,
}: {
  visible: boolean;
  postId: string;
  /** 지금 올라가 있는 값. 판을 열 때마다 여기서 시작합니다. */
  now: PostShape;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [shape, setShape] = useState<PostShape>(now);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /* 판은 닫혀도 화면에 남아 있습니다. 열 때마다 지금 올라가 있는 값으로
     되돌려 놓지 않으면, 고치다 취소한 것이 다음에 열 때 그대로 남습니다. */
  useEffect(() => {
    if (visible) {
      setShape(now);
      setFailed(null);
    }
    /* now 는 새로 읽을 때마다 새 객체라 여기 넣으면 치는 동안 계속
       되돌려집니다. 판이 열리는 순간만 봅니다. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function submit() {
    if (busy) {
      return;
    }
    if (!shape.title.trim()) {
      setFailed('제목은 비울 수 없어요. 목록에서 이것만 보여요.');
      return;
    }
    setFailed(null);
    setBusy(true);
    try {
      await api.patch(`/api/posts/${postId}`, {
        title: shape.title.trim(),
        summary: shape.summary.trim(),
        region: shape.region ?? '',
        tags: shape.tags,
        feedback: shape.feedback,
        /* 빈 문자열이 표지 지우기입니다. null 은 "그대로 두기" 라서, 뺀 것을
           서버에 알리려면 빈 값을 보내야 합니다. */
        coverPhotoId: shape.coverPhotoId ?? '',
        visibility: shape.visibility,
      });
      onDone();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title="글 고치기"
      onClose={onCancel}
      footer={<Button label="고치기" onPress={submit} busy={busy} />}>
      <Caption tone="secondary">
        일정은 그대로예요. 장소를 빼려면 그 장소를 누르고 점 세 개를 눌러요.
      </Caption>

      <PostFields value={shape} onChange={setShape} />

      {failed ? <ErrorNote message={failed} /> : null}
    </BottomSheet>
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
  days,
  onDone,
  onCancel,
}: {
  visible: boolean;
  postId: string;
  title: string;
  /** 이 글의 날들. 골라 가져올 수 있게 이름을 보여 줍니다. */
  days: { label: string | null; date?: string | null }[];
  onDone: (tripId: string) => void;
  onCancel: () => void;
}) {
  const [startIso, setStartIso] = useState(today());

  /*
    어느 날을 가져올지.

    <p>닷새짜리 글에서 이틀만 쓰고 싶을 때가 있습니다 — 다른 날은 이미 내
    계획이 있거나 안 갈 곳입니다. 통째로 가져와 지우게 하면 지우는 일이 곧
    남습니다.

    <p>기본은 전부입니다. 남의 일정을 통째로 본떠 오는 것이 더 흔합니다.
  */
  const [pickedDays, setPickedDays] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function submit() {
    setFailed(null);
    setBusy(true);
    try {
      const res = await api.post<{ tripId: string }>(`/api/posts/${postId}/copy`, {
        startIso,
        days: pickedDays,
      });
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
        「{title}」 의 일정이 그대로 복사돼요. 첫날을 정하면 나머지 날짜가 따라와요. 가져온
        뒤에는 마음대로 고칠 수 있어요.
      </Caption>
      <DateField label="떠나는 날" value={startIso} onChange={setStartIso} />

      {/*
        어느 날을 가져올지.

        <p>날이 둘 이상일 때만 냅니다. 고른 것들은 <b>가져온 차례가 아니라
        글의 차례</b>로 서고, 내 여행에서는 다시 1일차부터 셉니다 — 남의
        일정의 몇째 날이었는지는 내 여행에 남길 것이 아닙니다.
      */}
      {days.length > 1 ? (
        <>
          {/* 흐린 작은 글씨로 두었더니 날짜 칸 밑에 붙은 설명처럼 읽혀,
              고를 수 있는 것이 있다는 것을 못 보고 지나쳤습니다. 다른 판의
              묶음 이름과 같은 무게로 적습니다. */}
          <Body small strong>
            어느 날을 가져올까요?
          </Body>
          <Row gap={Spacing.s1} style={styles.wrap}>
            <Chip
              label="전부"
              selected={pickedDays.length === 0}
              onPress={() => setPickedDays([])}
            />
            {days.map((d, at) => (
              <Chip
                key={at}
                /* 둘 다 비어 있는 날이 있을 수 있습니다 — 올린 사람이 이름도
                   날짜도 안 적은 경우입니다. 그때는 몇째 날인지로 부릅니다. */
                label={d.date || d.label || `${at + 1}일차`}
                selected={pickedDays.includes(at)}
                onPress={() =>
                  setPickedDays((was) =>
                    was.includes(at) ? was.filter((x) => x !== at) : [...was, at],
                  )
                }
              />
            ))}
          </Row>
        </>
      ) : null}

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
 * 그 날에 걸린 글들.
 *
 * @param at 몇째 날. null 이면 어느 날에도 안 걸린 것들 — 돌아와서 올렸거나,
 *           붙어 있던 날이 나중에 빠진 글입니다
 *
 * <p>옛 글에는 stories 가 아예 없습니다. 사본은 그때의 모습이라 고쳐 쓰지
 * 않으므로, 없는 것을 빈 것으로 읽습니다.
 */
function storiesOn(stories: Maybe<Story[]>, at: number | null): Story[] {
  return (stories ?? []).filter((s) =>
    at === null ? s.dayIndex == null : s.dayIndex === at,
  );
}

const styles = StyleSheet.create({
  /* 하루와 그날의 글을 한 묶음으로. 사이가 벌어지면 그 글이 어느 날 것인지
     안 보입니다. */
  lane: {
    gap: Spacing.s2,
  },
  /* 지도가 바탕입니다. 판이 아직 안 깔린 자리는 지도 색으로 둡니다 —
     흰 판이 비치면 판이 두 겹인 것처럼 보입니다. */
  /* 떠 있는 띠가 서는 자리. 하단 띠 위로 올립니다. */
  /* 날이 닷새면 칩이 한 줄에 안 섭니다. 접히게 둡니다. */
  wrap: {
    flexWrap: 'wrap',
  },
  snackRail: {
    position: 'absolute',
    left: 0,
    right: 0,
    /*
      판과 아래 띠보다 위에 섭니다.

      <p>둘 다 zIndex 2 를 쓰는데 이 띠에는 층이 없었습니다. 웹에서 zIndex 는
      쌓임 문맥을 만들어서, <b>나중에 그려지든 말든</b> 2 가 0 위에 깔립니다 —
      「보석함에 담았습니다」 가 판 뒤에서 뜨고 5초 뒤에 사라졌습니다. 담은
      사람에게는 아무 일도 안 일어난 것으로 보였습니다.

      <p>여행 상세에서는 같은 띠가 판 높이만큼 위에 서기 때문에 겹치지 않아
      드러나지 않았습니다.
    */
    zIndex: 3,
  },
  stage: {
    flex: 1,
    backgroundColor: Colors.abyss,
  },
  /* 지도가 쓰는 자리. */
  mapPane: {
    flex: 1,
  },
  /* 넓은 화면에서는 왼쪽을 패널에 내줍니다. 여백(margin)으로 비킵니다 —
     안쪽 여백으로 두면 떠 있는 패널의 왼쪽 0 이 그 안으로 들어갑니다. */
  mapPaneWide: {
    marginLeft: SidePanelWidth,
  },
  /* 띠도 패널을 피합니다. 패널 위에 뜨면 읽던 글을 가립니다. */
  snackRailPast: {
    left: SidePanelWidth,
  },
  head: {
    gap: Spacing.s1,
  },
  grow: {
    flex: 1,
  },
  /* 하루. 판을 벗고 사이만 띄웁니다 — 가르는 일은 위의 띠가 합니다. */
  day: {
    gap: Spacing.s2,
  },
  dayHead: {
    alignItems: 'center',
    /* 줄 전체가 여닫는 자리라 손가락이 닿을 높이를 채웁니다. */
    minHeight: Tap.min,
  },
  /*
    그날 색 점.

    <p>네모였습니다(borderRadius 0). 옛 규칙이 「직각」 이었기 때문인데,
    지도의 핀은 동그라미입니다 — 같은 날을 가리키는 것이 목록에서는 네모,
    지도에서는 동그라미면 둘이 같은 것이라는 말을 못 합니다.
  */
  dot: {
    width: 12,
    height: 12,
    borderRadius: Radius.full,
  },
  /*
    하트 한 칸.

    <p>알약 단추에서 네모 칸으로 바꿨습니다. 오른쪽의 채운 주 단추와
    나란히 서는데 둘이 같은 알약이면 어느 쪽이 주된 것인지 크기로만
    가려야 했습니다. 이쪽은 테두리만 두고 숫자를 아래 적습니다.
  */
  heartBox: {
    width: Tap.control,
    height: Tap.control,
    borderRadius: Radius.r3,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartMark: {
    fontSize: 17,
    lineHeight: 20,
    color: Colors.textMuted,
  },
  heartOn: {
    color: Colors.like,
  },
  heartCount: {
    ...Type.micro,
    color: Colors.textSecondary,
  },
  place: {
    borderRadius: Radius.r3,
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
  /* 테두리만으로 말합니다. 바탕까지 갈면 고른 것이 아니라 다른 종류의
     것처럼 보입니다 — 내 여행 상세와 같은 규칙입니다. */
  placeOn: {
    borderColor: Colors.accent,
  },
  placeTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.s3,
    paddingVertical: Spacing.s1,
    paddingHorizontal: Spacing.s2,
  },
  placeText: {
    flex: 1,
    gap: 2,
  },
  /*
    다녀와서 남긴 사진.

    <p>카드의 자식이라 좌우 여백을 스스로 챙깁니다. 누르는 자리(placeTap)
    안에 있을 때는 그쪽 여백을 얻어 썼습니다. 여백은 글 쪽보다 좁습니다 —
    글은 가장자리에 바짝 붙으면 읽기 불편하지만 사진은 넓을수록 잘 보입니다.
  */
  shot: {
    marginTop: Spacing.s1,
    marginHorizontal: Spacing.s1,
  },
  /* 사진 아래의 별과 한 줄. 사진과 같은 자리에 섭니다. */
  said: {
    gap: 2,
    paddingTop: Spacing.s1,
    paddingBottom: Spacing.s1,
    paddingHorizontal: Spacing.s2,
  },
  order: {
    width: 22,
    alignItems: 'center',
  },
  orderText: {
    color: Colors.textMuted,
  },
});
