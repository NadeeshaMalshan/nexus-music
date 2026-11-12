import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  cleanCanvasTitle,
  cleanCanvasArtist,
  parseArtists,
  isArtistMatch,
  isTitleMatch,
  isAlbumMatch,
  scoreCanvasMatch,
  normalizeText,
} from "../src/lib/canvas/matching";

import { CuratedCanvasProvider } from "../src/lib/canvas/providers/curatedCanvasProvider";
import { CommunityCanvasProvider } from "../src/lib/canvas/providers/communityCanvasProvider";
import { CanvasService } from "../src/lib/canvas/canvasService";
import { ICanvasProvider, CanvasQuery, CanvasResponse } from "../src/lib/canvas/types";

describe("Canvas Title & Artist Normalization", () => {
  test("cleans noise tags and video descriptors from titles", () => {
    assert.equal(
      cleanCanvasTitle("Blinding Lights (Official Music Video)"),
      "Blinding Lights"
    );
    assert.equal(
      cleanCanvasTitle("Levitating [Official 4K UHD Video]"),
      "Levitating"
    );
    assert.equal(
      cleanCanvasTitle("Die With A Smile (Official Audio / Visualizer)"),
      "Die With A Smile"
    );
  });

  test("handles 'Artist - Title' format when artist is in part 0", () => {
    assert.equal(
      cleanCanvasTitle("The Weeknd - Blinding Lights", "The Weeknd"),
      "Blinding Lights"
    );
    assert.equal(
      cleanCanvasTitle("Dua Lipa - Levitating (Official Video)", "Dua Lipa"),
      "Levitating"
    );
  });

  test("handles 'Title - Artist' format when artist is in part 1", () => {
    assert.equal(
      cleanCanvasTitle("Blinding Lights - The Weeknd", "The Weeknd"),
      "Blinding Lights"
    );
  });

  test("handles YouTube pipe delimiters", () => {
    assert.equal(
      cleanCanvasTitle("Flowers | Official 4K Video | Miley Cyrus"),
      "Flowers"
    );
  });

  test("removes bracketed non-Latin Indic script when Latin title is present", () => {
    assert.equal(
      cleanCanvasTitle("Manike Mage Hithe (මැණිකේ මගේ හිතේ) - Yohani", "Yohani"),
      "Manike Mage Hithe"
    );
  });

  test("cleans channel noise and topic markers from artist strings", () => {
    assert.equal(cleanCanvasArtist("The Weeknd - Topic"), "The Weeknd");
    assert.equal(cleanCanvasArtist("TaylorSwiftVEVO"), "TaylorSwift");
    assert.equal(cleanCanvasArtist("Eminem Official Channel"), "Eminem");
  });

  test("parses multi-artist collaboration strings", () => {
    const parts = parseArtists("Lady Gaga & Bruno Mars");
    assert.deepEqual(parts, ["lady gaga", "bruno mars"]);

    const featParts = parseArtists("Ed Sheeran feat. Justin Bieber");
    assert.deepEqual(featParts, ["ed sheeran", "justin bieber"]);
  });
});

describe("Strict Title Matching & False Positive Prevention", () => {
  test("matches identical and normalized titles", () => {
    assert.equal(isTitleMatch("Blinding Lights", "blinding lights").isMatch, true);
    assert.equal(isTitleMatch("Die With A Smile", "die with a smile").isMatch, true);
  });

  test("allows legitimate version suffixes", () => {
    assert.equal(isTitleMatch("Blinding Lights", "Blinding Lights (Live)").isMatch, true);
    assert.equal(isTitleMatch("Circles", "Circles (Acoustic)").isMatch, true);
  });

  test("STRICTLY REJECTS short-title substring false positives", () => {
    // "Stay" must NEVER match "Stay With Me" or "Stay The Night"
    assert.equal(isTitleMatch("Stay", "Stay With Me").isMatch, false);
    assert.equal(isTitleMatch("Stay", "Stay The Night").isMatch, false);
    assert.equal(isTitleMatch("Stay", "Can't Stay Away").isMatch, false);

    // "One" must NEVER match "One More Night" or "One Kiss"
    assert.equal(isTitleMatch("One", "One More Night").isMatch, false);
    assert.equal(isTitleMatch("One", "One Kiss").isMatch, false);

    // "Hold On" must NEVER match "Hold On, We're Going Home"
    assert.equal(isTitleMatch("Hold On", "Hold On, We're Going Home").isMatch, false);

    // "Love" must NEVER match "Love Yourself" or "Love Story"
    assert.equal(isTitleMatch("Love", "Love Yourself").isMatch, false);
    assert.equal(isTitleMatch("Love", "Love Story").isMatch, false);
  });

  test("matches longer titles with high token overlap", () => {
    assert.equal(
      isTitleMatch(
        "We Don't Talk About Bruno",
        "We Don't Talk About Bruno From Encanto"
      ).isMatch,
      true
    );
  });

  test("rejects completely different titles", () => {
    assert.equal(isTitleMatch("Cruel Summer", "Bad Blood").isMatch, false);
    assert.equal(isTitleMatch("Not Like Us", "Euphoria").isMatch, false);
  });
});

