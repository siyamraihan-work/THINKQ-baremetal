package com.helpdesk.data.dto;

import java.util.List;

public record StudentDashboardLookupsResponse(
        List<CourseResponse> courses,
        List<LocationResponse> locations
) {}
