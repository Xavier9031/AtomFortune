-- Create users table
CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint

-- Insert the default user (backfill target)
INSERT INTO `users` (`id`, `name`) VALUES ('default-user', 'Default');
--> statement-breakpoint

-- Add userId to assets (nullable so existing rows are accepted)
ALTER TABLE `assets` ADD COLUMN `userId` text REFERENCES `users`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
UPDATE `assets` SET `userId` = 'default-user' WHERE `userId` IS NULL;
--> statement-breakpoint

-- Add userId to accounts
ALTER TABLE `accounts` ADD COLUMN `userId` text REFERENCES `users`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
UPDATE `accounts` SET `userId` = 'default-user' WHERE `userId` IS NULL;
--> statement-breakpoint

-- Add userId to holdings
ALTER TABLE `holdings` ADD COLUMN `userId` text REFERENCES `users`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
UPDATE `holdings` SET `userId` = 'default-user' WHERE `userId` IS NULL;
--> statement-breakpoint

-- Add userId to transactions
ALTER TABLE `transactions` ADD COLUMN `userId` text REFERENCES `users`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
UPDATE `transactions` SET `userId` = 'default-user' WHERE `userId` IS NULL;
--> statement-breakpoint

-- Add userId to snapshotItems
ALTER TABLE `snapshotItems` ADD COLUMN `userId` text REFERENCES `users`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
UPDATE `snapshotItems` SET `userId` = 'default-user' WHERE `userId` IS NULL;
--> statement-breakpoint

-- Add userId to recurringEntries
ALTER TABLE `recurringEntries` ADD COLUMN `userId` text REFERENCES `users`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
UPDATE `recurringEntries` SET `userId` = 'default-user' WHERE `userId` IS NULL;
