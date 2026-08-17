package com.helpdesk.data.dto;

import jakarta.validation.constraints.NotNull;

public record RequeueTicketRequest(@NotNull Long teacherId) {}
