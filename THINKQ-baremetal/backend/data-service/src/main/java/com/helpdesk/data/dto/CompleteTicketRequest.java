package com.helpdesk.data.dto;

import jakarta.validation.constraints.NotNull;

public record CompleteTicketRequest(@NotNull Long teacherId, String resolutionNotes) {}
