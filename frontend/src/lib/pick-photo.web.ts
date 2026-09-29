import { api } from '@/api/client';

/**
 * 사진 한 장 고르기 (웹).
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
 * 실패합니다 — 그때는 그렇다고 말합니다.
 */

/** 긴 쪽을 이만큼으로. 서버가 다시 굽는 크기와 같습니다. */
const MAX_SIDE = 1600;

/** 다시 그릴 때의 품질. */
const QUALITY = 0.85;

/**
 * 사진을 고르고 올립니다.
 *
 * @return 올라간 사진의 번호. 고르다 말면 null
 */
export async function pickAndUpload(): Promise<string | null> {
  const file = await pick();
  if (!file) {
    return null;
  }
  const small = await shrink(file);
  const form = new FormData();
  form.append('file', small, 'photo.jpg');
  const got = await api.upload<{ id: string }>('/api/photos', form);
  return got.id;
}

/**
 * 파일 하나 고르기.
 *
 * <p>capture 를 안 답니다. 달면 카메라가 바로 열리는데, 그러면 이미 찍어 둔
 * 사진을 고를 수가 없습니다. 안 달면 기기가 「사진 보관함 / 사진 찍기」를
 * 함께 물어봅니다.
 */
function pick(): Promise<File | null> {
  return new Promise((done) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';

    /*
      고르다 말았을 때.

      <p>취소에는 이벤트가 없는 브라우저가 있습니다. 창이 돌아왔는데 아무
      일도 없으면 안 고른 것으로 봅니다 — 안 그러면 이 약속이 영영 안 끝나고,
      그것을 기다리는 화면이 계속 바쁜 상태로 남습니다.
    */
    let settled = false;
    const finish = (file: File | null) => {
      if (settled) {
        return;
      }
      settled = true;
      input.remove();
      done(file);
    };

    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    window.addEventListener('focus', () => setTimeout(() => finish(null), 800), { once: true });

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
