-- 여행을 묶어 두는 폴더.
--
-- 폴더는 여행이 아니라 <보는 사람>의 것입니다. 여행에 붙이면 주인이 만든
-- 폴더가 동행자 목록에도 나타나는데, 같이 간 사람마다 정리하는 방식이 다릅니다.
-- 누가 만든 여행이든 각자 자기 폴더에 넣습니다.
CREATE TABLE trip_folders (
    id         VARCHAR(16) PRIMARY KEY,
    user_id    VARCHAR(16) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(40) NOT NULL,
    sort       INTEGER     NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- 같은 사람이 같은 이름의 폴더를 둘 만들 이유가 없습니다.
    UNIQUE (user_id, name)
);
CREATE INDEX ix_folders_user ON trip_folders (user_id, sort, created_at);

-- 어떤 여행을 어느 폴더에 넣었는지.
--
-- 열쇠가 (사람, 여행)이라 한 사람이 한 여행을 두 폴더에 넣을 수 없습니다.
-- 여러 곳에 걸쳐 두면 목록에서 같은 여행이 두 번 보입니다.
CREATE TABLE trip_folder_items (
    user_id   VARCHAR(16) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id   VARCHAR(16) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    folder_id VARCHAR(16) NOT NULL REFERENCES trip_folders(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, trip_id)
);
CREATE INDEX ix_folder_items_folder ON trip_folder_items (folder_id);
