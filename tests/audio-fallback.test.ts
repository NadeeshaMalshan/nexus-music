import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findAlternativeVideoId, resolveAudioUrlWithFallback } from "../src/lib/youtubeDirectAudioUrl";

describe("Audio Fallback & Alternative Video Resolution", () => {
  it("resolves alternative working video ID when broken video ID is passed for Adele - Rolling in the Deep", async () => {
    const brokenId = "x9Qv47HpEqw";
    const resolvedId = await findAlternativeVideoId("Rolling in the Deep", "Adele", brokenId);
    
    assert.ok(resolvedId, "Expected an alternative video ID to be resolved");
    assert.notEqual(resolvedId, brokenId, "Resolved video ID must differ from the broken ID");
    assert.strictEqual(typeof resolvedId, "string");
    assert.ok(resolvedId.length >= 10, "Resolved video ID should be a valid YouTube video ID");
  });

  it("returns null or fallback cleanly if title is empty or query cannot be found", async () => {
    const result = await findAlternativeVideoId("", "Unknown Artist");
    assert.strictEqual(result, null);
  });

  it("filters out the brokenVideoId from the search results", async () => {
    // If the search result would have matched brokenId, it must skip brokenId
    const resolvedId = await findAlternativeVideoId("Skyfall", "Adele", "broken_mock_id");
    assert.ok(resolvedId);
    assert.notEqual(resolvedId, "broken_mock_id");
  });

  it("strictly rejects candidate when artist does not match", async () => {
    const resolvedId = await findAlternativeVideoId("Rolling in the Deep", "CompletelyUnrelatedArtist999", "x9Qv47HpEqw");
    assert.strictEqual(resolvedId, null, "Must return null when artist does not match");
  });

  it("returns null instead of picking arbitrary search results if no title matches", async () => {
    const resolvedId = await findAlternativeVideoId("ZzzNonExistentSongTitle987654321", "Adele", "broken_id");
    assert.strictEqual(resolvedId, null, "Must return null for non-matching title, never pick random results");
  });

  it("resolveAudioUrlWithFallback does not search alternatives when allowFallback is false", async () => {
    // Non-existent or fake video ID where direct extraction fails
    const result = await resolveAudioUrlWithFallback("fake_broken_id", false, "Fake Song", "Fake Artist", false);
    assert.strictEqual(result, null, "Should return null when allowFallback is false and direct URL is unavailable");
  });
});

