package com.helpdesk.data.dto;

import jakarta.validation.constraints.NotNull;

public record AssignTicketRequest(@NotNull Long teacherId) {}
