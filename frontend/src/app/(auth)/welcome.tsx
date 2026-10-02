import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { api, query } from '@/api/client';
import type { PopularPlace, PopularRegion, PostCard, PostPage } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { SignUpGate } from '@/components/signup-gate';
import { TripTaste } from '@/components/trip-taste';
import { TripThumb } from '@/components/trip-thumb';
import { glyphOf, labelOf } from '@/constants/place-icons';
import {
  Colors,
  Gutter,
  MaxContentWidth,
  Radius,
  Spacing,
  Type,
  Weight,
} from '@/constants/theme';
import type { Comeback } from '@/lib/comeback';
import { Body, Button, Caption, ListRow, Mark, Press, Rise, Screen } from '@/ui';
import { LogoLockup } from '@/ui/logo';

/**
 * 처음 온 사람이 보는 문.
 *
 * <h3>왜 필요한가</h3>
 *
 * <p>지금까지 로그아웃 상태로 들어오면 예외 없이 로그인 화면이 떴습니다.
 * 처음 온 사람에게 로그인 화면은 <b>아무것도 말해 주지 않는 화면</b>입니다.
 * 여기가 무엇을 하는 곳인지 모르는 채로 이메일부터 내라고 하는 셈이라,
 * 대부분 거기서 닫습니다.
 *
 * <h3>말하지 않고 보여 줍니다</h3>
 *
 * <p>처음에는 여기에 "함께 고칩니다 · 모아 둡니다 · 가져옵니다" 세 줄을
 * 적어 두었습니다. 셋 다 <b>말</b>이었습니다. 읽는 사람은 그 말이 참인지
 * 알 길이 없고, 그래서 아무것도 달라지지 않습니다.
 *
 * <p>그런데 그 셋을 증명할 진짜 물건이 이미 서버에 있고, 계정 없이
 * 열립니다. 남이 올린 일정입니다. 지도 한 장과 제목 한 줄이면 "여기가
 * 뭐 하는 곳인지" 를 설명할 필요가 없어집니다.
 *
 * <h3>단추를 셋에서 둘로 줄였습니다</h3>
 *
 * <p>「둘러보기 · 시작하기 · 이미 계정이 있어요」 셋이 아래에 쌓여 있었고,
 * 그중 가장 큰 것이 둘러보기였습니다 — 아직 무엇인지도 모르는 것에 이메일을
 * 내줄 이유가 없다는 이유였습니다.
 *
 * <p>그 판단이 반만 맞았습니다. 둘러보기는 이제 <b>화면 안에 이미 펼쳐져
 * 있습니다.</b> 아래 캐러셀의 카드가 곧 둘러보기이고, 누르면 그 글로 바로
 * 갑니다. 그 자리에 똑같은 일을 하는 가장 큰 단추를 또 두면, 화면에서 제일
 * 눈에 띄는 자리가 <b>이미 보이는 것을 한 번 더 가리키는 데</b> 쓰입니다.
 *
 * <p>주 동작은 하나입니다 — 시작하기. 둘러보기는 그 아래 글자 링크로
 * 남겨 둡니다(카드를 못 본 사람의 길). 로그인은 가입 화면 아래의 링크로
 * 잇습니다. 이미 계정이 있는 사람은 대개 쿠키가 살아 있어 이 화면까지
 * 오지도 않습니다.
 *
 * <h3>카드 넷으로는 가입할 이유가 안 됩니다</h3>
 *
 * <p>위의 셈은 그대로 맞습니다. 그런데 거기서 멈춰 보니 문이 <b>여행기
 * 네 장</b>뿐이었습니다. 네 장은 "여기가 뭐 하는 곳인지" 까지는 말하지만
 * "나한테 뭘 해 주는지" 는 말하지 않습니다 — 남의 일정 넷은 남의 일정
 * 넷입니다.
 *
 * <p>늘릴 자리가 생겼습니다. 한 장이 곧 구글 호출 한 번이라 못 늘리고
 * 있었는데, {@link TripThumb} 가 표지 → 첫 사진 → 동선 그림 순으로 고르게
 * 되면서 <b>사진이 있는 글은 호출이 0</b> 입니다.
 *
 * <h3>슬라이드쇼를 안 골랐습니다</h3>
 *
 * <p>넘기는 장 셋에 「함께 짜요 · 모아 둬요 · 가져와요」를 적는 쪽이
 * 흔한 길입니다. 안 골랐습니다. 까닭이 셋인데, 공교롭게 <b>셋 다 이
 * 저장소가 이미 내린 판단과 같은 방향</b>입니다.
 *
 * <ol>
 *   <li><b>그 장에 적을 것이 다시 「말」입니다.</b> 넘기는 장의 내용은
 *       기능 설명이고, 기능 설명은 읽는 사람이 참인지 알 수 없는
 *       것입니다 — 위에서 걷어낸 세 줄을 장 셋으로 다시 세우는 셈입니다
 *   <li><b>장 뒤로 숨깁니다.</b> 요구가 「볼 거리가 많게」인데, 슬라이드쇼는
 *       한 화면에 <b>하나</b>만 보입니다. 나머지는 밀어야 나오고, 밀지
 *       않으면 없는 것입니다. 한 장 긴 화면이 같은 자리에 더 많이 깝니다
 *   <li><b>서버가 비면 더 나쁩니다.</b> 세로로 깐 것은 빈 묶음이
 *       사라지면 그만큼 짧아지는데, 장은 <b>빈 장으로 남습니다</b> —
 *       둘째 장을 밀어서 열었더니 아무것도 없는 것이 가장 나쁜 첫인상
 *       입니다
 * </ol>
 *
 * <p>밖에서 재어 본 것도 같은 말을 합니다. 넘기는 장 묶음은 대개 <b>읽지
 * 않고 밀어 넘기고</b>, 거기서 떨어져 나가는 사람이 적지 않으며(아직
 * 아무 일도 안 일어났으니까), 성과가 좋은 쪽은 거의 다 <b>가입 전에
 * 제품을 만져 보게 하는</b> 쪽입니다. 같은 자료가 「장을 하나 더 늘릴수록
 * 끝까지 가는 사람이 줄어든다」고도 말합니다.
 *
 * <h3>대신 만져 볼 것을 깔았습니다</h3>
 *
 * <p>가입 전에 제품을 만져 보게 하라는 것이 밖에서 가장 세게 나온
 * 말이었습니다. 이 앱에서 만져 볼 수 있는 가장 작은 단위는 <b>일정
 * 한 장</b>이고, 그것이 계정 없이 열립니다. 그래서 진짜 글 하나의 일정을
 * 문 안에 펼치고 날을 눌러 옮겨 다닐 수 있게 둡니다({@link TripTaste}).
 * 꾸민 예시가 아니라 받아 온 글입니다.
 *
 * <h3>스크롤로 나타나게 하는 것은 반만 했습니다</h3>
 *
 * <p>굴려 내려갈 때 묶음이 차례로 떠오르게 하려면 <b>굴린 양</b>을 알아야
 * 합니다. 그 값을 쥐고 있는 것은 {@link Screen} 의 {@code ScrollView}
 * 이고, 거기에는 {@code onScroll} 을 받는 칸이 없습니다. 내려면
 * {@code ui/index.tsx}(사천구백 줄, 서른여덟 화면이 같이 씁니다)를 고쳐야
 * 하는데, <b>한 화면의 꾸밈을 위해 모두가 쓰는 뼈대를 건드릴 일이
 * 아닙니다.</b> {@code scroll={false}} 로 두고 제 {@code ScrollView} 를
 * 세우는 쪽도 막혔습니다 — 그때 본문을 감싸는 틀에 {@code flex} 가 없어
 * 안쪽에 굴러가는 것을 넣으면 높이가 0이 됩니다.
 *
 * <p>그래서 {@link Rise} 로 합니다. 묶음마다 <b>제 것이 닿는 순간</b>
 * 떠오릅니다 — 넷을 따로 부르므로 닿는 때가 저절로 다르고, 그래서 화면이
 * 한꺼번에 완성되지 않고 차례로 들어섭니다. 굴린 양에 맞춘 것은 아니라
 * 「스크롤 액티베이션」이라고 부르지는 않겠습니다. 움직임을 줄여 둔
 * 사람에게는 처음부터 다 보입니다({@code useCalm}).
 *
 * <h3>단추는 바닥에 붙어 있습니다</h3>
 *
 * <p>화면이 길어지면 아래 단추가 멀어집니다. 마음을 정한 자리에서 단추가
 * 두 화면 위에 있으면 되감아 올라가야 하고, 대개 안 올라갑니다.
 * {@link Screen} 의 {@code footer} 는 굴러가는 본문 밖에 서므로 <b>어디를
 * 보고 있어도 엄지 밑에</b> 있습니다. 길게 깔면서 따로 손댈 것이 없었던
 * 자리입니다.
 *
 * <p>맨 아래에 단추를 하나 더 두는 쪽은 안 합니다. 붙어 있는 것이 이미
 * 늘 보이므로, 같은 일을 하는 셋째 단추가 되고 그것은 위에서 지운
 * 것입니다.
 *
 * <h3>깐 순서 — 읽는 사람의 물음 순서입니다</h3>
 *
 * <ol>
 *   <li><b>헤드라인과 세어 둔 숫자</b> — 「여기 뭐가 얼마나 있나」.
 *       아래 카드들이 그 숫자의 일부라서, 말이 아니라 바로 아래에서
 *       확인되는 숫자입니다
 *   <li><b>여행기 넷</b>(가로) — "여기가 뭐 하는 곳인가". 일정 한 장이
 *       그림과 함께 서면 설명이 필요 없습니다
 *   <li><b>일정 한 장을 만져 보기</b> — "그래서 이걸로 만든 게 어떻게
 *       생겼나". 카드는 겉이고 이것이 안입니다. 날을 눌러 보는 것이 이
 *       화면에서 유일하게 <b>무언가 일어나는</b> 자리라 캐러셀 바로
 *       아래입니다
 *   <li><b>지역</b>({@code /api/popular/regions}) — "내가 가려는 데가
 *       여기 있나". 글 수가 붙어 있어 말 대신 깊이를 셉니다
 *   <li><b>지금 뜨는 곳</b>({@code /api/popular/places}) — "글만 있는 게
 *       아니라 <b>곳</b>이 쌓여 있다". 보석함이 왜 있는지를 말합니다.
 *       <b>막는 자리가 여기뿐</b>이라 그 전에 공짜인 것을 다 보여 준
 *       뒤에 섭니다
 *   <li><b>많이 찾는 태그</b>({@code /api/posts/tags}) — 가장 약합니다.
 *       태그는 분류일 뿐이라 "나한테 뭘 해 주나" 를 직접 답하지 않습니다.
 *       깔 값이 0이라 맨 아래 닫는 줄로 둡니다
 * </ol>
 *
 * <h3>숫자는 세어서 적습니다</h3>
 *
 * <p>헤드라인 밑의 한 줄은 「여행기 N개 · 지역 N곳」입니다. 「수많은
 * 여행기」가 아닙니다 — 두루뭉술한 양은 아무 말도 아니고, 밖에서 재어
 * 본 것도 <b>구체적인 수가 두루뭉술한 수보다 믿긴다</b>고 말합니다.
 * N 은 {@code PostPage.total} 과 지역 묶음 수로, 둘 다 서버가 센 값입니다.
 *
 * <p>적게 올라온 판에서는 안 냅니다({@link ENOUGH}). 「여행기 3개」는
 * 참이지만 제 발등을 찍는 참입니다. 숨기는 것이 거짓은 아닙니다 —
 * 그 자리에 다른 말을 지어 넣지 않습니다.
 *
 * <h3>막는 자리는 하나입니다</h3>
 *
 * <p>이 화면의 모든 것이 계정 없이 읽힙니다. 여행기 카드 · 만져 보는
 * 일정 · 지역 칸 · 태그 줄은 눌러도 공개 화면으로 갑니다. 계정이 필요한
 * 것은 <b>장소 담기</b> 하나이고, 거기서만 {@link SignUpGate} 가 섭니다 —
 * 로그인 화면으로 말없이 튕기지 않고 보석함이 왜 사람마다 따로인지를 그
 * 자리에서 말합니다.
 *
 * <p>돌아올 자리는 {@code /(app)/popular} 입니다. 두 가지를 셈에 넣은
 * 값입니다.
 *
 * <ul>
 *   <li>{@code (auth)} 안의 경로를 적으면 안 됩니다. 로그인한 사람은
 *       {@code (auth)/_layout} 이 되돌려 보내므로 이 화면에 못 머무릅니다 —
 *       가입하자마자 한 번 더 튕깁니다
 *   <li>{@code /(app)/popular} 가 이 줄의 <b>전부</b>입니다. 같은
 *       {@code /api/popular/places} 를 장소·지역 두 띠로 펼치고 판에서
 *       담기까지 합니다. 가입하고 거기로 가면 방금 누른 곳이 같은 목록에
 *       그대로 있습니다
 * </ul>
 *
 * <h3>비어 있을 때를 대비합니다</h3>
 *
 * <p>묶음이 늘어난 만큼 이 셈이 더 중요해졌습니다. 아무것도 안 올라온
 * 판에서 <b>빈 머리글 다섯 개</b>가 서는 것이 가장 나쁜 첫인상입니다.
 *
 * <p>다행히 전부 <b>같은 뿌리</b>입니다 — 지역·장소·태그는 다 올라온
 * 글을 세어 나온 것이고, 만져 보는 일정은 그 글 하나를 펼친 것입니다.
 * 글이 없으면 다 같이 빕니다. 그래서 묶음마다 제 것이 비면 <b>그 묶음을
 * 아예 안 그리고</b>, 전부 비면 예전의 세 줄로 돌아갑니다. 중간은
 * 없습니다.
 *
 * <p>그 세 줄은 <b>넷이 다 답을 한 뒤에만</b> 섭니다({@link answered}).
 * 받는 중에 내밀면 글이 쌓인 판에서도 문이 열릴 때마다 말 세 줄이
 * 번쩍입니다.
 *
 * <h3>값</h3>
 *
 * <p>서버를 한 번 부르던 화면이 <b>다섯 번</b> 부릅니다 — 글 한 쪽,
 * 세어 둔 것 셋, 그리고 만져 볼 글 하나입니다. 마지막 것은 첫 응답에서
 * 글 번호를 받아야 하므로 <b>한 박자 뒤</b>에 나갑니다. 아래쪽에 서는
 * 묶음이라 그 늦음이 첫 그림을 안 늦춥니다.
 *
 * <p>새로 붙은 넷은 <b>구글 호출이 0</b> 입니다. 지역 칸과 태그 줄에는
 * 그림이 없고, 장소 줄과 만져 보는 일정은 선 그림({@link Mark})입니다.
 * 가장 가까운 곳 한 장을 {@code SpotMap} 으로 그리는 쪽도, 만져 보는
 * 일정에 동선 그림을 붙이는 쪽도 뺐습니다 — 문에서 한 장은 곧 모든
 * 방문자에게 한 장입니다.
 *
 * <p>그래서 구글 정적 지도는 <b>최악에도 넷</b>으로 그대로입니다 —
 * 캐러셀 카드 넷이 모두 사진 한 장도 없는 글일 때입니다. 사진이 있는
 * 만큼 줄어듭니다.
 *
 * <h3>새 꾸러미를 안 들였습니다</h3>
 *
 * <p>넘기는 장이든 굴림에 맞춘 움직임이든 {@code react-native-reanimated}
 * 를 부르고 싶어지는 일입니다. 들어 있기는 합니다(4.5.1). 그런데
 * {@code src/} 안에서 <b>아무도 안 쓰고</b> {@code babel.config.js} 조차
 * 없어서, 처음 쓰는 자리가 되면 설정이 맞는지부터 확인해야 하고 틀리면
 * EAS 재빌드 뒤로 밀립니다. 이 화면의 움직임은 {@link Rise} 가 쓰는
 * {@code react-native} 의 {@code Animated} 로 충분합니다 — 이미 이
 * 저장소가 쓰고 있는 것입니다.
 *
 * <h3>"본 적 있음" 을 기억하지 않습니다</h3>
 *
 * <p>다시 온 사람에게 이 화면을 건너뛰게 하려면 기기에 표시를 남겨야
 * 하는데, 앱에는 그럴 저장소가 없어 웹에서만 되는 장치가 됩니다. 게다가
 * 로그인이 살아 있으면 애초에 이 화면을 지나지도 않습니다.
 */

