import { StyleSheet, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { FeedPost, TripDetail } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { OurPhoto } from '@/components/our-photo';
import { PostFields, type PostShape } from '@/components/post-fields';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { BottomSheet, Button, Caption, Checkbox, Chip, ErrorNote, Grow, Press, Row, Split } from '@/ui';

/**
 * 내 일정을 게시판에 올립니다.
 *
 * <p>올리는 순간의 일정이 <b>사본</b>으로 떠집니다. 올린 뒤에 장소를 고치거나
 * 여행을 지워도 글은 그대로 남습니다. 반대로 고친 내용을 보여 주고 싶으면
 * 내리고 다시 올려야 합니다. 화면에 그렇게 적어 둡니다 — 안 적으면 고쳤는데
 * 왜 글이 그대로냐는 말이 나옵니다.
 */
/**
 * 사진 격자의 한 줄 높이.
 *
 * <p>칸 넓이는 {@code styles.shot} 이 백분율로 정합니다 — 넓이를 픽셀로
 * 박아 두면 네 칸을 세운 뒤 오른쪽에 쓰다 남은 자리가 생깁니다.
 */
const THUMB = 76;

export function PublishForm({
  visible,
  tripId,
  tripTitle,
  onDone,
  onCancel,
}: {
  visible: boolean;
  tripId: string;
  tripTitle: string;
  onDone: (postId: string) => void;
  onCancel: () => void;
}) {
  /*
    겉에 적는 것들.

    <p>고치는 판과 같은 칸을 씁니다(components/post-fields) — 올릴 때 적는
    것과 고칠 때 적는 것이 같은데 두 군데에 적어 두면 한쪽만 고치는 날이
    옵니다.
  */
  const [shape, setShape] = useState<PostShape>({
    title: tripTitle,
    summary: '',
    /*
      지역은 비워 둡니다.

      <p>여행 이름과 장소 이름을 <b>글자로 훑어</b> 미리 골라 주고 있었습니다.
      「도쿄 라멘 투어」는 도쿄가 되지만 「엄마랑 셋이」는 아무것도 안 되고,
      「도쿄에서 산 물건들」도 도쿄 모음에 섰습니다. 제목은 지역에 대한 사실이
      아닙니다.

      <p>비워 둔 채로 올리면 서버가 첫날 첫 장소의 <b>좌표로</b> 꼽습니다. 아래
      칸에서 고르면 고른 것이 이깁니다.
    */
    region: null,
    tags: [],
    feedback: false,
    coverPhotoId: null,
    /* 안 고르면 둘러보기입니다 — 지금까지의 동작이고, 「내놓기」 를 누른
       사람이 바라는 것도 대개 그것입니다. */
    visibility: 'LISTED',
  });
  /* 더 고를 것들을 펼쳤는지. 처음에는 접혀 있습니다. */
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /*
    어느 날을 올릴지.

    <p>올리는 것이 여행 전체뿐이었습니다. 그런데 닷새 중 하루만 잘 짜인
    날이 있고 나머지는 이동과 쉬는 날인 경우가 흔합니다. 그 하루를 보여
    주려고 닷새를 통째로 올리면 보는 사람은 나흘을 지나쳐야 합니다.

    <p>기본은 전부입니다 — 지금까지의 동작이고, 대개 그것이 맞습니다.
  */
  const [pickedDays, setPickedDays] = useState<string[]>([]);

  /*
    같이 실을 피드 글.

    <p>0단계에서 장소마다 남기던 기록을 걷어 냈고, 그때부터 새 여행기에는
    사진이 한 장도 안 실렸습니다. 그 자리를 이것이 메웁니다 — 어디를 갔는지는
    일정이 말하고, <b>어땠는지</b>는 그때 올린 사진과 한 줄이 말합니다.

    <p>내가 쓴 것만 고를 수 있습니다. 모임에서 남이 올린 사진을 공개로 돌리는
    결정은 찍은 사람이 합니다 — 서버도 같은 것을 봅니다.
  */
  const [pickedStories, setPickedStories] = useState<string[]>([]);

  /*
    장소마다 실을 사진.

    <p>기본은 <b>아무것도 안 고름</b>입니다. 여기 쌓인 것은 「다니면서 볼
    사진」이라 — 메뉴판, 예매 화면, 가는 길 지도 — 통째로 실으면 남의
    여행기에 내 예매 QR 이 올라갑니다. 공개로 돌리는 것은 한 장씩 고르는
    일이어야 합니다.
  */
  const [pickedShots, setPickedShots] = useState<string[]>([]);

  const { data: storyData, loading: storiesLoading } = useAsync<{ posts: FeedPost[] }>(
    (signal) =>
      visible
        ? api.get(`/api/feed?trip=${encodeURIComponent(tripId)}`, signal)
        : Promise.resolve({ posts: [] }),
    [visible, tripId],
  );
  const stories = (storyData?.posts ?? []).filter((p) => p.mine);

  /*
    날짜와, 장소마다 챙겨 둔 사진.

    <p>둘 다 같은 한 번에 옵니다 — 날을 고르는 칸과 사진을 고르는 칸이 따로
    묻게 두면 같은 것을 두 번 받아 옵니다.
  */
  const { data: trip } = useAsync<TripDetail>(
    (signal) => api.get(`/api/trip?trip=${encodeURIComponent(tripId)}`, signal),
    [tripId],
  );
  const tripDays = trip ? { days: trip.days } : null;

  /** 장소 번호 → 그 장소에 챙겨 둔 사진들. */
  const shotsOf = new Map((trip?.refs ?? []).map((r) => [r.placeId, r.photoIds]));

  /*
    장소 번호 → 그 장소를 보면서 올린 <b>내 피드 사진</b>들.

    <h3>챙겨 둔 것과 다른 더미입니다</h3>

    <p>위의 {@code refs} 는 「다니면서 볼 사진」입니다 — 메뉴판, 예매 화면, 가는
    길 지도. 사람이 남에게 보이려고 넣은 것이 아니라서 <b>하나도 미리 골라
    두지 않습니다.</b>

    <p>이쪽은 그 장소를 보면서 올린 사진입니다. 올린 사람이 이미 「이 사진은 이
    장소의 것」이라고 고른 것이라, 미리 골라 두는 것이 그 뜻을 따르는
    일입니다({@code seedShots}).

    <p>차례는 글이 올라온 차례입니다 — 읽는 사람에게 뜻이 있는 것은 시간이고,
    고른 차례는 화면이 어떻게 늘어놓았느냐에 달렸습니다.
  */
  const feedShotsOf = new Map<string, string[]>();
  for (const s of [...stories].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (!s.placeId || s.photoIds.length === 0) {
      continue;
    }
    feedShotsOf.set(s.placeId, [...(feedShotsOf.get(s.placeId) ?? []), ...s.photoIds]);
  }

  /** 글쓴이가 「나만」으로 닫아 둔 사진. 미리 골라 두지 않습니다({@code seedShots}). */
  const closedShots = new Set(
    stories.filter((s) => s.audience === 'ONLY_ME').flatMap((s) => s.photoIds),
  );

  /**
   * 사진이 있는 장소만, 날짜 차례대로.
   *
   * <p>피드에서 올린 것이 앞에 섭니다. 그것이 「다녀와서 남긴 것」이고 챙겨 둔
   * 것은 「가기 전에 넣어 둔 것」이라, 읽는 사람이 보고 싶은 쪽이 먼저입니다.
   *
   * <p>같은 사진이 두 더미에 다 있을 수는 없습니다 — 피드 사진은
   * {@code post_photos}, 챙겨 둔 것은 {@code place_photos} 로 붙는 길이
   * 따로입니다. 그래도 겹쳐 들어오면 격자에 같은 칸이 둘 서므로 걸러 둡니다.
   */
  const withShots = (trip?.days ?? []).flatMap((d) =>
    d.places
      .map((p) => {
        const fromFeed = feedShotsOf.get(p.id) ?? [];
        const kept = (shotsOf.get(p.id) ?? []).filter((id) => !fromFeed.includes(id));
        return { day: d, place: p, fromFeed, kept, shots: [...fromFeed, ...kept] };
      })
      .filter((x) => x.shots.length > 0),
  );

  /**
   * 미리 골라 둔 것을 이번에 심었는지.
   *
   * <p>한 번만 심어야 합니다. 그릴 때마다 심으면 <b>사람이 끈 사진이 되살아</b>
   * 납니다 — 끄고, 다시 그려지고, 켜져 있습니다. 끌 수가 없습니다.
   */
  const seeded = useRef(false);

  /* 판은 닫혀도 화면에 남아 있어 처음 잡은 값이 다음에 열 때도 그대로입니다. */
  useEffect(() => {
    if (!visible) {
      return;
    }
    seeded.current = false;
    setShape({
      title: tripTitle,
      summary: '',
      region: null,
      tags: [],
      feedback: false,
      coverPhotoId: null,
      visibility: 'LISTED',
    });
    setFailed(null);
    setBusy(false);
    setPickedStories([]);
    setPickedShots([]);
    setMore(false);
  }, [visible, tripTitle]);

  /*
    장소를 보면서 올린 사진을 미리 골라 둡니다.

    <h3>왜 미리 고르나</h3>

    <p>올린 사람이 <b>이미 골랐습니다.</b> 일정의 장소 줄에서 글을 올리면 그
    사진이 그 장소에 묶이는데({@code Post.placeId}), 그러고 나서 내놓기 판에서
    같은 사진을 장소마다 다시 찾아 누르게 하는 것은 같은 결정을 두 번 하라는
    말입니다. 여행기에 사진이 안 실린다는 말이 나온 까닭의 절반이 이것입니다.

    <h3>미리 안 고르는 둘</h3>

    <p><b>챙겨 둔 사진</b>({@code refs})은 그대로 둡니다. 메뉴판과 예매 화면이
    섞인 더미라, 통째로 켜면 남의 여행기에 내 예매 QR 이 올라갑니다 — 그 더미를
    한 장씩 고르게 한 결정은 안 바뀝니다.

    <p><b>「나만」으로 닫아 둔 글</b>의 사진도 그대로 둡니다. 공개 범위를 좁혀
    둔 것은 명시적인 뜻이고, 그것을 기본값이 뒤집으면 안 됩니다 — 모르고 넓게
    열리는 쪽이 모르고 좁게 닫히는 쪽보다 되돌리기 어렵습니다. 격자에는 섭니다:
    고르고 싶으면 누를 수 있어야 합니다.

    <h3>두 쪽이 다 도착한 뒤에 한 번</h3>

    <p>일정({@code trip})과 피드({@code storyData}) 둘이 따로 옵니다. 하나만
    왔을 때 심으면 반만 켜지고, 나머지가 와도 이미 심은 뒤라 영영 꺼진 채로
    남습니다.
  */
  useEffect(() => {
    if (!visible || seeded.current || storiesLoading || trip == null || storyData == null) {
      return;
    }
    seeded.current = true;
    setPickedShots(withShots.flatMap((x) => x.fromFeed.filter((id) => !closedShots.has(id))));
    /* 심는 때를 정하는 것은 위의 넷입니다. 격자({@code withShots})는 그 넷에서
       나온 것이라 넣으면 같은 말을 두 번 하는 셈이고, 그릴 때마다 새로 지어져
       매번 다시 심게 됩니다. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, storiesLoading, trip, storyData]);

  async function submit() {
    if (busy) {
      return;
    }
    if (!shape.title.trim()) {
      setFailed('제목부터 지어 주세요. 목록에서 이것만 보여요.');
      return;
    }
    setFailed(null);
    setBusy(true);
    try {
      /*
        한 사진이 두 자리에 실리지 않게 합니다.

        <p>장소에 묶인 글은 두 군데에서 고를 수 있습니다 — 「글을 같이 싣기」와
        그 장소의 사진 격자. 둘 다 고르면 같은 사진이 여행기에 두 번 뜹니다.

        <p><b>글 쪽이 이깁니다.</b> 격자에 켜져 있는 것은 우리가 미리 골라 둔
        것이고(기본값), 글을 고른 것은 사람이 한 번 누른 것입니다 — 기본값이
        사람이 한 일을 이기면 안 됩니다. 글을 고르면 사진이 글과 함께, 글을
        안 고르면 장소 자리에 섭니다.
      */
      const inStories = new Set(
        stories.filter((s) => pickedStories.includes(s.id)).flatMap((s) => s.photoIds),
      );
      const res = await api.post<{ postId: string }>(`/api/trips/${tripId}/publish`, {
        title: shape.title.trim(),
        summary: shape.summary.trim(),
        region: shape.region,
        tags: shape.tags,
        days: pickedDays,
        feedback: shape.feedback,
        coverPhotoId: shape.coverPhotoId,
        visibility: shape.visibility,
        storyIds: pickedStories,
        placePhotoIds: pickedShots.filter((id) => !inStories.has(id)),
      });
      onDone(res.postId);
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title="둘러보기에 내놓기"
      onClose={onCancel}
      footer={<Button label="내놓기" onPress={submit} busy={busy} />}>
      <Caption tone="secondary">
        지금 일정이 그대로 복사되어 올라가요. 나중에 일정을 고쳐도 올린 글은 바뀌지 않아요.
        고친 것을 보여 주려면 내리고 다시 올려 주세요.
      </Caption>
      <Caption tone="secondary">
        누가 다녀왔는지, 동행자가 누구인지는 올라가지 않아요. 날짜와 장소만 가요.
      </Caption>

      <PostFields value={shape} onChange={setShape} />

      {/*
        더 고를 것들 — 어느 날, 피드 이야기, 챙겨 둔 사진.

        <p>판을 열면 이것들이 제목보다 먼저 서 있었습니다. 내놓는 사람이 먼저
        정할 것은 <b>표지 · 제목 · 소개</b>이고, 날과 사진은 대개 「전부」 그대로
        둡니다. 접어 두고 고르고 싶은 사람만 엽니다.
      */}
      {more ? (
        <>
          {/*
            어느 날을 올릴지.

            <p>날이 둘 이상일 때만 냅니다. 하루짜리 여행에 "전부" 와 "1일차" 를
            나란히 두면 고를 것이 없는 줄이 하나 생깁니다.
          */}
          {(tripDays?.days.length ?? 0) > 1 ? (
            <>
              <Caption tone="secondary">어느 날을 올릴까요?</Caption>
              <Row gap={Spacing.s2} style={styles.wrap}>
                <Chip
                  label="전부"
                  selected={pickedDays.length === 0}
                  onPress={() => setPickedDays([])}
                />
                {tripDays?.days.map((d) => (
                  <Chip
                    key={d.id}
                    label={d.date || d.label}
                    selected={pickedDays.includes(d.id)}
                    onPress={() =>
                      setPickedDays((was) =>
                        was.includes(d.id) ? was.filter((x) => x !== d.id) : [...was, d.id],
                      )
                    }
                  />
                ))}
              </Row>
            </>
          ) : null}

          {/*
            어떤 글을 같이 실을까요.

            <p>기본은 <b>아무것도 안 고름</b>입니다. 피드에 올린 것은 아는
            사람들끼리 보려고 올린 것이라, 공개 글에 통째로 딸려 가면 안 됩니다 —
            공개로 돌리는 것은 한 편씩 고르는 일이어야 합니다.
          */}
          {stories.length > 0 ? (
            <>
              <Caption tone="secondary">
                이 여행에 올린 글을 같이 실을까요? 고른 것만 공개돼요.
              </Caption>
              <View style={styles.stories}>
                {stories.map((s) => {
                  const on = pickedStories.includes(s.id);
                  return (
                    <Press
                      key={s.id}
                      onPress={() =>
                        setPickedStories((was) =>
                          was.includes(s.id) ? was.filter((x) => x !== s.id) : [...was, s.id],
                        )
                      }
                      accessibilityLabel={`${s.text ?? '사진'} 같이 싣기`}
                      style={[styles.story, on ? styles.storyOn : null]}>
                      <Row gap={Spacing.s2}>
                        <Checkbox
                          label=""
                          checked={on}
                          onChange={() =>
                            setPickedStories((was) =>
                              was.includes(s.id) ? was.filter((x) => x !== s.id) : [...was, s.id],
                            )
                          }
                        />
                        {s.photoIds.length > 0 ? (
                          <OurPhoto id={s.photoIds[0]} width={44} height={44} />
                        ) : null}
                        <Grow gap={1}>
                          <Caption numberOfLines={2}>{s.text ?? '사진만 올린 글'}</Caption>
                          {/*
                            어디서 올린 글인지 적습니다.

                            <p>장소에 묶인 글은 사진이 아래 격자에도 서 있어서,
                            여기서 고르면 같은 사진을 두 자리에서 고른 셈이
                            됩니다. 어느 장소의 글인지가 보이면 그 격자에 켜져
                            있는 것이 무엇인지도 읽힙니다 — 고르면 사진은 글과
                            함께 가고 격자에서는 빠집니다({@code submit}).
                          */}
                          {s.photoIds.length > 0 ? (
                            <Caption tone="muted">
                              사진 {s.photoIds.length}장
                              {s.placeName ? ` · ${s.placeName}에서` : ''}
                            </Caption>
                          ) : null}
                        </Grow>
                      </Row>
                    </Press>
                  );
                })}
              </View>
            </>
          ) : null}

          {/*
            장소마다 챙겨 둔 사진.

            <p>한동안 여행기에 사진이 한 장도 안 실렸습니다. 여기 쌓인 것이
            「다니면서 볼 사진」이라 통째로 담으면 예매 화면이 섞여 나가기
            때문인데, 그러느라 <b>장소마다 찍어 둔 진짜 사진도 같이 묻혔습니다</b> —
            읽는 사람이 가장 보고 싶은 것이 그것인데 말입니다.

            <p>한 장씩 고릅니다. 고른 것만 올라갑니다.

            <h3>그 장소에서 올린 사진은 미리 골라 둡니다</h3>

            <p>일정의 장소 줄에서 피드를 올리면 그 사진이 그 장소에 묶입니다
            ({@code Post.placeId}). 올린 사람이 이미 「이 사진은 이 장소의 것」
            이라고 고른 것이라, 여기서 같은 사진을 다시 찾아 누르게 하는 것은
            같은 결정을 두 번 하라는 말입니다.

            <p>챙겨 둔 사진은 그대로 꺼져 있습니다 — 그쪽은 예매 화면이 섞인
            더미입니다. 「나만」으로 닫아 둔 글의 사진도 꺼져 있습니다.
          */}
          {withShots.length > 0 ? (
            <>
              <Caption tone="secondary">
                장소마다 실을 사진이에요. 고른 것만 공개돼요. 그 장소에서 올린 사진은 미리
                골라 뒀어요.
              </Caption>
              {withShots.map(({ day, place, shots, fromFeed, kept }) => {
                /* 이 장소 것이 다 골라져 있으면 끄는 쪽을 냅니다. 같은 자리에
                   켜기와 끄기를 나란히 두면 둘 중 무엇이 지금인지 안 보입니다. */
                const allOn = shots.every((id) => pickedShots.includes(id));
                return (
                  <View key={place.id} style={styles.spot}>
                    <Split>
                      <Grow>
                        <Caption tone="muted" numberOfLines={1}>
                          {day.date || day.label} · {place.name}
                          {/* 두 더미가 섞여 있을 때만 적습니다. 한 쪽뿐이면
                              적어 줄 것이 없고, 줄마다 괄호가 붙으면 장소
                              이름이 안 읽힙니다. */}
                          {fromFeed.length > 0 && kept.length > 0
                            ? ` · 올린 사진 ${fromFeed.length}장 · 챙겨 둔 것 ${kept.length}장`
                            : ''}
                        </Caption>
                      </Grow>
                      {/*
                        장소마다 하나씩.

                        <p>판 전체를 한 번에 켜는 것은 안 둡니다 — 여기 쌓인
                        것에는 예매 화면과 메뉴판이 섞여 있어서, 「전부」 가
                        판 전체를 뜻하면 한 번 눌러 그것까지 공개됩니다.
                        장소 하나는 눈으로 확인할 수 있는 크기입니다.
                      */}
                      <Press
                        onPress={() =>
                          setPickedShots((was) =>
                            allOn
                              ? was.filter((x) => !shots.includes(x))
                              : [...was, ...shots.filter((id) => !was.includes(id))],
                          )
                        }
                        scale={0.96}
                        hitSlop={8}
                        accessibilityLabel={`${place.name} 사진 ${allOn ? '전부 끄기' : '전부 고르기'}`}>
                        <Caption tone="accent">{allOn ? '전부 끄기' : '전부'}</Caption>
                      </Press>
                    </Split>
                    {/*
                      사진은 격자로 깔립니다.

                      <p>장소마다 한 줄에 썸네일 하나였습니다. 장소가 스물이면
                      스무 줄이 되어, 고르려면 판을 한참 굴려야 했습니다. 네
                      칸으로 깔면 같은 사진이 다섯 줄 남짓에 들어옵니다.
                    */}
                    <View style={styles.shots}>
                      {shots.map((id) => {
                        const on = pickedShots.includes(id);
                        return (
                          <Press
                            key={id}
                            onPress={() =>
                              setPickedShots((was) =>
                                was.includes(id) ? was.filter((x) => x !== id) : [...was, id],
                              )
                            }
                            accessibilityLabel={`${place.name} 사진 같이 싣기`}
                            accessibilityState={{ selected: on }}
                            style={[styles.shot, on ? styles.shotOn : null]}>
                            <OurPhoto id={id} height={THUMB} />
                          </Press>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </>
          ) : null}
        </>
      ) : (
        <Button
          label="올릴 날 · 이야기 · 사진 고르기"
          variant="ghost"
          iconAfter="chevron-down"
          onPress={() => setMore(true)}
        />
      )}
      {failed ? <ErrorNote message={failed} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  /* 태그가 여덟이면 한 줄에 안 섭니다. 접히게 둡니다 — 옆으로 흘리면
     오른쪽에 뭐가 더 있는지 안 보입니다. */
  wrap: {
    flexWrap: 'wrap',
  },
  stories: {
    gap: Spacing.s2,
  },
  spot: {
    gap: Spacing.s1,
  },
  /* 네 칸 격자. 사진 피드 격자와 같은 길입니다(components/feed-list) — 폭을
     재지 않고 백분율로 나눕니다. */
  shots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.s1,
  },
  /* 고른 사진은 테두리가 말합니다. 체크를 얹으면 작은 그림이 가립니다. */
  shot: {
    /* 네 칸에서 사이 간격을 뺀 몫. */
    width: '23.5%',
    borderRadius: Radius.r2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  shotOn: {
    borderColor: Colors.accent,
  },
  /*
    고른 것이 보이게 테두리를 둡니다. 체크만으로는 줄이 여럿일 때 어느 것을
    골랐는지 훑어서 안 보입니다.

    <p>테두리가 가장 얇은 선(hairline)이었습니다. 그 굵기로는 회색 면 위에서
    거의 안 보여서, 고른 것과 안 고른 것이 체크 하나 차이였습니다. 고른
    칸은 1.5픽셀 테두리에 옅은 바탕까지 갑니다 — 고르기 타일과 같은 규칙입니다.
  */
  story: {
    backgroundColor: Colors.fill,
    borderRadius: Radius.r3,
    padding: Spacing.s3,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  storyOn: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
});
