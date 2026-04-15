package com.helpdesk.data.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateCourseStatusRequest(
        @NotNull Boolean active
) {}
