package com.helpdesk.data.dto;

public record CourseResponse(
        Long id,
        String subject,
        String code,
        String title,
        boolean active,
        String label
) {}
