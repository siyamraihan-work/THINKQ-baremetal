package com.helpdesk.data.model;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "session_records", indexes = {
        @Index(name = "idx_sessions_session_id", columnList = "sessionId", unique = true),
        @Index(name = "idx_sessions_last_seen_at", columnList = "lastSeenAt")
})
public class SessionRecordEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 128)
    private String sessionId;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private UserEntity user;

    @Column(nullable = false)
    private boolean loggedIn = true;

    @Column(nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(nullable = false)
    private OffsetDateTime lastSeenAt = OffsetDateTime.now();

    public Long getId() { return id; }
    public String getSessionId() { return sessionId; }
    public UserEntity getUser() { return user; }
    public boolean isLoggedIn() { return loggedIn; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getLastSeenAt() { return lastSeenAt; }

    public void setId(Long id) { this.id = id; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public void setUser(UserEntity user) { this.user = user; }
    public void setLoggedIn(boolean loggedIn) { this.loggedIn = loggedIn; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public void setLastSeenAt(OffsetDateTime lastSeenAt) { this.lastSeenAt = lastSeenAt; }
}
