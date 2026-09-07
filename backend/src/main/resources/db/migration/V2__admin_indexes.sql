-- ============================================================================
--  운영 화면이 쓰는 인덱스
--  ---------------------------------------------------------------------------
--  감사 로그는 "누가" 또는 "무엇을" 로 좁혀 보는 일이 대부분입니다. 시간
--  인덱스(ix_audit_at)만으로는 그때마다 전체를 훑게 되므로, 자주 거는 조건에
--  맞춰 시간과 묶어 둡니다.
-- ============================================================================

-- 특정 사람의 활동을 최근 순으로
CREATE INDEX IF NOT EXISTS ix_audit_user   ON audit_log (user_id, at DESC);

-- 특정 활동(로그인 실패, 계정 잠금 등)을 최근 순으로
CREATE INDEX IF NOT EXISTS ix_audit_action ON audit_log (action, at DESC);

-- 어떤 대상에게 무슨 일이 있었는지
CREATE INDEX IF NOT EXISTS ix_audit_target ON audit_log (target, at DESC);

-- 계정을 지우기 전에 "이 사람이 주인인 여행" 을 셉니다.
CREATE INDEX IF NOT EXISTS ix_trips_owner  ON trips (owner_id);

-- 계정 목록은 만든 순의 역순으로 넘겨 봅니다.
CREATE INDEX IF NOT EXISTS ix_users_created ON users (created_at DESC);
