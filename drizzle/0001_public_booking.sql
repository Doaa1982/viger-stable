CREATE TABLE IF NOT EXISTS `booking_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`slug` text NOT NULL,
	`display_name` text NOT NULL,
	`tagline` text,
	`about` text,
	`address` text,
	`map_url` text,
	`whatsapp` text,
	`email` text,
	`time_slots` text DEFAULT '07:00,08:30,10:00,15:30,17:00' NOT NULL,
	`closed_days` text DEFAULT '',
	`usd_rate` real DEFAULT 50 NOT NULL,
	`pay_on_arrival` integer DEFAULT true NOT NULL,
	`pay_by_transfer` integer DEFAULT true NOT NULL,
	`transfer_details` text,
	`is_published` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `booking_settings_owner_id_unique` ON `booking_settings` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `booking_settings_slug_unique` ON `booking_settings` (`slug`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `customer_bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`service_id` text,
	`reference` text NOT NULL,
	`service_name` text NOT NULL,
	`customer_name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`country` text,
	`guests` integer DEFAULT 1 NOT NULL,
	`date` integer NOT NULL,
	`experience` text,
	`notes` text,
	`payment_method` text DEFAULT 'ARRIVAL' NOT NULL,
	`status` text DEFAULT 'REQUESTED' NOT NULL,
	`total_egp` real NOT NULL,
	`total_usd` real,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `customer_bookings_reference_unique` ON `customer_bookings` (`reference`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `services` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT 'RIDE' NOT NULL,
	`description` text,
	`duration_min` integer,
	`price_egp` real NOT NULL,
	`price_usd` real,
	`price_unit` text DEFAULT 'PERSON' NOT NULL,
	`max_guests` integer DEFAULT 6 NOT NULL,
	`min_age` integer,
	`image_url` text,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
