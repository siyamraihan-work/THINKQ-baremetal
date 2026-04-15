package com.helpdesk.data.config;

import com.helpdesk.data.model.Role;
import com.helpdesk.data.model.UserEntity;
import com.helpdesk.data.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DevSeedConfig {

    @Bean
    CommandLineRunner seedDevUsers(
            UserRepository userRepository,
            @Value("${DEV_AUTH_ENABLED:false}") boolean devAuthEnabled,
            @Value("${DEV_ADMIN_NAME:ThinkQ Admin}") String adminName,
            @Value("${DEV_ADMIN_EMAIL:admin@test.local}") String adminEmail,
            @Value("${DEV_ADMIN_OID:dev-admin-oid}") String adminOid,
            @Value("${DEV_TEACHER_NAME:ThinkQ Teacher}") String teacherName,
            @Value("${DEV_TEACHER_EMAIL:teacher@test.local}") String teacherEmail,
            @Value("${DEV_TEACHER_OID:dev-teacher-oid}") String teacherOid,
            @Value("${DEV_STUDENT_NAME:ThinkQ Student}") String studentName,
            @Value("${DEV_STUDENT_EMAIL:student@test.local}") String studentEmail,
            @Value("${DEV_STUDENT_OID:dev-student-oid}") String studentOid
    ) {
        return args -> {
            if (!devAuthEnabled) {
                return;
            }

            upsertUser(userRepository, adminName, adminEmail, adminOid, Role.ADMIN);
            upsertUser(userRepository, teacherName, teacherEmail, teacherOid, Role.TEACHER);
            upsertUser(userRepository, studentName, studentEmail, studentOid, Role.STUDENT);
        };
    }

    private void upsertUser(UserRepository userRepository, String name, String email, String oid, Role role) {
        UserEntity user = userRepository.findByOid(oid).orElseGet(UserEntity::new);
        user.setName(name);
        user.setEmail(email);
        user.setOid(oid);
        user.setRole(role);
        userRepository.save(user);
    }
}