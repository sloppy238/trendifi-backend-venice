import { double, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const emailSubscribers = mysqlTable("emailSubscribers", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  source: varchar("source", { length: 64 }).default("proof-dashboard").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailSubscriber = typeof emailSubscribers.$inferSelect;
export type InsertEmailSubscriber = typeof emailSubscribers.$inferInsert;

/** Immutable signal facts. entryPrice is set once at publication and never updated by refresh jobs. */
export const signals = mysqlTable("signals", {
  id: int("id").autoincrement().primaryKey(),
  signalId: varchar("signalId", { length: 32 }).notNull().unique(),
  ticker: varchar("ticker", { length: 16 }).notNull(),
  signalType: mysqlEnum("signalType", ["bullish", "bearish"]).notNull(),
  createdAt: timestamp("createdAt").notNull(),
  entryPrice: double("entryPrice").notNull(),
  confidence: mysqlEnum("confidence", ["high", "medium", "low"]).default("medium").notNull(),
  status: mysqlEnum("status", ["open", "closed", "neutral"]).default("open").notNull(),
  evidence: text("evidence"),
});

export type Signal = typeof signals.$inferSelect;
export type InsertSignal = typeof signals.$inferInsert;

/** Mutable market observations, separated from the immutable signal facts. */
export const signalResults = mysqlTable(
  "signalResults",
  {
    id: int("id").autoincrement().primaryKey(),
    signalId: varchar("signalId", { length: 32 }).notNull().unique(),
    currentPrice: double("currentPrice"),
    returnCurrent: double("returnCurrent"),
    price7d: double("price7d"),
    return7d: double("return7d"),
    price30d: double("price30d"),
    return30d: double("return30d"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({ signalIdIdx: index("signalResults_signalId_idx").on(table.signalId) }),
);

export type SignalResult = typeof signalResults.$inferSelect;
export type InsertSignalResult = typeof signalResults.$inferInsert;

export const analyticsEvents = mysqlTable(
  "analyticsEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    eventName: varchar("eventName", { length: 64 }).notNull(),
    signalId: varchar("signalId", { length: 32 }),
    sessionId: varchar("sessionId", { length: 128 }),
    visitorType: mysqlEnum("visitorType", ["new", "returning"]),
    deviceType: mysqlEnum("deviceType", ["mobile", "desktop"]),
    trafficSource: varchar("trafficSource", { length: 64 }),
    path: varchar("path", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({ eventNameIdx: index("analyticsEvents_eventName_idx").on(table.eventName) }),
);

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = typeof analyticsEvents.$inferInsert;

export const scheduledJobs = mysqlTable("scheduledJobs", {
  id: int("id").autoincrement().primaryKey(),
  jobKey: varchar("jobKey", { length: 64 }).notNull().unique(),
  taskUid: varchar("taskUid", { length: 65 }).unique(),
  lastRunAt: timestamp("lastRunAt"),
  enabled: int("enabled").default(1).notNull(),
});

export type ScheduledJob = typeof scheduledJobs.$inferSelect;
export type InsertScheduledJob = typeof scheduledJobs.$inferInsert;

export const weeklyReports = mysqlTable("weeklyReports", {
  id: int("id").autoincrement().primaryKey(),
  weekStart: varchar("weekStart", { length: 10 }).notNull().unique(),
  reportJson: text("reportJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WeeklyReport = typeof weeklyReports.$inferSelect;
export type InsertWeeklyReport = typeof weeklyReports.$inferInsert;
