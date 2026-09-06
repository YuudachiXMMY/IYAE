package com.iyae.dto;

/** Real follower/following counts for a user (derived COUNT queries — never denormalized). */
public record FollowCountsResponse(
    long followers,
    long following
) {}