describe("Strict Artist Matching", () => {
  test("matches exact and normalized artists", () => {
    assert.equal(isArtistMatch("Taylor Swift", "taylor swift").isMatch, true);
    assert.equal(isArtistMatch("The Weeknd", "the weeknd").isMatch, true);
  });

  test("matches collaborations with primary artist", () => {
    assert.equal(
      isArtistMatch("Lady Gaga & Bruno Mars", "Lady Gaga").isMatch,
      true
    );
    assert.equal(
      isArtistMatch("Lady Gaga", "Lady Gaga & Bruno Mars").isMatch,
      true
    );
  });

  test("rejects unrelated artists", () => {
    assert.equal(isArtistMatch("Taylor Swift", "Kanye West").isMatch, false);
    assert.equal(isArtistMatch("Drake", "Kendrick Lamar").isMatch, false);
  });
});

describe("Album Matching & Verification", () => {
  test("matches same album names", () => {
    assert.equal(isAlbumMatch("After Hours", "after hours"), true);
    assert.equal(isAlbumMatch("Future Nostalgia", "Future Nostalgia (The Moonlight Edition)"), true);
  });

  test("rejects mismatched album names", () => {
    assert.equal(isAlbumMatch("After Hours", "Starboy"), false);
    assert.equal(isAlbumMatch("Midnights", "1989"), false);
  });
});

describe("Overall Match Scoring & Cutoff", () => {
  test("gives passing score (>= 75) for genuine matches", () => {
    const result = scoreCanvasMatch(
      { title: "Blinding Lights", artist: "The Weeknd", album: "After Hours" },
      { title: "Blinding Lights", artist: "The Weeknd", album: "After Hours" }
    );
    assert.equal(result.isMatch, true);
    assert.ok(result.score >= 90);
  });

  test("strictly fails score (< 75) when song title is wrong even if artist matches", () => {
    const result = scoreCanvasMatch(
      { title: "Stay", artist: "The Kid LAROI", album: "F*CK LOVE 3" },
      { title: "Stay With Me", artist: "The Kid LAROI", album: "F*CK LOVE 3" }
    );
    assert.equal(result.isMatch, false);
    assert.equal(result.score, 0);
  });

  test("strictly fails score when artist is wrong even if title matches", () => {
    const result = scoreCanvasMatch(
      { title: "Circles", artist: "Post Malone" },
      { title: "Circles", artist: "Mac Miller" }
    );
    assert.equal(result.isMatch, false);
    assert.equal(result.score, 0);
  });
});

describe("CuratedCanvasProvider", () => {
  const provider = new CuratedCanvasProvider();

  test("returns verified motion artwork for iconic hits", async () => {
    const result = await provider.getCanvas({
      title: "Blinding Lights",
      artist: "The Weeknd",
    });
    assert.ok(result);
    assert.equal(result.hasCanvas, true);
    assert.equal(result.source, "curated");
    assert.ok(result.animatedCover?.url.includes(".m3u8"));
  });

  test("returns verified animated album artwork when queried by album name", async () => {
    const result = await provider.getCanvas({
      title: "",
      artist: "The Weeknd",
      album: "After Hours",
    });
    assert.ok(result);
    assert.equal(result.hasCanvas, true);
    assert.equal(result.source, "curated");
    assert.equal(result.animatedCover?.album, "After Hours");
  });

  test("returns null for non-curated songs without fabricating matches", async () => {
    const result = await provider.getCanvas({
      title: "Random Indie Track",
      artist: "Unknown Artist",
    });
    assert.equal(result, null);
  });
});

