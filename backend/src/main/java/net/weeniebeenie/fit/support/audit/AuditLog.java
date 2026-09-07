package net.weeniebeenie.fit.support.audit;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/** 누가 무엇을 했는지. 관리자 화면에서 최근 활동으로 보여 줍니다. */
@Entity
@Table(name = "audit_log")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Instant at = Instant.now();

    @Column(name = "user_id", length = 16)
    private String userId;

    @Column(nullable = false, length = 60)
    private String action;

    @Column(length = 60)
    private String target;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String detail;

    @Builder
    public AuditLog(String userId, String action, String target, String detail) {
        this.at = Instant.now();
        this.userId = userId;
        this.action = action;
        this.target = target;
        this.detail = detail;
    }
}
