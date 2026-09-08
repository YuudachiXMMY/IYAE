-- Fix schema-validation mismatch: V16 created resale_listings.currency as CHAR(3),
-- but the JPA entity (@Column(length = 3) String) expects VARCHAR(3), so Hibernate
-- ddl-auto=validate refused to build the SessionFactory and the server failed to boot.
-- Align the column with the VARCHAR(3) convention used everywhere else (see V1 baseline).
ALTER TABLE resale_listings
    MODIFY currency VARCHAR(3) NOT NULL DEFAULT 'CAD';