/**
 * 문에 세워 둘 개수.
 *
 * <p>셋이면 "여기 뭐가 쌓여 있다" 로 읽히고, 둘이면 "이것뿐이다" 로
 * 읽힙니다. 넷부터는 문이 아니라 목록이 됩니다.
 *
 * <p>가로로 눕히면서 하나를 더 받습니다. 옆으로 미는 줄은 <b>끝이 보이면
 * 밀 생각을 안 하므로</b>, 네 번째가 반쯤 걸쳐 있어야 손이 갑니다.
 *
 * <p>값도 셈에 넣습니다. 사진이 한 장도 없는 글은 동선 그림을 그리는데
 * 그것이 구글 호출 한 번입니다({@link TripThumb}). 로그인 안 한 사람이 가장
 * 자주 여는 화면이라 늘릴 자리가 아닙니다.
 *
 * <p>아래에 묶음을 넷 더 깔면서도 이 값은 안 건드렸습니다. 더 깐 넷은
 * 그림이 없어 호출이 0이고, 늘릴 자리가 아닌 것은 <b>여기</b>뿐입니다.
 */
const SHOW = 4;

/**
 * 카드 하나를 뺀 나머지 — 다음 카드가 걸쳐 보이는 폭.
 *
 * <p>좌우 여백 20씩과, 다음 카드가 28쯤 보이게 하는 값입니다. 딱 맞게
 * 끊으면 옆으로 밀 수 있다는 것을 아무도 모릅니다.
 */
