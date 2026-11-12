import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractPrimaryArtist,
  isYouTubeChannelId,
  scoreArtistCandidate,
} from "../src/lib/artistUtils";

describe("Artist Navigation & Extraction Utilities", () => {
  describe("isYouTubeChannelId", () => {
    it("identifies valid YouTube channel IDs", () => {
      assert.equal(isYouTubeChannelId("UC-J-KZfRV8c13fOCkhXdLiQ"), true);
      assert.equal(isYouTubeChannelId("UCy3zgWom-5AGypGX_FVTKpg"), true);
      assert.equal(isYouTubeChannelId("UCzVb0SIXp9q9PeKCcFjsBtA"), true);
    });

    it("rejects non-channel strings", () => {
      assert.equal(isYouTubeChannelId("Olivia Rodrigo"), false);
      assert.equal(isYouTubeChannelId("Dua Lipa"), false);
      assert.equal(isYouTubeChannelId(""), false);
      assert.equal(isYouTubeChannelId("UCshort"), false);
    });
  });

  describe("extractPrimaryArtist", () => {
    it("extracts primary artist from comma-separated collaborations", () => {
      const res = extractPrimaryArtist("Olivia Rodrigo, Dan Nigro");
      assert.equal(res.primary, "Olivia Rodrigo");
    });

    it("extracts primary artist from ampersand collaborations", () => {
      const res = extractPrimaryArtist("Lady Gaga & Bruno Mars");
      assert.equal(res.primary, "Lady Gaga");
    });

    it("extracts primary artist from feat. suffixes", () => {
      const res = extractPrimaryArtist("Taylor Swift feat. Post Malone");
      assert.equal(res.primary, "Taylor Swift");

      const res2 = extractPrimaryArtist("The Weeknd (feat. Daft Punk)");
      assert.equal(res2.primary, "The Weeknd");
    });

    it("strips - Topic and VEVO markers", () => {
      const res = extractPrimaryArtist("Dua Lipa - Topic");
      assert.equal(res.primary, "Dua Lipa");

      const res2 = extractPrimaryArtist("Taylor Swift VEVO");
      assert.equal(res2.primary, "Taylor Swift");
    });

    it("handles slash and x collaboration delimiters", () => {
      const res = extractPrimaryArtist("Dua Lipa / Elton John");
      assert.equal(res.primary, "Dua Lipa");

      const res2 = extractPrimaryArtist("Coldplay x BTS");
      assert.equal(res2.primary, "Coldplay");
    });

    it("preserves single artist names unchanged", () => {
      assert.equal(extractPrimaryArtist("Olivia Rodrigo").primary, "Olivia Rodrigo");
      assert.equal(extractPrimaryArtist("Dua Lipa").primary, "Dua Lipa");
      assert.equal(extractPrimaryArtist("Dean").primary, "Dean");
    });
  });

  describe("scoreArtistCandidate", () => {
    it("gives 100 for exact match", () => {
      assert.equal(scoreArtistCandidate("Olivia Rodrigo", "Olivia Rodrigo"), 100);
      assert.equal(scoreArtistCandidate("olivia rodrigo", "Olivia Rodrigo"), 100);
    });

    it("gives near 100 for symbol differences (e.g. P!nk vs Pink)", () => {
      const score = scoreArtistCandidate("P!nk", "Pink");
      assert.ok(score >= 95, `Expected score >= 95, got ${score}`);
    });

    it("scores Olivia Rodrigo 100 and Chappell Roan 0 for Olivia Rodrigo query", () => {
      const goodScore = scoreArtistCandidate("Olivia Rodrigo", "Olivia Rodrigo");
      const badScore = scoreArtistCandidate("Chappell Roan", "Olivia Rodrigo");
      assert.equal(goodScore, 100);
      assert.equal(badScore, 0);
    });

    it("scores Lady Gaga high and Bruno Mars 0 for Lady Gaga query", () => {
      const gagaScore = scoreArtistCandidate("Lady Gaga", "Lady Gaga");
      const brunoScore = scoreArtistCandidate("Bruno Mars", "Lady Gaga");
      assert.equal(gagaScore, 100);
      assert.equal(brunoScore, 0);
    });

    it("prefers exact single-word artist over longer artist containing the word", () => {
      const deanScore = scoreArtistCandidate("DEAN", "Dean");
      const oliviaDeanScore = scoreArtistCandidate("Olivia Dean", "Dean");
      assert.ok(deanScore > oliviaDeanScore, `Expected DEAN (${deanScore}) > Olivia Dean (${oliviaDeanScore})`);
    });
  });
});
