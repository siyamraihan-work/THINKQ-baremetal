package com.helpdesk.data.dto;

public record QueueMetricsResponse(
        long onlineTeacherCount,
        long queueCount,
        long estimatedWaitMinutes
) {}
