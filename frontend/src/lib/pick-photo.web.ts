import { api } from '@/api/client';

/**
 * 사진 고르기 (웹).
 *
 * <h3>보내기 전에 줄입니다</h3>
 *
 * <p>요즘 폰 사진은 한 장에 4~8MB 입니다. 그대로 보내면 로밍이 느린 데서
 * 한참 걸리고, 길 위에서 도장을 찍는 자리가 바로 그런 데입니다. 화면에서
 * 쓰는 것은 길어야 1600 픽셀이므로 여기서 먼저 줄입니다 — 대개 열에 하나가
 * 됩니다.
 *
 * <p>서버도 받은 그림을 다시 굽습니다. 여기서 줄이는 것은 <b>올라가는 동안</b>
 * 을 줄이려는 것이고, 서버가 굽는 것은 위치 딱지를 지우고 크기를 못 박기
 * 위해서입니다. 둘 다 필요합니다 — 화면이 보내 온 것은 믿을 것이 못 됩니다.
 *
 * <h3>HEIC 는 브라우저에 맡깁니다</h3>
 *
 * <p>아이폰이 찍는 HEIC 를 우리가 풀 수는 없습니다. 브라우저가 그림으로
 * 그려 줄 수 있으면 여기서 JPEG 으로 다시 그려져 나가고, 못 그리면 고를 때
 * 실패합니다.
 *
 * <p>한동안 앞부분을 읽어 HEIC 면 <b>열어 보지도 않고 막았습니다.</b> 그래서
 * <b>아이폰에서도 아이폰 사진을 못 올렸습니다</b> — 사파리는 풀 수 있는데
 * 우리가 먼저 거절했습니다. HEIC 를 찍는 기기가 바로 그 기기인데 말입니다.
 *
 * <p>그렇다고 「브라우저가 풀면 된다」로 두는 것도 반쪽입니다. 갤럭시도
 * 설정에서 고효율 이미지를 켜면 HEIC 로 찍는데, <b>안드로이드 크롬과 웹뷰는
 * 못 풉니다.</b> 그 사람들에게는 영영 안 되는 일이 됩니다.
 *
 * <p>직접 풉니다. 브라우저가 먼저 해 보고, 못 하면 그때 <b>푸는 코드를 받아
 * 옵니다</b>({@code heic-to}, wasm). 받아 오는 것이 작지 않아서 묶음에 미리
 * 싣지 않습니다 — HEIC 를 안 올리는 사람은 그 값을 안 냅니다. HEIF 도 같은
 * 무리라 같이 풀립니다.
 *
 * <p>여기서 풀어 주는 길도 있습니다(libheif 를 wasm 으로). 그런데 그것
 * 하나가 웹 묶음을 1~2MB 늘리고, 그 값은 HEIC 를 안 올리는 사람까지 함께
 * 냅니다. 필요해지면 그때 <b>HEIC 를 만났을 때만</b> 받아 오게 붙이는 것이
 * 맞습니다.
 */

/** 긴 쪽을 이만큼으로. 서버가 다시 굽는 크기와 같습니다. */
const MAX_SIDE = 1600;

/** 다시 그릴 때의 품질. */
const QUALITY = 0.85;

