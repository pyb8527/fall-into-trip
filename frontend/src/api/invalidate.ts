/**
 * 무언가를 바꾼 뒤, 그것을 보여 주던 자리들이 다시 읽게 하는 길.
 *
 * <h3>왜 생겼나</h3>
 *
 * <p>화면 하나가 여러 갈래를 따로 읽습니다. 여행 상세만 해도 일정 · 같이 가는
 * 사람 · 가계부 · 그 여행의 피드 · 보석함을 각자 받아 옵니다. 그런데 무엇을
 * 바꾼 뒤에 다시 읽는 것은 대개 <b>하나</b>뿐이었습니다 — 이야기를 올리고 나서
 * 일정만 다시 읽으니, 방금 올린 사진이 장소 밑에 안 붙고 새로고침을 눌러야
 * 나왔습니다(「여행 상세에서 사진을 올리거나 정보를 변경했을 때 리프레시
 * 로직이 없음」). 바꾸는 자리마다 「누가 이걸 보고 있지」를 손으로 꼽게 하면
 * 갈래가 하나 늘 때마다 어딘가에서 빠집니다.
 *
 * <p>그래서 꼽는 일을 한 곳으로 모읍니다.
 *
 * <ul>
 *   <li><b>읽는 쪽</b> — {@link useAsync} 가 부른 주소를 보고 어떤 갈래를
 *       읽었는지 스스로 적어 둡니다({@link keysOfRead}). 화면마다 열쇠를 달
 *       필요가 없습니다.</li>
 *   <li><b>바꾸는 쪽</b> — {@code api.post · put · patch · delete · upload}
 *       가 성공하면, 그 주소가 어떤 갈래를 바꾸는지 보고({@link keysOfWrite})
 *       알립니다. 부르는 자리는 아무것도 안 해도 됩니다.</li>
 * </ul>
 *
 * <p>주소만으로 모자랄 때(서버를 안 거치고 바뀐 것 등)는 {@link invalidate} 를
 * 직접 부르고, 읽는 쪽은 {@code useAsync(load, deps, { keys })} 로 열쇠를 더
 * 답니다.
 *
 * <h3>열쇠</h3>
 *
 * <p>{@code 갈래} 또는 {@code 갈래:번호} 입니다. 갈래만 알리면 그 갈래의 모든
 * 번호가 다시 읽습니다({@code trip} → {@code trip:3}, {@code trip:7} …).
 * 번호까지 알리면 그 번호만입니다. 거꾸로는 아닙니다 — {@code trip:3} 을 알려도
 * 갈래 전체를 듣는 쪽은 안 움직입니다. 바꾸는 쪽이 번호를 모를 때(장소 하나를
 * 고치면 주소에 여행 번호가 없습니다)는 갈래를 통째로 알립니다.
 *
 * <pre>
 *   trips          내 여행 목록 · 폴더          GET /api/trips, /api/folders
 *   trip:ID        여행 하나의 일정             GET /api/trip?trip=ID
 *   people:ID      그 여행의 사람               GET /api/trips/ID/people
 *   going:ID       간다 · 못 간다               GET /api/trips/ID/going
 *   dates:ID       날짜 투표                    GET /api/trips/ID/dates, /api/groups/ID/dates
 *   items:ID       챙길 것                      GET /api/trips/ID/items
 *   candidates:ID  가고 싶은 곳(투표장)         GET /api/trips/ID/candidates
 *   money:ID       가계부 · 정산 · 환율         GET /api/trips/ID/expenses|settlement|rates
 *   money          모든 여행의 가계부 요약      GET /api/expenses/summary
 *   feed           피드(이야기 · 사진 · 댓글)   GET /api/feed…
 *   posts          둘러보기 글 · 그 댓글        GET /api/posts…
 *   saved          보석함                       GET /api/saved
 *   tips           장소의 한 줄 팁              GET /api/places/ID/tips
 *   me             내 프로필 · 내가 쓴 것들     GET /api/me/profile, /api/users/ID/profile …
 *   blocks         막은 사람                    GET /api/me/blocks
 *   groups         모임 · 초대                  GET /api/groups…, /api/group-invites…
 *   news           새 소식                      GET /api/news
 *   admin          운영 화면                    GET /api/admin/…
 * </pre>
 *
 * <h3>일부러 빼 둔 것</h3>
 *
 * <ul>
 *   <li><b>구글에 묻는 것</b> — 이동 시간 · 영업시간 · 장소 사진 · 주변 장소.
 *       부를 때마다 돈이 나가고, 화면이 이미 장소의 차례와 자리를 열쇠로 다시
 *       묻고 있습니다({@code daySeq}). 여기 걸면 장소 하나 고칠 때마다 사 옵니다.</li>
 *   <li><b>추천 누르기</b> — 화면이 서버를 기다리지 않고 먼저 칠합니다. 다시
 *       읽으면 빠르게 두 번 누를 때 하트가 깜빡이며 되돌아갑니다.</li>
 *   <li><b>신고</b> — 보이는 것이 안 바뀝니다. 막기(차단)는 바뀝니다.</li>
 *   <li><b>새 소식 읽음 표시</b> — 새 소식 화면이 열자마자 보내는 것이라, 걸면
 *       그 화면이 열리자마자 한 번 더 읽습니다.</li>
 * </ul>
 */

