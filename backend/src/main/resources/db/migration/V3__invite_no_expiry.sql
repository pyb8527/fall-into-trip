-- 기한 없는 초대 링크.
--
-- 여행이 끝날 때까지 계속 쓰는 링크를 만들고 싶다는 요구가 있었습니다.
-- 기한을 비워 두면 그렇게 씁니다. 대신 인원 제한과 취소로 닫습니다.
ALTER TABLE trip_invites ALTER COLUMN expires_at DROP NOT NULL;