/**
 * 사진을 고르고 올립니다.
 *
 * <h3>한 번에 여러 장</h3>
 *
 * <p>한 장씩만 고르게 하면 다섯 장을 넣는 데 창을 다섯 번 열어야 합니다.
 * 한 자리에서 찍은 사진은 대개 보관함에서 나란히 붙어 있으므로, 거기서
 * 한꺼번에 고르는 것이 손이 훨씬 덜 갑니다.
 *
 * <h3>남은 자리만큼만</h3>
 *
 * <p>고르는 창은 몇 장까지인지를 모릅니다 — 브라우저에 그런 제한이
 * 없습니다. 열 장을 골라도 막을 길이 없으니 <b>받은 뒤에</b> 앞에서부터
 * 남은 자리만큼만 올립니다. 넘긴 것은 올리지도 않습니다 — 올려 놓고
 * 안 쓰면 그 사람 몫만 축냅니다.
 *
 * <h3>하나가 실패해도 나머지는 남깁니다</h3>
 *
 * <p>다섯 장 중 넷이 올라가고 하나가 깨졌을 때 통째로 버리면, 이미 올라간
 * 넷도 다시 골라야 합니다. 올라간 것은 돌려주고 못 올린 것만 말합니다.
 *
 * <h3>고르자마자 자리가 섭니다</h3>
 *
 * <p>전에는 다 올라갈 때까지 판에 아무것도 안 떴습니다. 로밍에서 다섯 장이면
 * 수십 초인데, 그동안 고른 사람이 보는 것은 바쁜 단추 하나뿐이라 고르기가
 * 안 된 줄 알고 다시 고릅니다. {@code onProgress} 를 주면 고른 장마다 자리를
 * 바로 알려 주고, 줄여지면 작은 미리보기를, 올라가면 번호를 얹어 줍니다.
 *
 * <p>미리보기 주소({@code URL.createObjectURL})는 <b>받는 쪽이 거둡니다</b>
 * ({@code URL.revokeObjectURL}). 여기서는 화면이 언제 그 그림을 그만 쓰는지
 * 모릅니다 — 진짜 사진으로 갈아 끼울 때인지, 사람이 뺄 때인지, 판을 닫을
 * 때인지는 화면만 압니다.
 * {@code onProgress} 를 안 주면 미리보기를 아예 안 만듭니다.
 *
 * @param room 넣을 수 있는 자리 수. 이보다 많이 골라도 여기까지만 올립니다
 * @param options 고른 장마다 어디까지 왔는지를 받을 자리
 * @return 올라간 사진의 번호들. 고르다 말면 빈 배열
 */
export async function pickAndUpload(room = 1, options: PickOptions = {}): Promise<Pick> {
  const files = await pick(room > 1);
  if (files.length === 0) {
    return { ids: [], skipped: 0, failed: 0 };
  }

  const taking = files.slice(0, Math.max(1, room));
  const ids: string[] = [];
  let failed = 0;
  /* 못 푼 것이 아이폰 사진이었는지. 그때만 무엇을 하면 되는지 말합니다 —
     여느 실패에 이 말을 붙이면 엉뚱한 데를 고치게 합니다. */
  let heicFailed = false;

  /* 고른 장마다 자리. 고치고 나면 통째로 새로 알려 줍니다 — 받는 쪽이
     React 상태에 그대로 넣어도 바뀐 것이 보이게. */
  const stamp = Date.now().toString(36);
  let items: Pending[] = taking.map((_, i) => ({
    key: `${stamp}-${i}`,
    previewUrl: null,
    state: 'preparing',
  }));
  const tell = (i: number, change: Partial<Pending>) => {
    if (!options.onProgress) {
      return;
    }
    items = items.map((it, at) => (at === i ? { ...it, ...change } : it));
    options.onProgress(items);
  };
  options.onProgress?.(items);

  /*
    줄이기(CPU)와 올리기(망)를 겹칩니다.

    <p>올리는 것은 여전히 <b>한 장씩</b>입니다. 한꺼번에 밀어 넣으면 로밍이
    느린 데서 서로의 대역을 나눠 먹어 다 같이 느려집니다 — 길 위에서 도장을
    찍는 자리가 바로 그런 데입니다. 그러니 망은 늘 한 줄입니다.

    <p>다만 전에는 <b>한 장을 줄이는 동안 망이 놀았고, 올리는 동안 CPU 가
    놀았습니다.</b> 둘은 서로 안 다투는 자원입니다. 그래서 N 번째가 올라가는
    동안 N+1 번째를 미리 줄여 둡니다. 다음 장이 올라갈 차례가 오면 이미 줄여져
    있어서, 열 장이면 줄이는 시간 아홉 번이 통째로 빠집니다.

    <p>미리 줄이는 것은 <b>한 장만</b>입니다. 더 앞서 가도 망이 한 줄이라
    빨라지지 않고, 그 사이 폰은 큰 그림을 연달아 풀며 메모리와 열을 씁니다 —
    오래된 안드로이드 웹뷰는 그러다 판째로 죽습니다.
  */
  const prepare = (i: number): Promise<Prepared> =>
    (async () => {
      const file = taking[i];
      const heic = await looksHeic(file);
      try {
        /* 아이폰·갤럭시가 찍은 것은 브라우저가 못 그릴 수 있습니다. 그때만
           푸는 코드를 받아 옵니다. */
        const usable = heic ? await unHeic(file) : file;
        const made = await shrink(usable, options.onProgress != null);
        /* 줄여지는 대로 바로 보여 줍니다 — 앞 장이 올라가기를 기다리지
           않습니다. */
        if (made.thumb) {
          tell(i, { previewUrl: URL.createObjectURL(made.thumb) });
        }
        return { ok: true as const, heic, small: made.small };
      } catch {
        return { ok: false as const, heic };
      }
    })();

  let next = prepare(0);
  for (let i = 0; i < taking.length; i++) {
    const ready = await next;
    /* 이 장이 올라가는 동안 다음 장을 줄입니다. */
    if (i + 1 < taking.length) {
      next = prepare(i + 1);
    }

    if (!ready.ok) {
      failed += 1;
      heicFailed ||= ready.heic;
      tell(i, { state: 'failed' });
      continue;
    }
    tell(i, { state: 'uploading' });
    try {
      const form = new FormData();
      form.append('file', ready.small, 'photo.jpg');
      const got = await api.upload<{ id: string }>('/api/photos', form);
      ids.push(got.id);
      tell(i, { state: 'done', id: got.id });
    } catch {
      failed += 1;
      heicFailed ||= ready.heic;
      tell(i, { state: 'failed' });
    }
  }

  /*
    한 장도 못 올렸고 그것이 전부 아이폰 사진이면, 「실패」 한 마디로는
    같은 사진을 몇 번씩 다시 고르게 됩니다. 몇 번을 해도 안 됩니다.
  */
  if (ids.length === 0 && heicFailed) {
    throw new PickError(
      'HEIC 사진을 푸는 데 실패했어요. 망이 느리면 푸는 코드를 못 받아 올 수 있어요. ' +
        '잠시 뒤에 다시 해 보세요.',
    );
  }

  return { ids, skipped: files.length - taking.length, failed };
}

