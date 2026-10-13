package com.iyae.util;

/**
 * One place to clamp a client-supplied page size.
 *
 * <p>Three services had their own {@code Math.min(size, MAX_PAGE_SIZE)} and the community
 * endpoints had none at all, so {@code GET /api/posts?size=1000000} bypassed pagination
 * entirely in a single request — loading every post, every comment or every follow row into
 * memory and serialising it.
 *
 * <p>The lower bound matters as much as the upper one: {@code PageRequest.of} throws on a size
 * below 1, which surfaced as a 500 for {@code ?size=0}.
 */
public final class Pagination {

    public static final int MAX_PAGE_SIZE = 100;
    public static final int DEFAULT_PAGE_SIZE = 20;

    private Pagination() {}

    /** Clamps to [1, {@value #MAX_PAGE_SIZE}]; a non-positive size falls back to the default. */
    public static int clampSize(int size) {
        if (size < 1) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(size, MAX_PAGE_SIZE);
    }

    /** Clamps a page index to 0 or above — a negative index also throws in PageRequest.of. */
    public static int clampPage(int page) {
        return Math.max(page, 0);
    }
}
