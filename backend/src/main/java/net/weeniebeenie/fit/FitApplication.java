package net.weeniebeenie.fit;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class FitApplication {

    public static void main(String[] args) {
        SpringApplication.run(FitApplication.class, args);
    }
}
