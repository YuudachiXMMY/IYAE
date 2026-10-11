package com.iyae.repository;

import com.iyae.entity.ChatSession;
import com.iyae.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChatSessionRepository extends JpaRepository<ChatSession, Long> {

    List<ChatSession> findByUserOrderByCreatedAtDesc(User user);

    Optional<ChatSession> findByIdAndUser(Long id, User user);

    // Account deletion (AccountDeletionService): removes this user's chat sessions.
    void deleteByUser(User user);

}
