-- 올라온 사진.
--
-- 그림 자체는 DB 에 안 넣습니다. 몇 메가짜리를 줄마다 넣으면 백업이 그만큼
-- 무거워지고, 백업이 무거워지면 안 하게 됩니다. 여기 두는 것은 "누구 것이고
-- 얼마나 크고 언제 올라왔나" 뿐이고 그림은 서버 옆 폴더에 둡니다.
--
-- 폴더 자리는 설정값입니다(fit.photos.dir). 나중에 별도 서버나 오브젝트
-- 스토리지로 뺄 때 여기 줄은 그대로 두고 읽고 쓰는 곳 하나만 바꿉니다.
CREATE TABLE photos (
    id          VARCHAR(16) PRIMARY KEY,
    owner_id    VARCHAR(16) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- 다시 인코딩한 뒤의 크기입니다. 사람마다 얼마나 쓰고 있는지 세는 데 씁니다.
    bytes       INTEGER     NOT NULL,
    width       INTEGER     NOT NULL,
    height      INTEGER     NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 한 사람이 얼마나 올렸는지 세는 길. 올릴 때마다 봅니다.
CREATE INDEX idx_photos_owner ON photos (owner_id);
