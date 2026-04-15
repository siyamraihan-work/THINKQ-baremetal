package com.helpdesk.data.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SubmitTicketFeedbackRequest(
        @NotNull Long studentId,
        @NotNull @Min(1) @Max(5) Integer rating,
        @Size(max = 500) String comment
) {}
