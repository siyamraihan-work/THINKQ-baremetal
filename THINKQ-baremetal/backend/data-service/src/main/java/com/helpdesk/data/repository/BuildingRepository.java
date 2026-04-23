package com.helpdesk.data.repository;

import com.helpdesk.data.model.BuildingEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BuildingRepository extends JpaRepository<BuildingEntity, Long> {
    boolean existsByNameIgnoreCase(String name);
}
