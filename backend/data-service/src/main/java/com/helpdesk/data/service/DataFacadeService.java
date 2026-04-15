package com.helpdesk.data.service;

import com.helpdesk.data.dto.*;
import com.helpdesk.data.model.*;
import com.helpdesk.data.repository.*;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;

@Service
public class DataFacadeService {

    private final UserRepository userRepository;
    private final SessionRecordRepository sessionRecordRepository;
    private final CourseRepository courseRepository;
    private final BuildingRepository buildingRepository;
    private final RoomRepository roomRepository;
    private final LocationRepository locationRepository;
    private final TicketRepository ticketRepository;

    public DataFacadeService(UserRepository userRepository,
                             SessionRecordRepository sessionRecordRepository,
                             CourseRepository courseRepository,
                             BuildingRepository buildingRepository,
                             RoomRepository roomRepository,
                             LocationRepository locationRepository,
                             TicketRepository ticketRepository) {
        this.userRepository = userRepository;
        this.sessionRecordRepository = sessionRecordRepository;
        this.courseRepository = courseRepository;
        this.buildingRepository = buildingRepository;
        this.roomRepository = roomRepository;
        this.locationRepository = locationRepository;
        this.ticketRepository = ticketRepository;
    }

    @Transactional
    public UserResponse upsertSamlUser(UpsertSamlUserRequest request) {
        UserEntity user = userRepository.findByOid(request.oid())
                .orElseGet(UserEntity::new);

        user.setOid(request.oid());
        user.setEmail(request.email());
        user.setName(request.name());
        if (user.getRole() == null) {
            user.setRole(Role.STUDENT);
        }

        user = userRepository.save(user);
        return toUserResponse(user);
    }

    public UserResponse getUser(Long id) {
        return toUserResponse(findUser(id));
    }

    public List<UserResponse> getUsers() {
        return userRepository.findAll().stream()
                .map(this::toUserResponse)
                .sorted((left, right) -> left.name().compareToIgnoreCase(right.name()))
                .toList();
    }

    @Transactional
    public UserResponse updateRole(Long id, UpdateRoleRequest request) {
        UserEntity user = findUser(id);
        user.setRole(request.role());
        return toUserResponse(userRepository.save(user));
    }

    @Transactional
    public void upsertSession(SessionUpsertRequest request) {
        UserEntity user = findUser(request.userId());

        SessionRecordEntity session = sessionRecordRepository.findBySessionId(request.sessionId())
                .orElseGet(SessionRecordEntity::new);

        session.setSessionId(request.sessionId());
        session.setUser(user);
        session.setLoggedIn(request.loggedIn());
        session.setLastSeenAt(OffsetDateTime.now());

        user.setLoggedIn(request.loggedIn());

        sessionRecordRepository.save(session);
        userRepository.save(user);
    }

    @Transactional
    public void deleteSession(String sessionId) {
        sessionRecordRepository.findBySessionId(sessionId).ifPresent(session -> {
            UserEntity user = session.getUser();
            sessionRecordRepository.delete(session);
            long remainingSessions = sessionRecordRepository.countByUserIdAndLoggedInTrue(user.getId());
            user.setLoggedIn(remainingSessions > 0);
            userRepository.save(user);
        });
    }

    @Transactional
    public void touchSession(String sessionId) {
        sessionRecordRepository.findBySessionId(sessionId).ifPresent(session -> {
            session.setLoggedIn(true);
            session.setLastSeenAt(OffsetDateTime.now());
            sessionRecordRepository.save(session);

            UserEntity user = session.getUser();
            if (!user.isLoggedIn()) {
                user.setLoggedIn(true);
                userRepository.save(user);
            }
        });
    }

    public List<CourseResponse> getCourses() {
        return courseRepository.findAll().stream().map(this::toCourseResponse).toList();
    }

    @Transactional
    public CourseResponse createCourse(CreateCourseRequest request) {
        CourseEntity course = new CourseEntity();
        course.setSubject(request.subject().toUpperCase());
        course.setCode(request.code());
        course.setTitle(request.title() == null || request.title().isBlank() ? "Untitled" : request.title().trim());
        course.setActive(request.active() == null || request.active());
        return toCourseResponse(courseRepository.save(course));
    }

