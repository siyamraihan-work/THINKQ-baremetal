package com.helpdesk.data.repository;

import com.helpdesk.data.model.LocationEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LocationRepository extends JpaRepository<LocationEntity, Long> {
    boolean existsByRoomIdAndTableNumberIgnoreCase(Long roomId, String tableNumber);
}
