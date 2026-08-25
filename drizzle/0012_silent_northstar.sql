-- Робочі налаштування і сповіщення, по рядку на користувача.
-- Вигляд (тема, шрифт, розмір, щільність) сюди не йде — він у cookie.
CREATE TABLE "user_settings" (
	"author" text PRIMARY KEY NOT NULL,
	"call_followup_days" integer DEFAULT 3 NOT NULL,
	"long_standing_days" integer DEFAULT 60 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"default_sort" text DEFAULT 'contact' NOT NULL,
	"notify_new" boolean DEFAULT true NOT NULL,
	"notify_comment" boolean DEFAULT true NOT NULL,
	"notify_price" boolean DEFAULT true NOT NULL,
	"notify_stage" boolean DEFAULT true NOT NULL,
	"digest_at" text DEFAULT '08:00' NOT NULL,
	"quiet_from" text DEFAULT '22:00' NOT NULL,
	"quiet_to" text DEFAULT '08:00' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
