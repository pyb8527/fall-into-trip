package net.weeniebeenie.fit.photo.application;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.photo.domain.Photo;
import net.weeniebeenie.fit.photo.domain.PhotoRepository;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;

/**
 * 사진을 받아 두는 일.
 *
 * <h3>받은 그대로 두지 않습니다</h3>
 *
 * <p>폰이 찍은 사진에는 <b>어디서 찍었는지</b>가 함께 들어 있습니다(EXIF 의
 * GPS). 여행기에 올린 사진 한 장으로 집 주소가 드러나는 일이 실제로 있습니다.
 * 받은 그림을 우리가 다시 그려서 내보내면 그 딱지들이 통째로 떨어집니다.
 *
 * <p>덤으로 크기도 잡힙니다. 요즘 폰 사진은 한 장에 4~8MB 인데, 화면에서
 * 쓰는 것은 길어야 1600 픽셀입니다. 다시 구우면 대개 10분의 1이 됩니다.
 *
 * <h3>믿지 않고 봅니다</h3>
 *
 * <p>브라우저가 보내 온 "이건 jpeg 이에요" 는 보낸 쪽 말입니다. 앞부분 몇
 * 바이트를 직접 보고, 우리가 읽을 수 있는 그림인지 실제로 그려 봅니다 —
 * 그림이 아닌 것은 여기서 걸립니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PhotoService {

    /** 받아 주는 한 장의 크기. 이보다 큰 것은 화면이 미리 줄여 보냅니다. */
    private static final int MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

    /**
     * 긴 쪽을 이만큼으로 줄입니다.
     *
     * <p>여행기에서 가장 크게 쓰는 자리가 폰 화면 가로폭이고, 그 두 배면
     * 고해상도 화면에서도 또렷합니다. 더 키워 두면 저장 자리만 먹습니다.
     */
    private static final int MAX_SIDE = 1600;

    /** 다시 구울 때의 품질. 0.82 아래로 내리면 하늘 같은 데가 뭉개집니다. */
    private static final float QUALITY = 0.82f;

    /**
     * 한 사람이 올릴 수 있는 장 수.
     *
     * <p>지금은 서버 옆 폴더 하나에 담습니다. 한 사람이 몇 만 장을 올리면
     * 그것으로 끝이라, 처음부터 막아 둡니다. 여행 한 번에 서른 장씩 스무
     * 번이면 육백 장이니 넉넉한 편입니다.
     */
    private static final long MAX_PER_USER = 1000;

    private final PhotoRepository photos;
    private final PhotoStore store;
    private final AuditService audit;

    @Transactional
    public Photo take(AuthPrincipal me, byte[] body) {
        if (body == null || body.length == 0) {
            throw ApiException.badRequest("사진이 비어 있어요.");
        }
        if (body.length > MAX_UPLOAD_BYTES) {
            throw ApiException.badRequest("사진이 너무 커요. 12MB 아래로 줄여 주세요.");
        }
        if (!looksLikeImage(body)) {
            throw ApiException.badRequest("사진 파일이 아니에요. JPEG 이나 PNG 로 올려 주세요.");
        }
        if (photos.countByOwnerId(me.id()) >= MAX_PER_USER) {
            throw ApiException.badRequest("올릴 수 있는 사진 수를 넘었어요. 안 쓰는 것을 지우고 올려 주세요.");
        }

        Baked baked = bake(body);
        Photo row = photos.save(Photo.builder()
                .ownerId(me.id())
                .bytes(baked.body().length)
                .width(baked.width())
                .height(baked.height())
                .build());

        store.put(row.getId(), baked.body());
        audit.log(me.id(), "photo.take", row.getId());
        return row;
    }

    public byte[] read(String id) {
        return store.get(id);
    }

    @Transactional
    public void drop(AuthPrincipal me, String id) {
        Photo row = photos.findById(id)
                .orElseThrow(() -> ApiException.notFound("그런 사진이 없어요."));
        if (!row.getOwnerId().equals(me.id())) {
            throw ApiException.forbidden("내가 올린 사진만 지울 수 있어요.");
        }
        photos.delete(row);
        store.drop(id);
        audit.log(me.id(), "photo.drop", id);
    }

    /**
     * 앞부분 몇 바이트로 그림인지 봅니다.
     *
     * <p>보낸 쪽이 적어 준 종류는 보낸 쪽 말입니다. 확장자도 마찬가지입니다.
     * 파일이 스스로 밝히는 것만 봅니다.
     */
    private static boolean looksLikeImage(byte[] b) {
        if (b.length < 8) {
            return false;
        }
        /* JPEG: FF D8 FF */
        if ((b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return true;
        }
        /* PNG: 89 50 4E 47 0D 0A 1A 0A */
        return (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G'
                && (b[4] & 0xFF) == 0x0D && (b[5] & 0xFF) == 0x0A
                && (b[6] & 0xFF) == 0x1A && (b[7] & 0xFF) == 0x0A;
    }

    /**
     * 다시 그려서 JPEG 으로 굽습니다.
     *
     * <p>이 한 번으로 EXIF 가 떨어지고 크기가 잡힙니다. 원본을 그대로 두는
     * 길은 두지 않습니다 — 두면 언젠가 그 길로 들어옵니다.
     */
    private static Baked bake(byte[] body) {
        BufferedImage src;
        try {
            src = ImageIO.read(new ByteArrayInputStream(body));
        } catch (Exception e) {
            throw ApiException.badRequest("사진을 읽지 못했어요. 다른 사진으로 올려 주세요.");
        }
        if (src == null) {
            throw ApiException.badRequest("사진을 읽지 못했어요. JPEG 이나 PNG 로 올려 주세요.");
        }

        int w = src.getWidth();
        int h = src.getHeight();
        int longest = Math.max(w, h);
        if (longest > MAX_SIDE) {
            double by = (double) MAX_SIDE / longest;
            w = Math.max(1, (int) Math.round(w * by));
            h = Math.max(1, (int) Math.round(h * by));
        }

        /* 투명한 PNG 를 그대로 JPEG 으로 구우면 투명한 자리가 검게 나옵니다.
           흰 바탕을 먼저 깔아 둡니다. */
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,
                    RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING,
                    RenderingHints.VALUE_RENDER_QUALITY);
            g.setColor(java.awt.Color.WHITE);
            g.fillRect(0, 0, w, h);
            g.drawImage(src, 0, 0, w, h, null);
        } finally {
            g.dispose();
        }

        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try {
            if (!writeJpeg(out, bytes)) {
                throw ApiException.badRequest("사진을 저장하지 못했어요.");
            }
        } catch (Exception e) {
            throw ApiException.badRequest("사진을 저장하지 못했어요.");
        }
        return new Baked(bytes.toByteArray(), w, h);
    }

    private static boolean writeJpeg(BufferedImage image, ByteArrayOutputStream out)
            throws java.io.IOException {
        var writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) {
            return false;
        }
        var writer = writers.next();
        var param = writer.getDefaultWriteParam();
        param.setCompressionMode(javax.imageio.ImageWriteParam.MODE_EXPLICIT);
        param.setCompressionQuality(QUALITY);
        try (var stream = ImageIO.createImageOutputStream(out)) {
            writer.setOutput(stream);
            writer.write(null, new javax.imageio.IIOImage(image, null, null), param);
        } finally {
            writer.dispose();
        }
        return true;
    }

    private record Baked(byte[] body, int width, int height) {
    }
}
