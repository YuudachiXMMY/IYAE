ALTER TABLE orders
    ADD COLUMN stripe_session_id      VARCHAR(255) NULL,
    ADD COLUMN stripe_payment_intent  VARCHAR(255) NULL,
    ADD COLUMN payment_status         VARCHAR(50)  NOT NULL DEFAULT 'PENDING';
