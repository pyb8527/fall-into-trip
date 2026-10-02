import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { FeedAudience, FeedPost, TripDetail, TripSummary } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { OurPhoto } from '@/components/our-photo';
import { Spacing } from '@/constants/theme';
import { PickError, pickAndUpload } from '@/lib/pick-photo';
import {
  BottomSheet,
  Button,
  Caption,
  Chip,
  ErrorNote,
  Field,
  IconButton,
  Row,
} from '@/ui';

/**
 * 피드에 올리는 판.
 *
 * <h3>사진만 올려도, 글만 써도 됩니다</h3>
 *
 * <p>둘 다 비면 못 올립니다. 제목도 지역도 안 받습니다 — 올리는 데 드는 품이
 * 사진 고르기 하나여야 합니다.
 *
 * <h3>공개 범위는 받습니다 — 다만 안 골라도 됩니다</h3>
 *
 * <p>전에는 <b>올린 자리가 곧 공개 범위</b>였습니다. 모임에 올리면 그 모임
 * 사람이 보고 내 피드에 쓰면 나만 봤는데, 그 사이에 있고 싶은 글이 있습니다 —
 * 모임 사람에게만 보여 주고 싶은 사진, 아무에게도 안 보여 줄 메모, 누구에게나
 * 보여 주고 싶은 한 장.
 *
 * <p>칸을 하나 더 두는 값은 치릅니다. 그래서 <b>미리 골라 둡니다</b> — 모임에
 * 올리면 그 모임 사람, 내 피드에 쓰면 나만입니다. 안 건드리고 올리면 전과
 * 똑같이 동작하고, 서버도 같은 값을 기본으로 씁니다.
 *
 * <h3>태그는 적는 대로</h3>
 *
 * <p>고르는 목록을 두지 않습니다. 무엇으로 묶일지는 미리 알 수 없고, 목록을
 * 만들어 두면 거기 없는 이야기는 아무 데도 안 걸립니다.
 *
 * <h3>어느 여행 · 어느 날 · 어느 장소</h3>
 *
 * <p>여행만 골랐습니다. 그런데 닷새에 스무 곳이면 「이 여행 이야기」는 사진이
 * 설 자리를 못 집어 줍니다 — 둘러보기에 내놓을 때 그 사진이 어느 장소 자리에
 * 들어가야 하는지 아무도 모르고, 사람이 내놓기 판에서 장소마다 사진을 하나하나
 * 다시 골랐습니다. 이미 그 장소를 보면서 올린 사진인데 말입니다.
 *
 * <p>칩 세 줄이 아니라 <b>좁혀 가는 세 단계</b>입니다. 여행을 고르면 날이
 * 나오고, 날을 고르면 그 날 장소만 남습니다 — 스무 개를 한 줄에 늘어놓으면
 * 고르는 것이 아니라 훑는 일이 됩니다.
 *
 * <p>날은 <b>안 보냅니다.</b> 장소가 이미 날에 달려 있어서, 둘을 따로 보내면
 * 어긋날 수 있습니다 — 장소를 끌어서 다른 날로 옮기면 보낸 날이 거짓이 되고
 * 고쳐 줄 자리가 없습니다. 여기서 날은 장소를 좁히는 단계일 뿐이고, 서버는
 * 장소에서 날을 거슬러 올라갑니다({@code FeedService.placeOf}).
 *
 * <p>여행 번호도 마찬가지로 <b>장소가 이깁니다.</b> 둘 다 보내도 서버는 장소에서
 * 꺼낸 것을 저장하고, 어긋나면 거절합니다.
 *
 * <h3>같은 판으로 고칩니다</h3>
 *
 * <p>칸이 두 벌이 되면 한쪽만 고치는 날이 옵니다.
 */

/** 서버 FeedService 의 한도와 같아야 합니다. */
const MAX_PHOTOS = 10;

