package com.helpdesk.data.dto;

import com.helpdesk.data.model.IssueType;
import com.helpdesk.data.model.PreferredContact;
import com.helpdesk.data.model.TicketStatus;

import java.time.OffsetDateTime;

public record TicketResponse(
        Long id,
        Long studentId,
        String studentName,
        Long teacherId,
        String teacherName,
        Long courseId,
        String courseLabel,
        Long locationId,
        String locationLabel,
        TicketStatus status,
        IssueType issueType,
        PreferredContact preferredContact,
        String notes,
        String resolutionNotes,
        Integer rating,
        String feedbackComment,
        OffsetDateTime createdAt,
        OffsetDateTime acceptedAt,
        OffsetDateTime completedAt
) {}
