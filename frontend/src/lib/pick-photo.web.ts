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
 * @param room 넣을 수 있는 자리 수. 이보다 많이 골라도 여기까지만 올립니다
 * @return 올라간 사진의 번호들. 고르다 말면 빈 배열
 */
export async function pickAndUpload(room = 1): Promise<Pick> {
  const files = await pick(room > 1);
  if (files.length === 0) {
    return { ids: [], skipped: 0, failed: 0 };
  }

  const taking = files.slice(0, Math.max(1, room));
  const ids: string[] = [];
  let failed = 0;
  /* 한 장씩 차례로 올립니다. 한꺼번에 밀어 넣으면 로밍이 느린 데서
     서로의 대역을 나눠 먹어 다 같이 느려집니다 — 길 위에서 도장을
     찍는 자리가 바로 그런 데입니다. */
  /* 못 푼 것이 아이폰 사진이었는지. 그때만 무엇을 하면 되는지 말합니다 —
     여느 실패에 이 말을 붙이면 엉뚱한 데를 고치게 합니다. */
  let heicFailed = false;

  for (const file of taking) {
    try {
      /* 아이폰·갤럭시가 찍은 것은 브라우저가 못 그릴 수 있습니다. 그때만
         푸는 코드를 받아 옵니다. */
      const usable = (await looksHeic(file)) ? await unHeic(file) : file;
      const small = await shrink(usable);
      const form = new FormData();
      form.append('file', small, 'photo.jpg');
      const got = await api.upload<{ id: string }>('/api/photos', form);
      ids.push(got.id);
    } catch {
      failed += 1;
      if (!heicFailed && (await looksHeic(file))) {
        heicFailed = true;
      }
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

/** 긴 쪽을 맞춰 다시 그립니다. 그러면서 JPEG 이 됩니다. */
async function shrink(file: File): Promise<Blob> {
  const image = await draw(file);
  let { width, height } = image;
  const longest = Math.max(width, height);
  if (longest > MAX_SIDE) {
    const by = MAX_SIDE / longest;
    width = Math.max(1, Math.round(width * by));
    height = Math.max(1, Math.round(height * by));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  if (!g) {
    /* 그릴 데가 없으면 원본 그대로 보냅니다. 서버가 어차피 다시 굽습니다. */
    return file;
  }
  /* 투명한 PNG 를 JPEG 으로 구우면 투명한 자리가 검게 나옵니다. */
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, width, height);
  g.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((done) =>
    canvas.toBlob(done, 'image/jpeg', QUALITY),
  );
  return blob ?? file;
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
