package com.helpdesk.data.repository;

import com.helpdesk.data.model.TicketEntity;
import com.helpdesk.data.model.TicketStatus;
import com.helpdesk.data.model.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;

public interface TicketRepository extends JpaRepository<TicketEntity, Long> {
    List<TicketEntity> findByStatusOrderByCreatedAtAsc(TicketStatus status);
    List<TicketEntity> findByStudentIdOrderByCreatedAtDesc(Long studentId);
    List<TicketEntity> findByTeacherIdOrderByCreatedAtDesc(Long teacherId);
    List<TicketEntity> findAllByOrderByCreatedAtDesc();
    boolean existsByStudentIdAndStatusIn(Long studentId, Collection<TicketStatus> statuses);

    @Query("select t from TicketEntity t where t.status = :status order by coalesce(t.queuedAt, t.createdAt) asc, t.id asc")
    List<TicketEntity> findQueueOrdered(@Param("status") TicketStatus status);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update TicketEntity t set t.teacher = :teacher, t.status = :assignedStatus, t.acceptedAt = :acceptedAt, t.updatedAt = :acceptedAt where t.id = :ticketId and t.status = :queuedStatus")
    int claimTicket(@Param("ticketId") Long ticketId,
                    @Param("teacher") UserEntity teacher,
                    @Param("acceptedAt") OffsetDateTime acceptedAt,
                    @Param("assignedStatus") TicketStatus assignedStatus,
                    @Param("queuedStatus") TicketStatus queuedStatus);
}
