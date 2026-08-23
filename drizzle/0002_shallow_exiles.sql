-- Багатоджерельні оголошення: auto_ria_id → (source, source_id).
-- Спершу додаємо колонки як nullable, переносимо наявні дані, і лише потім
-- ставимо NOT NULL — інакше ALTER впаде на вже наявних рядках.
ALTER TABLE "listings" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "source_id" text;--> statement-breakpoint
UPDATE "listings" SET "source" = 'autoria', "source_id" = "auto_ria_id"::text WHERE "source" IS NULL;--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "source" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "source_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "listings_source_source_id_idx" ON "listings" USING btree ("source","source_id");
