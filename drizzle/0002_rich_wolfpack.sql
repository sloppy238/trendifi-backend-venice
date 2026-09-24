CREATE TABLE `analyticsEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventName` varchar(64) NOT NULL,
	`signalId` varchar(32),
	`sessionId` varchar(128),
	`path` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analyticsEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduledJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobKey` varchar(64) NOT NULL,
	`taskUid` varchar(65),
	`lastRunAt` timestamp,
	`enabled` int NOT NULL DEFAULT 1,
	CONSTRAINT `scheduledJobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `scheduledJobs_jobKey_unique` UNIQUE(`jobKey`),
	CONSTRAINT `scheduledJobs_taskUid_unique` UNIQUE(`taskUid`)
);
--> statement-breakpoint
CREATE TABLE `signalResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`signalId` varchar(32) NOT NULL,
	`currentPrice` double,
	`returnCurrent` double,
	`price7d` double,
	`return7d` double,
	`price30d` double,
	`return30d` double,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `signalResults_id` PRIMARY KEY(`id`),
	CONSTRAINT `signalResults_signalId_unique` UNIQUE(`signalId`)
);
--> statement-breakpoint
CREATE TABLE `signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`signalId` varchar(32) NOT NULL,
	`ticker` varchar(16) NOT NULL,
	`signalType` enum('bullish','bearish') NOT NULL,
	`createdAt` timestamp NOT NULL,
	`entryPrice` double NOT NULL,
	`status` enum('open','closed','neutral') NOT NULL DEFAULT 'open',
	`evidence` text,
	CONSTRAINT `signals_id` PRIMARY KEY(`id`),
	CONSTRAINT `signals_signalId_unique` UNIQUE(`signalId`)
);
--> statement-breakpoint
CREATE TABLE `weeklyReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`weekStart` varchar(10) NOT NULL,
	`reportJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weeklyReports_id` PRIMARY KEY(`id`),
	CONSTRAINT `weeklyReports_weekStart_unique` UNIQUE(`weekStart`)
);
--> statement-breakpoint
CREATE INDEX `analyticsEvents_eventName_idx` ON `analyticsEvents` (`eventName`);--> statement-breakpoint
CREATE INDEX `signalResults_signalId_idx` ON `signalResults` (`signalId`);