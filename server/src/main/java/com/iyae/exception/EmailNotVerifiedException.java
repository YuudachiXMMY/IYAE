package com.iyae.exception;

/**
 * Thrown when an action requires a verified email address but the account is unverified.
 * Mapped to HTTP 403 by {@code GlobalExceptionHandler} (distinct from the 400 that
 * {@code IllegalArgumentException} yields) so callers can distinguish "not verified"
 * from generic bad input.
 */
public class EmailNotVerifiedException extends RuntimeException {
    public EmailNotVerifiedException(String message) {
        super(message);
    }
}