const PEEK = 68;

/**
 * 장소 줄 수.
 *
 * <p>다섯을 넘으면 묶음 하나가 화면을 다 먹습니다 —
 * {@code NearbyPlaces} 가 같은 값으로 같은 판단을 했습니다. 서버는 열까지
 * 내려 주고, 나머지는 {@code /(app)/popular} 가 맡습니다.
 */
const PLACES = 5;

/**
 * 태그 수.
 *
 * <p>글자 한 줄입니다. 다섯이면 폰 폭에서 두 줄을 안 넘고, 열이면
 * "많이 찾는" 이 아니라 "전부" 로 읽힙니다.
 */
const TAGS = 5;

/**
 * 숫자를 적기 시작하는 개수.
 *
 * <p>「여행기 3개」는 참이지만 제 발등을 찍습니다. 열쯤 되면 "쌓여
 * 있다" 로 읽히고, 그 아래로는 카드 넷이 곧 전부라는 말이 됩니다 —
 * 그때는 숫자 없이 카드만 보여 주는 편이 낫습니다.
 */
const ENOUGH = 10;

export default function Welcome() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  /* 넓은 화면에서도 본문은 600 에서 멈춥니다(Screen). 카드 폭도 거기에
     맞춰야 캐러셀만 혼자 넓어지지 않습니다. */
  const card = Math.min(width, MaxContentWidth) - PEEK;

  /** 담으려다 막힌 자리. null 이면 판이 닫혀 있습니다. */
  const [gate, setGate] = useState<Comeback | null>(null);

  /* 인기순으로 받아 옵니다. 최신순이면 방금 올라온 빈 일정이 문 앞에
     설 수 있습니다. 계정 없이 열리는 주소라 토큰이 없어도 됩니다. */
  const hot = useAsync<PostPage>(
    (signal) => api.get(`/api/posts${query({ sort: 'hot', page: 0 })}`, signal),
    [],
  );

  /* 세어 둔 것 셋. 셋 다 로그인 없이 열립니다(SecurityConfig —
     /api/popular/** 와 /api/posts/* 가 permitAll). */
  const regions = useAsync<{ regions: PopularRegion[] }>(
    (signal) => api.get('/api/popular/regions', signal),
    [],
  );
  /* 자리를 안 보냅니다. near= 를 붙이면 권한 창이 문에서 먼저 뜨고,
     구경하러 들어온 사람은 대개 거절합니다 — 한 번 거절하면 시스템
     설정까지 들어가야 되돌립니다. 여기서는 인기순이면 충분합니다. */
  const places = useAsync<{ places: PopularPlace[] }>(
    (signal) => api.get('/api/popular/places', signal),
    [],
  );
  const tags = useAsync<{ tags: { tag: string; posts: number }[] }>(
    (signal) => api.get('/api/posts/tags', signal),
    [],
  );

  const shown = hot.data?.posts.slice(0, SHOW) ?? [];
  /* 고를 수 있는 지역은 여덟 묶음이라 서버가 열을 내려도 여덟을 넘지
     않습니다. 따로 안 자릅니다 — 가로로 미는 줄이라 길어도 자리를 안
     먹습니다. */
  const where = regions.data?.regions ?? [];
  const spots = places.data?.places.slice(0, PLACES) ?? [];
  const words = tags.data?.tags.slice(0, TAGS) ?? [];

  /* 펼쳐 볼 글. 인기순 첫 글입니다 — 가장 많이 읽힌 것이 대개 가장
     잘 짜인 것이고, 문에 세울 것이면 그래야 합니다. */
  const taste = shown[0];

  /*
    헤드라인 밑의 숫자 한 줄.

    <p>둘 다 서버가 센 값입니다. 하나라도 아직 안 왔으면 안 적습니다 —
    「여행기 128개 · 지역 0곳」이 한 박자 서 있다가 고쳐지면, 고쳐지는
    것을 본 사람은 둘 다 안 믿습니다.
  */
  const counted = hot.data?.total ?? 0;
  const proof =
    counted >= ENOUGH && where.length > 0
      ? `여행기 ${counted.toLocaleString()}개 · 지역 ${where.length}곳`
      : null;

  /*
    전부 비었는가.

    <p>받는 중은 비어 있는 것이 아닙니다. 넷이 다 답을 한 뒤에만 참이
    됩니다 — 그러지 않으면 글이 쌓인 판에서도 문이 열릴 때마다 말 세
    줄이 번쩍입니다.
  */
  const bare =
    shown.length === 0 &&
    where.length === 0 &&
    spots.length === 0 &&
    words.length === 0 &&
    answered(hot) &&
    answered(regions) &&
    answered(places) &&
    answered(tags);

  return (
    <Screen
      safeTop
      footer={
        <>
          <Button label="시작하기" onPress={() => router.push('/(auth)/register')} />
          <Button
            label="먼저 둘러볼게요"
            variant="ghost"
            onPress={() => router.push('/community')}
          />
        </>
      }>
      {/*
        심볼 · 이름 · 한 줄을 세로로 쌓은 것을 가운데 세웁니다.

        <p>글자만 있는 「fit」 한 줄이 상단 막대에 있었습니다. 그런데 이
        화면은 로고가 안 보이는 화면이 아닙니다 — 앱을 처음 여는 사람이
        제일 먼저 마주치는 자리이고, 초대 링크({@code invite/[token]})·
        공유 링크({@code view/[token]})가 이미 {@link LogoLockup} 으로
        그 일을 합니다. 시작 화면만 빠져 있었습니다.

        <p>작게 둡니다. 저 둘은 로고가 화면의 거의 전부지만, 여기는 그
        아래로 보여 줄 것이 많습니다 — 심볼이 카드와 레일 위에서 너무
        크게 자리를 차지하면 안 됩니다.
      */}
      <View style={styles.bar}>
        <LogoLockup size={48} />
      </View>

      <View style={styles.pitch}>
        {/*
          두 줄로 끊어 둡니다.

          <p>한 줄로 두면 폰 폭에 따라 끊기는 자리가 달라져 「여행은 짜는
          동안이 제일」 까지 왔다가 넘어갑니다. 끊을 자리를 우리가 정합니다.
        */}
        <Text style={styles.headline}>
          여행은 짜는 동안이{'\n'}제일 즐거워야 하니까
        </Text>
        <Body small tone="secondary">
          일정 한 장을 여럿이 같이 고치고, 가고 싶은 곳을 모아 둬요.
        </Body>
        {/* 바로 아래 카드들이 이 숫자의 일부입니다. 말 밑에 말을 덧대는
            것이 아니라, 세어 둔 것 위에 세어 둔 것을 적습니다. */}
        {proof ? (
          <Rise>
            <Caption tone="muted">{proof}</Caption>
          </Rise>
        ) : null}
      </View>

      {shown.length > 0 ? (
        /* 밖으로 미는 것을 <b>이 겹에</b> 답니다. 안쪽 ScrollView 에
           두면 좌우로 삐져나온 카드가 이 겹의 바깥이 되고, 안드로이드
           에서는 그 자리가 잘릴 수 있습니다. 겹을 하나 더 두르면서
           삐져나오는 겹은 그대로 하나로 둡니다. */
        <Rise style={styles.railOut}>
          {/*
            옆으로 미는 줄입니다.

            <p>세로로 쌓아 두었습니다. 그러면 첫 장만 보이고 둘째 장부터는
            굴려야 나오는데, <b>문에서 굴리는 사람은 많지 않습니다.</b> 눕혀
            두면 한 화면에 하나 반이 보여 "더 있다" 가 그냥 보입니다.

            <p>좌우 여백만큼 밖으로 밀어 두고 그만큼을 안쪽 여백으로 돌려
            놓습니다 — 첫 카드는 글자와 같은 선에서 시작하고, 미는 카드는
            화면 끝까지 흘러갑니다.
          */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}>
            {shown.map((post) => (
              <Peek
                key={post.id}
                post={post}
                width={card}
                onOpen={() => router.push(`/community/${post.id}`)}
              />
            ))}
          </ScrollView>
        </Rise>
      ) : null}

      {taste ? (
        /* 카드 넷이 겉이면 이것이 안입니다. 받는 동안과 펼칠 것이 없는
           글에서는 스스로 사라집니다({@link TripTaste}). */
        <Rise order={1}>
          <View style={styles.shelf}>
            <TripTaste
              postId={taste.id}
              onOpen={() => router.push(`/community/${taste.id}`)}
            />
          </View>
        </Rise>
      ) : null}

      {where.length > 0 ? (
        <Rise order={2}>
          <RegionRail
            regions={where}
            onRegion={(region) =>
              router.push(`/community?region=${encodeURIComponent(region)}`)
            }
          />
        </Rise>
      ) : null}

      {spots.length > 0 ? (
        <Rise order={3}>
          <HotPlaces
            places={spots}
            /* 담기만 막습니다. 어느 곳을 누른 것인지는 안 싣습니다 —
               돌아갈 화면이 그 뜻을 꺼내 쓰지 않으므로, 실어 두면 아무도
               안 읽는 값이 주소를 타고 돌아다닙니다. */
            onKeep={() => setGate({ where: '/(app)/popular', what: 'save' })}
          />
        </Rise>
      ) : null}

      {words.length > 0 ? (
        <Rise order={4}>
          {/*
            누르는 꼴을 안 입힌 줄입니다.

            <p>칩이면 눌릴 것처럼 보이는데 갈 데가 없습니다 — 아래에
            적어 둔 {@code community/index.tsx} 의 {@code tag} 때문입니다.
            글자는 아무것도 약속하지 않습니다.
          */}
          <View style={styles.tags}>
            <Body strong>요즘 이런 여행을 찾아요</Body>
            <Body small tone="secondary">
              {words.map((t) => `#${t.tag}`).join('  ')}
            </Body>
          </View>
        </Rise>
      ) : null}

      {bare ? (
        /* 아직 아무것도 안 올라왔거나 서버가 안 뜬 판. 문이 비면 고장 난
           것으로 읽히므로 말로라도 채웁니다. */
        <View style={styles.points}>
          {POINTS.map((point) => (
            <Body key={point} tone="secondary">
              {point}
            </Body>
          ))}
        </View>
      ) : null}

      <SignUpGate intent={gate} onClose={() => setGate(null)} />
    </Screen>
  );
}

