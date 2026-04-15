package com.helpdesk.data.model;

import jakarta.persistence.*;

@Entity
@Table(name = "rooms", uniqueConstraints = {
        @UniqueConstraint(name = "uk_rooms_building_name", columnNames = {"building_id", "name"})
})
public class RoomEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "building_id")
    private BuildingEntity building;

    @Column(nullable = false, length = 60)
    private String name;

    public Long getId() { return id; }
    public BuildingEntity getBuilding() { return building; }
    public String getName() { return name; }

    public void setId(Long id) { this.id = id; }
    public void setBuilding(BuildingEntity building) { this.building = building; }
    public void setName(String name) { this.name = name; }

    @Transient
    public String getDisplayLabel() {
        return building.getName() + " / Room " + name;
    }
}
