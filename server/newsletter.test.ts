import { describe, expect, it, vi } from "vitest";

const { addEmailSubscriber, recordAnalyticsEvent } = vi.hoisted(() => ({
  addEmailSubscriber: vi.fn().mockResolvedValue(undefined),
  recordAnalyticsEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./db", () => ({
  addEmailSubscriber,
  recordAnalyticsEvent,
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("newsletter.subscribe", () => {
  it("normalizes the email and stores the source", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    const result = await caller.newsletter.subscribe({
      email: "  Analyst@Example.com ",
      source: "hero-banner",
    });

    expect(result).toEqual({ success: true });
    expect(addEmailSubscriber).toHaveBeenCalledWith("analyst@example.com", "hero-banner");
  });

  it("rejects malformed email addresses before touching persistence", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.newsletter.subscribe({ email: "not-an-email" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(addEmailSubscriber).toHaveBeenCalledTimes(1);
  });
});