describe("CanvasService Orchestration & Caching", () => {
  test("caches positive results and does not query providers again", async () => {
    let callCount = 0;
    const mockProvider: ICanvasProvider = {
      name: "mock",
      async getCanvas(query: CanvasQuery): Promise<CanvasResponse | null> {
        callCount++;
        return {
          hasCanvas: true,
          animatedCover: {
            url: "https://example.com/test.mp4",
            width: 720,
            height: 720,
            durationMs: null,
            format: "mp4",
            source: "mock",
            matchedTitle: query.title,
            matchedArtist: query.artist,
          },
          fallbackRequired: false,
          source: "mock",
        };
      },
    };

    const service = new CanvasService([mockProvider]);

    const res1 = await service.getCanvas({ title: "Mock Song", artist: "Mock Artist" });
    assert.equal(res1.hasCanvas, true);
    assert.equal(callCount, 1);

    const res2 = await service.getCanvas({ title: "Mock Song", artist: "Mock Artist" });
    assert.equal(res2.hasCanvas, true);
    assert.equal(callCount, 1); // Served from cache!
  });

  test("falls back gracefully when no canvas is found", async () => {
    const emptyProvider: ICanvasProvider = {
      name: "empty",
      async getCanvas(): Promise<CanvasResponse | null> {
        return null;
      },
    };

    const service = new CanvasService([emptyProvider]);
    const res = await service.getCanvas({ title: "No Video Song", artist: "Unknown Artist" });

    assert.equal(res.hasCanvas, false);
    assert.equal(res.animatedCover, null);
    assert.equal(res.fallbackRequired, true);
  });

  test("handles pure album queries with empty title in CanvasService", async () => {
    let queriedQuery: any = null;
    const albumMockProvider: ICanvasProvider = {
      name: "album-mock",
      async getCanvas(query: CanvasQuery): Promise<CanvasResponse | null> {
        queriedQuery = query;
        return {
          hasCanvas: true,
          animatedCover: {
            url: "https://example.com/album.m3u8",
            width: 720,
            height: 720,
            durationMs: null,
            format: "hls",
            source: "apple-music",
            album: query.album,
          },
          fallbackRequired: false,
          source: "apple-music",
        };
      },
    };

    const service = new CanvasService([albumMockProvider]);
    const res = await service.getCanvas({
      title: "",
      artist: "Olivia Rodrigo",
      album: "you seem pretty sad for a girl so in love",
    });

    assert.equal(res.hasCanvas, true);
    assert.equal(queriedQuery?.album, "you seem pretty sad for a girl so in love");
    assert.equal(res.animatedCover?.url, "https://example.com/album.m3u8");
  });

  test("generates tinted Apple Music background gradient", () => {
    const { getAppleMusicBackground } = require("../src/lib/useArtworkColors");
    const bg = getAppleMusicBackground("#7c939f");
    assert.ok(bg.includes("radial-gradient"));
    assert.ok(bg.includes("linear-gradient"));
    assert.ok(bg.includes("rgb("));
  });
});

describe("Apple Music Artist Info & Wordmark Logo Service", () => {
  const { getAppleArtistInfo } = require("../src/lib/appleArtistService");
  const { isArtistMatch } = require("../src/lib/canvas/matching");

  test("returns authentic artist logo for Olivia Rodrigo without confusing with Olivia Dean", async () => {
    const infoRodrigo = await getAppleArtistInfo("Olivia Rodrigo");
    assert.ok(infoRodrigo !== null);
    assert.equal(
      infoRodrigo.logoUrl,
      "https://is1-ssl.mzstatic.com/image/thumb/2ayJ04CqIfSdXp36oZA8yA/400x133bb.webp"
    );

    const infoDean = await getAppleArtistInfo("Olivia Dean");
    assert.ok(infoDean !== null);
    assert.equal(
      infoDean.logoUrl,
      "https://is1-ssl.mzstatic.com/image/thumb/Wcm2Bo9UxDiBqIsGMm19KA/400x133bb.webp"
    );
  });

  test("resolves typo 'olivia ridrigi' to Olivia Rodrigo and strictly rejects Olivia Dean", async () => {
    const info = await getAppleArtistInfo("olivia ridrigi");
    assert.ok(info !== null);
    assert.equal(
      info.logoUrl,
      "https://is1-ssl.mzstatic.com/image/thumb/2ayJ04CqIfSdXp36oZA8yA/400x133bb.webp"
    );

    // Verify matcher level rejection of Dean vs Rodrigo
    const matchDeanVsTypo = isArtistMatch("olivia ridrigi", "Olivia Dean");
    assert.equal(matchDeanVsTypo.isMatch, false);

    const matchDeanVsRodrigo = isArtistMatch("olivia rodrigo", "Olivia Dean");
    assert.equal(matchDeanVsRodrigo.isMatch, false);

    const matchRodrigoVsTypo = isArtistMatch("olivia ridrigi", "Olivia Rodrigo");
    assert.equal(matchRodrigoVsTypo.isMatch, true);
    assert.ok(matchRodrigoVsTypo.score >= 0.8);
  });

  test("normalizes artist names with case or whitespace differences", async () => {
    const info = await getAppleArtistInfo("  olivia rodrigo  ");
    assert.ok(info !== null);
    assert.equal(
      info.logoUrl,
      "https://is1-ssl.mzstatic.com/image/thumb/2ayJ04CqIfSdXp36oZA8yA/400x133bb.webp"
    );
  });

  test("handles empty or unknown artist gracefully without throwing", async () => {
    const emptyInfo = await getAppleArtistInfo("");
    assert.equal(emptyInfo, null);

    const unknownInfo = await getAppleArtistInfo("NonExistentArtistX999Z");
    assert.equal(unknownInfo, null);
  });
});
