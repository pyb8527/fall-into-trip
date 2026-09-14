-- 구글로 로그인하기.
--
-- 가입에 새 비밀번호를 만들게 하는 것이 지금 가장 큰 문턱입니다. 여행 한 번
-- 같이 가자고 부른 사람에게 그것부터 시키고 있었습니다.

-- 비밀번호가 없는 사람이 생깁니다. 소셜로만 들어온 사람입니다.
alter table users alter column password_hash drop not null;

-- 누가 어느 곳의 누구인지.
--
-- 열쇠가 (provider, subject) 입니다. 이메일이 아닙니다 — 사람은 구글에서
-- 이메일을 바꿀 수 있지만 subject 는 안 바뀝니다. 이메일을 열쇠로 쓰면
-- 주소를 바꾼 날 남의 계정이 되거나 제 계정을 잃습니다.
create table user_identities (
    provider   varchar(16)  not null,
    subject    varchar(255) not null,
    user_id    varchar(16)  not null references users(id) on delete cascade,
    -- 이을 때 그쪽이 알려 준 주소. 확인용으로만 두고 이것으로 사람을 찾지
    -- 않습니다.
    email      varchar(190),
    created_at timestamptz  not null default now(),
    primary key (provider, subject)
);

-- 한 사람이 어떤 곳들을 이어 두었는지. 설정 화면과 "끊으면 들어올 길이
-- 없는지" 를 보는 데 씁니다.
create index ix_identities_user on user_identities (user_id);

-- 한 사람이 같은 곳을 두 번 잇지 않습니다. 열쇠가 subject 라서 계정을
-- 바꿔 이으면 줄이 둘이 되는데, 그러면 "끊으면 들어올 길이 없는지" 셈이
-- 틀립니다.
create unique index ux_identities_user_provider on user_identities (user_id, provider);
