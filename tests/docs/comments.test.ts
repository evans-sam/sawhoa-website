import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { planComments, syncComments } from "@/lib/docs/comments";
import { commentText } from "@/lib/docs/messages";
import type { Problem } from "@/lib/docs/types";
import { createComment, listComments, resolveComment, type DriveComment } from "@/lib/google/api";

vi.mock("@/lib/google/api", () => ({
  listComments: vi.fn(),
  createComment: vi.fn(),
  resolveComment: vi.fn(),
}));

const table: Problem = { kind: "table", quote: "Fees" };
const empty: Problem = { kind: "empty", quote: "" };

/** An open comment the site posted. */
function ours(id: string, problem: Problem): DriveComment {
  return { id, content: commentText(problem), resolved: false, author: { me: true } };
}

describe("planComments", () => {
  test("one problem and no comments: one comment to post", () => {
    expect(planComments([table], [])).toEqual({ create: [commentText(table)], resolve: [] });
  });

  test("a problem whose comment is already open: nothing to do, however often it runs", () => {
    const existing = [ours("c1", table)];
    expect(planComments([table], existing)).toEqual({ create: [], resolve: [] });
    expect(planComments([table], existing)).toEqual({ create: [], resolve: [] });
  });

  test("no problems and two of our comments open: both resolved", () => {
    expect(planComments([], [ours("c1", table), ours("c2", empty)])).toEqual({
      create: [],
      resolve: ["c1", "c2"],
    });
  });

  test("a fixed problem is resolved while a new one is posted", () => {
    expect(planComments([empty], [ours("c1", table)])).toEqual({
      create: [commentText(empty)],
      resolve: ["c1"],
    });
  });

  test("a human's open comment and our resolved comment are never touched", () => {
    const human: DriveComment = { id: "h1", content: commentText(table), author: { me: false } };
    const anonymous: DriveComment = { id: "h2", content: "Website: looks good" };
    const resolved: DriveComment = { ...ours("c1", empty), resolved: true };
    const ownChat: DriveComment = { id: "c2", content: "Please check the fees", author: { me: true } };
    expect(planComments([], [human, anonymous, resolved, ownChat])).toEqual({
      create: [],
      resolve: [],
    });
    // A human's comment with the same words does not stand in for ours.
    expect(planComments([table], [human, resolved])).toEqual({
      create: [commentText(table)],
      resolve: [],
    });
  });

  test("a comment of ours with no resolved field counts as open", () => {
    const open: DriveComment = { id: "c1", content: commentText(table), author: { me: true } };
    expect(planComments([], [open])).toEqual({ create: [], resolve: ["c1"] });
  });

  test("two identical problems: one comment", () => {
    expect(planComments([table, { ...table }], [])).toEqual({
      create: [commentText(table)],
      resolve: [],
    });
  });
});

describe("syncComments", () => {
  let errors: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(listComments).mockResolvedValue([]);
    vi.mocked(createComment).mockResolvedValue();
    vi.mocked(resolveComment).mockResolvedValue();
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.resetAllMocks();
    errors.mockRestore();
  });

  test("posts the new comments and resolves the fixed ones on the doc", async () => {
    vi.mocked(listComments).mockResolvedValue([ours("c1", table)]);
    await syncComments("doc-1", [empty]);
    expect(listComments).toHaveBeenCalledWith("doc-1");
    expect(createComment).toHaveBeenCalledExactlyOnceWith("doc-1", commentText(empty));
    expect(resolveComment).toHaveBeenCalledExactlyOnceWith("doc-1", "c1");
    expect(errors).not.toHaveBeenCalled();
  });

  test("does nothing when the comments already match", async () => {
    vi.mocked(listComments).mockResolvedValue([ours("c1", table)]);
    await syncComments("doc-1", [table]);
    expect(createComment).not.toHaveBeenCalled();
    expect(resolveComment).not.toHaveBeenCalled();
  });

  test("resolves normally when createComment rejects, and logs the failure", async () => {
    vi.mocked(listComments).mockResolvedValue([ours("c1", table)]);
    vi.mocked(createComment).mockRejectedValue(new Error("403 forbidden"));
    await expect(syncComments("doc-1", [empty])).resolves.toBeUndefined();
    expect(resolveComment).toHaveBeenCalledWith("doc-1", "c1");
    expect(errors).toHaveBeenCalledOnce();
  });

  test("resolves normally when listing or resolving comments fails", async () => {
    vi.mocked(listComments).mockRejectedValue(new Error("500"));
    await expect(syncComments("doc-1", [table])).resolves.toBeUndefined();
    expect(createComment).not.toHaveBeenCalled();

    vi.mocked(listComments).mockResolvedValue([ours("c1", table)]);
    vi.mocked(resolveComment).mockRejectedValue(new Error("404"));
    await expect(syncComments("doc-1", [])).resolves.toBeUndefined();
    expect(errors).toHaveBeenCalledTimes(2);
  });

  test("resolves normally when a call throws synchronously", async () => {
    vi.mocked(listComments).mockImplementation(() => {
      throw new Error("boom");
    });
    await expect(syncComments("doc-1", [table])).resolves.toBeUndefined();
    expect(errors).toHaveBeenCalledOnce();
  });
});
