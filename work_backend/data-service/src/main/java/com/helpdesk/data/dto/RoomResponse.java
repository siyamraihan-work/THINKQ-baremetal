package com.helpdesk.data.dto;

public record RoomResponse(
        Long id,
        Long buildingId,
        String buildingName,
        String name,
        String displayLabel
) {}
