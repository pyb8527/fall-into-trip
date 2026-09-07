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
