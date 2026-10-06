import { ThreeJSOverlayView } from '@googlemaps/three';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import type { Vehicle } from '@/lib/vehicles';

/**
 * 동선의 3D 탈것 — 구글 WebGL Overlay View 위의 three.js.
 *
 * <h3>왜 three.js 인가</h3>
 *
 * <p>처음에는 deck.gl 에 상자 몇 개를 쌓은 모양을 올렸습니다. 「모형이 너무
 * 이상하다, 자연스럽지 않다」였습니다. 자연스러운 모양은 디자이너가 만든
 * glTF 이고, glTF 를 불러오고 걷는 동작을 돌리고 빛을 비추는 일은 three.js 가
 * 제 일입니다. 구글도 벡터 지도 위 3D 는 WebGLOverlayView + three.js
 * (@googlemaps/three)를 권합니다 — 지도와 같은 그림판에 그려 건물 · 지형과 함께
 * 가려지고 겹칩니다.
 *
 * <h3>모델</h3>
 *
 * <p>public/models 에 있습니다(LICENSES.txt).
 * <ul>
 *   <li>사람 · 차 · 버스(밴) · 기차(고속열차) · 배 — Kenney, CC0</li>
 *   <li>비행기 — 「Airplane」, Poly by Google, CC-BY 3.0. 화면에 출처를 적습니다</li>
 * </ul>
 * 텍스처를 파일 안에 묻어 두었습니다(gltf-transform copy) — Kenney 는 묶음마다
 * 같은 이름(Textures/colormap.png)의 다른 그림을 따로 두어서, 그대로 두면 서로
 * 덮어씁니다.
 *
 * <h3>필요한 것만, 필요할 때 — 이 파일 통째로 한 번</h3>
 *
 * <p>이 파일은 replay-stage 가 <b>import() 한 번</b>으로 받습니다. three ·
 * GLTFLoader · @googlemaps/three 는 여기서 그냥 import 합니다.
 *
 * <p>처음에는 셋을 이 안에서 따로따로 import() 했습니다. 그러면 번들러가 셋이
 * 함께 쓰는 three 를 「여러 조각이 나눠 쓰는 것」으로 보고 __common 에 넣는데,
 * __common 은 <b>모든 화면이 처음에 받는</b> 조각입니다 — 동선을 안 여는
 * 사람도 three 800KB 를 받았습니다(deck.gl 때도 같았습니다). 경계를 하나로
 * 두면 three 는 그 조각 하나에만 들어갑니다.
 *
 * <p>모델은 처음 타는 순간 받고, 한 번 받은 것은 다시 받지 않습니다.
 */

const MODEL_URL: Record<Vehicle, string> = {
  walk: '/models/walk.glb',
  car: '/models/car.glb',
  bus: '/models/bus.glb',
  train: '/models/train.glb',
  boat: '/models/boat.glb',
  plane: '/models/plane.glb',
};

/**
 * 모델마다 앞이 어느 쪽인지(라디안). 정규화한 뒤 앞이 북쪽(-Z)을 보도록 더하는
 * 각입니다. 모델 파일마다 앞을 두는 축이 달라 화면에서 보고 맞췄습니다.
 */
const FACING: Record<Vehicle, number> = {
  walk: Math.PI,
  car: Math.PI,
  bus: Math.PI,
  train: Math.PI,
  boat: Math.PI,
  plane: Math.PI,
};

export type VehicleScene = {
  /** 탈것 하나를 그 자리 · 그 방향 · 그 크기로. 매 화면 부릅니다. */
  draw(at: {
    vehicle: Vehicle;
    lat: number;
    lng: number;
    /** 땅에서 높이(미터). */
    altitude: number;
    /** 북쪽에서 시계 방향(도). */
    heading: number;
    /** 긴 쪽 길이(미터). */
    meters: number;
    /** 서 있는지(걷는 사람은 그때 멈춰 섭니다). */
    still: boolean;
    dt: number;
  }): void;
  hide(): void;
  dispose(): void;
};

