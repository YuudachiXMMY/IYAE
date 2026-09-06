package com.iyae.repository;

import com.iyae.entity.Post;
import com.iyae.entity.PostReport;
import com.iyae.entity.User;
import com.iyae.entity.enums.ReportStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PostReportRepository extends JpaRepository<PostReport, Long> {
    Page<PostReport> findByStatusOrderByCreatedAtDesc(ReportStatus status, Pageable pageable);
    boolean existsByPostAndReporter(Post post, User reporter);
    Optional<PostReport> findByPostAndReporter(Post post, User reporter);
}
