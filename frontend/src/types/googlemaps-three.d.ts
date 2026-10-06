/**
 * @googlemaps/three 의 타입.
 *
 * <p>꾸러미 안에 타입이 있는데 package.json 의 exports 가 그 자리를 안 알려
 * 줘서 TypeScript 가 못 찾습니다. 그리고 그 타입은 google.maps 이름공간에
 * 기대는데, 이 저장소는 구글 지도 타입을 안 들이고 지도 물건을 any 로 다룹니다
 * (lib/gmaps.web). 그래서 쓰는 만큼만 여기 적습니다(lib/vehicle-scene).
 */
declare module '@googlemaps/three' {
  import type { Scene } from 'three';

  type LatLngAltitude = { lat: number; lng: number; altitude?: number };

  export class ThreeJSOverlayView {
    constructor(options?: {
      map?: any;
      anchor?: LatLngAltitude;
      upAxis?: 'Y' | 'Z';
      scene?: Scene;
      animationMode?: 'always' | 'ondemand';
      addDefaultLighting?: boolean;
    });
    readonly scene: Scene;
    setAnchor(anchor: LatLngAltitude): void;
    requestRedraw(): void;
    setMap(map: any): void;
  }
}