/**
 * 이 길이 한 번이라도 답을 했는지.
 *
 * <p>{@code loading} 만 보면 안 됩니다 — 화면으로 돌아올 때마다 다시
 * 받으므로({@link useAsync} 의 {@code useFocusEffect}) 이미 받아 둔
 * 것이 있는데도 {@code loading} 이 다시 켜집니다. 그 사이에 「비었다」로
 * 넘어가면 돌아올 때마다 말 세 줄이 번쩍입니다.
 *
 * <p>오류로 끝난 것도 답을 한 것으로 셉니다. 서버가 안 뜨는 판에서
 * 영원히 아무것도 안 그리는 것이 가장 나쁩니다 — 그때가 바로 말 세
 * 줄이 필요한 자리입니다.
 */
function answered(from: { loading: boolean; data: unknown }) {
  return !from.loading || from.data !== null;
}

/**
 * 남이 올린 일정 한 편, 문 앞에서 미리.
 *
 * <p>누르면 그 글로 곧장 갑니다. 문을 한 번 더 거치게 하면 구경하러 온
 * 사람이 문 앞에서 한 번 더 결심해야 합니다.
 *
 * <p>그림을 4:3 으로 눕힙니다. 폰에서 세로로 긴 그림은 한 장이 화면을
 * 다 먹어 "더 있다" 를 못 보여 줍니다.
 *
 * <p>한동안 <b>동선 그림만</b> 걸었습니다. 글쓴이가 고른 표지가 응답에 실려
 * 오는데도 안 봤고, 그래서 사진이 넘치는 글도 문 앞에서는 선 한 장이었습니다.
 * {@link TripThumb} 에 맡기면 표지 · 첫 사진 · 동선 그림 세 칸이 한곳에
 * 있습니다 — <b>네 장 가운데 사진이 있는 만큼 구글 호출이 사라집니다.</b>
 */
