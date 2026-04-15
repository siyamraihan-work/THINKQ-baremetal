package com.helpdesk.data.model;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "tickets", indexes = {
        @Index(name = "idx_tickets_status", columnList = "status"),
        @Index(name = "idx_tickets_student", columnList = "student_id"),
        @Index(name = "idx_tickets_teacher", columnList = "teacher_id")
})
public class TicketEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "student_id")
    private UserEntity student;

    @ManyToOne
    @JoinColumn(name = "teacher_id")
    private UserEntity teacher;

    @ManyToOne(optional = false)
    @JoinColumn(name = "course_id")
    private CourseEntity course;

    @ManyToOne(optional = false)
    @JoinColumn(name = "location_id")
    private LocationEntity location;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TicketStatus status = TicketStatus.IN_QUEUE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private IssueType issueType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PreferredContact preferredContact = PreferredContact.IN_PERSON;

    @Column(nullable = false, length = 1000)
    private String notes;

    @Column(length = 1000)
    private String resolutionNotes;

    @Column(length = 500)
    private String feedbackComment;

    private Integer rating;

    @Column(nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    private OffsetDateTime acceptedAt;

    private OffsetDateTime completedAt;

    @PreUpdate
    public void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public UserEntity getStudent() { return student; }
    public UserEntity getTeacher() { return teacher; }
    public CourseEntity getCourse() { return course; }
    public LocationEntity getLocation() { return location; }
    public TicketStatus getStatus() { return status; }
    public IssueType getIssueType() { return issueType; }
    public PreferredContact getPreferredContact() { return preferredContact; }
    public String getNotes() { return notes; }
    public String getResolutionNotes() { return resolutionNotes; }
    public String getFeedbackComment() { return feedbackComment; }
    public Integer getRating() { return rating; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public OffsetDateTime getAcceptedAt() { return acceptedAt; }
    public OffsetDateTime getCompletedAt() { return completedAt; }

    public void setId(Long id) { this.id = id; }
    public void setStudent(UserEntity student) { this.student = student; }
    public void setTeacher(UserEntity teacher) { this.teacher = teacher; }
    public void setCourse(CourseEntity course) { this.course = course; }
    public void setLocation(LocationEntity location) { this.location = location; }
    public void setStatus(TicketStatus status) { this.status = status; }
    public void setIssueType(IssueType issueType) { this.issueType = issueType; }
    public void setPreferredContact(PreferredContact preferredContact) { this.preferredContact = preferredContact; }
    public void setNotes(String notes) { this.notes = notes; }
    public void setResolutionNotes(String resolutionNotes) { this.resolutionNotes = resolutionNotes; }
    public void setFeedbackComment(String feedbackComment) { this.feedbackComment = feedbackComment; }
    public void setRating(Integer rating) { this.rating = rating; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
    public void setAcceptedAt(OffsetDateTime acceptedAt) { this.acceptedAt = acceptedAt; }
    public void setCompletedAt(OffsetDateTime completedAt) { this.completedAt = completedAt; }
}
