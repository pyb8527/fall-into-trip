package net.weeniebeenie.fit.photo.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.photo.application.PhotoService;
import net.weeniebeenie.fit.photo.domain.Photo;
import net.weeniebeenie.fit.shared.error.ApiException;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;

/**
 * 사진.
 *
 * <h3>보는 것은 누구나</h3>
 *
 * <p>여행기에 올린 사진은 그 글을 보는 사람이 봐야 하고, 글은 로그인 없이도
 * 열립니다. 그래서 <b>꺼내 보는 길만</b> 열어 둡니다. 올리고 지우는 것은
 * 로그인해야 합니다.
 *
 * <p>id 는 아홉 바이트 난수라 찍어서 맞힐 수 있는 값이 아닙니다. 그래도
 * "공개 글에 붙은 사진" 이라는 전제가 깔려 있으니, 나중에 <b>나만 보기</b>
 * 여행기를 만들 때는 여기에 볼 수 있는지 묻는 자리가 하나 생겨야 합니다.
 */
@RestController
@RequiredArgsConstructor
public class PhotoController {

    private final PhotoService photos;

    /**
     * 한 장 올리기.
     *
     * <p>받은 그림은 서버가 다시 굽습니다 — 그러면서 어디서 찍었는지(EXIF 의
     * GPS)가 떨어지고 크기도 잡힙니다.
     */
    @PostMapping("/api/photos")
    public Map<String, Object> take(@CurrentUser AuthPrincipal me,
                                    @RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("사진을 골라 주세요.");
        }
        byte[] body;
        try {
            body = file.getBytes();
        } catch (IOException e) {
            throw ApiException.badRequest("사진을 받지 못했어요. 다시 올려 주세요.");
        }
        Photo made = photos.take(me, body);
        return Map.of(
                "id", made.getId(),
                "width", made.getWidth(),
                "height", made.getHeight());
    }

    /**
     * 한 장 보기.
     *
     * <p>오래 담아 두라고 말합니다. 사진은 한 번 올라오면 안 바뀌고, id 가
     * 곧 그 그림입니다 — 바뀌면 id 가 바뀝니다.
     */
    @GetMapping("/api/photos/{id}")
    public ResponseEntity<byte[]> read(@PathVariable String id) {
        byte[] body = photos.read(id);
        if (body == null) {
            throw ApiException.notFound("그런 사진이 없어요.");
        }
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .body(body);
    }

    /**
     * 한 장 지우기.
     *
     * <p>올린 글에 실려 있으면 파일은 두고 붙어 있던 자리에서 떼기만 합니다 —
     * 지우면 남이 보던 여행기에 깨진 자리가 생깁니다. 그 경우 {@code gone} 이
     * false 로 옵니다.
     */
    @DeleteMapping("/api/photos/{id}")
    public Map<String, Object> drop(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        boolean gone = photos.drop(me, id);
        return Map.of("ok", true, "gone", gone);
    }
}
