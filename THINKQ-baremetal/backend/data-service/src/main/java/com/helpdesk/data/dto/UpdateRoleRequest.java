package com.helpdesk.data.dto;

import com.helpdesk.data.model.Role;
import jakarta.validation.constraints.NotNull;

public record UpdateRoleRequest(@NotNull Role role) {}