    @Transactional
    public CourseResponse updateCourseStatus(Long id, UpdateCourseStatusRequest request) {
        CourseEntity course = findCourse(id);
        course.setActive(Boolean.TRUE.equals(request.active()));
        return toCourseResponse(courseRepository.save(course));
    }

    @Transactional
    public void deleteCourse(Long id) {
        courseRepository.deleteById(id);
    }

    public List<BuildingResponse> getBuildings() {
        return buildingRepository.findAll().stream()
                .map(this::toBuildingResponse)
                .sorted((left, right) -> left.name().compareToIgnoreCase(right.name()))
                .toList();
    }

    @Transactional
    public BuildingResponse createBuilding(CreateBuildingRequest request) {
        String normalizedName = normalizeName(request.name());
        if (buildingRepository.existsByNameIgnoreCase(normalizedName)) {
            throw new IllegalStateException("Building already exists");
        }

        BuildingEntity building = new BuildingEntity();
        building.setName(normalizedName);
        return toBuildingResponse(buildingRepository.save(building));
    }

    public List<RoomResponse> getRooms() {
        return roomRepository.findAll().stream()
                .map(this::toRoomResponse)
                .sorted((left, right) -> left.displayLabel().compareToIgnoreCase(right.displayLabel()))
                .toList();
    }

    @Transactional
    public RoomResponse createRoom(CreateRoomRequest request) {
        BuildingEntity building = findBuilding(request.buildingId());
        String normalizedName = normalizeName(request.name());

        if (roomRepository.existsByBuildingIdAndNameIgnoreCase(building.getId(), normalizedName)) {
            throw new IllegalStateException("Room already exists in this building");
        }

        RoomEntity room = new RoomEntity();
        room.setBuilding(building);
        room.setName(normalizedName);
        return toRoomResponse(roomRepository.save(room));
    }

    public List<LocationResponse> getLocations() {
        return locationRepository.findAll().stream()
                .filter(location -> location.getRoom() != null)
                .map(this::toLocationResponse)
                .sorted((left, right) -> left.displayLabel().compareToIgnoreCase(right.displayLabel()))
                .toList();
    }

    @Transactional
    public LocationResponse createLocation(CreateLocationRequest request) {
        RoomEntity room = findRoom(request.roomId());
        String normalizedTableNumber = normalizeName(request.tableNumber());

        if (locationRepository.existsByRoomIdAndTableNumberIgnoreCase(room.getId(), normalizedTableNumber)) {
            throw new IllegalStateException("Table already exists in this room");
        }

        LocationEntity location = new LocationEntity();
        location.setRoom(room);
        location.setLabel(room.getBuilding().getName());
        location.setRoomNumber(room.getName());
        location.setTableNumber(normalizedTableNumber);
        location.setActive(request.active() == null || request.active());
        return toLocationResponse(locationRepository.save(location));
    }

    @Transactional
    public LocationResponse updateLocationStatus(Long id, UpdateLocationStatusRequest request) {
        LocationEntity location = findLocation(id);
        location.setActive(Boolean.TRUE.equals(request.active()));
        return toLocationResponse(locationRepository.save(location));
    }

    @Transactional
    public void deleteLocation(Long id) {
        locationRepository.deleteById(id);
    }

    public StudentDashboardLookupsResponse getStudentDashboardLookups() {
        List<CourseResponse> courses = courseRepository.findAll().stream()
                .filter(CourseEntity::isActive)
                .map(this::toCourseResponse)
                .toList();

        List<LocationResponse> locations = locationRepository.findAll().stream()
                .filter(LocationEntity::isActive)
                .filter(location -> location.getRoom() != null)
                .map(this::toLocationResponse)
                .sorted((left, right) -> left.displayLabel().compareToIgnoreCase(right.displayLabel()))
                .toList();

        return new StudentDashboardLookupsResponse(courses, locations);
    }