/** 듣는 쪽 하나. {@link useAsync} 와 {@link useInvalidation} 이 만듭니다. */
export type Subscriber = {
  /** 지금 무엇을 보고 있는지. 부를 때마다 새로 묻습니다 — 읽을 때마다 바뀝니다. */
  keys: () => Iterable<string>;
  /** 마지막으로 읽기 시작한 때({@link stamp}). 모르면 0 을 돌려줍니다. */
  lastRun: () => number;
  /** 다시 읽으라는 말. */
  fire: () => void;
};

const subscribers = new Set<Subscriber>();

/**
 * 시계 대신 쓰는 차례 번호.
 *
 * <p>「알린 뒤에 이미 다시 읽었나」를 가리려고 둡니다. 바꾸는 자리 다수가 성공한
 * 뒤 제 화면을 손으로 다시 읽습니다({@code reload()}). 그 뒤에 알림까지 받아
 * 또 읽으면 같은 것을 두 번 받습니다. 알린 차례보다 늦게 읽기 시작했으면
 * 건너뜁니다. 시각(ms)으로 하면 같은 1ms 안에서 앞뒤가 안 갈립니다.
 */
let tick = 0;

export function stamp() {
  tick += 1;
  return tick;
}

/** 알렸지만 아직 돌리지 않은 열쇠와, 마지막으로 알린 차례. */
const pending = new Map<string, number>();
let scheduled = false;

/**
 * 이 열쇠들을 보던 자리에 다시 읽으라고 알립니다.
 *
 * <p>바로 돌리지 않고 한 박자 모읍니다. 지우기 여러 개를 한꺼번에 보내는
 * 자리({@code Promise.all})가 있는데, 하나 끝날 때마다 다시 읽으면 같은 목록을
 * 그 수만큼 받습니다.
 */
export function invalidate(...keys: string[]) {
  if (keys.length === 0) {
    return;
  }
  const at = stamp();
  for (const key of keys) {
    pending.set(key, at);
  }
  if (!scheduled) {
    scheduled = true;
    setTimeout(flush, 0);
  }
}

/** {@code wide} 를 알리면 {@code narrow} 를 보던 쪽이 움직이는지. */
function covers(wide: string, narrow: string) {
  return narrow === wide || narrow.startsWith(`${wide}:`);
}

function flush() {
  scheduled = false;
  if (pending.size === 0) {
    return;
  }
  const batch = [...pending];
  pending.clear();

  /* 도는 사이에 듣는 쪽이 빠지거나 늘 수 있어 한 벌 떠 둡니다. */
  for (const sub of [...subscribers]) {
    let latest = 0;
    for (const listened of sub.keys()) {
      for (const [key, at] of batch) {
        if (at > latest && covers(key, listened)) {
          latest = at;
        }
      }
    }
    if (latest > 0 && sub.lastRun() < latest) {
      sub.fire();
    }
  }
}

export function subscribe(sub: Subscriber) {
  subscribers.add(sub);
  return () => {
    subscribers.delete(sub);
  };
}

/* ───────────────────────── 읽기: 무엇을 읽었나 ───────────────────────── */

/**
 * 읽기 한 번이 부른 주소들을 모아 둘 자리.
 *
 * <p>{@link useAsync} 는 읽기마다 새 {@link AbortSignal} 을 만들어 넘기고,
 * 화면은 그것을 {@code api.get(path, signal)} 에 그대로 실어 보냅니다. 그 끈을
 * 열쇠 삼아 「이 읽기가 무엇을 불렀나」를 적습니다. 끈이 사라지면 함께
 * 사라지도록 WeakMap 에 둡니다.
 */
const readsBySignal = new WeakMap<AbortSignal, Set<string>>();

