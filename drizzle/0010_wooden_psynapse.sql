-- Ручне заповнення карток. manual_fields — перелік колонок, які людина виправила
-- руками: парсер і cron їх більше не перезаписують. photos_manual тримається
-- окремо від photos_local, бо перерозбір чистить той масив за списком photos.
ALTER TABLE "listings" ADD COLUMN "manual_fields" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "photos_manual" text[] DEFAULT '{}' NOT NULL;