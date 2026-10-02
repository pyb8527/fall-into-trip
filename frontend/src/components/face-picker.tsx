import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ApiError } from '@/api/client';
import { ProfileFace } from '@/components/profile-face';
import { Spacing } from '@/constants/theme';
import { pickFacePhoto, PickError } from '@/lib/pick-square';
import { Body, Button, Caption, ChoiceTile, ErrorNote, Row } from '@/ui';

/**
 * 얼굴 고르기 — 사진 한 장이나 표식 하나.
 *
 * <h3>한 자리에 둘이 섭니다</h3>
 *
 * <p>사람 얼굴과 모임 얼굴은 고르는 목록만 다릅니다 — 사람은 동물
 * ({@code user-marks}), 모임은 모임에 어울리는 이모지. 하는 일은 같습니다:
 * 사진을 올리거나, 표식 하나를 찍거나, 아무것도 안 하거나.
 *
 * <p>그래서 판을 둘 만들지 않습니다. 둘로 두면 사진 올리다 깨졌을 때의 말,
 * 올리는 중의 모양, 사진을 뺄 길이 <b>한쪽만</b> 고쳐지는 날이 옵니다.
 *
 * <h3>사진이 표식을 지우지 않습니다</h3>
 *
 * <p>사진을 올려도 골라 둔 표식은 그대로 남습니다. 사진을 빼면 표식이 다시
 * 섭니다 — 사진을 빼는 것과 표식을 지우는 것은 다른 일입니다. 둘을 묶어
 * 두면 사진 한 번 올린 뒤에 표식을 되찾을 길이 없습니다.
 *
 * <p>보여 줄 때는 사진이 먼저입니다({@link ProfileFace}). 둘을 함께 그릴
 * 자리가 없고, 사진을 올린 사람이 바라는 것은 그 사진입니다.
 *
 * <h3>사진 한 장은 그 사람 몫을 먹습니다</h3>
 *
 * <p>얼굴도 {@code /api/photos} 로 올라가서 <b>사람당 1000장</b>에 들어갑니다.
 * 예외를 두려면 서버가 사진에 갈래를 달고 세는 자리를 가려야 하는데, 천
 * 장에서 한 장(0.1%)을 위해 그것을 하지는 않습니다.
 *
 * <p>대신 <b>쌓이지 않게</b> 합니다. 얼굴은 바꾸는 것이라 그대로 두면 바꾼
 * 횟수만큼 묵은 장이 남습니다. 바꿔 끼운 뒤에 옛 장을 지우는 일은 <b>저장한
 * 쪽</b>이 합니다 — 여기서 지워 버리면 판을 저장 안 하고 닫은 사람의 얼굴이
 * 깨집니다.
 */

/** 고를 수 있는 표식 하나. 사람 것과 모임 것의 생김새를 맞춥니다. */
export type FaceMark = {
  /** 서버에 보낼 값. 사람은 짧은 이름("rabbit"), 모임은 이모지 그대로입니다. */
  key: string;
  /** 칸에 그릴 이모지. */
  glyph: string;
  /** 화면 읽어 주는 기계에게. */
  label: string;
};

