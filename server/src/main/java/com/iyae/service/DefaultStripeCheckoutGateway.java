package com.iyae.service;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.net.Webhook;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.stereotype.Component;

@Component
public class DefaultStripeCheckoutGateway implements StripeCheckoutGateway {

    @Override
    public Session createSession(SessionCreateParams params, String apiKey) throws StripeException {
        RequestOptions options = RequestOptions.builder()
                .setApiKey(apiKey)
                .build();
        return Session.create(params, options);
    }

    @Override
    public Event constructEvent(String payload, String sigHeader, String endpointSecret)
            throws SignatureVerificationException {
        return Webhook.constructEvent(payload, sigHeader, endpointSecret);
    }
}
