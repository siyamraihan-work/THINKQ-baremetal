package com.helpdesk.data.model;

import jakarta.persistence.*;

@Entity
@Table(name = "courses", uniqueConstraints = {
        @UniqueConstraint(name = "uk_course_subject_code", columnNames = {"subject", "code"})
})
public class CourseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 10)
    private String subject;

    @Column(nullable = false, length = 10)
    private String code;

    @Column(nullable = false, length = 120)
    private String title = "Untitled";

    @Column(nullable = false)
    private boolean active = true;

    public Long getId() { return id; }
    public String getSubject() { return subject; }
    public String getCode() { return code; }
    public String getTitle() { return title; }
    public boolean isActive() { return active; }

    public void setId(Long id) { this.id = id; }
    public void setSubject(String subject) { this.subject = subject; }
    public void setCode(String code) { this.code = code; }
    public void setTitle(String title) { this.title = title; }
    public void setActive(boolean active) { this.active = active; }

    @Transient
    public String getLabel() {
        return subject + " " + code;
    }
}