    public QueueMetricsResponse getQueueMetrics() {
        OffsetDateTime cutoff = OffsetDateTime.now().minusMinutes(5);
        long onlineTeacherCount = sessionRecordRepository.countDistinctActiveUsersByRoleSince(Role.TEACHER, cutoff);
        long queueCount = ticketRepository.findByStatusOrderByCreatedAtAsc(TicketStatus.IN_QUEUE).size();

        long estimatedWaitMinutes;
        if (onlineTeacherCount <= 0) {
            estimatedWaitMinutes = 0;
        } else {
            long ratio = (long) Math.ceil((double) Math.max(queueCount, 1L) / (double) onlineTeacherCount);
            estimatedWaitMinutes = Math.max(2L, ratio * 2L);
        }

        return new QueueMetricsResponse(onlineTeacherCount, queueCount, estimatedWaitMinutes);
    }

    @Transactional
    public TicketResponse createTicket(CreateTicketRequest request) {
        CourseEntity course = findCourse(request.courseId());
        if (!course.isActive()) {
            throw new IllegalStateException("Selected subject is inactive");
        }

        LocationEntity location = findLocation(request.locationId());
        if (!location.isActive() || location.getRoom() == null) {
            throw new IllegalStateException("Selected support table is unavailable");
        }

        TicketEntity ticket = new TicketEntity();
        ticket.setStudent(findUser(request.studentId()));
        ticket.setCourse(course);
        ticket.setLocation(location);
        ticket.setIssueType(request.issueType());
        ticket.setNotes(request.notes() == null ? "" : request.notes().trim());
        ticket.setPreferredContact(request.preferredContact() == null ? PreferredContact.IN_PERSON : request.preferredContact());
        ticket.setStatus(TicketStatus.IN_QUEUE);

        return toTicketResponse(ticketRepository.save(ticket));
    }

    public List<TicketResponse> getTicketsByStatus(TicketStatus status) {
        return ticketRepository.findByStatusOrderByCreatedAtAsc(status).stream().map(this::toTicketResponse).toList();
    }

    public List<TicketResponse> getTicketsByStudent(Long studentId) {
        return ticketRepository.findByStudentIdOrderByCreatedAtDesc(studentId).stream().map(this::toTicketResponse).toList();
    }

    public List<TicketResponse> getTicketsByTeacher(Long teacherId) {
        return ticketRepository.findByTeacherIdOrderByCreatedAtDesc(teacherId).stream().map(this::toTicketResponse).toList();
    }

    public List<TicketAnalyticsRow> getTicketAnalyticsRows() {
        return ticketRepository.findAllByOrderByCreatedAtDesc().stream().map(ticket -> {
            Long waitTimeSeconds = null;
            Long completionTimeSeconds = null;

            if (ticket.getAcceptedAt() != null) {
                waitTimeSeconds = Duration.between(ticket.getCreatedAt(), ticket.getAcceptedAt()).getSeconds();
            }
            if (ticket.getAcceptedAt() != null && ticket.getCompletedAt() != null) {
                completionTimeSeconds = Duration.between(ticket.getAcceptedAt(), ticket.getCompletedAt()).getSeconds();
            }

            return new TicketAnalyticsRow(
                    ticket.getId(),
                    ticket.getLocation().getDisplayLabel(),
                    ticket.getStudent().getName(),
                    ticket.getCourse().getSubject() + ticket.getCourse().getCode(),
                    ticket.getStatus().name(),
                    ticket.getRating(),
                    ticket.getTeacher() == null ? null : ticket.getTeacher().getName(),
                    ticket.getFeedbackComment(),
                    ticket.getCreatedAt(),
                    ticket.getCreatedAt(),
                    ticket.getAcceptedAt(),
                    ticket.getCompletedAt(),
                    waitTimeSeconds,
                    completionTimeSeconds
            );
        }).toList();
    }

    @Transactional
    public TicketResponse assignTicket(Long ticketId, AssignTicketRequest request) {
        TicketEntity ticket = findTicket(ticketId);
        if (ticket.getStatus() != TicketStatus.IN_QUEUE) {
            throw new IllegalStateException("Only in-queue tickets can be assigned");
        }

        UserEntity teacher = findUser(request.teacherId());
        ticket.setTeacher(teacher);
        ticket.setStatus(TicketStatus.ASSIGNED);
        ticket.setAcceptedAt(OffsetDateTime.now());

        return toTicketResponse(ticketRepository.save(ticket));
    }

