package com.iyae.testsupport;

import com.iyae.entity.User;
import com.iyae.entity.enums.Role;

/**
 * Pre-built User fixtures for unit tests.
 */
public final class TestUsers {

    private TestUsers() {}

    public static User aBuyer() {
        return User.builder()
                .id(1L)
                .email("buyer@test.com")
                .passwordHash("$2a$10$hashedpassword")
                .name("Test Buyer")
                .username("testbuyer")
                .role(Role.BUYER)
                .emailVerified(true)
                .build();
    }

    public static User aDesigner() {
        return User.builder()
                .id(2L)
                .email("designer@test.com")
                .passwordHash("$2a$10$hashedpassword")
                .name("Test Designer")
                .username("testdesigner")
                .role(Role.DESIGNER)
                .emailVerified(true)
                .build();
    }
}