function Peek({
  post,
  width,
  onOpen,
}: {
  post: PostCard;
  width: number;
  onOpen: () => void;
}) {
  const tall = Math.round((width * 3) / 4);
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" style={{ width }}>
      {/* 사진도 지도도 못 받아 오는 판이 있습니다. 바탕을 깔아 두어야 그때도
          카드 모양이 남습니다. */}
      <View style={[styles.media, { height: tall }]}>
        <TripThumb
          postId={post.id}
          coverPhotoId={post.coverPhotoId}
          firstPhotoId={post.firstPhotoId}
          height={tall}
          label={post.title}
          style={styles.flat}
        />
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {post.title}
      </Text>
      {/* 어디를 · 며칠. 이 둘이면 어떤 일정인지 감이 옵니다. */}
      <Caption tone="secondary" numberOfLines={1}>
        {post.region ? `${post.region} · ` : ''}
        {post.dayCount}일 · {post.placeCount}곳
      </Caption>
    </Pressable>
  );
}

/**
 * 어디로 갈 수 있나 — 지역과 그 지역 글 수.
 *
 * <h3>왜 그림이 없는가</h3>
 *
 * <p>지역은 글이 아니라 <b>묶음 이름</b>입니다. 썸네일을 붙이려면 그 지역의
 * 글 하나를 골라 그 사진을 써야 하는데, 그러면 「일본」이 어쩌다 맨 위에 선
 * 글 한 장으로 대표됩니다. 이름과 글 수만 적습니다 — 고르는 데 필요한 것이
 * 그 둘이고, 문에서는 <b>깔 값이 0</b> 이라는 것까지 맞습니다.
 *
 * <p>목록은 서버가 글을 세어 세운 것입니다. 고를 수 있는 지역 여덟을 그냥
 * 늘어놓지 않습니다 — 아직 글이 없는 지역을 누르면 빈 목록이 나오고,
 * 그러면 누른 사람은 자기가 뭘 잘못 눌렀나 합니다.
 *
 * <p>「그 밖」도 그대로 섭니다. 문에 세우기에 썩 좋은 이름은 아니라
 * 빼려다 두었습니다 — 글이 실제로 있는 묶음이고 누르면 제대로 걸립니다.
 * 화면이 서버 목록에서 한 칸을 골라 빼기 시작하면, <b>서버가 센 것과
 * 화면이 보여 주는 것이 갈립니다.</b> 이름이 문제면 고칠 자리는
 * {@code Regions.ALL} 입니다.
 *
 * <h3>{@code curation.tsx} 와 겹칩니다</h3>
 *
 * <p>같은 줄이 거기에도 있습니다({@code RegionShelf}) — 누르면 가는 데도
 * 같습니다. 그런데 그쪽은 내보내지 않는 안쪽 함수이고 <b>이번에 그 파일을
 * 못 건드립니다.</b> 자리가 나면 내보내고 이 함수를 지우는 것이 맞습니다.
 */
