package com.helpdesk.data.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateBuildingRequest(
        @NotBlank String name
) {}
