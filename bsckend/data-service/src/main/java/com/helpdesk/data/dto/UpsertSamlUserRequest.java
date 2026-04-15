package com.helpdesk.data.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record UpsertSamlUserRequest(
        @Email @NotBlank String email,
        @NotBlank String oid,
        @NotBlank String name
) {}
