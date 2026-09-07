package net.weeniebeenie.fit.support.setting;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "settings")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Setting {

    @Id
    @Column(name = "key", length = 60)
    private String key;

    @Column(name = "value", nullable = false, length = 200)
    private String value;

    public Setting(String key, String value) {
        this.key = key;
        this.value = value;
    }
}
