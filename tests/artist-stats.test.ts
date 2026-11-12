import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getKnownOAC, KNOWN_OAC_LIST } from "../src/lib/knownOAC";
import { parseSubCount } from "../src/lib/youtubeData";

describe("Artist OAC & Subscriber Statistics Resolution", () => {
  describe("getKnownOAC", () => {
    it("resolves Dua Lipa OAC by name", () => {
      const match = getKnownOAC("Dua Lipa");
      assert.ok(match);
      assert.equal(match.channelId, "UC-J-KZfRV8c13fOCkhXdLiQ");
      assert.equal(match.subscribers, 25500000);
    });

    it("resolves Olivia Rodrigo OAC by name", () => {
      const match = getKnownOAC("Olivia Rodrigo");
      assert.ok(match);
      assert.equal(match.channelId, "UCy3zgWom-5AGypGX_FVTKpg");
      assert.equal(match.subscribers, 16900000);
    });

    it("resolves Dua Lipa OAC from Topic channel ID", () => {
      const match = getKnownOAC("UCzVb0SIXp9q9PeKCcFjsBtA");
      assert.ok(match);
      assert.equal(match.name, "Dua Lipa");
      assert.equal(match.channelId, "UC-J-KZfRV8c13fOCkhXdLiQ");
    });

    it("resolves Olivia Rodrigo OAC from Topic channel ID", () => {
      const match = getKnownOAC("UCE5XNpliPM-SmyFEp61tL_g");
      assert.ok(match);
      assert.equal(match.name, "Olivia Rodrigo");
      assert.equal(match.channelId, "UCy3zgWom-5AGypGX_FVTKpg");
    });

    it("tolerates typos in artist names (e.g. 'olivia ridrigi')", () => {
      const match = getKnownOAC("olivia ridrigi");
      assert.ok(match);
      assert.equal(match.name, "Olivia Rodrigo");
      assert.equal(match.channelId, "UCy3zgWom-5AGypGX_FVTKpg");
    });

    it("resolves other major artists correctly", () => {
      const taylor = getKnownOAC("Taylor Swift");
      assert.ok(taylor);
      assert.equal(taylor.channelId, "UCqECaJ8Gagnn7YCbPEzWH6g");
      assert.equal(taylor.subscribers, 60400000);

      const billie = getKnownOAC("Billie Eilish");
      assert.ok(billie);
      assert.equal(billie.channelId, "UCiGm_E4ZwYSHV3bcW1pnSeQ");
      assert.equal(billie.subscribers, 52300000);
    });

    it("returns null for completely unknown artist or empty string", () => {
      assert.equal(getKnownOAC(""), null);
      assert.equal(getKnownOAC("Some Unknown Local Artist 99999"), null);
    });
  });

  describe("parseSubCount", () => {
    it("parses millions with M suffix", () => {
      assert.equal(parseSubCount("25.5M subscribers"), 25500000);
      assert.equal(parseSubCount("16.9M"), 16900000);
      assert.equal(parseSubCount("1M subscribers"), 1000000);
    });

    it("parses thousands with K suffix", () => {
      assert.equal(parseSubCount("10.2K subscribers"), 10200);
      assert.equal(parseSubCount("500K"), 500000);
    });

    it("parses billions with B suffix", () => {
      assert.equal(parseSubCount("1.2B subscribers"), 1200000000);
    });

    it("parses full words (million, thousand)", () => {
      assert.equal(parseSubCount("25.5 million subscribers"), 25500000);
      assert.equal(parseSubCount("500 thousand subscribers"), 500000);
    });

    it("parses raw numeric comma strings", () => {
      assert.equal(parseSubCount("25,500,000 subscribers"), 25500000);
      assert.equal(parseSubCount("10200"), 10200);
    });

    it("handles empty or invalid string gracefully", () => {
      assert.equal(parseSubCount(""), 0);
      assert.equal(parseSubCount("no numbers here"), 0);
    });
  });
});
