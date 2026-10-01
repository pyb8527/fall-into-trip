import { StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { FeedPost, TripDetail } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { OurPhoto } from '@/components/our-photo';
import { PostFields, type PostShape } from '@/components/post-fields';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { BottomSheet, Button, Caption, Checkbox, Chip, ErrorNote, Grow, Press, Row } from '@/ui';

/**
 * 내 일정을 게시판에 올립니다.
 *
 * <p>올리는 순간의 일정이 <b>사본</b>으로 떠집니다. 올린 뒤에 장소를 고치거나
 * 여행을 지워도 글은 그대로 남습니다. 반대로 고친 내용을 보여 주고 싶으면
 * 내리고 다시 올려야 합니다. 화면에 그렇게 적어 둡니다 — 안 적으면 고쳤는데
 * 왜 글이 그대로냐는 말이 나옵니다.
 */
/** 고른 사진을 늘어놓는 네모의 한 변. */
const THUMB = 64;

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
    region: null,
    tags: [],
    feedback: false,
    coverPhotoId: null,
    /* 안 고르면 둘러보기입니다 — 지금까지의 동작이고, 「내놓기」 를 누른
       사람이 바라는 것도 대개 그것입니다. */
    visibility: 'LISTED',
  });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /* 고를 수 있는 지역은 서버가 정합니다. 여기 따로 적어 두면 언젠가 어긋나고,
     어긋나면 고른 값이 저장은 되는데 목록에서 아무것도 안 걸립니다. */
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

  const { data: storyData } = useAsync<{ posts: FeedPost[] }>(
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

  /** 사진이 있는 장소만, 날짜 차례대로. */
  const withShots = (trip?.days ?? []).flatMap((d) =>
    d.places
      .filter((p) => (shotsOf.get(p.id)?.length ?? 0) > 0)
      .map((p) => ({ day: d, place: p, shots: shotsOf.get(p.id) ?? [] })),
  );

  /* 판은 닫혀도 화면에 남아 있어 처음 잡은 값이 다음에 열 때도 그대로입니다. */
  useEffect(() => {
    if (!visible) {
      return;
    }
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
  }, [visible, tripTitle]);

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
        placePhotoIds: pickedShots,
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
                      {s.photoIds.length > 0 ? (
                        <Caption tone="muted">사진 {s.photoIds.length}장</Caption>
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
      */}
      {withShots.length > 0 ? (
        <>
          <Caption tone="secondary">
            장소에 챙겨 둔 사진을 같이 실을까요? 고른 것만 공개돼요.
          </Caption>
          {withShots.map(({ day, place, shots }) => (
            <View key={place.id} style={styles.spot}>
              <Caption tone="muted" numberOfLines={1}>
                {day.date || day.label} · {place.name}
              </Caption>
              <Row gap={Spacing.s2} style={styles.wrap}>
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
                      <OurPhoto id={id} width={THUMB} height={THUMB} />
                    </Press>
                  );
                })}
              </Row>
            </View>
          ))}
        </>
      ) : null}

      <PostFields value={shape} onChange={setShape} />

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
  /* 고른 사진은 테두리가 말합니다. 체크를 얹으면 작은 그림이 가립니다. */
  shot: {
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
