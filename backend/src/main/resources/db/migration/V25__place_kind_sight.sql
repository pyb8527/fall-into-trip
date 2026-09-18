-- "명소" 로 잘못 묶인 것을 이름 보고 옮깁니다.
--
-- 구글은 거의 모든 장소에 point_of_interest 를 붙이는데, 그것으로 명소를
-- 판단했고 그 검사가 식당 검사보다 앞에 있었습니다. 그래서 츠케멘집도
-- 꼬치집도 초등학교도 전부 도리이 그림을 달고 "명소" 가 되었습니다.
--
-- 짐작은 담을 때 한 번만 합니다. 그래서 코드를 고쳐도 이미 담아 둔 것은
-- 틀린 그림을 그대로 들고 있습니다. 여기서 옮깁니다.
--
-- 다만 옮기는 것은 <이름이 대놓고 다른 것>뿐입니다. "명소" 로 남아 있는
-- 것 중에는 진짜 명소도 있고, 사람이 일부러 그렇게 골라 둔 것도 있습니다.
-- 이름에 라멘이라고 적혀 있는데 명소로 묶인 것은 사람의 뜻이 아니라
-- 서버가 틀린 것이라고 볼 수 있습니다.
--
-- "회" 같은 한 글자는 안 봅니다 — 교회·회관까지 걸립니다.

-- 일정에 들어간 장소
UPDATE places SET icon = CASE
    WHEN name ~ '(라멘|라면|우동|소바|국수|츠케멘|쯔케멘|누들|ramen|udon|soba|noodle)' THEN 'ramen'
    WHEN name ~ '(스시|초밥|sushi|sashimi)'                                            THEN 'sushi'
    WHEN name ~ '(야키니쿠|야키토리|꼬치|곱창|닭갈비|고깃집|yakitori)'                  THEN 'meat'
    WHEN name ~ '(온천|센토|찜질|onsen)'                                               THEN 'onsen'
    WHEN name ~ '(이자카야|포차|맥주|와인|izakaya)'                                    THEN 'bar'
    ELSE icon
END
WHERE icon = 'sight'
  AND name ~ '(라멘|라면|우동|소바|국수|츠케멘|쯔케멘|누들|ramen|udon|soba|noodle|스시|초밥|sushi|sashimi|야키니쿠|야키토리|꼬치|곱창|닭갈비|고깃집|yakitori|온천|센토|찜질|onsen|이자카야|포차|맥주|와인|izakaya)';

-- 보석함에 담아 둔 곳
UPDATE saved_places SET icon = CASE
    WHEN name ~ '(라멘|라면|우동|소바|국수|츠케멘|쯔케멘|누들|ramen|udon|soba|noodle)' THEN 'ramen'
    WHEN name ~ '(스시|초밥|sushi|sashimi)'                                            THEN 'sushi'
    WHEN name ~ '(야키니쿠|야키토리|꼬치|곱창|닭갈비|고깃집|yakitori)'                  THEN 'meat'
    WHEN name ~ '(온천|센토|찜질|onsen)'                                               THEN 'onsen'
    WHEN name ~ '(이자카야|포차|맥주|와인|izakaya)'                                    THEN 'bar'
    ELSE icon
END
WHERE icon = 'sight'
  AND name ~ '(라멘|라면|우동|소바|국수|츠케멘|쯔케멘|누들|ramen|udon|soba|noodle|스시|초밥|sushi|sashimi|야키니쿠|야키토리|꼬치|곱창|닭갈비|고깃집|yakitori|온천|센토|찜질|onsen|이자카야|포차|맥주|와인|izakaya)';
