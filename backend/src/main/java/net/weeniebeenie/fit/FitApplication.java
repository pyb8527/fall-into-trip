package net.weeniebeenie.fit;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
/* 알림 보내기는 따로 돕니다. 중계 서버에 닿는 데 이백 밀리초쯤 걸리는데,
   그것 때문에 장소 하나 옮기는 일이 느려질 이유가 없습니다. */
@EnableAsync
public class FitApplication {

    public static void main(String[] args) {
        SpringApplication.run(FitApplication.class, args);
    }
}
