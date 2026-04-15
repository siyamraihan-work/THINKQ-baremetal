package com.helpdesk.data.dto;

public record LocationResponse(
        Long id,
        Long buildingId,
        String buildingName,
        Long roomId,
        String roomName,
        String tableNumber,
        boolean active,
        String displayLabel
) {}