function RegionRail({
  regions,
  onRegion,
}: {
  regions: PopularRegion[];
  onRegion: (region: string) => void;
}) {
  return (
    <View style={styles.shelf}>
      <Body strong>여기 글이 쌓여 있는 곳</Body>
      <Caption tone="secondary">누르면 그 지역 여행기를 둘러봐요.</Caption>
      {/*
        캐러셀처럼 밖으로 밀지 <b>않습니다.</b>

        <p>밀면 마지막 칸이 화면 끝으로 흘러가 "더 있다" 가 보입니다.
        그런데 이 줄은 머리글 묶음 안에, 그 묶음은 또 {@link Rise} 안에
        있어서 삐져나오는 겹이 둘 더 생깁니다 — 안드로이드에서 그 자리가
        잘리는지 여기서 확인할 길이 없습니다.

        <p>{@code curation.tsx} 의 같은 줄도 안 밀고 내보냈습니다. 지역은
        여덟을 안 넘고 칸이 좁아 대개 다 들어오므로, 안 밀어서 잃는 것이
        작습니다. 이미 돌아가는 모양과 같은 쪽을 고릅니다.
      */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.regionRow}>
        {regions.map((r) => (
          <Press
            key={r.region}
            onPress={() => onRegion(r.region)}
            scale={0.97}
            style={styles.regionCard}>
            <Body strong numberOfLines={1}>
              {r.region}
            </Body>
            <Caption tone="muted">{`여행 ${r.posts}개`}</Caption>
          </Press>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * 지금 뜨는 곳 — 여러 일정에 함께 담긴 장소들.
 *
 * <h3>왜 문에 세우는가</h3>
 *
 * <p>여행기 넷은 "남들이 뭘 짰나" 를 보여 주고, 이 줄은 <b>"그래서 무엇이
 * 쌓였나"</b> 를 보여 줍니다. 「성심당 · 여행 12개」 한 줄이 보석함이 왜
 * 있는지를 설명 없이 말합니다 — 가고 싶은 곳을 주워 두는 자리라는 말을,
 * 이미 주워져 있는 것으로 대신합니다.
 *
 * <h3>여기가 이 화면에서 유일하게 막히는 자리입니다</h3>
 *
 * <p>읽는 것은 다 공짜입니다. 담는 것만 계정이 필요하고, 그 까닭은
 * 보석함이 사람마다 따로라는 것입니다 — {@link SignUpGate} 가 그 한
 * 줄을 그 자리에서 말합니다. 로그인 화면으로 말없이 보내지 않습니다.
 *
 * <p>줄 전체가 담기입니다. 판을 띄워 장소를 들여다보게 하는 쪽도
 * 있었는데({@code PlaceDetailSheet}), 그러면 문에서 판을 한 겹 더 열고
 * 거기서 또 막히게 됩니다. 구경하러 온 사람에게 벽을 두 번 보여 줄
 * 이유가 없습니다.
 *
 * <p>좌표가 없는 곳도 누릅니다. 막는 자리라 좌표를 쓸 일이 아직
 * 없습니다 — 쓰는 것은 가입하고 간 {@code /(app)/popular} 쪽입니다.
 */
function HotPlaces({
  places,
  onKeep,
}: {
  places: PopularPlace[];
  onKeep: () => void;
}) {
  return (
    <View style={styles.shelf}>
      <Body strong>지금 뜨는 곳</Body>
      <Caption tone="secondary">
        올라온 여행기에 많이 담긴 곳이에요. 보석함에 주워 두면 다음 여행에서 꺼내 써요.
      </Caption>
      {places.map((place, i, rows) => (
        <ListRow
          key={place.key}
          left={<Mark icon={glyphOf(place.icon)} />}
          title={place.name}
          subtitle={[labelOf(place.icon) || null, `여행 ${place.posts}개`]
            .filter(Boolean)
            .join(' · ')}
          last={i === rows.length - 1}
          onPress={onKeep}
        />
      ))}
    </View>
  );
}

/** 보여 줄 것이 없을 때만 쓰는 말. 한 줄에 하나씩. */
const POINTS = [
  '한 일정을 여럿이 함께 고쳐요.',
  '가고 싶은 곳을 보석함에 모아 둬요.',
  '남이 다녀온 길을 통째로 가져와요.',
];

const styles = StyleSheet.create({
  /* LogoLockup 이 제 몫의 세로 공간을 요구합니다 — Tap.bar 는 글자 한
     줄짜리 막대 높이라 심볼·이름·한 줄 셋을 쌓기엔 모자랍니다. */
  bar: {
    alignItems: 'center',
    paddingTop: Spacing.s2,
  },
  /* 이름 줄과 이야기 사이 24. Screen 이 자식 사이를 12 씌우므로 12 만 더합니다. */
  pitch: {
    marginTop: Spacing.s3,
    gap: Spacing.s3,
  },
  headline: {
    ...Type.display,
    fontWeight: Weight.bold,
    color: Colors.text,
  },
  /* 캐러셀 위 32 — 위와 같은 셈입니다(12 + 20). */
  railOut: {
    marginTop: Spacing.s5,
    marginHorizontal: -Gutter,
  },
  rail: {
    paddingHorizontal: Gutter,
    gap: Spacing.s3,
  },
  /* 지역 줄. 밖으로 안 미므로 안쪽 여백도 없습니다 — 여백은 화면이
     이미 쥐고 있습니다. */
  regionRow: {
    gap: Spacing.s3,
  },
  /* 새로 깐 묶음들. 캐러셀과 같은 32 로 떨어집니다(12 + 20). */
  shelf: {
    marginTop: Spacing.s5,
    gap: Spacing.s2,
  },
  /* 글자 두 줄이라 묶음 머리글보다 바짝 붙입니다. */
  tags: {
    marginTop: Spacing.s5,
    gap: Spacing.s1,
  },
  media: {
    width: '100%',
    borderRadius: Radius.r4,
    backgroundColor: Colors.fill,
    overflow: 'hidden',
    marginBottom: Spacing.s2,
  },
  /* 이 틀이 이미 모서리를 쥐고 있으니 안쪽 그림은 제 모서리와 테두리를
     내놓습니다. 두 겹을 두르면 안쪽 둥근 선 밖으로 바탕색이 비칩니다. */
  flat: {
    borderRadius: 0,
    borderWidth: 0,
  },
  cardTitle: {
    ...Type.headline,
    fontWeight: Weight.semibold,
    color: Colors.text,
  },
  /* 지역 칸. 사진이 없으니 글 카드보다 좁고, 글자 두 줄 높이로만 섭니다. */
  regionCard: {
    minWidth: 104,
    gap: 2,
    paddingVertical: Spacing.s3,
    paddingHorizontal: Spacing.s4,
    borderRadius: Radius.r3,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  points: {
    gap: Spacing.s2,
  },
});
