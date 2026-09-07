-- ============================================================================
--  FIT — 초기 스키마
--  ---------------------------------------------------------------------------
--  id 는 애플리케이션이 만드는 12자 문자열입니다. 순번(1,2,3…)을 쓰면 장소를
--  지웠을 때 방문기록·지출이 엉뚱한 장소로 옮겨 붙기 때문에 고정 ID 를 씁니다.
-- ============================================================================

-- ---------------------------------------------------------------- 사용자
CREATE TABLE users (
    id            VARCHAR(16)  PRIMARY KEY,
    email         VARCHAR(190) NOT NULL,
    name          VARCHAR(80)  NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(16)  NOT NULL DEFAULT 'MEMBER',   -- ADMIN | MEMBER
    disabled      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);
-- 대소문자를 가리지 않고 한 사람당 하나
CREATE UNIQUE INDEX ux_users_email ON users (lower(email));

-- ------------------------------------------------------- 리프레시 토큰
--  · 원본은 저장하지 않고 sha256 만 둡니다. DB 가 통째로 새어도 그것만으로는
--    토큰을 되살릴 수 없습니다.
--  · 재발급할 때마다 새 토큰으로 갈아 끼우고(rotation) 옛 것은 replaced_by 로
--    이어 둡니다. 이미 쓴 토큰이 다시 들어오면 탈취로 보고 그 계정의 토큰을
--    전부 끊습니다.
CREATE TABLE refresh_tokens (
    id          VARCHAR(16)  PRIMARY KEY,
    token_hash  VARCHAR(64)  NOT NULL UNIQUE,
    user_id     VARCHAR(16)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id   VARCHAR(16)  NOT NULL,          -- 한 번의 로그인에서 파생된 토큰 묶음
    issued_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ  NOT NULL,
    used_at     TIMESTAMPTZ,                    -- 재발급에 쓰인 시각
    revoked_at  TIMESTAMPTZ,
    replaced_by VARCHAR(16),
    user_agent  VARCHAR(200),
    ip          VARCHAR(64)
);
CREATE INDEX ix_refresh_user   ON refresh_tokens (user_id);
CREATE INDEX ix_refresh_family ON refresh_tokens (family_id);
CREATE INDEX ix_refresh_expiry ON refresh_tokens (expires_at);

-- ---------------------------------------------------------------- 여행
CREATE TABLE trips (
    id         VARCHAR(16)  PRIMARY KEY,
    title      VARCHAR(120) NOT NULL,
    owner_id   VARCHAR(16)  NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    version    BIGINT       NOT NULL DEFAULT 0
);
CREATE INDEX ix_trips_created ON trips (created_at);

CREATE TABLE trip_members (
    trip_id VARCHAR(16) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id VARCHAR(16) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role    VARCHAR(16) NOT NULL DEFAULT 'EDITOR',   -- EDITOR | VIEWER
    PRIMARY KEY (trip_id, user_id)
);

-- ------------------------------------------------------------ 초대 링크
--  주인이 링크를 만들어 카톡 등으로 보내면, 받은 사람이 눌러 참여합니다.
--  상대 이메일을 몰라도 되고, 가입자 명단이 새지 않습니다.
--
--  · 토큰 원본은 저장하지 않고 sha256 만 둡니다.
--  · 기한과 쓸 수 있는 횟수를 둡니다. 링크가 어딘가로 흘러가도 계속 열려
--    있으면 안 됩니다.
CREATE TABLE trip_invites (
    id         VARCHAR(16)  PRIMARY KEY,
    trip_id    VARCHAR(16)  NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    token_hash VARCHAR(64)  NOT NULL UNIQUE,
    role       VARCHAR(16)  NOT NULL DEFAULT 'EDITOR',   -- 참여했을 때 받을 역할
    created_by VARCHAR(16)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ  NOT NULL,
    max_uses   INTEGER      NOT NULL DEFAULT 1 CHECK (max_uses > 0),
    used_count INTEGER      NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    revoked_at TIMESTAMPTZ
);
CREATE INDEX ix_invites_trip ON trip_invites (trip_id);

