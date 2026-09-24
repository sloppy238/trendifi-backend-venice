ALTER TABLE `analyticsEvents` ADD `visitorType` enum('new','returning');--> statement-breakpoint
ALTER TABLE `analyticsEvents` ADD `deviceType` enum('mobile','desktop');--> statement-breakpoint
ALTER TABLE `analyticsEvents` ADD `trafficSource` varchar(64);--> statement-breakpoint
ALTER TABLE `signals` ADD `confidence` enum('high','medium','low') DEFAULT 'medium' NOT NULL;