/**
 * 고르다 생긴 일. 화면이 이 말을 그대로 보여 줍니다.
 *
 * <p>ApiError 가 아니므로 부르는 쪽의 `e instanceof ApiError` 에 안 걸립니다.
 * 그쪽은 걸리지 않으면 「사진을 올리지 못했어요」로 뭉개므로, 이것도 같이
 * 보게 해야 합니다.
 */
export class PickError extends Error {}

/**
 * 아이폰 사진인지.
 *
 * <p>ISO 기반 미디어 파일은 앞 네 바이트가 크기이고 그다음 네 바이트가
 * 'ftyp' 입니다. 그 뒤의 넉 자가 무엇인지를 봅니다 — heic·heix·hevc·mif1·msf1
 * 이 HEIC 무리입니다. 확장자는 안 봅니다. 사람이 바꿔 붙일 수 있고, 아이폰이
 * 보내 온 것에는 아예 없는 때도 있습니다.
 */
async function looksHeic(file: File): Promise<boolean> {
  try {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (head.length < 12) {
      return false;
    }
    const tag = String.fromCharCode(head[4], head[5], head[6], head[7]);
    if (tag !== 'ftyp') {
      return false;
    }
    const kind = String.fromCharCode(head[8], head[9], head[10], head[11]).toLowerCase();
    return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(kind);
  } catch {
    /* 못 읽으면 지나갑니다. 그리다 실패하면 그때 말해 줍니다. */
    return false;
  }
}

/** 고른 결과. 못 넣은 것이 왜 안 들어갔는지를 화면이 말해 줘야 합니다. */
export type Pick = {
  /** 올라간 사진의 번호들. */
  ids: string[];
  /** 자리가 모자라 안 올린 장 수. */
  skipped: number;
  /** 올리다 깨진 장 수. */
  failed: number;
};

