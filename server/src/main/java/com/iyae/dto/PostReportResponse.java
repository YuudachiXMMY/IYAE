package com.iyae.dto;

import com.iyae.entity.PostReport;
import com.iyae.entity.enums.ReportStatus;

import java.time.Instant;

/** Report row for the admin moderation queue. */
public record PostReportResponse(
    Long id,
    Long postId,
    Long reporterId,
    String reporterUsername,
    String reason,
    ReportStatus status,
    Instant createdAt
) {
    public static PostReportResponse from(PostReport report) {
        String reporterUsername = report.getReporter().getUsername() != null
            ? report.getReporter().getUsername()
            : report.getReporter().getEmail();
        return new PostReportResponse(
            report.getId(),
            report.getPost().getId(),
            report.getReporter().getId(),
            reporterUsername,
            report.getReason(),
            report.getStatus(),
            report.getCreatedAt()
        );
    }
}
