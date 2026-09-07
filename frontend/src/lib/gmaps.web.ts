/**
 * 구글 지도 스크립트 (웹).
 *
 * <p>키는 빌드할 때 EXPO_PUBLIC_GMAPS_KEY 로만 들어옵니다. 없으면 지도와
 * 장소 검색이 조용히 빠지고, 나머지 화면은 그대로 씁니다. 쓰는 사람에게
 * 키를 물어보는 일은 없습니다 — 그건 만드는 사람이 넣어 둘 값입니다.
 *
 * <p>지도를 그리는 데만 씁니다. 장소 검색은 서버가 대신 하므로 places
 * 라이브러리를 받아 오지 않습니다.
 *
 * <p>웹 전용입니다. 앱에서는 이 파일이 잡히지 않습니다.
 */

export const GMAPS_KEY = process.env.EXPO_PUBLIC_GMAPS_KEY ?? null;

export const hasMaps = () => Boolean(GMAPS_KEY);

/* 스크립트는 문서에 한 번만 붙입니다. 화면을 오갈 때마다 붙이면 그때마다
   다시 내려받고, 구글이 "이미 불렀다" 고 경고합니다. */
let loader: Promise<void> | null = null;

export function loadMaps(): Promise<void> {
  if (loader) {
    return loader;
  }
  loader = new Promise<void>((resolve, reject) => {
    if (!GMAPS_KEY || typeof window === 'undefined') {
      reject(new Error('지도를 쓸 수 없습니다.'));
      return;
    }
    if ((window as any).google?.maps) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    /*
      loading=async 를 쓰지 않습니다.
      그 방식은 스크립트를 받은 뒤에도 실제 라이브러리를 나중에 채우므로,
      onload 시점에 google.maps.Map 이 아직 없을 수 있습니다. 빠른 기기에서는
      우연히 맞아떨어지고 느린 기기(폰)에서는 어긋납니다. 한 번에 다 받아
      오는 쪽이 몇십 밀리초 느린 대신 확실합니다.
    */
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GMAPS_KEY)}` +
      '&language=ko&region=KR';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      /* 다음 시도에서 다시 붙일 수 있게 비웁니다. */
      loader = null;
      reject(new Error('지도를 불러오지 못했습니다.'));
    };
    document.head.appendChild(script);
  });
  return loader;
}

/** 로드가 끝난 뒤에만 부릅니다. */
export const gmaps = () => (window as any).google.maps;