/** 이 끈으로 부르는 읽기들의 열쇠를 여기에 모으게 합니다. */
export function watchReads(signal: AbortSignal, into: Set<string>) {
  readsBySignal.set(signal, into);
}

/** {@code api.get} 이 부를 때마다 알려 옵니다. 지켜보는 끈이 아니면 버립니다. */
export function noteRead(path: string, signal: AbortSignal | undefined) {
  if (!signal) {
    return;
  }
  const into = readsBySignal.get(signal);
  if (!into) {
    return;
  }
  for (const key of keysOfRead(path)) {
    into.add(key);
  }
}

/** 주소를 조각과 묻는 값으로 나눕니다. {@code /api/trips/3/items?x=1} → {@code ['trips','3','items']}. */
function parse(path: string) {
  const [pathname, search = ''] = path.split('?');
  const parts = pathname.split('/').filter(Boolean);
  /* 맨 앞 api 는 모두 같으니 뗍니다. */
  if (parts[0] === 'api') {
    parts.shift();
  }
  const params = new Map<string, string>();
  for (const pair of search.split('&')) {
    if (!pair) {
      continue;
    }
    const [k, v = ''] = pair.split('=');
    params.set(decodeURIComponent(k), decodeURIComponent(v));
  }
  return { parts: parts.map((p) => decodeURIComponent(p)), params };
}

/** 여행 밑 갈래(GET /api/trips/ID/…)가 어느 열쇠인지. */
const TRIP_READS: Record<string, string> = {
  people: 'people',
  going: 'going',
  dates: 'dates',
  items: 'items',
  candidates: 'candidates',
  expenses: 'money',
  settlement: 'money',
  rates: 'money',
};

/**
 * 이 주소를 읽은 화면은 어떤 열쇠를 들어야 하는지.
 *
 * <p>모르는 주소는 아무 열쇠도 안 줍니다 — 다시 읽을 까닭이 생기지 않는 것은
 * 처음부터 안 답니다(위 「일부러 빼 둔 것」).
 */
export function keysOfRead(path: string): string[] {
  const { parts, params } = parse(path);
  const [head, id, sub] = parts;

  switch (head) {
    case 'trip':
      return params.get('trip') ? [`trip:${params.get('trip')}`] : ['trip'];
    case 'trips':
      if (!id) {
        return ['trips'];
      }
      return sub && TRIP_READS[sub] ? [`${TRIP_READS[sub]}:${id}`] : [];
    case 'folders':
      return ['trips'];
    case 'expenses':
      return id === 'summary' ? ['money'] : [];
    case 'feed':
      return ['feed'];
    case 'posts':
      /* 태그 · 지역 모음은 글 하나 바뀐다고 달라지지 않습니다. */
      if (id === 'tags' || id === 'regions') {
        return [];
      }
      return id === 'mine' ? ['posts', 'me'] : ['posts'];
    case 'comments':
      return id === 'mine' ? ['me'] : [];
    case 'saved':
      return ['saved'];
    case 'places':
      return sub === 'tips' ? ['tips'] : [];
    case 'me':
      return id === 'blocks' ? ['blocks'] : id === 'calendar' ? [] : ['me'];
    case 'users':
      return sub === 'profile' ? ['me'] : [];
    case 'groups':
      return id && sub === 'dates' ? ['dates'] : ['groups'];
    case 'group-invites':
      return ['groups'];
    case 'news':
      return ['news'];
    case 'admin':
      return ['admin'];
    default:
      return [];
  }
}

/* ───────────────────────── 쓰기: 무엇을 바꿨나 ───────────────────────── */

/** 사람을 막거나 풀면 그 사람이 쓴 것이 곳곳에서 사라지거나 돌아옵니다. */
const HIDDEN_BY_BLOCK = ['blocks', 'feed', 'posts', 'tips', 'me', 'news'];

/**
 * 이 주소로 무언가를 바꿨으면 어떤 열쇠를 알려야 하는지.
 *
 * <p>읽는 쪽보다 넉넉하게 잡습니다. 다시 읽는 것은 <b>지금 보이는 화면</b>
 * 뿐이라(가려진 화면은 돌아올 때 어차피 다시 읽습니다), 조금 넓게 알려도
 * 한 화면의 몇 갈래를 더 받는 데서 그칩니다. 좁게 잡아 빠뜨리면 그게 이번에
 * 고친 그 일입니다.
 */
