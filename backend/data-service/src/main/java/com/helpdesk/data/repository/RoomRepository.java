package com.helpdesk.data.repository;

import com.helpdesk.data.model.RoomEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomRepository extends JpaRepository<RoomEntity, Long> {
    boolean existsByBuildingIdAndNameIgnoreCase(Long buildingId, String name);
}
