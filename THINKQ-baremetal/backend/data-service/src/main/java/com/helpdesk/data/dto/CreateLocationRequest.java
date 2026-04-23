package com.helpdesk.data.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateLocationRequest(
        @NotNull Long roomId,
        @NotBlank String tableNumber,
        Boolean active
) {}
