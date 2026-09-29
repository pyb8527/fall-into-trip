package net.weeniebeenie.fit.photo.application;

import lombok.extern.slf4j.Slf4j;
import net.weeniebeenie.fit.shared.error.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

/**
 * 그림이 실제로 놓이는 자리.
 *
 * <h3>왜 따로 두는가</h3>
 *
 * <p>지금은 서버 옆 폴더입니다. 쓰는 사람이 늘어 자리가 모자라면 별도 서버나
 * 오브젝트 스토리지로 뺍니다. 그때 <b>바꿀 곳이 여기 하나</b>여야 합니다 —
 * 부르는 쪽이 경로를 알고 있으면 옮기는 날 그 경로가 화면과 서비스 여기저기에
 * 흩어져 있습니다.
 *
 * <p>그래서 밖에 내주는 것은 {@code id} 뿐이고, 그것이 어디에 어떤 이름으로
 * 놓이는지는 이 안에서만 압니다.
 *
 * <h3>도커라면 볼륨이어야 합니다</h3>
 *
 * <p>컨테이너 안의 폴더에 두면 다시 올릴 때마다({@code up -d --build}) 사진이
 * 통째로 사라집니다. docker-compose 에 볼륨을 걸어 두었습니다.
 *
 * <h3>두 자리로 나눠 담습니다</h3>
 *
 * <p>한 폴더에 수만 개를 넣으면 목록을 읽는 것만으로 느려지는 파일 시스템이
 * 있습니다. id 앞 두 글자로 폴더를 갈라 둡니다 — 나중에 옮길 때도 이 규칙만
 * 알면 됩니다.
 */
@Slf4j
@Component
public class PhotoStore {

    private final Path root;

    public PhotoStore(@Value("${fit.photos.dir:}") String dir) {
        /*
          안 정해 두면 서버 옆 photos 폴더입니다.

          <p>도커에서는 값을 넣어 볼륨을 가리키게 합니다. 개발할 때는 그냥
          여기 생기는 편이 편합니다.
        */
        this.root = Path.of(dir == null || dir.isBlank() ? "photos" : dir).toAbsolutePath();
    }

    /** 그림 한 장을 놓습니다. */
    public void put(String id, byte[] body) {
        Path at = pathOf(id);
        try {
            Files.createDirectories(at.getParent());
            /* 임시 이름으로 다 쓴 다음 옮깁니다. 쓰는 도중에 서버가 죽으면
               반쪽짜리 파일이 남는데, 그 뒤로는 그 줄을 열 때마다 깨진
               그림이 나옵니다. */
            Path half = at.resolveSibling(at.getFileName() + ".part");
            Files.write(half, body);
            Files.move(half, at, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            log.warn("사진을 두지 못했어요 ({}): {}", id, e.getMessage());
            throw ApiException.badRequest("사진을 저장하지 못했어요. 잠시 뒤 다시 올려 주세요.");
        }
    }

    /** 그림 한 장을 꺼냅니다. 없으면 null. */
    public byte[] get(String id) {
        Path at = pathOf(id);
        try {
            return Files.exists(at) ? Files.readAllBytes(at) : null;
        } catch (IOException e) {
            log.warn("사진을 읽지 못했어요 ({}): {}", id, e.getMessage());
            return null;
        }
    }

    /** 그림 한 장을 치웁니다. 없어도 조용합니다. */
    public void drop(String id) {
        try {
            Files.deleteIfExists(pathOf(id));
        } catch (IOException e) {
            /* 줄은 이미 지웠습니다. 파일 하나가 남는 것은 나중에 치울 수
               있지만, 여기서 터지면 지우기 자체가 실패합니다. */
            log.warn("사진 파일을 치우지 못했어요 ({}): {}", id, e.getMessage());
        }
    }

    /**
     * id 가 놓이는 자리.
     *
     * <p>id 는 우리가 만든 것만 들어옵니다. 그래도 한 번 더 봅니다 — 이 값이
     * 어디서 오는지는 부르는 쪽이 바뀌면 같이 바뀌고, 그때 {@code ../} 하나면
     * 서버의 아무 파일이나 내주게 됩니다.
     */
    private Path pathOf(String id) {
        if (id == null || !id.matches("^[A-Za-z0-9_-]{6,24}$")) {
            throw ApiException.badRequest("그런 사진이 없어요.");
        }
        return root.resolve(id.substring(0, 2)).resolve(id + ".jpg");
    }
}