/**
 * 고른 사진을 늘어놓는 네모의 한 변.
 *
 * <p>폭을 못 박습니다. {@link OurPhoto} 는 폭을 안 주면 100% 를 쓰는데, 폭이
 * 정해지지 않은 칸 안에서 100% 는 0 입니다 — 사진이 올라갔는데도 미리보기
 * 자리가 실오라기처럼 보였습니다.
 *
 * <p>네모로 둡니다. 가로세로가 제각각이면 줄이 들쭉날쭉해지고, 여기서 보려는
 * 것은 「무엇을 골랐나」이지 사진의 생김새가 아닙니다.
 */
const THUMB = 88;
const MAX_TEXT = 2000;
const MAX_TAGS = 5;

/**
 * 고를 수 있는 공개 범위.
 *
 * <p>값은 서버의 {@code feed/domain/Audience} 와 같아야 합니다. 차례는 <b>넓은
 * 것부터</b>입니다 — 여행기 쪽({@code post-fields.tsx})과 같은 차례라 두 판을
 * 번갈아 쓰는 사람이 같은 자리에서 같은 것을 찾습니다.
 *
 * <p>「내 모임 사람만」의 설명이 둘입니다. 모임에 올리는 글에서는 <b>그 모임</b>
 * 이고, 내 피드에 쓰는 글에서는 <b>나와 모임을 함께 쓰는 사람</b>이라 묻는
 * 것이 다릅니다. 한 문장으로 뭉치면 둘 다 아닌 말이 됩니다.
 */
const SEEN: { value: FeedAudience; label: string; hint: string; inGroupHint?: string }[] = [
  {
    value: 'EVERYONE',
    label: '모두',
    hint: '앱을 쓰는 누구나 볼 수 있어요. 모임 밖 사람도요.',
  },
  {
    value: 'MATES',
    label: '내 모임 사람만',
    hint: '나와 모임을 함께 쓰는 사람만 볼 수 있어요.',
    inGroupHint: '이 모임 사람만 볼 수 있어요.',
  },
  {
    value: 'ONLY_ME',
    label: '나만',
    hint: '나만 볼 수 있어요. 혼자 간직할 때.',
  },
];

/**
 * 안 고른 글의 공개 범위.
 *
 * <p>서버의 {@code Post.audienceFor} 와 같은 규칙입니다. 공개 범위가 없던
 * 때의 동작이라, 미리 골라 두어도 아무도 모르게 넓어지는 일이 없습니다.
 *
 * <p>「모두」를 기본으로 두지 않습니다. 모르고 넓게 열리는 쪽이 모르고 좁게
 * 닫히는 쪽보다 되돌리기 어렵습니다 — 이미 남이 본 것은 못 거둡니다.
 */
function defaultAudience(groupId?: string | null): FeedAudience {
  return groupId ? 'MATES' : 'ONLY_ME';
}

