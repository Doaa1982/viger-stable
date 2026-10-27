CREATE TABLE IF NOT EXISTS `lesson_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`name` text NOT NULL,
	`lessons_total` integer NOT NULL,
	`price_egp` real NOT NULL,
	`paid` integer DEFAULT false NOT NULL,
	`purchased_at` integer NOT NULL,
	`expires_at` integer,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`package_id` text,
	`coach_staff_id` text,
	`horse_id` text,
	`date` integer NOT NULL,
	`duration_min` integer DEFAULT 45 NOT NULL,
	`status` text DEFAULT 'SCHEDULED' NOT NULL,
	`focus` text,
	`coach_notes` text,
	`rating` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`package_id`) REFERENCES `lesson_packages`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`coach_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`horse_id`) REFERENCES `horses`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`user_id` text,
	`role` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`status` text DEFAULT 'INVITED' NOT NULL,
	`invite_token` text,
	`invite_expires` integer,
	`staff_id` text,
	`client_id` text,
	`student_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `memberships_invite_token_unique` ON `memberships` (`invite_token`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`booking_id` text,
	`user_id` text,
	`author_name` text NOT NULL,
	`country` text,
	`rating` integer NOT NULL,
	`comment` text,
	`published` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`booking_id`) REFERENCES `customer_bookings`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `students` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`guardian_name` text,
	`birth_year` integer,
	`level` text DEFAULT 'BEGINNER' NOT NULL,
	`goals` text,
	`coach_staff_id` text,
	`notes` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`coach_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE set null
);
