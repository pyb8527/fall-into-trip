/**
 * 구글이 보내는 길을 좌표로 되돌립니다.
 *
 * <p>경로는 점이 수백 개라 그대로 보내면 응답이 커집니다. 그래서 구글은 앞
 * 점과의 차이만 남기고, 그 값을 5비트씩 잘라 글자로 바꿔 보냅니다. 여기서
 * 그 과정을 거꾸로 밟습니다.
 *
 * <p>이걸 우리가 짜는 이유는 웹과 앱이 같은 답을 써야 하기 때문입니다. 웹은
 * 구글 지도의 geometry 라이브러리로 풀 수 있지만 앱에는 그런 것이 없고,
 * 그것 하나 때문에 라이브러리를 더 받아 오면 지도가 뜨는 시점이 늦어집니다.
 *
 * @see https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export type LatLng = { lat: number; lng: number };

export function decodePolyline(encoded: string | null | undefined): LatLng[] {
  if (!encoded) {
    return [];
  }

  const points: LatLng[] = [];
  let index = 0;
  /* 좌표는 앞 점과의 차이로 오므로 더해 가며 따라갑니다. */
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    lat += step();
    lng += step();
    /* 소수점 다섯 자리까지를 정수로 만들어 보냅니다. 되돌립니다. */
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;

  /** 글자를 하나씩 읽어 숫자 하나를 만듭니다. */
  function step(): number {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      /* 옮겨 적을 때 63 을 더해 두었습니다(눈에 보이는 글자로 만들려고). */
      byte = encoded!.charCodeAt(index++) - 63;
      /* 아래 5비트가 값이고, 여섯 번째 비트는 "뒤에 더 있다" 는 표시입니다. */
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded!.length);

    /* 음수를 담으려고 부호를 맨 아래 비트에 넣어 두었습니다. */
    return result & 1 ? ~(result >> 1) : result >> 1;
  }
}
