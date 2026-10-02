package net.weeniebeenie.fit.trip.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.trip.application.MyRecordService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 마이페이지의 리뷰 탭과 「다녀온 곳」 카드. 규칙은 {@link MyRecordService}. */
@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MyRecordController {

    private final MyRecordService records;

    @GetMapping("/reviews")
    public MyRecordService.Reviews reviews(@CurrentUser AuthPrincipal me) {
        return records.reviewsOf(me);
    }

    @GetMapping("/visited")
    public MyRecordService.Footprint visited(@CurrentUser AuthPrincipal me) {
        return records.footprintOf(me);
    }
}
