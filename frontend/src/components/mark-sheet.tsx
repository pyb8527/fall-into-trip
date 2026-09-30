import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { PlaceMark } from '@/api/types';
import { OurPhoto } from '@/components/our-photo';
import { Spacing } from '@/constants/theme';
import { PickError, pickAndUpload } from '@/lib/pick-photo';
import { BottomSheet, Button, Caption, Chip, ErrorNote, Field, Icon, Row } from '@/ui';

/**
 * 한 곳에 붙일 수 있는 사진 수.
 *
 * <p>서버와 같은 수입니다(VisitService.MAX_PHOTOS). 여기서 막는 것은
 * 친절이고, 서버에서 막는 것이 진짜입니다 — 한쪽만 두면 둘 중 하나는
 * 거짓말이 됩니다.
 */
const MAX_PHOTOS = 5;

/**
 * 그 자리에 남기는 것.
 *
 * <h3>사진과 글이 본문입니다</h3>
 *
 * <p>「도장에 곁들이는 것」으로 두었었습니다. 별점 줄이 먼저 서고 한 줄짜리
 * 칸이 맨 아래 붙어서, 쓰는 사람은 이 판을 <b>체크를 마무리하는 자리</b>로
 * 읽었습니다. 그래서 대개 아무것도 안 남겼습니다.
 *
 * <p>순서를 뒤집습니다. 사진을 고르는 것이 맨 위이고 그다음이 글이며, 별은
 * 맨 아래에서 원하면 누릅니다. 도장은 「갔다 왔다」는 표시일 뿐이고, 여기서
 * 하는 일은 그날 그 자리를 남기는 것입니다.
 *
 * <h3>왜 찍자마자 여는가</h3>
 *
 * <p>돌아와서 쓰라고 하면 안 씁니다. 그때는 무엇을 느꼈는지부터 다시
 * 떠올려야 하니까요. 도장은 길 위에서 걸으며 누르는 것이고, 그 순간이 사진과
 * 글이 나오기에 가장 좋은 때입니다.
 *
 * <h3>여행의 것입니다</h3>
 *
 * <p>같이 간 사람 모두의 자리라 멤버면 누구나 고치고 뺍니다. 내 것만 고칠 수
 * 있게 두면, 흐린 사진 한 장을 바꾸는 데도 올린 사람이 앱을 열어야 합니다.
 */
export function MarkSheet({
  place,
  now,
  onClose,
  onSaved,
}: {
  /** 남길 곳. null 이면 판이 닫혀 있습니다. */
  place: { id: string; name: string } | null;
  /** 이미 남아 있는 것. 다시 열면 여기서 시작합니다. */
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
      /* PickError 는 무엇을 하면 되는지까지 담은 말입니다. 뭉개면 그 말이
         사라지고 「사진을 올리지 못했어요」만 남습니다. */
      setFailed(
        e instanceof ApiError || e instanceof PickError
          ? e.message
          : '사진을 올리지 못했어요.',
      );
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
        /* 보낸 목록이 곧 그 장소의 사진입니다. 뺀 것은 여기 없으니
           서버에서도 떨어집니다. 빈 배열이 "다 빼기" 입니다. */
        photoIds,
        /* 빈 글자와 0 이 지우기입니다. null 은 "그대로 두기" 라서, 지운 것을
           서버에 알리려면 빈 값을 보내야 합니다. */
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
      title={place ? place.name : ''}
      onClose={onClose}
      footer={<Button label="올리기" onPress={save} busy={busy} strong />}>
      {/*
        사진이 맨 위입니다.

        <p>고르는 자리에서는 옆으로 안 넘깁니다 — 지금 몇 장이 붙어 있는지가
        한눈에 보여야 다섯 장을 셀 수 있고, 빼는 단추가 사진마다 붙어 있어야
        어느 것을 빼는지가 분명합니다.
      */}
      {photoIds.map((id, at) => (
        <View key={id} style={styles.shot}>
          <OurPhoto id={id} height={220} />
          {/* 빼는 단추는 사진 위 모서리에 얹습니다. 아래에 한 줄로 두면
              사진 다섯 장에 단추 다섯 줄이 끼어 목록이 두 배가 됩니다. */}
          <Pressable
            style={styles.drop}
            onPress={() => drop(id)}
            accessibilityLabel={`${at + 1}번째 사진 빼기`}>
            <Icon name="x" size={18} tone="inverse" />
          </Pressable>
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
          busy={picking}
          onPress={choose}
        />
      ) : (
        <Caption tone="secondary">사진은 한 곳에 {MAX_PHOTOS}장까지예요.</Caption>
      )}

      {/*
        글.

        <p>한 줄짜리 칸이었습니다. 「한 줄」이라고 이름까지 붙여 두었으니
        긴 것을 적을 생각이 안 듭니다. 여기가 본문이라 여러 줄을 받습니다.
      */}
      <Field
        label="그날 이야기"
        value={note}
        onChangeText={setNote}
        placeholder="국물이 진했고 줄은 20분쯤 섰어요"
        multiline
        numberOfLines={4}
        style={styles.body}
        hint="200자까지. 비워도 돼요."
      />

      {/*
        별.

        <p>맨 아래입니다 — 있으면 좋지만 없어도 그만인 것이라, 위에 두면
        이 판이 「점수 매기는 자리」로 읽힙니다.

        <p>누른 것을 다시 누르면 지워집니다. 지우는 길이 없으면 잘못 누른
        것을 되돌릴 수 없고, 그러면 안 매기느니만 못합니다.
      */}
      <Caption tone="secondary">어땠어요? (안 매겨도 돼요)</Caption>
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

      <Caption tone="muted">같이 간 사람 모두에게 보이고, 누구나 고칠 수 있어요.</Caption>

      {failed ? <ErrorNote message={failed} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexWrap: 'wrap',
  },
  shot: {
    position: 'relative',
  },
  drop: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    /* 사진 위에 얹히므로 바탕을 깝니다. 밝은 하늘 위의 흰 ✕ 는 안 보입니다. */
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  /* 글이 본문이라 넉넉히 둡니다. 두 줄짜리 칸에는 두 줄만 적힙니다. */
  body: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
