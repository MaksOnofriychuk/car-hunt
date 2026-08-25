-- Вхідні Telegram (SPEC, «Пости з Telegram-груп»).
--
--   telegram_posts — переслані пости: одне авто, багато постів. Це наш архів
--     для telegram-карток: html_raw тут не існує, його роль виконує raw.
--   telegram_inbox — стейджинг апдейтів, щоб зібрати альбом з кількох
--     повідомлень. update_id первинним ключем — це ще й дедуп ретраїв Telegram.
--   tg_messages — які наші повідомлення про яке авто, щоб реплай ставав
--     коментарем.
--
-- Часткова унікальність по (chat_id, media_group_id) — бекстоп проти двох
-- обробників одного альбому.

CREATE TABLE "telegram_inbox" (
	"update_id" bigint PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"message_id" integer NOT NULL,
	"media_group_id" text,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "telegram_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"chat_id" text NOT NULL,
	"message_id" integer NOT NULL,
	"origin_message_ids" integer[] DEFAULT '{}' NOT NULL,
	"origin_title" text,
	"media_group_id" text,
	"text_hash" text,
	"forwarded_by" text NOT NULL,
	"posted_at" timestamp with time zone,
	"text" text,
	"parsed" jsonb,
	"raw" jsonb,
	"price_usd" integer,
	"price_uah" integer,
	"price_currency" text,
	"links" text[] DEFAULT '{}' NOT NULL,
	"photos_local" text[] DEFAULT '{}' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tg_messages" (
	"chat_id" text NOT NULL,
	"message_id" integer NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tg_messages_chat_id_message_id_pk" PRIMARY KEY("chat_id","message_id")
);
--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "price_from_post" integer;--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "telegram_username" text;--> statement-breakpoint
ALTER TABLE "telegram_posts" ADD CONSTRAINT "telegram_posts_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tg_messages" ADD CONSTRAINT "tg_messages_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "telegram_inbox_media_group_idx" ON "telegram_inbox" USING btree ("media_group_id","received_at");--> statement-breakpoint
CREATE INDEX "telegram_inbox_unprocessed_idx" ON "telegram_inbox" USING btree ("claimed_at") WHERE processed_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_posts_chat_message_idx" ON "telegram_posts" USING btree ("chat_id","message_id");--> statement-breakpoint
CREATE INDEX "telegram_posts_listing_id_posted_at_idx" ON "telegram_posts" USING btree ("listing_id","posted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_posts_media_group_idx" ON "telegram_posts" USING btree ("chat_id","media_group_id") WHERE media_group_id is not null;--> statement-breakpoint
CREATE INDEX "telegram_posts_text_hash_idx" ON "telegram_posts" USING btree ("text_hash");