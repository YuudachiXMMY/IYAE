package com.iyae.service;

import com.iyae.entity.User;
import com.iyae.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public User findByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + email));
    }

    @Transactional(readOnly = true)
    /** Tombstone-aware: a deleted account must not resolve through a caller-supplied id. */
    public User findById(Long id) {
        return userRepository.findActiveById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));
    }

    @Transactional(readOnly = true)
    public User getCurrentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalStateException("No authenticated user in context");
        }
        return findByEmail(authentication.getName());
    }
}
