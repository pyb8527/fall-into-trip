import { api } from '@/api/client';
import { pickAndUpload, PickError } from '@/lib/pick-photo.web';
import { askShell, inShell } from '@/lib/shell-bridge.web';

/**
 * 얼굴 사진 한 장 고르기 (웹).
 *
 * <h3>자르는 판은 폰에만 있습니다</h3>
 *
 * <p>얼굴 자리는 네모입니다. 긴 사진을 그대로 두면 <b>어디를 보여 줄지 우리가
 * 정하게</b> 됩니다 — 가운데를 잘라 놓으면 머리가 날아간 얼굴이 섭니다.
 *
 * <p>폰에는 자르는 판이 있어서 껍데기에게 넘깁니다({@code aspect: [1, 1]}).
 * 브라우저에는 없습니다. 손수 그리면 끌기·확대·두 손가락까지 다 짜야 하는데,
 * <b>얼굴 자리가 어차피 네모로 덮어 그립니다</b>({@link OurPhoto} 가
 * {@code cover}). 그래서 브라우저에서는 사진을 그대로 올리고 보여 줄 때
 * 네모로 덮습니다 — 가운데가 보이는 것은 같고, 고를 수 있는 것만 없습니다.
 *
 * <p>이 갈림은 <b>보이는 모양을 바꾸지 않습니다.</b> 둘 다 네모로 보입니다.
 * 다른 것은 「어디를 네모로 할지 사람이 정했는가」 하나입니다.
 *
 * <h3>옛 껍데기도 돕니다</h3>
 *
 * <p>{@code pickSquare} 를 모르는 껍데기는 아무 답도 안 합니다(답이 비어
 * 옵니다). 그때는 브라우저 길로 내려갑니다 — 앱을 새로 굽기 전에도 사진을
 * 넣을 수 있어야 합니다.
 */

/**
 * 얼굴에 쓸 크기.
 *
 * <p>가장 크게 쓰이는 자리가 마이페이지의 64픽셀이고, 세 배 화면이면
 * 192입니다. 512면 넉넉하고, 서버가 긴 변 1600으로 다시 굽는 것보다
 * 훨씬 작습니다 — 얼굴 하나에 1600을 둘 이유가 없습니다.
 */
const FACE = 512;

/** 다시 구울 때의 품질. {@code pick-photo.web.ts} 와 같습니다. */
const QUALITY = 0.85;

/**
 * 사진을 고르고 올립니다.
 *
 * @return 올라간 사진 번호. 고르다 말았으면 null
 * @throws PickError 사람에게 그대로 보여 줄 말이 있을 때
 */
export async function pickFacePhoto(): Promise<string | null> {
  if (inShell) {
    const cropped = await squareFromShell();
    if (cropped === 'cancelled') {
      return null;
    }
    if (cropped) {
      const got = await api.upload<{ id: string }>('/api/photos', formOf(cropped));
      return got.id;
    }
    /* 이 말을 모르는 옛 껍데기입니다. 아래 브라우저 길로 내려갑니다. */
  }

  /*
    브라우저 길. 이미 있는 것을 그대로 씁니다 — HEIC 를 푸는 일, 긴 변을
    줄이는 일, 올리다 깨진 것을 세는 일이 전부 거기 있습니다. 여기서 다시
    짜면 아이폰 사진이 한쪽에서만 안 열리는 날이 옵니다.
  */
  const got = await pickAndUpload(1);
  if (got.ids[0]) {
    return got.ids[0];
  }
  if (got.failed > 0) {
    throw new PickError('사진을 올리지 못했어요. 다시 해 보세요.');
  }
  return null;
}

/**
 * 껍데기에게 네모로 잘라 달라고 부탁합니다.
 *
 * @return 줄여 놓은 JPEG. 고르다 말았으면 'cancelled', 이 말을 모르는
 *         껍데기면 null
 */
async function squareFromShell(): Promise<Blob | 'cancelled' | null> {
  let said: unknown;
  try {
    said = await askShell({ kind: 'pickSquare' });
  } catch {
    /* 껍데기가 넘어졌거나 답이 늦습니다. 브라우저 길이 남아 있습니다. */
    return null;
  }

  if (said === null) {
    return 'cancelled';
  }
  if (typeof said !== 'string' || !said) {
    /* 이 말을 모르는 껍데기입니다. 답이 비어서 옵니다. */
    return null;
  }

  try {
    /*
      받은 조각을 512로 줄입니다.

      <p>폰이 잘라 준 조각은 원본 크기 그대로입니다 — 1200만 화소면
      3000픽셀짜리 네모입니다. 이미 네모라 비율은 안 건드리고 크기만
      줄입니다.
    */
    return await shrinkSquare(`data:image/jpeg;base64,${said}`);
  } catch {
    throw new PickError('사진을 열지 못했어요. 다른 사진으로 해 보세요.');
  }
}

/** 올릴 봉투. 서버는 {@code file} 하나만 봅니다. */
function formOf(blob: Blob): FormData {
  const form = new FormData();
  form.append('file', blob, 'face.jpg');
  return form;
}

/** 네모인 사진을 {@link FACE} 로 줄입니다. */
async function shrinkSquare(src: string): Promise<Blob> {
  const image = await draw(src);
  const side = Math.min(FACE, Math.max(image.width, image.height)) || FACE;

  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const g = canvas.getContext('2d');
  if (!g) {
    throw new Error('그릴 데가 없어요');
  }
  /*
    폰이 네모로 잘라 줬어도 한 픽셀씩 어긋나 올 수 있습니다. 네모 칸에
    덮어 그려서 어긋난 만큼은 잘라 냅니다 — 늘여서 찌그러뜨리는 것보다
    낫습니다.
  */
  const by = side / Math.min(image.width, image.height);
  const w = image.width * by;
  const h = image.height * by;
  g.drawImage(image, (side - w) / 2, (side - h) / 2, w, h);

  const blob = await new Promise<Blob | null>((done) =>
    canvas.toBlob(done, 'image/jpeg', QUALITY),
  );
  if (!blob) {
    throw new Error('사진을 다시 굽지 못했어요');
  }
  return blob;
}

function draw(src: string): Promise<HTMLImageElement> {
  return new Promise((done, fail) => {
    const image = new Image();
    image.onload = () => done(image);
    image.onerror = () => fail(new Error('사진을 열지 못했어요'));
    image.src = src;
  });
}

export { PickError } from '@/lib/pick-photo.web';
