package com.helpdesk.data.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateRoomRequest(
        @NotNull Long buildingId,
        @NotBlank String name
) {}
