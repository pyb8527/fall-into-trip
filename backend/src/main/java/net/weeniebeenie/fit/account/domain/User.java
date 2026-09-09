package net.weeniebeenie.fit.account.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;
import net.weeniebeenie.fit.account.domain.Role;

import java.time.Instant;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User {

    @Id
    @Column(length = 16)
    private String id;

    @Column(nullable = false, length = 190)
    private String email;

    @Column(nullable = false, length = 80)
    private String name;

    /**
     * 지도에서 나를 가리키는 그림.
     *
     * <p>이모지가 아니라 짧은 이름("rabbit")만 둡니다. 어떤 그림을 그릴지는
     * 화면이 정합니다 — 이모지는 기기마다 다르게 생기고, 언젠가 바꾸고 싶을 때
     * 쌓인 값을 전부 고쳐야 합니다.
     *
     * <p>안 골랐으면 비어 있습니다. 그때는 화면이 이름 첫 글자로 그립니다.
     */
    @Column(length = 24)
    private String mark;

    /** scrypt 해시. 평문은 어디에도 남기지 않습니다. */
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Role role = Role.MEMBER;

    @Column(nullable = false)
    private boolean disabled = false;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Builder
    public User(String email, String name, String passwordHash, Role role) {
        this.id = Ids.next();
        this.email = email;
        this.name = name;
        this.passwordHash = passwordHash;
        this.role = role == null ? Role.MEMBER : role;
        this.createdAt = Instant.now();
    }

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }
}
