CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`institution` text,
	`accountType` text NOT NULL,
	`note` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`assetClass` text NOT NULL,
	`category` text NOT NULL,
	`subKind` text NOT NULL,
	`symbol` text,
	`market` text,
	`currencyCode` text NOT NULL,
	`pricingMode` text NOT NULL,
	`unit` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fxRates` (
	`fromCurrency` text NOT NULL,
	`toCurrency` text NOT NULL,
	`rateDate` text NOT NULL,
	`rate` numeric NOT NULL,
	`source` text NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`fromCurrency`, `rateDate`, `toCurrency`)
);
--> statement-breakpoint
CREATE TABLE `holdings` (
	`assetId` text NOT NULL,
	`accountId` text NOT NULL,
	`quantity` numeric NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`accountId`, `assetId`),
	FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `prices` (
	`assetId` text NOT NULL,
	`priceDate` text NOT NULL,
	`price` numeric NOT NULL,
	`source` text NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`assetId`, `priceDate`),
	FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recurringEntries` (
	`id` text PRIMARY KEY NOT NULL,
	`assetId` text,
	`accountId` text,
	`type` text NOT NULL,
	`amount` numeric NOT NULL,
	`currencyCode` text DEFAULT 'TWD' NOT NULL,
	`dayOfMonth` integer DEFAULT 1 NOT NULL,
	`label` text,
	`effectiveFrom` text NOT NULL,
	`effectiveTo` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `snapshotItems` (
	`snapshotDate` text NOT NULL,
	`assetId` text NOT NULL,
	`accountId` text NOT NULL,
	`quantity` numeric NOT NULL,
	`price` numeric NOT NULL,
	`fxRate` numeric NOT NULL,
	`valueInBase` numeric NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`accountId`, `assetId`, `snapshotDate`),
	FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tickers` (
	`symbol` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`exchange` text,
	`country` text,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`assetId` text NOT NULL,
	`accountId` text NOT NULL,
	`txnType` text NOT NULL,
	`quantity` numeric NOT NULL,
	`txnDate` text NOT NULL,
	`note` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
