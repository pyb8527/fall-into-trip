import * as ImagePicker from 'expo-image-picker';

/**
 * 사진 한 장을 고르고 네모로 자르기 (껍데기).
 *
 * <h3>자르는 판은 안 짭니다</h3>
 *
 * <p>얼굴 자리는 네모라 긴 사진을 그대로 두면 어디를 보여 줄지 우리가 정하게
 * 됩니다. 사람이 정하게 하려면 자르는 판이 필요한데, {@code allowsEditing} 과
 * {@code aspect: [1, 1]} 로 <b>폰이 가진 판</b>이 그 일을 합니다. 손수 그리면
 * 끌기·확대·두 손가락까지 쪽마다 다시 맞춰야 합니다.
 *
 * <h3>허락은 안 묻습니다</h3>
 *
 * <p>{@code launchImageLibraryAsync} 는 보관함 허락이 필요 없습니다 — 폰이
 * 고르는 판을 제 쪽에서 띄우고 <b>고른 한 장만</b> 건네줍니다. 우리가
 * 보관함을 뒤지는 것이 아니라서, 「사진 접근을 허용하시겠습니까」를 띄울
 * 이유가 없습니다. 알림·위치와 달리 여기는 물을 것이 없는 자리입니다.
 *
 * <h3>작게 받습니다</h3>
 *
 * <p>잘라 낸 조각은 원본 크기 그대로 나옵니다. 1200만 화소 사진의 네모
 * 조각이면 3000픽셀이고, 그것이 base64 글자가 되어 다리를 건넙니다. 품질을
 * 낮춰 받아 그 글자를 줄이고, 크기를 줄이는 것은 받은 쪽이 합니다
 * ({@code lib/pick-square.web.ts} — 거기가 이미 캔버스를 쓰고 있습니다).
 */

/**
 * 다리를 건널 글자를 줄이려고 낮춰 받습니다.
 *
 * <p>어차피 512로 줄이고, 서버가 또 한 번 굽습니다. 여기서 아낀 것은
 * 그대로 다리를 건너는 시간입니다.
 */
const QUALITY = 0.6;

/**
 * 고르는 판을 열고 잘라 낸 사진을 돌려줍니다.
 *
 * @return 잘라 낸 JPEG 의 base64. 고르다 말았으면 null
 */
export async function pickSquare(): Promise<string | null> {
  const got = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    /* 둘이 한 쌍입니다 — allowsEditing 만 켜면 자르는 판이 제 비율로 뜹니다. */
    allowsEditing: true,
    aspect: [1, 1],
    quality: QUALITY,
    /*
      base64 로 받습니다.

      <p>파일 자리(uri)를 그대로 넘겨도 웹은 못 읽습니다 — 웹뷰 안의 코드가
      {@code file://} 를 가져오는 것은 출처가 달라 막힙니다. 글자로 건네는
      것이 이 다리가 할 수 있는 유일한 길입니다.
    */
    base64: true,
  });

  if (got.canceled) {
    /* 고르다 말았습니다. 고장이 아니므로 아무 말도 안 합니다. */
    return null;
  }

  return got.assets[0]?.base64 ?? null;
}
