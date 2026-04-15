package com.helpdesk.data.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record SessionUpsertRequest(
        @NotBlank String sessionId,
        @NotNull Long userId,
        boolean loggedIn
) {}