/** 고른 한 장이 어디까지 왔는지. */
export type Pending = {
  /** 한 번 고를 때 안에서, 그리고 여러 번 고르는 사이에도 겹치지 않는 이름. */
  key: string;
  /**
   * 작은 미리보기. 줄여지기 전에는 null 입니다. 다 쓰면 받는 쪽이
   * {@code URL.revokeObjectURL} 로 거둡니다.
   */
  previewUrl: string | null;
  state: 'preparing' | 'uploading' | 'done' | 'failed';
  /** 올라간 사진 번호. {@code done} 일 때만 있습니다. */
  id?: string;
};

export type PickOptions = {
  /** 고른 장 전부의 지금 모습. 무엇이 바뀌든 통째로 다시 옵니다. */
  onProgress?: (items: Pending[]) => void;
};

/** 한 장을 올릴 채비가 끝난 것. 깨졌으면 아이폰 사진이었는지만 남깁니다. */
type Prepared = { ok: true; heic: boolean; small: Blob } | { ok: false; heic: boolean };

/**
 * 파일 고르기.
 *
 * <p>capture 를 안 답니다. 달면 카메라가 바로 열리는데, 그러면 이미 찍어 둔
 * 사진을 고를 수가 없습니다. 안 달면 기기가 「사진 보관함 / 사진 찍기」를
 * 함께 물어봅니다.
 *
 * <p>여러 장을 받을 때만 multiple 을 답니다. 한 장짜리 자리(여행기 표지)
 * 에까지 달면 여러 장을 고를 수 있는 것처럼 보여 놓고 하나만 씁니다.
 */
function pick(many: boolean): Promise<File[]> {
  return new Promise((done) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = many;
    input.style.display = 'none';

    /*
      고르다 말았을 때.

      <p>취소에는 이벤트가 없는 브라우저가 있습니다. 창이 돌아왔는데 아무
      일도 없으면 안 고른 것으로 봅니다 — 안 그러면 이 약속이 영영 안 끝나고,
      그것을 기다리는 화면이 계속 바쁜 상태로 남습니다.
    */
    let settled = false;
    const finish = (files: File[]) => {
      if (settled) {
        return;
      }
      settled = true;
      input.remove();
      done(files);
    };

    input.addEventListener('change', () => finish(Array.from(input.files ?? [])));
    input.addEventListener('cancel', () => finish([]));
    window.addEventListener('focus', () => setTimeout(() => finish([]), 800), { once: true });

    document.body.appendChild(input);
    input.click();
  });
}

/**
 * 미리보기의 긴 쪽.
 *
 * <p>판의 네모가 88픽셀이고 세 배 화면이면 264 입니다. 1600짜리를 그대로
 * 미리보기로 걸면 네모 열 개가 큰 그림 열 장을 풀어 들고 있게 됩니다 — 이미
 * 풀어 둔 그림에서 한 번 더 작게 그리는 값은 거의 없습니다.
 */
const THUMB_SIDE = 264;

/**
 * 긴 쪽을 맞춰 다시 그립니다. 그러면서 JPEG 이 됩니다.
 *
 * <h3>{@code createImageBitmap} 을 안 씁니다 — 재 보니 더 느렸습니다</h3>
 *
 * <p>「풀어서 넘겨 달라」는 말이라 옆 줄에서 풀고 화면 줄을 덜 붙잡을 것 같아
 * 보입니다. 크롬(안드로이드 웹뷰가 같은 엔진입니다)에서 4032×3024 넉 장을
 * 1600 으로 줄여 구워 보니 반대였습니다.
 *
 * <ul>
 *   <li>{@code <img>} → {@code <canvas>}: 약 0.2~0.4초, 화면 줄을 가장 오래 붙잡은
 *       때 40~80ms</li>
 *   <li>{@code createImageBitmap} → {@code OffscreenCanvas}: 약 0.4~0.7초,
 *       60~100ms</li>
 *   <li>{@code resizeWidth·resizeHeight} 를 준 것: 0.35~0.95초, 50~160ms</li>
 * </ul>
 *
 * <p>CPU 를 네 배 느리게 묶어도(오래된 폰 흉내) 차례가 같았습니다. 까닭은
 * JPEG 을 푸는 방식에 있습니다. {@code <img>} 를 작게 그리면 브라우저가 JPEG 을
 * <b>처음부터 1/2·1/4 크기로 풉니다</b> — 다 풀고 줄이는 것이 아니라 덜 풉니다.
 * {@code createImageBitmap} 은 크기를 줘도 일단 다 푼 다음 줄입니다. 큰 사진일수록
 * 벌어집니다. 그래서 「더 빠르게」는 푸는 길을 바꾸는 대신 줄이기와 올리기를
 * 겹치는 것({@link pickAndUpload})으로 얻습니다.
 *
 * <p>돌아간 사진도 이 길이 맞게 세웁니다. 폰 사진은 대개 누운 채로 저장되고
 * 「세워서 보라」는 딱지(EXIF)가 붙어 있는데, 요즘 브라우저는 {@code <img>} 를
 * 그 딱지대로 세워서 캔버스에 그립니다. 다시 구우면 딱지는 떨어집니다 — 서버도
 * 한 번 더 지웁니다.
 *
 * @param thumb 미리보기도 만들지. 이미 풀어 둔 그림에서 한 번 더 작게 그리는
 *        것이라 큰 그림을 다시 풀지 않습니다
 */
