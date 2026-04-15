package com.helpdesk.data.repository;

import com.helpdesk.data.model.Role;
import com.helpdesk.data.model.SessionRecordEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;

public interface SessionRecordRepository extends JpaRepository<SessionRecordEntity, Long> {
    Optional<SessionRecordEntity> findBySessionId(String sessionId);
    void deleteBySessionId(String sessionId);
    long countByUserIdAndLoggedInTrue(Long userId);

    @Query("select count(distinct s.user.id) from SessionRecordEntity s where s.loggedIn = true and s.user.role = :role and s.lastSeenAt >= :cutoff")
    long countDistinctActiveUsersByRoleSince(@Param("role") Role role, @Param("cutoff") OffsetDateTime cutoff);
}
