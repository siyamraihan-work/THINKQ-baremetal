package com.helpdesk.data.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateCourseRequest(
        @NotBlank String subject,
        @NotBlank String code,
        String title,
        Boolean active
) {}
