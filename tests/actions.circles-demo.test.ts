import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Repositories } from "@/lib/data/repositories";
import { addCircleMemberAction, createSharedCircleAction } from "@/app/actions/circles";
import { createSharedCircle, listSharedCircles } from "@/lib/services/circles";
import { createSecondUser, createTestContext } from "./helpers";

// Actions call requireUser() and services without repos, so route both to the in-memory test database.
const state = vi.hoisted(() => ({ repos: null as unknown as Repositories, userId: "" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn(async () => ({ id: state.userId })) }));
vi.mock("@/lib/services/library", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/library")>()),
  defaultRepositories: vi.fn(async () => state.repos),
}));

const DEMO_ERROR = { ok: false, error: "The demo account can't create or join circles." };

/** A real owner with one circle, plus the shared demo account. */
async function setup() {
  const ctx = await createTestContext("owner@example.com");
  const demo = await ctx.repos.users.create({
    email: "demo@example.com",
    name: "Demo Diner",
    passwordHash: null,
    isDemo: true,
  });
  const circleId = await createSharedCircle(ctx.userId, "Dinner crew", ctx.repos);
  state.repos = ctx.repos;
  return { repos: ctx.repos, ownerId: ctx.userId, demoId: demo.id, circleId };
}

beforeEach(() => {
  state.repos = null as unknown as Repositories;
  state.userId = "";
});

describe("addCircleMemberAction", () => {
  it("still lets a real owner add a real member", async () => {
    const { repos, ownerId, circleId } = await setup();
    const memberId = await createSecondUser(repos, "member@example.com");
    state.userId = ownerId;
    expect(await addCircleMemberAction(circleId, "member@example.com")).toEqual({ ok: true });
    expect((await repos.circles.accessibleUserIds(memberId)).sort()).toEqual([ownerId, memberId].sort());
  });

  it("shows the demo message when a real owner adds the demo email", async () => {
    const { repos, ownerId, demoId, circleId } = await setup();
    state.userId = ownerId;
    expect(await addCircleMemberAction(circleId, "demo@example.com")).toEqual(DEMO_ERROR);
    expect(await repos.circles.accessibleUserIds(demoId)).toEqual([demoId]);
  });

  it("shows the demo message when the demo account adds a member", async () => {
    const { repos, ownerId, demoId } = await setup();
    const demoCircleId = await repos.circles.create(demoId, "Seeded demo crew");
    state.userId = demoId;
    expect(await addCircleMemberAction(demoCircleId, "owner@example.com")).toEqual(DEMO_ERROR);
    expect(await repos.circles.accessibleUserIds(ownerId)).toEqual([ownerId]);
  });
});

describe("createSharedCircleAction", () => {
  it("shows the demo message when the demo account creates a circle", async () => {
    const { repos, demoId } = await setup();
    state.userId = demoId;
    expect(await createSharedCircleAction("Demo crew")).toEqual(DEMO_ERROR);
    expect(await listSharedCircles(demoId, repos)).toEqual([]);
  });
});
