package com.helpdesk.data.controller;

import com.helpdesk.data.dto.*;
import com.helpdesk.data.model.TicketStatus;
import com.helpdesk.data.service.DataFacadeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/internal")
public class InternalController {

    private final DataFacadeService service;

    public InternalController(DataFacadeService service) {
        this.service = service;
    }

    @GetMapping("/health")
    public String health() {
        return "ok";
    }

    @PostMapping("/users/upsert-from-saml")
    public UserResponse upsertFromSaml(@Valid @RequestBody UpsertSamlUserRequest request) {
        return service.upsertSamlUser(request);
    }

    @GetMapping("/users")
    public List<UserResponse> getUsers() {
        return service.getUsers();
    }

    @GetMapping("/users/{id}")
    public UserResponse getUser(@PathVariable("id") Long id) {
        return service.getUser(id);
    }

    @PatchMapping("/users/{id}/role")
    public UserResponse updateRole(
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateRoleRequest request
    ) {
        return service.updateRole(id, request);
    }

    @PostMapping("/sessions")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void upsertSession(@Valid @RequestBody SessionUpsertRequest request) {
        service.upsertSession(request);
    }

    @DeleteMapping("/sessions/{sessionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSession(@PathVariable("sessionId") String sessionId) {
        service.deleteSession(sessionId);
    }

    @PatchMapping("/sessions/{sessionId}/touch")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void touchSession(@PathVariable("sessionId") String sessionId) {
        service.touchSession(sessionId);
    }

    @GetMapping("/courses")
    public List<CourseResponse> getCourses() {
        return service.getCourses();
    }

    @PostMapping("/courses")
    @ResponseStatus(HttpStatus.CREATED)
    public CourseResponse createCourse(@Valid @RequestBody CreateCourseRequest request) {
        return service.createCourse(request);
    }

    @PatchMapping("/courses/{id}/status")
    public CourseResponse updateCourseStatus(
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateCourseStatusRequest request
    ) {
        return service.updateCourseStatus(id, request);
    }

    @DeleteMapping("/courses/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCourse(@PathVariable("id") Long id) {
        service.deleteCourse(id);
    }

    @GetMapping("/buildings")
    public List<BuildingResponse> getBuildings() {
        return service.getBuildings();
    }

    @PostMapping("/buildings")
    @ResponseStatus(HttpStatus.CREATED)
    public BuildingResponse createBuilding(@Valid @RequestBody CreateBuildingRequest request) {
        return service.createBuilding(request);
    }

    @GetMapping("/rooms")
    public List<RoomResponse> getRooms() {
        return service.getRooms();
    }

    @PostMapping("/rooms")
    @ResponseStatus(HttpStatus.CREATED)
    public RoomResponse createRoom(@Valid @RequestBody CreateRoomRequest request) {
        return service.createRoom(request);
    }

    @GetMapping("/locations")
    public List<LocationResponse> getLocations() {
        return service.getLocations();
    }

    @PostMapping("/locations")
    @ResponseStatus(HttpStatus.CREATED)
    public LocationResponse createLocation(@Valid @RequestBody CreateLocationRequest request) {
        return service.createLocation(request);
    }

    @PatchMapping("/locations/{id}/status")
    public LocationResponse updateLocationStatus(
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateLocationStatusRequest request
    ) {
        return service.updateLocationStatus(id, request);
    }

    @DeleteMapping("/locations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteLocation(@PathVariable("id") Long id) {
        service.deleteLocation(id);
    }

    @GetMapping("/support/lookups")
    public StudentDashboardLookupsResponse getStudentDashboardLookups() {
        return service.getStudentDashboardLookups();
    }

    @GetMapping("/support/metrics")
    public QueueMetricsResponse getQueueMetrics() {
        return service.getQueueMetrics();
    }

    @PostMapping("/tickets")
    @ResponseStatus(HttpStatus.CREATED)
    public TicketResponse createTicket(@Valid @RequestBody CreateTicketRequest request) {
        return service.createTicket(request);
    }

    @GetMapping("/tickets")
    public List<TicketResponse> getTicketsByStatus(@RequestParam("status") TicketStatus status) {
        return service.getTicketsByStatus(status);
    }

    @GetMapping("/tickets/by-student/{studentId}")
    public List<TicketResponse> getTicketsByStudent(@PathVariable("studentId") Long studentId) {
        return service.getTicketsByStudent(studentId);
    }

    @GetMapping("/tickets/by-teacher/{teacherId}")
    public List<TicketResponse> getTicketsByTeacher(@PathVariable("teacherId") Long teacherId) {
        return service.getTicketsByTeacher(teacherId);
    }

    @GetMapping("/tickets/report")
    public List<TicketAnalyticsRow> getTicketReport() {
        return service.getTicketAnalyticsRows();
    }

    @PostMapping("/tickets/purge")
    public PurgeResultResponse purgeTickets(@Valid @RequestBody PurgeTicketsRequest request) {
        long deletedCount = service.purgeTickets(request.ticketIds());
        return new PurgeResultResponse(deletedCount);
    }

    @PatchMapping("/tickets/{ticketId}/assign")
    public TicketResponse assignTicket(
            @PathVariable("ticketId") Long ticketId,
            @Valid @RequestBody AssignTicketRequest request
    ) {
        return service.assignTicket(ticketId, request);
    }

    @PatchMapping("/tickets/{ticketId}/complete")
    public TicketResponse completeTicket(
            @PathVariable("ticketId") Long ticketId,
            @Valid @RequestBody CompleteTicketRequest request
    ) {
        return service.completeTicket(ticketId, request);
    }

    @PatchMapping("/tickets/{ticketId}/feedback")
    public TicketResponse submitTicketFeedback(
            @PathVariable("ticketId") Long ticketId,
            @Valid @RequestBody SubmitTicketFeedbackRequest request
    ) {
        return service.submitTicketFeedback(ticketId, request);
    }
}
