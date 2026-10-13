package com.iyae.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * #12: an unbounded `size` let one request bypass pagination entirely — the community
 * endpoints had no clamp at all, so `?size=1000000` loaded and serialised every row.
 */
class PaginationTest {

    @Test
    void clampsAnOversizedRequestToTheMaximum() {
        assertThat(Pagination.clampSize(1_000_000)).isEqualTo(Pagination.MAX_PAGE_SIZE);
    }

    @Test
    void leavesAReasonableSizeAlone() {
        assertThat(Pagination.clampSize(20)).isEqualTo(20);
        assertThat(Pagination.clampSize(Pagination.MAX_PAGE_SIZE))
                .isEqualTo(Pagination.MAX_PAGE_SIZE);
    }

    @Test
    void fallsBackToTheDefaultForANonPositiveSize() {
        // PageRequest.of throws below 1, which surfaced as a 500 for `?size=0`.
        assertThat(Pagination.clampSize(0)).isEqualTo(Pagination.DEFAULT_PAGE_SIZE);
        assertThat(Pagination.clampSize(-5)).isEqualTo(Pagination.DEFAULT_PAGE_SIZE);
    }

    @Test
    void clampsANegativePageToZero() {
        assertThat(Pagination.clampPage(-1)).isZero();
        assertThat(Pagination.clampPage(0)).isZero();
        assertThat(Pagination.clampPage(3)).isEqualTo(3);
    }
}