    @Transactional
    public TicketResponse completeTicket(Long ticketId, CompleteTicketRequest request) {
        TicketEntity ticket = findTicket(ticketId);
        if (ticket.getStatus() != TicketStatus.ASSIGNED) {
            throw new IllegalStateException("Only assigned tickets can be completed");
        }

        if (ticket.getTeacher() == null || !ticket.getTeacher().getId().equals(request.teacherId())) {
            throw new IllegalStateException("Only the assigned teacher can complete this ticket");
        }

        ticket.setStatus(TicketStatus.COMPLETED);
        ticket.setResolutionNotes(request.resolutionNotes());
        ticket.setCompletedAt(OffsetDateTime.now());

        return toTicketResponse(ticketRepository.save(ticket));
    }

    @Transactional
    public long purgeTickets(List<Long> ticketIds) {
        if (ticketIds == null || ticketIds.isEmpty()) {
            return 0;
        }
        long count = ticketIds.size();
        ticketRepository.deleteAllByIdInBatch(ticketIds);
        return count;
    }

    @Transactional
    public TicketResponse submitTicketFeedback(Long ticketId, SubmitTicketFeedbackRequest request) {
        TicketEntity ticket = findTicket(ticketId);
        if (!ticket.getStudent().getId().equals(request.studentId())) {
            throw new IllegalStateException("Only the owning student can submit feedback");
        }
        if (ticket.getStatus() != TicketStatus.COMPLETED) {
            throw new IllegalStateException("Feedback can only be submitted for completed tickets");
        }

        ticket.setRating(request.rating());
        ticket.setFeedbackComment(request.comment());
        return toTicketResponse(ticketRepository.save(ticket));
    }

    private UserEntity findUser(Long id) {
        return userRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("User not found"));
    }

    private CourseEntity findCourse(Long id) {
        return courseRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Course not found"));
    }

    private BuildingEntity findBuilding(Long id) {
        return buildingRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Building not found"));
    }

    private RoomEntity findRoom(Long id) {
        return roomRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Room not found"));
    }

    private LocationEntity findLocation(Long id) {
        return locationRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Location not found"));
    }

    private TicketEntity findTicket(Long id) {
        return ticketRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Ticket not found"));
    }

    private UserResponse toUserResponse(UserEntity user) {
        return new UserResponse(user.getId(), user.getName(), user.getEmail(), user.getOid(), user.getRole(), user.isLoggedIn());
    }

    private CourseResponse toCourseResponse(CourseEntity course) {
        return new CourseResponse(course.getId(), course.getSubject(), course.getCode(), course.getTitle(), course.isActive(), course.getLabel());
    }

    private BuildingResponse toBuildingResponse(BuildingEntity building) {
        return new BuildingResponse(building.getId(), building.getName());
    }

    private RoomResponse toRoomResponse(RoomEntity room) {
        return new RoomResponse(room.getId(), room.getBuilding().getId(), room.getBuilding().getName(), room.getName(), room.getDisplayLabel());
    }

    private LocationResponse toLocationResponse(LocationEntity location) {
        return new LocationResponse(
                location.getId(),
                location.getBuildingId(),
                location.getBuildingName(),
                location.getResolvedRoomId(),
                location.getResolvedRoomName(),
                location.getTableNumber(),
                location.isActive(),
                location.getDisplayLabel()
        );
    }

    private TicketResponse toTicketResponse(TicketEntity ticket) {
        return new TicketResponse(
                ticket.getId(),
                ticket.getStudent().getId(),
                ticket.getStudent().getName(),
                ticket.getTeacher() == null ? null : ticket.getTeacher().getId(),
                ticket.getTeacher() == null ? null : ticket.getTeacher().getName(),
                ticket.getCourse().getId(),
                ticket.getCourse().getLabel(),
                ticket.getLocation().getId(),
                ticket.getLocation().getDisplayLabel(),
                ticket.getStatus(),
                ticket.getIssueType(),
                ticket.getPreferredContact(),
                ticket.getNotes(),
                ticket.getResolutionNotes(),
                ticket.getRating(),
                ticket.getFeedbackComment(),
                ticket.getCreatedAt(),
                ticket.getAcceptedAt(),
                ticket.getCompletedAt()
        );
    }

    private String normalizeName(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }
}
