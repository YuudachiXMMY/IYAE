package com.iyae.testsupport;

import com.iyae.entity.User;
import com.iyae.entity.enums.Role;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;

/**
 * Factory for creating Spring Security Authentication objects in unit tests.
 */
public final class MockAuthenticationFactory {

    private MockAuthenticationFactory() {}

    public static Authentication authenticatedBuyer() {
        return withUser(TestUsers.aBuyer());
    }

    public static Authentication authenticatedDesigner() {
        return withUser(TestUsers.aDesigner());
    }

    public static Authentication withUser(User user) {
        String authority = "ROLE_" + user.getRole().name();
        return new UsernamePasswordAuthenticationToken(
                user.getEmail(),
                null,
                List.of(new SimpleGrantedAuthority(authority))
        );
    }
}
