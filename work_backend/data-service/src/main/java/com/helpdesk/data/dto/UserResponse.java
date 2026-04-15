package com.helpdesk.data.dto;

import com.helpdesk.data.model.Role;

public record UserResponse(
        Long id,
        String name,
        String email,
        String oid,
        Role role,
        boolean loggedIn
) {}
