package com.helpdesk.data.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record PurgeTicketsRequest(
        @NotEmpty List<@NotNull Long> ticketIds
) {}
