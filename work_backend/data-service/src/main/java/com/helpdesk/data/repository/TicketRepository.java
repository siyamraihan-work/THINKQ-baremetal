package com.helpdesk.data.repository;

import com.helpdesk.data.model.TicketEntity;
import com.helpdesk.data.model.TicketStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TicketRepository extends JpaRepository<TicketEntity, Long> {
    List<TicketEntity> findByStatusOrderByCreatedAtAsc(TicketStatus status);
    List<TicketEntity> findByStudentIdOrderByCreatedAtDesc(Long studentId);
    List<TicketEntity> findByTeacherIdOrderByCreatedAtDesc(Long teacherId);
    List<TicketEntity> findAllByOrderByCreatedAtDesc();
}
