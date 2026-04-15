package com.helpdesk.data.model;

import jakarta.persistence.*;

@Entity
@Table(name = "locations")
public class LocationEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String label;

    @Column(nullable = false, length = 20)
    private String roomNumber;

    @ManyToOne
    @JoinColumn(name = "room_id")
    private RoomEntity room;

    @Column(nullable = false, length = 20)
    private String tableNumber;

    @Column(nullable = false)
    private boolean active = true;

    public Long getId() { return id; }
    public String getLabel() { return label; }
    public String getRoomNumber() { return roomNumber; }
    public RoomEntity getRoom() { return room; }
    public String getTableNumber() { return tableNumber; }
    public boolean isActive() { return active; }

    public void setId(Long id) { this.id = id; }
    public void setLabel(String label) { this.label = label; }
    public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }
    public void setRoom(RoomEntity room) { this.room = room; }
    public void setTableNumber(String tableNumber) { this.tableNumber = tableNumber; }
    public void setActive(boolean active) { this.active = active; }

    @Transient
    public Long getBuildingId() {
        return room != null && room.getBuilding() != null ? room.getBuilding().getId() : null;
    }

    @Transient
    public String getBuildingName() {
        if (room != null && room.getBuilding() != null && room.getBuilding().getName() != null && !room.getBuilding().getName().isBlank()) {
            return room.getBuilding().getName();
        }
        return label;
    }

    @Transient
    public Long getResolvedRoomId() {
        return room == null ? null : room.getId();
    }

    @Transient
    public String getResolvedRoomName() {
        if (room != null && room.getName() != null && !room.getName().isBlank()) {
            return room.getName();
        }
        return roomNumber;
    }

    @Transient
    public String getDisplayLabel() {
        return getBuildingName() + " / Room " + getResolvedRoomName() + " / Table " + tableNumber;
    }
}
