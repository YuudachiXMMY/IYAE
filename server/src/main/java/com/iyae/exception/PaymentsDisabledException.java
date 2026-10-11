package com.iyae.exception;

/**
 * Thrown when a checkout is attempted while payment collection is not wired.
 *
 * <p>The first production launch ships deliberately without payment. The danger that makes this
 * exception necessary is that "no Stripe key" used to mean "fall through to the dev stub", which
 * persisted the order as {@code PAID} and charged nobody. Refusing loudly with a 503 is what
 * "disabled" has to mean; a blank key is not a disable switch.
 */
public class PaymentsDisabledException extends RuntimeException {
    public PaymentsDisabledException(String message) {
        super(message);
    }
}