-- ---------------------------------------------------------------- 날짜
CREATE TABLE days (
    id       VARCHAR(16)  PRIMARY KEY,
    trip_id  VARCHAR(16)  NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    sort     INTEGER      NOT NULL,
    label    VARCHAR(40)  NOT NULL,
    short    VARCHAR(80),
    date     VARCHAR(40),      -- 보여줄 문자열 "10.08 (목)"
    iso      DATE,
    theme    VARCHAR(200),
    color    VARCHAR(24),
    budget   VARCHAR(40),
    flight   JSONB,
    version  BIGINT       NOT NULL DEFAULT 0
);
CREATE INDEX ix_days_trip ON days (trip_id, sort);

-- ---------------------------------------------------------------- 장소
CREATE TABLE places (
    id         VARCHAR(16)      PRIMARY KEY,
    day_id     VARCHAR(16)      NOT NULL REFERENCES days(id) ON DELETE CASCADE,
    sort       INTEGER          NOT NULL,
    name       VARCHAR(120)     NOT NULL,
    ja         VARCHAR(120),
    en         VARCHAR(120),
    lat        DOUBLE PRECISION NOT NULL,
    lng        DOUBLE PRECISION NOT NULL,
    cat        VARCHAR(40),
    time       VARCHAR(10),     -- "HH:MM"
    cost       VARCHAR(40),
    note       TEXT,
    url        VARCHAR(500),
    radius     INTEGER,
    fit        BOOLEAN          NOT NULL DEFAULT TRUE,
    move       JSONB,           -- {mode,min,via,cost}
    updated_at TIMESTAMPTZ      NOT NULL DEFAULT now(),
    updated_by VARCHAR(16)      REFERENCES users(id),
    -- 둘이 같은 장소를 동시에 고쳤을 때 뒤엣사람이 앞사람 것을 모르고 덮어쓰지
    -- 않도록 씁니다. 저장할 때 값이 어긋나면 되돌립니다.
    version    BIGINT           NOT NULL DEFAULT 0
);
CREATE INDEX ix_places_day ON places (day_id, sort);

-- ---------------------------------------------------------------- 방문
CREATE TABLE visits (
    user_id    VARCHAR(16) NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    place_id   VARCHAR(16) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, place_id)
);

-- ---------------------------------------------------------------- 가계부
--  amount 는 엔 단위 정수입니다. 소수를 쓰면 정산에서 반올림 오차가 쌓입니다.
CREATE TABLE expenses (
    id         VARCHAR(16)  PRIMARY KEY,
    trip_id    VARCHAR(16)  NOT NULL REFERENCES trips(id)  ON DELETE CASCADE,
    day_id     VARCHAR(16)  REFERENCES days(id)   ON DELETE SET NULL,
    place_id   VARCHAR(16)  REFERENCES places(id) ON DELETE SET NULL,
    payer_id   VARCHAR(16)  NOT NULL REFERENCES users(id),
    cat        VARCHAR(40),
    name       VARCHAR(120) NOT NULL,
    amount     INTEGER      NOT NULL CHECK (amount >= 0),
    pay        VARCHAR(40),
    share      JSONB,        -- 정산 대상 user_id 배열
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by VARCHAR(16)  NOT NULL REFERENCES users(id),
    version    BIGINT       NOT NULL DEFAULT 0
);
CREATE INDEX ix_expenses_trip ON expenses (trip_id, day_id);

-- ---------------------------------------------------------------- 감사 로그
CREATE TABLE audit_log (
    id      BIGSERIAL   PRIMARY KEY,
    at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id VARCHAR(16),
    action  VARCHAR(60) NOT NULL,
    target  VARCHAR(60),
    detail  JSONB
);
CREATE INDEX ix_audit_at ON audit_log (at DESC);

-- ---------------------------------------------------------------- 설정
CREATE TABLE settings (
    key   VARCHAR(60)  PRIMARY KEY,
    value VARCHAR(200) NOT NULL
);
