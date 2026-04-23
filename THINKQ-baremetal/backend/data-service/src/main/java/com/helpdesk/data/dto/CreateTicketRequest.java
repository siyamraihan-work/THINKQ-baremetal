package com.helpdesk.data.dto;

import com.helpdesk.data.model.IssueType;
import com.helpdesk.data.model.PreferredContact;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateTicketRequest(
        @NotNull Long studentId,
        @NotNull Long courseId,
        @NotNull Long locationId,
        @NotNull IssueType issueType,
        @Size(max = 1000) String notes,
        PreferredContact preferredContact
) {}
