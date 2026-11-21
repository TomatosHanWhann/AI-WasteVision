CREATE TABLE `sorting_events` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`image_digest` text NOT NULL,
	`material` text NOT NULL,
	`condition` text NOT NULL,
	`model_version` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_image_once` ON `sorting_events` (`member_id`,`image_digest`);--> statement-breakpoint
CREATE INDEX `events_member_date` ON `sorting_events` (`member_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `request_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`suffix` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `card_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_expiry` ON `card_sessions` (`expires_at`);