-- One resale listing per owned unit.
--
-- The duplicate guard existed only in the read path: `listEligibleItems` filtered out units the
-- seller already had an active listing for, while `createListing` enforced nothing. A seller
-- posting straight to the API could create any number of listings for the single physical item
-- they own, and each one could be reserved and sold.
--
-- (original_order_id, product_id, size_label) is what identifies the owned unit, matching the
-- eligibility model: the order proves the purchase, and the product+size identifies what was
-- bought. A unique index makes the application guard race-proof rather than merely usual.

-- De-duplicate first, or the index cannot be created on an existing database.
-- Keep one row per unit, preferring a committed state over a withdrawn one and then the oldest:
--   SOLD (3) > RESERVED (2) > LISTED/DRAFT (1) > REMOVED (0)
-- so a real sale is never the row that gets deleted.
DELETE r FROM resale_listings r
JOIN (
  SELECT original_order_id, product_id, size_label,
         SUBSTRING_INDEX(
           GROUP_CONCAT(
             id
             ORDER BY CASE status
                        WHEN 'SOLD'     THEN 3
                        WHEN 'RESERVED' THEN 2
                        WHEN 'REMOVED'  THEN 0
                        ELSE 1
                      END DESC,
                      created_at ASC
           ), ',', 1
         ) AS keep_id
  FROM resale_listings
  GROUP BY original_order_id, product_id, size_label
  HAVING COUNT(*) > 1
) dup
  ON  r.original_order_id = dup.original_order_id
  AND r.product_id        = dup.product_id
  AND r.size_label        = dup.size_label
WHERE r.id <> CAST(dup.keep_id AS UNSIGNED);

CREATE UNIQUE INDEX uk_resale_owned_unit
  ON resale_listings (original_order_id, product_id, size_label);
