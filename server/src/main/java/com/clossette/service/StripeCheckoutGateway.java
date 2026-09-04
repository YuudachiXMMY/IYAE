package com.clossette.service;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;

public interface StripeCheckoutGateway {

    Session createSession(SessionCreateParams params, String apiKey) throws StripeException;

    Event constructEvent(String payload, String sigHeader, String endpointSecret)
            throws SignatureVerificationException;
}
