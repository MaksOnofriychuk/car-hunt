-- Збережені набори фільтрів (свої; три вбудовані живуть константами в коді)
-- і індекси під фільтри списку: досі жодного, окрім next_contact_at і status.
CREATE TABLE "filter_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author" text NOT NULL,
	"name" text NOT NULL,
	"query" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "filter_presets_created_at_idx" ON "filter_presets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "listings_archived_next_contact_at_idx" ON "listings" USING btree ("archived","next_contact_at");--> statement-breakpoint
CREATE INDEX "listings_price_usd_idx" ON "listings" USING btree ("price_usd");--> statement-breakpoint
CREATE INDEX "listings_year_idx" ON "listings" USING btree ("year");--> statement-breakpoint
CREATE INDEX "listings_published_at_idx" ON "listings" USING btree ("published_at");