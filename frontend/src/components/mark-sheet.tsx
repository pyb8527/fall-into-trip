import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { PlaceMark } from '@/api/types';
import { OurPhoto } from '@/components/our-photo';
import { Spacing } from '@/constants/theme';
import { pickAndUpload } from '@/lib/pick-photo';
import { BottomSheet, Button, Caption, Chip, ErrorNote, Field, Row } from '@/ui';

/**
 * 한 곳에 붙일 수 있는 사진 수.
 *
 * <p>서버와 같은 수입니다(VisitService.MAX_PHOTOS). 여기서 막는 것은
 * 친절이고, 서버에서 막는 것이 진짜입니다 — 한쪽만 두면 둘 중 하나는
 * 거짓말이 됩니다.
 */
const MAX_PHOTOS = 5;

/**
 * 그 자리에서 남기는 것.
 *
 * <h3>왜 찍자마자 여는가</h3>
 *
 * <p>여행기의 재료가 여기서 나옵니다. 그런데 따로 찾아 들어가게 하면 아무도
 * 안 남깁니다 — 도장은 길 위에서 걸으며 누르는 것이고, 그때 한 번 더 들어가라고
 * 하면 그걸로 끝입니다.
 *
 * <p>돌아와서 쓰라고 하면 더 안 씁니다. 그때는 무엇을 느꼈는지부터 다시
 * 떠올려야 하니까요.
 *
 * <h3>안 남기고 닫을 수 있습니다</h3>
 *
 * <p>남기는 것이 도장의 조건은 아닙니다. 그냥 찍고 지나가는 것이 여전히
 * 기본이고, 이 판은 "할 수 있다" 를 보여 줄 뿐입니다.
 */
export function MarkSheet({
  place,
  now,
  onClose,
  onSaved,
}: {
  /** 남길 곳. null 이면 판이 닫혀 있습니다. */
  place: { id: string; name: string } | null;
  /** 이미 남긴 것. 다시 열면 여기서 시작합니다. */
  now?: PlaceMark;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState('');
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /* 판은 닫혀도 화면에 남아 있습니다. 열 때마다 지금 남아 있는 것으로
     되돌려 놓지 않으면, 앞 장소에 적은 것이 다음 장소에 그대로 뜹니다. */
  useEffect(() => {
    if (place) {
      setPhotoIds(now?.photoIds ?? []);
      setStars(now?.stars ?? 0);
      setNote(now?.note ?? '');
      setFailed(null);
    }
    /* place 가 바뀔 때만 봅니다 — now 는 새로 읽을 때마다 새 객체라 여기
       넣으면 적는 동안 계속 되돌려집니다. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.id]);

  async function choose() {
    const room = MAX_PHOTOS - photoIds.length;
    if (room <= 0) {
      return;
    }
    setFailed(null);
    setPicking(true);
    try {
      const got = await pickAndUpload(room);
      if (got.ids.length > 0) {
        /* 고르는 사이에 다른 장이 붙었을 수 있습니다. 그때의 자리가 아니라
           지금의 자리로 다시 잘라 넣습니다. */
        setPhotoIds((was) => [
          ...was,
          ...got.ids.filter((id) => !was.includes(id)).slice(0, MAX_PHOTOS - was.length),
        ]);
      }
      /* 왜 덜 들어갔는지를 말해 줍니다. 아무 말 없이 몇 장만 붙어 있으면
         나머지가 어디로 갔는지 알 수가 없습니다. */
      if (got.failed > 0) {
        setFailed(`${got.failed}장은 올리지 못했어요. 다시 해 보세요.`);
      } else if (got.skipped > 0) {
        setFailed(`사진은 한 곳에 ${MAX_PHOTOS}장까지라 ${got.skipped}장은 안 넣었어요.`);
      }
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : '사진을 올리지 못했어요.');
    } finally {
      setPicking(false);
    }
  }

  /**
   * 한 장 빼기.
   *
   * <p>여기서는 떼기만 합니다. 서버에 지워 달라고까지 하면, 잘못 눌러서
   * 뺀 것을 되돌릴 길이 없어집니다. 파일을 정말 지우는 것은 사진 관리에서
   * 따로 합니다.
   */
  function drop(id: string) {
    setPhotoIds((was) => was.filter((one) => one !== id));
  }

  async function save() {
    if (!place || busy) {
      return;
    }
    setFailed(null);
    setBusy(true);
    try {
      await api.put(`/api/visits/${place.id}`, {
        /* 빈 문자열과 0 이 지우기입니다. null 은 "그대로 두기" 라서, 지운
           것을 서버에 알리려면 빈 값을 보내야 합니다. */
        /* 보낸 목록이 곧 그 장소의 사진입니다. 뺀 것은 여기 없으니
           서버에서도 떨어집니다. 빈 배열이 "다 빼기" 입니다. */
        photoIds,
        stars,
        note: note.trim(),
      });
      onSaved();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      visible={place !== null}
      title={place ? `${place.name} 에 남기기` : ''}
      onClose={onClose}
      footer={<Button label="남기기" onPress={save} busy={busy} />}>
      <Caption tone="secondary">
        나중에 여행기로 옮겨져요. 안 남기고 닫아도 도장은 그대로예요.
      </Caption>

      {/*
        고른 사진들.

        <p>고르는 자리에서는 옆으로 넘기지 않고 다 펴 놓습니다 — 지금 몇
        장이 붙어 있는지가 한눈에 보여야 다섯 장을 셀 수 있고, 빼는 단추가
        사진마다 붙어 있어야 어느 것을 빼는지가 분명합니다.
      */}
      {photoIds.map((id, at) => (
        <View key={id} style={styles.shot}>
          <OurPhoto id={id} height={200} />
          <Row gap={Spacing.sm} style={styles.shotFoot}>
            <Caption tone="secondary">
              {at + 1}/{photoIds.length}
            </Caption>
            <Button label="빼기" variant="ghost" compact onPress={() => drop(id)} />
          </Row>
        </View>
      ))}
      {photoIds.length < MAX_PHOTOS ? (
        <Button
          label={
            photoIds.length === 0
              ? `사진 고르기 (${MAX_PHOTOS}장까지)`
              : `사진 더 넣기 (${photoIds.length}/${MAX_PHOTOS})`
          }
          variant="secondary"
          compact
          busy={picking}
          onPress={choose}
        />
      ) : (
        <Caption tone="secondary">사진은 한 곳에 {MAX_PHOTOS}장까지예요.</Caption>
      )}

      {/*
        별.

        <p>누른 것을 다시 누르면 지워집니다. 지우는 길이 없으면 잘못 누른 것을
        되돌릴 수 없고, 그러면 안 매기느니만 못합니다.
      */}
      <Caption tone="secondary">어땠어요?</Caption>
      <Row gap={Spacing.xs} style={styles.wrap}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Chip
            key={n}
            label={'★'.repeat(n)}
            selected={stars === n}
            onPress={() => setStars(stars === n ? 0 : n)}
          />
        ))}
      </Row>

      <Field
        label="한 줄"
        value={note}
        onChangeText={setNote}
        placeholder="국물이 진해요"
        hint="200자까지. 비워도 돼요."
      />

      {failed ? <ErrorNote message={failed} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexWrap: 'wrap',
  },
  shot: {
    gap: Spacing.xs,
  },
  shotFoot: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
