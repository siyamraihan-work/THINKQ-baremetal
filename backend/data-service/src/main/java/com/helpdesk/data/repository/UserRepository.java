package com.helpdesk.data.repository;

import com.helpdesk.data.model.Role;
import com.helpdesk.data.model.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<UserEntity, Long> {
    Optional<UserEntity> findByEmail(String email);
    Optional<UserEntity> findByOid(String oid);
    long countByRoleAndLoggedInTrue(Role role);
}
