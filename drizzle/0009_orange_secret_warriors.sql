CREATE TABLE "exchange_rates" (
	"date" date PRIMARY KEY NOT NULL,
	"usd_uah" numeric(8, 4) NOT NULL,
	"source" text DEFAULT 'nbu' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