export function FeedForm({
  visible,
  /** 모임에 올리면 그 모임. 안 주면 내 피드입니다. */
  groupId,
  groupName,
  /** 고치는 중이면 그 글. 안 주면 새로 쓰는 것입니다. */
  post,
  at,
  onClose,
  onDone,
}: {
  visible: boolean;
  groupId?: string | null;
  groupName?: string | null;
  post?: FeedPost | null;
  /**
   * 어디를 보면서 여는지 — <b>미리 묶어 둘 자리</b>.
   *
   * <p>일정의 장소 줄에서 열면 그 장소가 들어옵니다. 그러면 올리는 사람이
   * 여행·날·장소를 다시 고를 일이 없습니다 — 보고 있던 것이 곧 답입니다.
   *
   * <p>고치는 글({@code post})이 있으면 그 글이 들고 있는 자리가 이깁니다.
   * 고치는 판에서 열린 자리를 덮어쓰면 묶임이 조용히 바뀝니다.
   */
  at?: { tripId: string; placeId: string } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const editing = post != null;

  const [text, setText] = useState('');
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [tripId, setTripId] = useState<string | null>(null);
  /*
    고른 날.

    <p>서버에 안 보냅니다 — 장소를 좁히는 단계일 뿐입니다(머리글). 비어 있으면
    그 여행의 장소가 전부 나옵니다.
  */
  const [dayId, setDayId] = useState<string | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [audience, setAudience] = useState<FeedAudience>(defaultAudience(groupId));
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /*
    고를 수 있는 여행.

    <p>모임에 올리는 글이면 <b>그 모임의 여행만</b> 나옵니다. 안 그러면 모임
    사람들에게 그들이 못 보는 여행 이름이 글마다 붙어 뜹니다. 서버도 같은
    것을 봅니다.
  */
  const { data: tripData } = useAsync<{ trips: TripSummary[] }>(
    (signal) => (visible ? api.get('/api/trips', signal) : Promise.resolve({ trips: [] })),
    [visible],
  );
  const trips = (tripData?.trips ?? []).filter((t) =>
    groupId ? t.groupId === groupId : t.groupId == null,
  );

  /*
    고른 여행의 날과 장소.

    <p>여행을 고른 뒤에만 묻습니다. 판을 열자마자 다 받아 오는 길도 있었는데,
    장소를 안 고르는 글이 대부분이고(숙소에서 찍은 단체 사진은 장소에 설 자리가
    없습니다) 여행마다 일정 한 벌을 끌고 오는 것은 그 한 번을 위해 치르는
    값입니다.

    <p>{@code null} 을 돌려주는 가지가 있어야 합니다 — 여행을 안 골랐을 때
    「장소가 없어요」가 뜨면 안 되고, 그것을 가리는 것은 아래의 {@code spotsReady}
    입니다.
  */
  const { data: chosen, loading: chosenLoading } = useAsync<TripDetail | null>(
    (signal) =>
      visible && tripId
        ? api.get<TripDetail>(`/api/trip?trip=${encodeURIComponent(tripId)}`, signal)
        : Promise.resolve(null),
    [visible, tripId],
  );

  /*
    받아 둔 일정이 <b>지금 고른 여행의 것</b>인지.

    <p>여행을 갈아 끼우면 새 응답이 오기 전까지 {@code chosen} 에 옛 여행의
    일정이 남아 있습니다. 그대로 그리면 오사카를 고른 화면에 도쿄의 장소가
    한 박자 서 있고, 그 사이에 누르면 <b>다른 여행의 장소</b>가 골라집니다.
  */
  const spotsReady = tripId != null && !chosenLoading && chosen?.trip.id === tripId;
  const chosenDays = spotsReady ? chosen.days : [];
  /* 날을 고르면 그 날만. 안 골랐으면 그 여행의 장소 전부입니다. */
  const spots = chosenDays
    .filter((d) => dayId == null || d.id === dayId)
    .flatMap((d) => d.places.map((p) => ({ day: d, place: p })));

  useEffect(() => {
    if (!visible) {
      return;
    }
    setText(post?.text ?? '');
    setPhotoIds(post?.photoIds ?? []);
    setTags(post?.tags ?? []);
    setTagDraft('');
    /* 고치는 글이 들고 있는 자리가 먼저입니다 — 열린 자리({@code at})로
       덮어쓰면 묶임이 조용히 바뀝니다. 날은 장소에서 저절로 따라옵니다. */
    setTripId(post?.tripId ?? at?.tripId ?? null);
    setDayId(null);
    setPlaceId(post ? (post.placeId ?? null) : (at?.placeId ?? null));
    /* 고치는 중이면 지금 값을, 새로 쓰면 올린 자리가 정한 값을. 고치는
       판에서 기본값으로 되돌리면 좁혀 두었던 글이 조용히 넓어집니다. */
    setAudience(post?.audience ?? defaultAudience(groupId));
    setError(null);
    setNotice(null);
    setBusy(false);
    /*
      {@code at} 을 통째로 보지 않고 <b>안의 글자 둘</b>을 봅니다. 부르는 쪽이
      {@code at={{ tripId, placeId }}} 로 그 자리에서 짓는 꼴이면 생김새는
      같아도 그릴 때마다 다른 것이 되고, 그러면 이 되돌리기가 매번 돌아 적던
      글이 사라집니다.
    */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, post, groupId, at?.tripId, at?.placeId]);

  async function addPhotos() {
    const room = MAX_PHOTOS - photoIds.length;
    if (room <= 0) {
      setError(`사진은 ${MAX_PHOTOS}장까지 올릴 수 있어요.`);
      return;
    }
    setPicking(true);
    setError(null);
    setNotice(null);
    try {
      const got = await pickAndUpload(room);
      if (got.ids.length > 0) {
        setPhotoIds([...photoIds, ...got.ids]);
      }
      /* 몇 장이 왜 안 들어갔는지 말해 줍니다 — 아홉 장을 골랐는데 일곱만
         뜨면, 말해 주지 않는 한 고른 사람은 모릅니다. */
      const said: string[] = [];
      if (got.skipped > 0) {
        said.push(`자리가 모자라 ${got.skipped}장은 안 올렸어요.`);
      }
      if (got.failed > 0) {
        said.push(`${got.failed}장은 올리다 실패했어요.`);
      }
      setNotice(said.length > 0 ? said.join(' ') : null);
    } catch (e) {
      setError(e instanceof PickError || e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setPicking(false);
    }
  }

  function addTag() {
    const clean = tagDraft.trim().replace(/^#+/, '').trim().toLowerCase();
    if (!clean) {
      return;
    }
    if (tags.includes(clean)) {
      setTagDraft('');
      return;
    }
    if (tags.length >= MAX_TAGS) {
      setError(`태그는 ${MAX_TAGS}개까지예요.`);
      return;
    }
    setTags([...tags, clean]);
    setTagDraft('');
  }

  async function submit() {
    if (busy) {
      return;
    }
    if (!text.trim() && photoIds.length === 0) {
      setError('사진을 고르거나 한 줄 적어 주세요.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      /*
        장소는 <b>빈 글자로라도</b> 보냅니다. 고치는 길에서 안 보내는 것은
        「그대로 두기」라, 묶어 둔 장소를 떼는 길이 없어집니다 — 여행 칸과
        같은 약속입니다.

        <p>날은 안 보냅니다. 장소가 이미 날을 말하고, 둘을 따로 보내면 어긋날
        수 있습니다(머리글).
      */
      const body = {
        text: text.trim(),
        tags,
        photoIds,
        tripId: tripId ?? '',
        placeId: placeId ?? '',
        audience,
      };
      if (editing) {
        await api.patch(`/api/feed/${encodeURIComponent(post.id)}`, body);
      } else {
        await api.post('/api/feed', { ...body, groupId: groupId ?? null });
      }
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  /*
    막대에 적는 말.

    <p>장소를 묶고 열면 <b>그 장소 이름</b>이 섭니다 — 일정의 줄에서 열었으면
    올리는 사람이 보고 있던 것이 그것이고, 「내 피드에 올리기」는 지금 어디에
    올리는지를 한 줄도 안 말해 줍니다.

    <p>이름은 날로 좁혀 둔 목록이 아니라 그 여행의 장소 <b>전부</b>에서
    찾습니다. 좁혀 둔 목록에서 찾으면 날을 갈아 끼우는 사이에 막대의 말이
    사라집니다.
  */
  const spotName =
    placeId == null
      ? null
      : (chosenDays.flatMap((d) => d.places).find((p) => p.id === placeId)?.name ??
        post?.placeName ??
        null);
  const where = editing
    ? '글 고치기'
    : spotName
      ? `${spotName}에서 올리기`
      : groupName
        ? `${groupName}에 올리기`
        : '내 피드에 올리기';

  return (
    <BottomSheet
      visible={visible}
      title={where}
      onClose={onClose}
      footer={<Button label={editing ? '저장' : '올리기'} onPress={submit} busy={busy} />}>
      <Row gap={Spacing.s2} style={styles.wrap}>
        {photoIds.map((id) => (
          <View key={id} style={styles.shot}>
            <OurPhoto id={id} width={THUMB} height={THUMB} />
            <View style={styles.pull}>
              {/* 사진 위에 얹히는 단추라 바탕 없이 둡니다 — 회색 네모를 두르면
                  그 네모가 사진의 일부처럼 보입니다.

                  중괄호 없이 적혀 있었습니다. 그러면 주석이 아니라 <b>글자</b>라서
                  React Native 가 「Text strings must be rendered within a Text
                  component」로 멈춥니다 — 사진을 한 장 고르는 순간 판이 터졌습니다. */}
              <IconButton
                name="x"
                label="이 사진 빼기"
                tone="danger"
                bare
                onPress={() => setPhotoIds(photoIds.filter((x) => x !== id))}
              />
            </View>
          </View>
        ))}
      </Row>

      <Button
        label={photoIds.length > 0 ? `사진 더 고르기 (${photoIds.length}/${MAX_PHOTOS})` : '사진 고르기'}
        variant="secondary"
        busy={picking}
        onPress={addPhotos}
      />
      {notice ? <Caption tone="secondary">{notice}</Caption> : null}

      <Field
        label="무슨 일이 있었나요?"
        value={text}
        onChangeText={setText}
        placeholder="이번 오사카 진짜 좋았다"
        maxLength={MAX_TEXT}
        multiline
        hint="사진만 올려도 돼요."
      />

      <Caption strong tone="secondary">태그</Caption>
      {tags.length > 0 ? (
        <Row gap={Spacing.s2} style={styles.wrap}>
          {tags.map((t) => (
            <Chip key={t} label={`#${t}`} selected onPress={() => setTags(tags.filter((x) => x !== t))} />
          ))}
        </Row>
      ) : null}
      <Row gap={Spacing.s2}>
        <View style={styles.grow}>
          <Field
            label="태그 달기"
            value={tagDraft}
            onChangeText={setTagDraft}
            placeholder="라멘"
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={addTag}
          />
        </View>
        <Chip label="추가" selected={tagDraft.trim().length > 0} onPress={addTag} />
      </Row>

      {/*
        어느 여행 · 어느 날 · 어느 장소.

        <p>줄 셋이 아니라 <b>좁혀 가는 세 단계</b>입니다. 여행을 안 고르면 뒤의
        둘은 아예 안 섭니다 — 고를 것이 없는 줄을 세워 두면 무엇을 기다리는
        줄인지 알 수 없습니다.
      */}
      {trips.length > 0 ? (
        <>
          <Caption tone="secondary">어느 여행 이야기예요? 안 골라도 돼요.</Caption>
          <Row gap={Spacing.s2} style={styles.wrap}>
            <Chip
              label="안 고름"
              selected={tripId === null}
              onPress={() => {
                setTripId(null);
                /* 여행을 떼면 날과 장소도 함께 갑니다 — 다른 여행의 장소가
                   남으면 서버가 거절하고, 왜 거절했는지는 화면에 안 보입니다. */
                setDayId(null);
                setPlaceId(null);
              }}
            />
            {trips.map((t) => (
              <Chip
                key={t.id}
                label={t.title}
                selected={tripId === t.id}
                onPress={() => {
                  const next = tripId === t.id ? null : t.id;
                  setTripId(next);
                  setDayId(null);
                  setPlaceId(null);
                }}
              />
            ))}
          </Row>
        </>
      ) : null}

      {/*
        날 — 장소를 좁히는 단계입니다.

        <p>날이 둘 이상일 때만 냅니다. 하루짜리 여행에 「전부」와 「1일차」를
        나란히 두면 고를 것이 없는 줄이 하나 생깁니다 — 내놓기 판과 같은
        규칙입니다({@code publish-form}).
      */}
      {spotsReady && chosenDays.length > 1 ? (
        <>
          <Caption tone="secondary">어느 날이에요?</Caption>
          <Row gap={Spacing.s2} style={styles.wrap}>
            <Chip label="전부" selected={dayId === null} onPress={() => setDayId(null)} />
            {chosenDays.map((d) => (
              <Chip
                key={d.id}
                label={d.date || d.label}
                selected={dayId === d.id}
                onPress={() => {
                  const next = dayId === d.id ? null : d.id;
                  setDayId(next);
                  /* 고른 날에 없는 장소가 골라져 있으면 떼어 냅니다. 화면에서
                     사라진 칩이 속으로 골라져 있으면, 올린 뒤에야 엉뚱한
                     자리에 묶인 것을 압니다. */
                  if (
                    next != null &&
                    placeId != null &&
                    !(chosen?.days.find((x) => x.id === next)?.places ?? []).some(
                      (p) => p.id === placeId,
                    )
                  ) {
                    setPlaceId(null);
                  }
                }}
              />
            ))}
          </Row>
        </>
      ) : null}

      {/*
        장소.

        <p>「없어요」는 <b>다 받아 본 뒤에만</b> 적습니다({@code spotsReady}) —
        받는 중에 적으면 일정이 있는 여행에도 한 박자 거짓이 뜹니다.

        <p>장소 이름 앞에 날을 적습니다. 날을 「전부」로 두고 보면 같은 이름이
        여러 날에 있을 수 있어서, 날이 없으면 어느 쪽인지 안 갈립니다.
      */}
      {spotsReady ? (
        spots.length > 0 ? (
          <>
            <Caption tone="secondary">어느 장소예요? 안 골라도 돼요.</Caption>
            <Row gap={Spacing.s2} style={styles.wrap}>
              <Chip label="안 고름" selected={placeId === null} onPress={() => setPlaceId(null)} />
              {spots.map(({ day, place }) => (
                <Chip
                  key={place.id}
                  label={
                    dayId === null && chosenDays.length > 1
                      ? `${day.date || day.label} · ${place.name}`
                      : place.name
                  }
                  selected={placeId === place.id}
                  onPress={() => setPlaceId(placeId === place.id ? null : place.id)}
                />
              ))}
            </Row>
          </>
        ) : dayId != null ? (
          /* 날을 좁혀서 빈 것과 여행이 비어 있는 것은 다른 말입니다. 하나로
             뭉치면 장소가 스무 곳인 여행에서 「장소가 없어요」를 보게 됩니다. */
          <Caption tone="muted">이 날엔 아직 장소가 없어요. 위에서 날을 바꿔 보세요.</Caption>
        ) : (
          <Caption tone="muted">이 여행엔 아직 장소가 없어요. 여행만 묶어 둘게요.</Caption>
        )
      ) : null}

      {/*
        누가 볼지.

        <p>맨 아래입니다 — 무엇을 올릴지 다 정한 다음에 정하는 것이고, 무엇보다
        <b>올리기 직전에 한 번 더 보게</b> 하고 싶은 값입니다. 여행기 쪽
        ({@code post-fields.tsx})도 같은 자리입니다.
      */}
      <Caption strong tone="secondary">누가 볼 수 있나요?</Caption>
      <Row gap={Spacing.s2} style={styles.wrap}>
        {SEEN.map((s) => (
          <Chip
            key={s.value}
            label={s.label}
            selected={audience === s.value}
            onPress={() => setAudience(s.value)}
          />
        ))}
      </Row>
      <Caption tone="muted">{hintOf(audience, groupId)}</Caption>

      {error ? <ErrorNote message={error} /> : null}
    </BottomSheet>
  );
}

/** 고른 갈래의 한 줄 설명. 모임에 올리는 글이면 「내 모임」이 그 모임입니다. */
function hintOf(audience: FeedAudience, groupId?: string | null) {
  const found = SEEN.find((s) => s.value === audience);
  if (!found) {
    return '';
  }
  return groupId && found.inGroupHint ? found.inGroupHint : found.hint;
}

const styles = StyleSheet.create({
  wrap: {
    flexWrap: 'wrap',
  },
  shot: {
    position: 'relative',
    width: THUMB,
    height: THUMB,
  },
  /* 빼는 단추는 사진 위 오른쪽. 사진마다 줄을 따로 두면 아홉 장에 아홉
     줄이 생깁니다. */
  pull: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  grow: {
    flexGrow: 1,
    flexShrink: 1,
  },
});