export function FacePicker({
  photoId,
  /** 사진이 바뀌었습니다. 뺐으면 null. 저장은 부르는 쪽이 합니다. */
  onPhoto,
  mark,
  /** 표식이 바뀌었습니다. 뺐으면 null. */
  onMark,
  marks,
  /**
   * 표식을 안 고른 칸에 붙일 이름. 안 주면 그 칸을 안 냅니다.
   *
   * <p>모임 쪽은 고른 것을 다시 눌러서 뺍니다 — 칸이 열이라 하나를 더
   * 붙이면 줄이 어긋납니다.
   */
  noneLabel,
  /**
   * 사진이 없을 때 얼굴 칸에 그릴 이모지.
   *
   * <p>안 주면 고른 표식의 것을 씁니다. 모임은 그 기본이 맞습니다 — 표식
   * 값이 이모지 그대로라 {@code marks} 에서 바로 찾힙니다.
   *
   * <p>사람은 다릅니다. 표식 값이 짧은 이름("rabbit")이고 그림은 화면이
   * 정하며({@code user-marks}), 고치는 자리도 여기가 아닙니다 —
   * {@code marks} 가 비어 있어 찾을 데가 없습니다. 그래서 <b>그릴 것</b>을
   * 따로 받습니다. 안 받으면 토끼를 골라 둔 사람이 판을 열었을 때 빈
   * 동그라미를 보고 「내 얼굴이 비었다」고 읽습니다.
   */
  glyph,
  /** 사진도 표식도 없을 때 얼굴 칸에 세울 것. 로고나 이름 첫 글자. */
  fallback,
  /** 「내 얼굴」 · 「모임 얼굴」. 판의 머리글과 읽어 주는 이름에 함께 씁니다. */
  what,
}: {
  photoId: string | null;
  onPhoto: (next: string | null) => void;
  mark: string | null;
  onMark: (next: string | null) => void;
  marks: FaceMark[];
  glyph?: string | null;
  noneLabel?: string;
  fallback?: React.ReactNode;
  what: string;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /*
    사진은 사람이 단추를 누른 다음에 고릅니다.

    <p>판을 열자마자 보관함을 열지 않습니다 — 표식만 바꾸러 온 사람에게
    사진 고르는 창이 뜨면 그것을 닫고 나서 다시 찾아야 합니다.
  */
  async function choose() {
    if (busy) {
      return;
    }
    setFailed(null);
    setBusy(true);
    try {
      const id = await pickFacePhoto();
      if (id) {
        onPhoto(id);
      }
      /* id 가 없으면 고르다 말았습니다. 고장이 아니므로 아무 말도 안 합니다. */
    } catch (e) {
      setFailed(
        e instanceof ApiError || e instanceof PickError ? e.message : '사진을 올리지 못했어요.',
      );
    } finally {
      setBusy(false);
    }
  }

  const chosen = marks.find((m) => m.key === mark);

  return (
    <>
      <Row gap={Spacing.s4} style={styles.now}>
        <ProfileFace
          photoId={photoId}
          mark={glyph ?? chosen?.glyph}
          fallback={fallback}
          size={64}
          label={`지금 ${what}`}
        />
        <Row gap={Spacing.s2} style={styles.buttons}>
          <Button
            label={photoId ? '사진 바꾸기' : '사진 고르기'}
            variant="secondary"
            compact
            busy={busy}
            onPress={choose}
          />
          {photoId ? (
            <Button label="사진 빼기" variant="ghost" compact onPress={() => onPhoto(null)} />
          ) : null}
        </Row>
      </Row>

      {failed ? <ErrorNote message={failed} /> : null}

      {/*
        표식 고르기.

        <p>{@code marks} 가 비어 있으면 이 칸을 아예 안 냅니다. 사람 프로필은
        표식이 <b>지도에서 나를 가리키는 그림</b>이라 그 뜻을 적어 둔 설정
        화면에서 고릅니다 — 여기서도 고치게 두면 같은 값을 두 자리에서
        바꾸게 되고, 그러면 한쪽만 고치는 날이 옵니다.

        <p>그래도 <b>보여 줄 때는</b> 위 얼굴 칸이 표식을 세웁니다. 사진이
        없는 사람의 얼굴이 그것입니다.
      */}
      {marks.length === 0 ? null : (
        <>
          {/* 사진을 올려 둔 사람에게는 아래 칸이 지금 쓰이지 않는 것이라고
              말해 줍니다 — 안 그러면 눌러 놓고 왜 안 바뀌는지 찾습니다. */}
          {photoId ? (
            <Caption tone="muted">사진을 올려 두면 아래 표식 대신 사진이 보여요.</Caption>
          ) : null}

          <Body small strong>
            표식
          </Body>
          <Row gap={Spacing.s2} style={styles.tiles}>
            {noneLabel ? (
              <ChoiceTile
                label={noneLabel}
                selected={mark === null}
                onPress={() => onMark(null)}
                accessibilityLabel={`표식 없이 ${noneLabel}`}
              />
            ) : null}
            {marks.map((one) => (
              <ChoiceTile
                key={one.key}
                mark={one.glyph}
                selected={mark === one.key}
                accessibilityLabel={one.label}
                /* 고른 것을 다시 누르면 뺍니다. 뺄 길이 없으면 한 번 달면
                   끝입니다. */
                onPress={() => onMark(mark === one.key ? null : one.key)}
              />
            ))}
          </Row>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  now: {
    alignItems: 'center',
  },
  buttons: {
    flexWrap: 'wrap',
  },
  tiles: {
    flexWrap: 'wrap',
  },
});
