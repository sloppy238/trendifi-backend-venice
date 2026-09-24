CREATE TABLE `emailSubscribers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`source` varchar(64) NOT NULL DEFAULT 'proof-dashboard',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `emailSubscribers_id` PRIMARY KEY(`id`),
	CONSTRAINT `emailSubscribers_email_unique` UNIQUE(`email`)
);
