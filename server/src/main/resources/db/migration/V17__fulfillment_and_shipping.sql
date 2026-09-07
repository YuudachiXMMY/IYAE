-- Phase 8: Toronto Physical Touchpoints + Shipping (lightweight v1). Mirrors V16 DDL style.
-- Buyers choose in-city Toronto PICKUP (a seeded location) or SHIP (a flat-rate carrier) at
-- checkout. The chosen fulfillment + fee are recorded on the order. No live rates / labels / tracking.
CREATE TABLE pickup_locations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    address_line VARCHAR(255) NOT NULL,
    city VARCHAR(80) NOT NULL DEFAULT 'Toronto',
    instructions VARCHAR(500) NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO pickup_locations (name, address_line, city, instructions) VALUES
  ('IYAE Studio — Queen West', '401 Queen St W', 'Toronto', 'Ring the studio buzzer; usually ready within 24h.'),
  ('Inland Market Pop-up', '213 Sterling Rd', 'Toronto', 'Weekend pickup at the IYAE booth.');

-- Record the buyer's fulfillment choice + fee on each order (nullable carrier/pickup are mutually
-- exclusive; legacy rows default to SHIP with a zero fee so Hibernate `validate` passes).
ALTER TABLE orders
    ADD COLUMN fulfillment_method VARCHAR(16) NOT NULL DEFAULT 'SHIP',
    ADD COLUMN pickup_location_id BIGINT NULL,
    ADD COLUMN shipping_carrier VARCHAR(24) NULL,
    ADD COLUMN shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    ADD CONSTRAINT fk_orders_pickup_location FOREIGN KEY (pickup_location_id)
        REFERENCES pickup_locations(id) ON DELETE SET NULL;
