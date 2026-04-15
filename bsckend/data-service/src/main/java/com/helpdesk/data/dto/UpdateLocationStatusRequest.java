package com.helpdesk.data.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateLocationStatusRequest(
        @NotNull Boolean active
) {}
