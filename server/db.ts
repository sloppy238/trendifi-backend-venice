import { and, desc, eq, gte, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  analyticsEvents,
  emailSubscribers,
  InsertAnalyticsEvent,
  InsertEmailSubscriber,
  InsertSignal,
  InsertUser,
  scheduledJobs,
  signalResults,
  signals,
  users,
  weeklyReports,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];

  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };

  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function addEmailSubscriber(email: string, source = "proof-dashboard") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const values: InsertEmailSubscriber = { email, source };
  await db.insert(emailSubscribers).values(values).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
}

export async function publishSignal(input: InsertSignal) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(signals).values(input);
  await db.insert(signalResults).values({ signalId: input.signalId });
  return input;
}

export async function recordAnalyticsEvent(event: InsertAnalyticsEvent) {
  const db = await getDb();
  if (!db) return;
  await db.insert(analyticsEvents).values(event);
}

export async function getPublicProofSnapshot() {
  const db = await getDb();
  if (!db) return { signals: [], scorecard: emptyScorecard() };
  const rows = await db
    .select({ signal: signals, result: signalResults })
    .from(signals)
    .leftJoin(signalResults, eq(signals.signalId, signalResults.signalId))
    .orderBy(desc(signals.createdAt));
  const publicSignals = rows.map(({ signal, result }) => ({ signal, result }));
  return { signals: publicSignals, scorecard: buildScorecard(publicSignals) };
}

function emptyScorecard() {
  return { signalsPublished: 0, openSignals: 0, sevenDayWinRate: 0, thirtyDayWinRate: 0, averageReturn: 0 };
}

function buildScorecard(rows: Array<{ signal: typeof signals.$inferSelect; result: typeof signalResults.$inferSelect | null }>) {
  const sevenDay = rows.map((row) => row.result?.return7d).filter((value): value is number => value !== null && value !== undefined);
  const thirtyDay = rows.map((row) => row.result?.return30d).filter((value): value is number => value !== null && value !== undefined);
  const current = rows.map((row) => row.result?.returnCurrent).filter((value): value is number => value !== null && value !== undefined);
  return {
    signalsPublished: rows.length,
    openSignals: rows.filter(({ signal }) => signal.status === "open").length,
    sevenDayWinRate: sevenDay.length ? (sevenDay.filter((value) => value > 0).length / sevenDay.length) * 100 : 0,
    thirtyDayWinRate: thirtyDay.length ? (thirtyDay.filter((value) => value > 0).length / thirtyDay.length) * 100 : 0,
    averageReturn: current.length ? current.reduce((sum, value) => sum + value, 0) / current.length : 0,
  };
}

async function fetchPriceHistory(ticker: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=3mo&interval=1d&events=history`;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Market data request failed (${response.status})`);
  const payload = (await response.json()) as {
    chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> };
  };
  const chart = payload.chart?.result?.[0];
  const timestamps = chart?.timestamp ?? [];
  const closes = chart?.indicators?.quote?.[0]?.close ?? [];
  const points = timestamps
    .map((timestamp, index) => ({ timestamp: timestamp * 1000, close: closes[index] }))
    .filter((point): point is { timestamp: number; close: number } => typeof point.close === "number");
  if (!points.length) throw new Error(`No market data returned for ${ticker}`);
  return points;
}

function closestPrice(points: Array<{ timestamp: number; close: number }>, target: number) {
  return points.reduce((closest, point) =>
    Math.abs(point.timestamp - target) < Math.abs(closest.timestamp - target) ? point : closest,
  );
}

function percentReturn(entryPrice: number, currentPrice: number | null) {
  return currentPrice === null ? null : ((currentPrice - entryPrice) / entryPrice) * 100;
}

export async function refreshSignalPerformance() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const allSignals = await db.select().from(signals);
  const refreshed: Array<{ signalId: string; currentPrice: number }> = [];

  for (const signal of allSignals) {
    const points = await fetchPriceHistory(signal.ticker);
    const now = Date.now();
    const latest = points[points.length - 1];
    const price7d = now >= signal.createdAt.getTime() + 7 * 86400000
      ? closestPrice(points, signal.createdAt.getTime() + 7 * 86400000).close
      : null;
    const price30d = now >= signal.createdAt.getTime() + 30 * 86400000
      ? closestPrice(points, signal.createdAt.getTime() + 30 * 86400000).close
      : null;
    await db.insert(signalResults).values({
      signalId: signal.signalId,
      currentPrice: latest.close,
      returnCurrent: percentReturn(signal.entryPrice, latest.close),
      price7d,
      return7d: percentReturn(signal.entryPrice, price7d),
      price30d,
      return30d: percentReturn(signal.entryPrice, price30d),
    }).onDuplicateKeyUpdate({
      set: {
        currentPrice: latest.close,
        returnCurrent: percentReturn(signal.entryPrice, latest.close),
        price7d,
        return7d: percentReturn(signal.entryPrice, price7d),
        price30d,
        return30d: percentReturn(signal.entryPrice, price30d),
        updatedAt: new Date(),
      },
    });
    refreshed.push({ signalId: signal.signalId, currentPrice: latest.close });
  }
  return { refreshed: refreshed.length, signals: refreshed };
}

export async function getScheduledJobByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(scheduledJobs).where(and(eq(scheduledJobs.taskUid, taskUid), eq(scheduledJobs.enabled, 1))).limit(1);
  return rows[0];
}

export async function markScheduledJobRun(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(scheduledJobs).set({ lastRunAt: new Date() }).where(eq(scheduledJobs.id, id));
}

export async function generateWeeklyReport() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const weekStartDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  const weekStart = weekStartDate.toISOString().slice(0, 10);
  const snapshot = await getPublicProofSnapshot();
  const subscribers = await db.select().from(emailSubscribers).where(gte(emailSubscribers.createdAt, weekStartDate));
  const report = {
    weekStart,
    newSignals: snapshot.signals.filter(({ signal }) => signal.createdAt >= weekStartDate).length,
    bestPerformingSignal: snapshot.signals.filter(({ result }) => result?.returnCurrent != null).sort((a, b) => (b.result?.returnCurrent ?? -Infinity) - (a.result?.returnCurrent ?? -Infinity))[0]?.signal.signalId ?? null,
    worstPerformingSignal: snapshot.signals.filter(({ result }) => result?.returnCurrent != null).sort((a, b) => (a.result?.returnCurrent ?? Infinity) - (b.result?.returnCurrent ?? Infinity))[0]?.signal.signalId ?? null,
    averageReturn: snapshot.scorecard.averageReturn,
    newSubscribers: subscribers.length,
    returningUsers: 0,
  };
  await db.insert(weeklyReports).values({ weekStart, reportJson: JSON.stringify(report) }).onDuplicateKeyUpdate({ set: { reportJson: JSON.stringify(report) } });
  return report;
}