/** three.js 와 오버레이를 받아 지도에 붙입니다. 못 받으면 던집니다. */
/* 지도 물건은 any 로 다룹니다(lib/gmaps.web 와 같은 규칙). */
export async function createVehicleScene(map: any): Promise<VehicleScene> {
  const overlay = new ThreeJSOverlayView({
    map,
    upAxis: 'Y',
    anchor: { ...map.getCenter()!.toJSON(), altitude: 0 },
    animationMode: 'always',
    addDefaultLighting: true,
  });

  /*
    기본 조명(구글이 건물에 비추는 것과 비슷한 해 · 하늘빛)만으로는 탈것이 어둡게
    가라앉았습니다 — 빨간 세단이 고동색으로 보였습니다. 고르게 한 겹 더합니다.
  */
  overlay.scene.add(new THREE.AmbientLight(0xffffff, 0.9));

  const loader = new GLTFLoader();
  type Loaded = {
    root: InstanceType<typeof THREE.Group>;
    mixer: InstanceType<typeof THREE.AnimationMixer> | null;
    walk: ReturnType<InstanceType<typeof THREE.AnimationMixer>['clipAction']> | null;
    idle: ReturnType<InstanceType<typeof THREE.AnimationMixer>['clipAction']> | null;
  };
  const loaded = new Map<Vehicle, Loaded>();
  const pending = new Map<Vehicle, Promise<void>>();
  let shown: Vehicle | null = null;

  /**
   * 모델을 받아 크기 1(긴 쪽) · 바닥이 0 · 가운데가 원점이 되게 맞춥니다.
   * 파일마다 단위가 다릅니다 — 비행기는 수백, Kenney 는 1 남짓.
   */
  function load(vehicle: Vehicle) {
    if (loaded.has(vehicle) || pending.has(vehicle)) {
      return;
    }
    const job = loader.loadAsync(MODEL_URL[vehicle]).then((gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const longest = Math.max(size.x, size.z) || 1;
      model.position.set(-center.x, -box.min.y, -center.z);
      const unit = new THREE.Group();
      unit.add(model);
      unit.scale.setScalar(1 / longest);
      unit.rotation.y = FACING[vehicle];
      const root = new THREE.Group();
      root.add(unit);
      root.visible = false;
      overlay.scene.add(root);

      let mixer: Loaded['mixer'] = null;
      let walk: Loaded['walk'] = null;
      let idle: Loaded['idle'] = null;
      if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        const clip = (name: string) => gltf.animations.find((a) => a.name === name);
        const w = clip('walk');
        const i = clip('idle') ?? clip('static');
        walk = w ? mixer.clipAction(w) : null;
        idle = i ? mixer.clipAction(i) : null;
        (walk ?? idle)?.play();
      }
      loaded.set(vehicle, { root, mixer, walk, idle });
    });
    pending.set(
      vehicle,
      job.catch(() => {
        /* 못 받은 탈것은 안 그립니다. 동선은 그대로 돕니다. */
      }),
    );
  }

  /* 많이 타는 것부터 미리. */
  (['walk', 'car', 'train', 'plane'] as Vehicle[]).forEach(load);

  return {
    draw(at) {
      load(at.vehicle);
      if (shown && shown !== at.vehicle) {
        const was = loaded.get(shown);
        if (was) {
          was.root.visible = false;
        }
      }
      const it = loaded.get(at.vehicle);
      if (!it) {
        shown = null;
        return;
      }
      shown = at.vehicle;
      /*
        오버레이의 기준점(anchor)을 탈것 자리로 옮기고 탈것은 원점에 둡니다.
        기준점에서 수백 km 떨어진 곳을 그리면 단정밀도 셈이 흔들립니다 — 탈것이
        파르르 떱니다.
      */
      overlay.setAnchor({ lat: at.lat, lng: at.lng, altitude: at.altitude });
      it.root.position.set(0, 0, 0);
      it.root.scale.setScalar(at.meters);
      /* Y 가 위, -Z 가 북쪽. 북쪽에서 시계 방향 각은 Y 축으로 음수만큼. */
      it.root.rotation.y = (-at.heading * Math.PI) / 180;
      it.root.visible = true;

      if (it.mixer) {
        const want = at.still ? (it.idle ?? it.walk) : (it.walk ?? it.idle);
        const other = want === it.walk ? it.idle : it.walk;
        if (want && !want.isRunning()) {
          want.reset().fadeIn(0.2).play();
          other?.fadeOut(0.2);
        }
        it.mixer.update(at.dt);
      }
    },
    hide() {
      loaded.forEach((it) => {
        it.root.visible = false;
      });
      shown = null;
      overlay.requestRedraw();
    },
    dispose() {
      overlay.setMap(null);
    },
  };
}