export function keysOfWrite(path: string): string[] {
  const { parts } = parse(path);
  const [head, id, sub] = parts;
  const tail = parts[parts.length - 1];

  /* 보이는 것이 안 바뀌는 것들. */
  if (tail === 'report' || tail === 'like') {
    return [];
  }

  switch (head) {
    case 'trips': {
      if (!id) {
        /* 새 여행 */
        return ['trips'];
      }
      switch (sub) {
        case undefined:
          /* 이름 · 표식 고치기, 지우기. 모임 화면과 가계부 요약에도 이름이 섭니다. */
          return ['trips', `trip:${id}`, 'money', 'groups'];
        case 'copy':
          return ['trips'];
        case 'folder':
          return ['trips'];
        case 'notice':
          return [`trip:${id}`];
        case 'budget':
          return [`trip:${id}`, 'money'];
        case 'expenses':
        case 'rates':
        case 'settlement':
          return ['money'];
        case 'items':
          return [`items:${id}`];
        case 'candidates':
          return [`candidates:${id}`];
        case 'vote-until':
          return [`trip:${id}`, `candidates:${id}`];
        case 'going':
          return [`going:${id}`, `people:${id}`, `trip:${id}`];
        case 'group':
          /* 혼자 여행 ↔ 모임 여행. 사람도, 모임 화면의 여행 목록도 바뀝니다. */
          return ['trips', `trip:${id}`, `people:${id}`, `going:${id}`, 'groups'];
        case 'dates':
          /* 날을 정하면(confirm) 여행 날짜가 옮겨 갑니다. */
          return tail === 'confirm'
            ? ['dates', 'going', 'trips', `trip:${id}`, 'groups']
            : ['dates'];
        case 'publish':
          return ['posts', 'me', `trip:${id}`];
        default:
          /* location · pins(지도가 따로 몇 초마다 읽습니다), view-link(공유 주소 판이
             스스로 다시 읽습니다), recommend(묻기만 합니다). */
          return [];
      }
    }
    case 'folders':
      return ['trips'];
    case 'expenses':
      return ['money'];
    case 'items':
      return ['items'];
    case 'candidates':
      return ['candidates'];
    case 'days':
      /* 날 고치기, 보석함 · 투표장에서 일정으로 붓기 */
      if (sub === 'places') {
        return tail === 'from-saved' ? ['trip', 'trips', 'saved'] : ['trip', 'trips', 'candidates'];
      }
      return ['trip'];
    case 'places':
      if (sub === 'tips') {
        return ['tips', 'me'];
      }
      /* 장소 넣기 · 고치기 · 지우기 · 차례 바꾸기. 주소에 여행 번호가 없어
         갈래를 통째로 알립니다. 홈 카드의 장소 수 · 사진도 따라와야 합니다. */
      return ['trip', 'trips'];
    case 'visits':
      return ['trip'];
    case 'feed':
      /* 글 · 사진 올리기, 고치기, 지우기, 댓글. 내 프로필의 글 수도 함께. */
      return ['feed', 'me'];
    case 'posts':
      if (id && sub === 'copy') {
        return ['trips'];
      }
      return ['posts', 'me'];
    case 'comments':
      /* 피드 댓글인지 둘러보기 댓글인지 주소로는 모릅니다. */
      return ['feed', 'posts', 'me'];
    case 'saved':
      return ['saved'];
    case 'tips':
      /* /api/tips/counts 는 세기만 하는 POST 입니다. */
      return id === 'counts' ? [] : ['tips', 'me'];
    case 'users':
      return sub === 'block' ? HIDDEN_BY_BLOCK : [];
    case 'me':
      /* 이름 · 얼굴은 피드 글 머리, 모임 사람 목록, 일정의 「누가 고쳤나」에 섭니다. */
      return id === 'profile' ? ['me', 'feed', 'posts', 'groups', 'people'] : [];
    case 'auth':
      /* 내 표식. 지도의 내 핀 · 사람 목록에 섭니다. 나머지(로그인 · 연결 등)는
         화면이 스스로 다시 세웁니다. */
      return id === 'mark' ? ['me', 'people', 'groups'] : [];
    case 'groups':
      if (id && sub === 'dates') {
        return ['dates'];
      }
      /* 모임을 나가거나 넘기면 그 모임 여행이 내 목록에서 빠지거나 바뀝니다. */
      return ['groups', 'trips', 'people'];
    case 'group-invites':
      return ['groups', 'trips', 'people'];
    case 'admin':
      return ['admin', 'feed', 'posts'];
    default:
      /* photos(올린 사진은 글에 붙어야 보입니다 — 붙이는 쪽이 알립니다),
         push · news/seen · recommend 등 */
      return [];
  }
}
