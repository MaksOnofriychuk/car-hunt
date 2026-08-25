ALTER TABLE "sellers" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "source_user_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "sellers_source_user_id_idx" ON "sellers" USING btree ("source","source_user_id");--> statement-breakpoint
CREATE INDEX "sellers_phones_idx" ON "sellers" USING gin ("phones");