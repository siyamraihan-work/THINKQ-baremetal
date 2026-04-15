package com.helpdesk.data.dto;

import java.time.OffsetDateTime;

public record TicketAnalyticsRow(
        Long ticketId,
        String location,
        String studentName,
        String topic,
        String status,
        Integer rating,
        String claimName,
        String comments,
        OffsetDateTime date,
        OffsetDateTime signIn,
        OffsetDateTime claimedAt,
        OffsetDateTime completedAt,
        Long waitTimeSeconds,
        Long completionTimeSeconds
) {}
