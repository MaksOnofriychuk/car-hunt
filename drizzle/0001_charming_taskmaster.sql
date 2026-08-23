ALTER TABLE "listings" ADD COLUMN "html_raw" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "description_text" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "photos_local" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "listings_archive_backlog_idx" ON "listings" USING btree ("parsed_at") WHERE "listings"."archived_at" is null;