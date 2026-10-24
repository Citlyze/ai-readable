import { afterEach, describe, expect, it, vi } from "vitest";
import { COMMENT_MARKER } from "../src/cli/format";
import { upsertPrComment, type GitHubContext } from "../src/cli/github";

const ctx: GitHubContext = {
  token: "t",
  repository: "acme/site",
  prNumber: 7,
  serverUrl: "https://github.com",
  runUrl: null,
};

type Comment = { id: number; body: string; user: { login: string; type: string } };

const bot = (id: number): Comment => ({ id, body: `${COMMENT_MARKER}\nreport`, user: { login: "github-actions[bot]", type: "Bot" } });
const stranger = (id: number): Comment => ({ id, body: `${COMMENT_MARKER}\nfake`, user: { login: "mallory", type: "User" } });
const filler = (id: number): Comment => ({ id, body: "LGTM", user: { login: "someone", type: "User" } });

/** Fake GitHub API: /user as `login` (or 403 for the Actions token), comment pages, and a record of writes. */
function fakeApi(pages: Comment[][], login: string | null = null) {
  const writes: { method: string; path: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: { method?: string }) => {
      const url = new URL(input);
      const method = init?.method ?? "GET";
      const json = (status: number, value: unknown) =>
        new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
      if (url.pathname === "/user") return login ? json(200, { login }) : json(403, { message: "Resource not accessible by integration" });
      if (method === "GET") return json(200, pages[Number(url.searchParams.get("page") ?? "1") - 1] ?? []);
      writes.push({ method, path: url.pathname });
      return json(method === "POST" ? 201 : 200, { id: 1 });
    }),
  );
  return writes;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("upsertPrComment", () => {
  it("updates the bot's own comment", async () => {
    const writes = fakeApi([[filler(1), bot(2)]]);
    expect(await upsertPrComment(ctx, "new")).toBe("updated");
    expect(writes).toEqual([{ method: "PATCH", path: "/repos/acme/site/issues/comments/2" }]);
  });

  it("never edits someone else's comment that carries the marker", async () => {
    const writes = fakeApi([[stranger(1)]]);
    expect(await upsertPrComment(ctx, "new")).toBe("created");
    expect(writes).toEqual([{ method: "POST", path: "/repos/acme/site/issues/7/comments" }]);
  });

  it("matches the token's own login when the token can read /user", async () => {
    const writes = fakeApi([[bot(1), { ...stranger(2), user: { login: "ci-user", type: "User" } }]], "ci-user");
    expect(await upsertPrComment(ctx, "new")).toBe("updated");
    expect(writes).toEqual([{ method: "PATCH", path: "/repos/acme/site/issues/comments/2" }]);
  });

  it("finds its comment past the first page of 100", async () => {
    const first = Array.from({ length: 100 }, (_, i) => filler(i + 1));
    const writes = fakeApi([first, [bot(500)]]);
    expect(await upsertPrComment(ctx, "new")).toBe("updated");
    expect(writes).toEqual([{ method: "PATCH", path: "/repos/acme/site/issues/comments/500" }]);
  });
});
