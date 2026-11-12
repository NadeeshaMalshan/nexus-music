import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../src/app/api/caption-sync/route";

describe("GET /api/caption-sync", () => {
  it("returns 400 when videoId is missing", async () => {
    const req = new Request("http://localhost:3000/api/caption-sync");
    const res = await GET(req);
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  it("returns 400 when videoId is undefined or null string", async () => {
    const req1 = new Request("http://localhost:3000/api/caption-sync?videoId=undefined");
    const res1 = await GET(req1);
    assert.strictEqual(res1.status, 400);

    const req2 = new Request("http://localhost:3000/api/caption-sync?videoId=null");
    const res2 = await GET(req2);
    assert.strictEqual(res2.status, 400);
  });

  it("returns 200 with words array or short reason for valid videoId without throwing", async () => {
    const req = new Request("http://localhost:3000/api/caption-sync?videoId=rYEDA3JcQqw");
    const res = await GET(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.words));
  });
});
