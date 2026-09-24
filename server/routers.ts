import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import {
  addEmailSubscriber,
  getPublicProofSnapshot,
  recordAnalyticsEvent,
} from "./db";

const analyticsEventNames = ["proof_view", "signal_view", "evidence_open", "email_signup", "return_visit"] as const;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  proof: router({
    snapshot: publicProcedure.query(() => getPublicProofSnapshot()),
    publish: adminProcedure
      .input(z.object({
        signalId: z.string().min(1).max(32),
        ticker: z.string().trim().min(1).max(16).transform((value) => value.toUpperCase()),
        signalType: z.enum(["bullish", "bearish"]),
        createdAt: z.coerce.date(),
        entryPrice: z.number().positive(),
        confidence: z.enum(["high", "medium", "low"]).default("medium"),
        evidence: z.string().max(5000).optional(),
      }))
      .mutation(async ({ input }) => {
        const { publishSignal } = await import("./db");
        await publishSignal({ ...input, status: "open" });
        return { success: true, signalId: input.signalId } as const;
      }),
  }),
  analytics: router({
    track: publicProcedure
      .input(z.object({
        eventName: z.enum(analyticsEventNames),
        signalId: z.string().max(32).optional(),
        sessionId: z.string().max(128).optional(),
        visitorType: z.enum(["new", "returning"]).optional(),
        deviceType: z.enum(["mobile", "desktop"]).optional(),
        trafficSource: z.string().max(64).optional(),
        path: z.string().max(255).optional(),
      }))
      .mutation(async ({ input }) => {
        await recordAnalyticsEvent(input);
        return { success: true } as const;
      }),
  }),
  newsletter: router({
    subscribe: publicProcedure
      .input(z.object({ email: z.string().trim().email(), source: z.string().trim().max(64).optional() }))
      .mutation(async ({ ctx, input }) => {
        await addEmailSubscriber(input.email.toLowerCase(), input.source ?? "proof-dashboard");
        await recordAnalyticsEvent({ eventName: "email_signup", path: ctx.req.path });
        return { success: true } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;