async function shrink(file: File, thumb: boolean): Promise<{ small: Blob; thumb: Blob | null }> {
  const image = await draw(file);
  const small = await encode(image, MAX_SIDE, QUALITY);
  if (!small) {
    /* 그릴 데가 없으면 원본 그대로 보냅니다. 서버가 어차피 다시 굽습니다. */
    return { small: file, thumb: null };
  }
  return { small, thumb: thumb ? await encode(image, THUMB_SIDE, 0.7) : null };
}

/**
 * 긴 쪽이 {@code side} 를 넘지 않게 그려 JPEG 으로 굽습니다.
 *
 * @return 구운 것. 그릴 데가 없으면 null
 */
async function encode(image: HTMLImageElement, side: number, quality: number): Promise<Blob | null> {
  let width = image.naturalWidth;
  let height = image.naturalHeight;
  const longest = Math.max(width, height);
  if (longest > side) {
    const by = side / longest;
    width = Math.max(1, Math.round(width * by));
    height = Math.max(1, Math.round(height * by));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  if (!g) {
    return null;
  }
  /* 투명한 PNG 를 JPEG 으로 구우면 투명한 자리가 검게 나옵니다. */
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, width, height);
  /* 4000 에서 1600 으로 한 번에 줄이면 기본 품질에서는 잔물결이 섭니다. */
  g.imageSmoothingQuality = 'high';
  g.drawImage(image, 0, 0, width, height);

  return new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', quality));
}

function draw(file: File): Promise<HTMLImageElement> {
  return new Promise((done, fail) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      done(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      fail(new Error('사진을 열지 못했어요. 다른 사진으로 해 보세요.'));
    };
    image.src = url;
  });
}

/**
 * 브라우저가 못 푸는 것을 풀어 옵니다.
 *
 * <h3>왜 미리 안 싣는가</h3>
 *
 * <p>푸는 코드는 wasm 이라 작지 않습니다. 묶음에 미리 실으면 <b>HEIC 를 한
 * 번도 안 올리는 사람까지</b> 그 값을 냅니다. 만났을 때만 받아 옵니다 —
 * 처음 한 장이 조금 느리고, 그다음부터는 브라우저가 들고 있습니다.
 *
 * <h3>먼저 브라우저에게 맡깁니다</h3>
 *
 * <p>사파리는 HEIC 를 그대로 그립니다. 그쪽이 훨씬 빠르고 메모리도 덜 먹으니,
 * 받아 오는 것은 <b>브라우저가 못 그렸을 때</b>뿐입니다.
 */
async function unHeic(file: File): Promise<File> {
  try {
    /* 브라우저가 그릴 수 있으면 그대로 둡니다. */
    await draw(file);
    return file;
  } catch {
    /* 못 그립니다. 풀어 봅니다. */
  }

  const { heicTo } = await import('heic-to');
  const jpeg = await heicTo({ blob: file, type: 'image/jpeg', quality: QUALITY });
  return new File([jpeg], 'photo.jpg', { type: 'image/jpeg' });
}
