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

    /**
     * scrypt 해시. 평문은 어디에도 남기지 않습니다.
     *
     * <p><b>없을 수 있습니다.</b> 구글로만 들어온 사람은 비밀번호를 만든 적이
     * 없습니다. 그때는 비밀번호로 로그인하는 길이 <b>막혀</b> 있어야 합니다 —
     * 빈 해시에 빈 비밀번호가 맞아떨어지는 일이 없도록 {@link #hasPassword} 를
     * 먼저 봅니다.
     */
    @Column(name = "password_hash")
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

    /**
     * 소식함을 어디까지 봤는가.
     *
     * <p>비어 있으면 한 번도 안 연 것이고, 그때는 목록이 전부 새것입니다.
     *
     * <p>이 값으로 <b>거르지 않습니다.</b> 소식은 늘 30일치가 그대로 있고,
     * 이것은 "새것" 점을 찍을지만 정합니다 — 열어 본 뒤에 어제 것이
     * 사라지면 "아까 그게 뭐였더라" 를 할 수 없습니다.
     */
    @Column(name = "news_seen_at")
    private Instant newsSeenAt;

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

    /**
     * 비밀번호로 들어올 수 있는 계정인가.
     *
     * <p>해시를 직접 견주는 자리마다 이것을 먼저 봅니다. 안 보면 해시가
     * 비어 있을 때 무슨 일이 일어나는지가 암호 라이브러리 사정에 달리게
     * 됩니다.
     */
    public boolean hasPassword() {
        return passwordHash != null && !passwordHash.isBlank();
    }
}
