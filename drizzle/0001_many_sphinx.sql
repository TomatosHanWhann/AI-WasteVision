CREATE TABLE `analysis_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`model_version` text NOT NULL,
	`source` text NOT NULL,
	`image_key` text,
	`image_digest` text NOT NULL,
	`items` text NOT NULL,
	`expected_count` integer NOT NULL,
	`predicted_count` integer NOT NULL,
	`user_correct` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_items` text,
	`reviewed_count` integer,
	`delete_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_image_version` ON `analysis_feedback` (`image_digest`,`model_version`);--> statement-breakpoint
CREATE INDEX `feedback_review_status` ON `analysis_feedback` (`status`);