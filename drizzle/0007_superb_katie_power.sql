ALTER TABLE "listings" ADD COLUMN "vin" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "fuel_type" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "transmission" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "color" text;--> statement-breakpoint
-- Дані вже лежать у snapshot_raw.ldJson з перших парсингів — переносимо в колонки,
-- щоб не чекати наступного прогону cron. Блок Vehicle у ld+json тільки один.
UPDATE "listings" SET
  "vin"          = coalesce("listings"."vin",          v."vin"),
  "fuel_type"    = coalesce("listings"."fuel_type",    v."fuel_type"),
  "transmission" = coalesce("listings"."transmission", v."transmission"),
  "color"        = coalesce("listings"."color",        v."color")
FROM (
  SELECT
    l."id",
    nullif(b->>'vehicleIdentificationNumber', '') AS "vin",
    nullif(coalesce(b->>'fuelType', b#>>'{vehicleEngine,fuelType}'), '') AS "fuel_type",
    nullif(b->>'vehicleTransmission', '') AS "transmission",
    nullif(b->>'color', '') AS "color"
  FROM "listings" l
  CROSS JOIN LATERAL jsonb_array_elements(l."snapshot_raw"->'ldJson') AS b
  WHERE jsonb_typeof(l."snapshot_raw"->'ldJson') = 'array'
    AND b->>'@type' = 'Vehicle'
    AND b ? 'name'
) v
WHERE "listings"."id" = v."id";
