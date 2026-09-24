import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import {
  generateWeeklyReport,
  getScheduledJobByTaskUid,
  markScheduledJobRun,
  refreshSignalPerformance,
} from "./db";

function errorPayload(error: unknown, req: Request, taskUid?: string) {
  return {
    error: error instanceof Error ? error.message : String(error),
    context: { url: req.originalUrl, taskUid },
    timestamp: new Date().toISOString(),
  };
}

async function authorizeCron(req: Request, res: Response) {
  const user = await sdk.authenticateRequest(req);
  if (!user.isCron || !user.taskUid) {
    res.status(403).json({ error: "cron-only" });
    return null;
  }
  return user;
}

export async function refreshSignalsHandler(req: Request, res: Response) {
  try {
    const user = await authorizeCron(req, res);
    if (!user) return;
    const job = await getScheduledJobByTaskUid(user.taskUid!);
    if (!job) {
      res.json({ ok: true, skipped: "orphan" });
      return;
    }
    const result = await refreshSignalPerformance();
    await markScheduledJobRun(job.id);
    res.json({ ok: true, job: "refresh-signals", ...result });
  } catch (error) {
    const taskUid = req.headers["x-task-uid"] as string | undefined;
    res.status(500).json(errorPayload(error, req, taskUid));
  }
}

export async function weeklyReportHandler(req: Request, res: Response) {
  try {
    const user = await authorizeCron(req, res);
    if (!user) return;
    const job = await getScheduledJobByTaskUid(user.taskUid!);
    if (!job) {
      res.json({ ok: true, skipped: "orphan" });
      return;
    }
    const report = await generateWeeklyReport();
    await markScheduledJobRun(job.id);
    res.json({ ok: true, job: "weekly-report", report });
  } catch (error) {
    const taskUid = req.headers["x-task-uid"] as string | undefined;
    res.status(500).json(errorPayload(error, req, taskUid));
  }
}
