package com.helpdesk.data.model;

import jakarta.persistence.*;

@Entity
@Table(name = "buildings", uniqueConstraints = {
        @UniqueConstraint(name = "uk_buildings_name", columnNames = "name")
})
public class BuildingEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String name;

    public Long getId() { return id; }
    public String getName() { return name; }

    public void setId(Long id) { this.id = id; }
    public void setName(String name) { this.name = name; }
}
