import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeArtistName,
  extractConstituentArtists,
  getPrimaryArtist,
  selectDiverseRecommendations,
  selectDiversePlaylists,
  deduplicateArtists,
  parseRefreshOffset,
  isArtistMatch,
  type CandidateTrack,
} from "../src/lib/recommendations/recommendationEngine";

describe("Recommendation Engine: Artist Normalization & Extraction", () => {
  test("normalizes capitalization and excess whitespace cleanly", () => {
    assert.equal(normalizeArtistName("Taylor Swift"), "taylor swift");
    assert.equal(normalizeArtistName("  taylor swift  "), "taylor swift");
    assert.equal(normalizeArtistName("TAYLOR SWIFT"), "taylor swift");
    assert.equal(normalizeArtistName("The   Weeknd"), "the weeknd");
  });

  test("strips '- Topic', 'VEVO', channel noise, and apostrophes", () => {
    assert.equal(normalizeArtistName("The Weeknd - Topic"), "the weeknd");
    assert.equal(normalizeArtistName("TaylorSwiftVEVO"), "taylorswift");
    assert.equal(normalizeArtistName("Adele Official Channel"), "adele");
    assert.equal(normalizeArtistName("Sony Music Records"), "sony");
    assert.equal(normalizeArtistName("Guns N' Roses"), "guns n roses");
  });

  test("extracts featured artists and collaborators from artist field and title", () => {
    const list1 = extractConstituentArtists("The Weeknd, Daft Punk");
    assert.deepEqual(list1, ["the weeknd", "daft punk"]);

    const list2 = extractConstituentArtists("Drake & 21 Savage");
    assert.deepEqual(list2, ["drake", "21 savage"]);

    const list3 = extractConstituentArtists("Drake", "Jimmy Cooks (feat. 21 Savage)");
    assert.deepEqual(list3, ["drake", "21 savage"]);

    const list4 = extractConstituentArtists("Metro Boomin", "Creepin' [ft. The Weeknd & 21 Savage]");
    assert.deepEqual(list4, ["metro boomin", "the weeknd", "21 savage"]);

    const list5 = extractConstituentArtists("Calvin Harris and Dua Lipa", "One Kiss");
    assert.deepEqual(list5, ["calvin harris", "dua lipa"]);
  });

  test("gracefully handles missing or unknown artist strings", () => {
    assert.deepEqual(extractConstituentArtists(""), []);
    assert.deepEqual(extractConstituentArtists(undefined), []);
    assert.deepEqual(extractConstituentArtists("Unknown Artist"), []);
    assert.deepEqual(extractConstituentArtists("Various Artists"), []);
    assert.equal(getPrimaryArtist("Unknown Artist"), "unknown");
    assert.equal(getPrimaryArtist(undefined), "unknown");
  });
});

describe("Recommendation Engine: Artist Diversity & Round-Robin Selection", () => {
  // 1. One artist returning many songs
  test("limits a single artist returning many songs to max 3 songs", () => {
    const candidates: CandidateTrack[] = Array.from({ length: 15 }, (_, i) => ({
      videoId: `adele_vid_${i}`,
      title: `Song ${i}`,
      artist: "Adele",
    }));

    const result = selectDiverseRecommendations(candidates, {
      targetCount: 12,
      maxPerArtist: 3,
      preferredMaxPerArtist: 2,
    });

    // Hard ceiling of 3 per artist must be respected even though 15 were provided
    assert.equal(result.length, 3);
    assert.ok(result.every((t) => t.artist === "Adele"));
    // Ensure all 3 have distinct video IDs
    const ids = new Set(result.map((t) => t.videoId));
    assert.equal(ids.size, 3);
  });

  // 2. Multiple artists with uneven candidate counts
  test("produces balanced round-robin selection (A1, B1, C1, A2, B2, C2, A3, B3, C3) for uneven pools", () => {
    // 8 from Artist A, 6 from Artist B, 5 from Artist C
    const poolA: CandidateTrack[] = Array.from({ length: 8 }, (_, i) => ({
      videoId: `vid_A_${i}`,
      title: `Song A${i + 1}`,
      artist: "Artist A",
    }));
    const poolB: CandidateTrack[] = Array.from({ length: 6 }, (_, i) => ({
      videoId: `vid_B_${i}`,
      title: `Song B${i + 1}`,
      artist: "Artist B",
    }));
    const poolC: CandidateTrack[] = Array.from({ length: 5 }, (_, i) => ({
      videoId: `vid_C_${i}`,
      title: `Song C${i + 1}`,
      artist: "Artist C",
    }));

    const candidates = [...poolA, ...poolB, ...poolC];

    const result = selectDiverseRecommendations(candidates, {
      preferredArtists: ["Artist A", "Artist B", "Artist C"],
      targetCount: 12,
      maxPerArtist: 3,
      preferredMaxPerArtist: 2,
    });

    // Exactly 9 songs should be selected (3 for each artist)
    assert.equal(result.length, 9);

    // Verify round-robin sequence: A1, B1, C1, A2, B2, C2, A3, B3, C3
    const expectedTitles = ["Song A1", "Song B1", "Song C1", "Song A2", "Song B2", "Song C2", "Song A3", "Song B3", "Song C3"];
    assert.deepEqual(
      result.map((t) => t.title),
      expectedTitles
    );

    // Verify per-artist count
    const counts = new Map<string, number>();
    for (const t of result) {
      counts.set(t.artist, (counts.get(t.artist) || 0) + 1);
    }
    assert.equal(counts.get("Artist A"), 3);
    assert.equal(counts.get("Artist B"), 3);
    assert.equal(counts.get("Artist C"), 3);
  });

  // 3. Target 2 songs per artist when enough valid results are available
  test("preferably targets 2 songs per artist when enough unique artists are available", () => {
    // 6 artists with 4 songs each (total 24 songs, target 12 songs)
    const candidates: CandidateTrack[] = [];
    const artists = ["Artist 1", "Artist 2", "Artist 3", "Artist 4", "Artist 5", "Artist 6"];
    for (const art of artists) {
      for (let i = 0; i < 4; i++) {
        candidates.push({
          videoId: `${art}_vid_${i}`,
          title: `${art} - Track ${i}`,
          artist: art,
        });
      }
    }

    const result = selectDiverseRecommendations(candidates, {
      preferredArtists: artists,
      targetCount: 12,
      maxPerArtist: 3,
      preferredMaxPerArtist: 2,
    });

    // Should return 12 songs
    assert.equal(result.length, 12);

    // Each of the 6 artists must have exactly 2 songs, none should have 3
    for (const art of artists) {
      const artSongs = result.filter((t) => t.artist === art);
      assert.equal(artSongs.length, 2, `Expected ${art} to have exactly 2 songs, got ${artSongs.length}`);
    }
  });

  // 4. Duplicate video IDs
  test("eliminates duplicate video IDs across candidates", () => {
    const candidates: CandidateTrack[] = [
      { videoId: "dup12345678", title: "Song 1", artist: "Artist A" },
      { videoId: "dup12345678", title: "Song 1 (Re-upload)", artist: "Artist A" },
      { videoId: "dup12345678", title: "Song 1", artist: "Artist B" },
      { videoId: "uniq2345678", title: "Song 2", artist: "Artist B" },
    ];

    const result = selectDiverseRecommendations(candidates, { targetCount: 12 });
    assert.equal(result.length, 2);
    assert.equal(result[0].videoId, "dup12345678");
    assert.equal(result[1].videoId, "uniq2345678");
  });

  // 5. Artist names with different capitalization, whitespace, or minor formatting
  test("merges artist variations ('The Weeknd', 'the weeknd', 'The Weeknd - Topic') under same limit", () => {
    const candidates: CandidateTrack[] = [
      { videoId: "v1_weeknd", title: "Blinding Lights", artist: "The Weeknd" },
      { videoId: "v2_weeknd", title: "Save Your Tears", artist: "the weeknd" },
      { videoId: "v3_weeknd", title: "Starboy", artist: "  THE WEEKND  " },
      { videoId: "v4_weeknd", title: "In Your Eyes", artist: "The Weeknd - Topic" },
      { videoId: "v5_weeknd", title: "After Hours", artist: "The Weeknd" },
    ];

    const result = selectDiverseRecommendations(candidates, {
      targetCount: 12,
      maxPerArtist: 3,
    });

    // Max 3 per artist must group all these variations together
    assert.equal(result.length, 3);
  });

  // 6. Collaborator and featured artist diversity enforcement
  test("does not treat featured artists or collaborators as unrelated songs", () => {
    const candidates: CandidateTrack[] = [
      { videoId: "drake_1", title: "God's Plan", artist: "Drake" },
      { videoId: "drake_2", title: "Hotline Bling", artist: "Drake" },
      { videoId: "drake_collab_1", title: "Jimmy Cooks (feat. 21 Savage)", artist: "Drake" },
      { videoId: "travis_1", title: "SICKO MODE", artist: "Travis Scott" },
      // Drake reaches 3 songs; a song featuring Drake should be rejected even though primary artist is Travis Scott
      { videoId: "drake_collab_2", title: "Meltdown", artist: "Travis Scott feat. Drake" },
    ];

    const result = selectDiverseRecommendations(candidates, {
      preferredArtists: ["Drake", "Travis Scott"],
      targetCount: 12,
      maxPerArtist: 3,
      preferredMaxPerArtist: 2,
    });

    // In pass 1 (cap 2):
    // Round 1: Drake ("God's Plan"), Travis Scott ("SICKO MODE")
    // Round 2: Drake ("Hotline Bling")
    // In pass 2 (cap 3):
    // Round 3: Drake ("Jimmy Cooks (feat. 21 Savage)") -> Drake count is now 3
    // Next candidate: "Meltdown" has Drake as featured artist, but Drake is at limit 3 -> rejected!
    const videoIds = result.map((t) => t.videoId);
    assert.ok(videoIds.includes("drake_1"));
    assert.ok(videoIds.includes("drake_2"));
    assert.ok(videoIds.includes("drake_collab_1"));
    assert.ok(videoIds.includes("travis_1"));
    assert.ok(!videoIds.includes("drake_collab_2"), "Collaborator song with Drake should be rejected when Drake is at limit");
  });

  // 7. Missing or unknown artist metadata
  test("handles missing or unknown artist metadata gracefully", () => {
    const candidates: CandidateTrack[] = [
      { videoId: "unk_1", title: "Track 1", artist: "" },
      { videoId: "unk_2", title: "Track 2", artist: "Unknown Artist" },
      { videoId: "unk_3", title: "Track 3", artist: "Unknown" },
      { videoId: "art_1", title: "Track 4", artist: "Adele" },
    ];

    const result = selectDiverseRecommendations(candidates, {
      preferredArtists: ["Adele"],
      targetCount: 12,
    });

    assert.ok(result.length > 0);
    // Adele should be selected, and unknown tracks handled safely without crashing
    assert.ok(result.some((t) => t.artist === "Adele"));
  });

  // 8. Insufficient unique artists
  test("respects maxPerArtist hard limit when unique artists are insufficient to fill target count", () => {
    // Only 2 artists available, each with 10 songs. Target is 12.
    const candidates: CandidateTrack[] = [
      ...Array.from({ length: 10 }, (_, i) => ({
        videoId: `a_${i}`,
        title: `Song A${i}`,
        artist: "Artist A",
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        videoId: `b_${i}`,
        title: `Song B${i}`,
        artist: "Artist B",
      })),
    ];

    const result = selectDiverseRecommendations(candidates, {
      preferredArtists: ["Artist A", "Artist B"],
      targetCount: 12,
      maxPerArtist: 3,
      preferredMaxPerArtist: 2,
    });

    // Max 3 per artist across 2 artists = 6 songs maximum
    assert.equal(result.length, 6);
    const countA = result.filter((t) => t.artist === "Artist A").length;
    const countB = result.filter((t) => t.artist === "Artist B").length;
    assert.equal(countA, 3);
    assert.equal(countB, 3);
  });

  // 9. Refresh behavior returning alternatives when available
  test("returns alternative candidates on refresh when surplus candidates exist", () => {
    // 3 artists with 6 songs each (18 candidates total). Target 6 songs.
    const candidates: CandidateTrack[] = [];
    const artists = ["Artist A", "Artist B", "Artist C"];
    for (const art of artists) {
      for (let i = 0; i < 6; i++) {
        candidates.push({
          videoId: `${art}_vid_${i}`,
          title: `${art} - Song ${i}`,
          artist: art,
        });
      }
    }

    // Run 1: offset 0 (initial recommendation load)
    const run1 = selectDiverseRecommendations(candidates, {
      preferredArtists: artists,
      targetCount: 6,
      maxPerArtist: 3,
      preferredMaxPerArtist: 2,
      offset: 0,
    });

    // Run 2: offset 1 (simulating refresh with different timestamp / offset)
    const run2 = selectDiverseRecommendations(candidates, {
      preferredArtists: artists,
      targetCount: 6,
      maxPerArtist: 3,
      preferredMaxPerArtist: 2,
      offset: 1,
    });

    // Both runs must return 6 songs and respect per-artist limits
    assert.equal(run1.length, 6);
    assert.equal(run2.length, 6);

    const run1Ids = run1.map((t) => t.videoId);
    const run2Ids = run2.map((t) => t.videoId);

    // The two runs must NOT be identical: alternative candidates should be surfaced!
    const identical = run1Ids.every((id, idx) => id === run2Ids[idx]);
    assert.equal(identical, false, "Refresh must return alternative candidates when available");

    // Both runs should still feature balanced distribution
    for (const art of artists) {
      assert.equal(run1.filter((t) => t.artist === art).length, 2);
      assert.equal(run2.filter((t) => t.artist === art).length, 2);
    }
  });

  test("parses refresh offset from query parameters", () => {
    const req1 = new Request("http://localhost/api/audio/personalized?offset=5");
    assert.equal(parseRefreshOffset(req1), 5);

    const req2 = new Request("http://localhost/api/audio/personalized?seed=12");
    assert.equal(parseRefreshOffset(req2), 12);

    const req3 = new Request("http://localhost/api/audio/personalized?t=1740000000");
    assert.equal(typeof parseRefreshOffset(req3), "number");
    assert.ok(parseRefreshOffset(req3) >= 0);

    const req4 = new Request("http://localhost/api/audio/personalized");
    assert.equal(parseRefreshOffset(req4), 0);
  });
});

import { GET as getAudioPersonalized } from "../src/app/api/audio/personalized/route";
import { GET as getVideoPersonalized } from "../src/app/api/music-videos/personalized/route";
import { getPublicYTMusic, getYTMusic } from "../src/lib/ytmClient";

describe("Personalized Recommendation Route Handlers", () => {
  test("GET /api/audio/personalized respects per-artist limit when pool is dominated by one artist", async () => {
    const ytm = await getPublicYTMusic();
    const originalGetUpNexts = ytm.getUpNexts;
    const originalSearchSongs = ytm.searchSongs;
    const originalFetch = global.fetch;

    try {
      // Simulate UpNext returning 10 songs by Adele
      ytm.getUpNexts = async () =>
        Array.from({ length: 10 }, (_, i) => ({
          videoId: `adele_up_${i}11`,
          title: `Adele Hit ${i}`,
          artists: [{ name: "Adele" }],
          duration: "3:30",
        })) as any;

      // Simulate searchSongs returning 5 songs by Adele
      ytm.searchSongs = async (q: string) =>
        Array.from({ length: 5 }, (_, i) => ({
          videoId: `search_${i}1122`,
          title: `${q} Song ${i}`,
          artists: [{ name: "Adele" }],
          duration: "3:30",
        })) as any;

      // Mock YouTube activity & liked songs via fetch
      global.fetch = async (url: string | URL | Request) => {
        const u = String(url);
        if (u.includes("channels?part=contentDetails")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ items: [{ contentDetails: { relatedPlaylists: { likes: "LL123" } } }] }),
          } as any;
        }
        if (u.includes("playlistItems")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  contentDetails: { videoId: "seed_vid_123" },
                  snippet: { title: "Rolling in the Deep", videoOwnerChannelTitle: "Adele" },
                },
              ],
            }),
          } as any;
        }
        if (u.includes("videos?part=")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  id: "seed_vid_123",
                  snippet: { title: "Rolling in the Deep", channelTitle: "Adele", categoryId: "10" },
                  contentDetails: { duration: "PT3M48S" },
                },
              ],
            }),
          } as any;
        }
        return { ok: true, status: 200, json: async () => ({ items: [] }) } as any;
      };

      const req = new Request("http://localhost/api/audio/personalized", {
        headers: { authorization: "Bearer test_token" },
      });

      const res = await getAudioPersonalized(req);
      assert.equal(res.status, 200);

      const data = await res.json();
      assert.ok(Array.isArray(data.items));
      assert.ok(data.items.length > 0);

      // Must strictly respect max 3 songs per artist limit
      const adeleSongs = data.items.filter((t: any) =>
        t.author.toLowerCase().includes("adele")
      );
      assert.ok(
        adeleSongs.length <= 3,
        `Expected Adele to have at most 3 songs in Audio Picks, got ${adeleSongs.length}`
      );
    } finally {
      ytm.getUpNexts = originalGetUpNexts;
      ytm.searchSongs = originalSearchSongs;
      global.fetch = originalFetch;
    }
  });

  test("GET /api/music-videos/personalized respects per-artist limit and eliminates duplicates", async () => {
    const originalFetch = global.fetch;

    try {
      global.fetch = async (url: string | URL | Request) => {
        const u = String(url);
        if (u.includes("channels?part=contentDetails")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ items: [{ contentDetails: { relatedPlaylists: { likes: "LL123" } } }] }),
          } as any;
        }
        if (u.includes("playlistItems")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  contentDetails: { videoId: "seed_vid_456" },
                  snippet: { title: "Cruel Summer", videoOwnerChannelTitle: "Taylor Swift" },
                },
              ],
            }),
          } as any;
        }
        if (u.includes("videos?part=")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  id: "seed_vid_456",
                  snippet: { title: "Cruel Summer", channelTitle: "Taylor Swift", categoryId: "10" },
                  contentDetails: { duration: "PT2M58S" },
                },
              ],
            }),
          } as any;
        }
        // Simulate related videos or music category searches returning 10 videos by Taylor Swift
        if (u.includes("search?")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: Array.from({ length: 10 }, (_, i) => ({
                id: { videoId: `taylor_search_${i}1` },
                snippet: {
                  title: `Taylor Swift Music Video ${i}`,
                  channelTitle: "Taylor Swift",
                  thumbnails: { high: { url: "" } },
                },
                contentDetails: { duration: "PT3M30S" },
              })),
            }),
          } as any;
        }
        return { ok: true, status: 200, json: async () => ({ items: [] }) } as any;
      };

      const req = new Request("http://localhost/api/music-videos/personalized", {
        headers: { authorization: "Bearer test_token" },
      });

      const res = await getVideoPersonalized(req);
      assert.equal(res.status, 200);

      const data = await res.json();
      assert.ok(Array.isArray(data.items));
      assert.ok(data.items.length > 0);

      // Must strictly respect max 3 songs per artist
      const taylorSongs = data.items.filter((t: any) =>
        t.author.toLowerCase().includes("taylor swift")
      );
      assert.ok(
        taylorSongs.length <= 3,
        `Expected Taylor Swift to have at most 3 songs in Music Videos, got ${taylorSongs.length}`
      );

      // Verify no duplicate video IDs
      const ids = new Set(data.items.map((t: any) => t.videoId));
      assert.equal(ids.size, data.items.length);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("GET /api/live/personalized respects channel diversity and filters non-music streams", async () => {
    const { GET: getLivePersonalized } = await import("../src/app/api/live/personalized/route");
    const originalFetch = global.fetch;

    try {
      global.fetch = async (url: string | URL | Request) => {
        const u = String(url);
        if (u.includes("channels?part=contentDetails")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ items: [{ contentDetails: { relatedPlaylists: { likes: "LL123" } } }] }),
          } as any;
        }
        if (u.includes("playlistItems")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  contentDetails: { videoId: "seed_vid_789" },
                  snippet: { title: "Starboy", videoOwnerChannelTitle: "The Weeknd" },
                },
              ],
            }),
          } as any;
        }
        if (u.includes("videos?part=")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  id: "seed_vid_789",
                  snippet: { title: "Starboy", channelTitle: "The Weeknd", categoryId: "10" },
                  contentDetails: { duration: "PT3M50S" },
                },
              ],
            }),
          } as any;
        }
        // Return 6 live streams from "PESIARnet" and 4 from "Lofi Girl"
        if (u.includes("search?")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                ...Array.from({ length: 6 }, (_, i) => ({
                  id: { videoId: `pesiar_live_${i}` },
                  snippet: {
                    title: `🔴 LIVE 🌴 Beautiful Beach 🏖️ Chill Music Vol ${i}`,
                    channelTitle: "PESIARnet",
                    thumbnails: { high: { url: "" } },
                  },
                })),
                ...Array.from({ length: 4 }, (_, i) => ({
                  id: { videoId: `lofi_live_${i}` },
                  snippet: {
                    title: `lofi hip hop radio - beats to relax/study to ${i}`,
                    channelTitle: "Lofi Girl",
                    thumbnails: { high: { url: "" } },
                  },
                })),
              ],
            }),
          } as any;
        }
        return { ok: true, status: 200, json: async () => ({ items: [] }) } as any;
      };

      const req = new Request("http://localhost/api/live/personalized", {
        headers: { authorization: "Bearer test_token" },
      });

      const res = await getLivePersonalized(req);
      assert.equal(res.status, 200);

      const data = await res.json();
      assert.ok(Array.isArray(data.items));
      assert.ok(data.items.length > 0);

      // Channel diversity: PESIARnet must be limited to at most 2 streams!
      const pesiarStreams = data.items.filter((t: any) =>
        t.author.toLowerCase().includes("pesiarnet")
      );
      assert.ok(
        pesiarStreams.length <= 2,
        `Expected PESIARnet to have at most 2 streams, got ${pesiarStreams.length}`
      );

      // All items must be marked as isLive
      assert.ok(data.items.every((t: any) => t.isLive === true));
    } finally {
      global.fetch = originalFetch;
    }
  });
});

import { isLikelyMusicLiveStream } from "../src/lib/recommendations/recommendationEngine";

describe("Live Stream Content Quality & Music Relevance Filter", () => {
  test("strictly rejects live view count and subscriber counter streams", () => {
    assert.equal(
      isLikelyMusicLiveStream({
        title: "Most Viewed Music Videos on YouTube 2026 - Live count",
        author: "DSC Top music charts",
      }),
      false
    );

    assert.equal(
      isLikelyMusicLiveStream({
        title: "TOP 50 ... LIVE count",
        author: "SubGalaxy",
      }),
      false
    );

    assert.equal(
      isLikelyMusicLiveStream({
        title: "Realtime Subscriber Count Live",
        author: "LiveStats",
      }),
      false
    );
  });

  test("strictly rejects celebrity gossip, red carpet news, and paparazzi streams", () => {
    assert.equal(
      isLikelyMusicLiveStream({
        title: "Priyanka Chopra, Taylor Swift, Kim Kardashian & More Make Academy Museum Carpet",
        author: "zoom",
      }),
      false
    );

    assert.equal(
      isLikelyMusicLiveStream({
        title: "Celebrity Gossip and Red Carpet Arrivals LIVE",
        author: "E! News",
      }),
      false
    );
  });

  test("strictly rejects cartoons, animations, and kids swimming pool content", () => {
    assert.equal(
      isLikelyMusicLiveStream({
        title: "🔴 LIVE 24/7 | What Happened at the Swimming Pool? 😱",
        author: "Family Life English",
      }),
      false
    );

    assert.equal(
      isLikelyMusicLiveStream({
        title: "Cocomelon Nursery Rhymes Cartoon for Kids Live",
        author: "Kids Animation World",
      }),
      false
    );
  });

  test("strictly rejects gaming streams", () => {
    assert.equal(
      isLikelyMusicLiveStream({
        title: "Roblox Live 24/7 with Viewers",
        author: "GamerPro",
      }),
      false
    );
  });

  test("accepts genuine music live streams, acoustic sessions, and DJ sets", () => {
    assert.equal(
      isLikelyMusicLiveStream({
        title: "🔴 LIVE 🌴 Beautiful Beach 🏖️ Chill, Healing & Relaxing Music",
        author: "PESIARnet",
        categoryId: "10",
      }),
      true
    );

    assert.equal(
      isLikelyMusicLiveStream({
        title: "lofi hip hop radio - beats to relax/study to",
        author: "Lofi Girl",
        categoryId: "10",
      }),
      true
    );

    assert.equal(
      isLikelyMusicLiveStream({
        title: "Live Acoustic Guitar & Vocals Session",
        author: "Acoustic Morning",
      }),
      true
    );

    assert.equal(
      isLikelyMusicLiveStream({
        title: "Electronic DJ Set Live at Tomorrowland",
        author: "Festival Live",
      }),
      true
    );
  });
});

describe("Recommendation Engine: Artist Deduplication (deduplicateArtists)", () => {
  test("eliminates duplicates and normalizes artist variations like - Topic", () => {
    const rawArtists = [
      { id: "1", name: "The Weeknd" },
      { id: "2", name: "The Weeknd - Topic" },
      { id: "3", name: "THE WEEKND" },
      { id: "4", name: "Kendrick Lamar" },
      { id: "5", name: "Kendrick Lamar - Topic" },
      { id: "6", name: "Taylor Swift" },
    ];

    const result = deduplicateArtists(rawArtists);
    assert.equal(result.length, 3);
    assert.deepEqual(
      result.map((a) => a.name),
      ["The Weeknd", "Kendrick Lamar", "Taylor Swift"]
    );
  });

  test("discards unknown, empty, and generic artist names", () => {
    const rawArtists = [
      { id: "1", name: "" },
      { id: "2", name: "Unknown" },
      { id: "3", name: "Unknown Artist" },
      { id: "4", name: "Various Artists" },
      { id: "5", name: "Billie Eilish" },
    ];

    const result = deduplicateArtists(rawArtists);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Billie Eilish");
  });

  test("respects targetCount and rotates candidates with offset on refresh", () => {
    const artists = [
      { id: "1", name: "Artist 1" },
      { id: "2", name: "Artist 2" },
      { id: "3", name: "Artist 3" },
      { id: "4", name: "Artist 4" },
      { id: "5", name: "Artist 5" },
    ];

    const resOffset0 = deduplicateArtists(artists, { targetCount: 3, offset: 0 });
    assert.equal(resOffset0.length, 3);
    assert.deepEqual(
      resOffset0.map((a) => a.name),
      ["Artist 1", "Artist 2", "Artist 3"]
    );

    const resOffset2 = deduplicateArtists(artists, { targetCount: 3, offset: 2 });
    assert.equal(resOffset2.length, 3);
    assert.deepEqual(
      resOffset2.map((a) => a.name),
      ["Artist 3", "Artist 4", "Artist 5"]
    );
  });
});

describe("Recommendation Engine: Playlist Diversity (selectDiversePlaylists)", () => {
  test("caps dominance by a single curator or channel at max 2 playlists", () => {
    const candidates = [
      { id: "pl_1", title: "Mix 1", author: "SuperCurator" },
      { id: "pl_2", title: "Mix 2", author: "SuperCurator" },
      { id: "pl_3", title: "Mix 3", author: "SuperCurator" },
      { id: "pl_4", title: "Mix 4", author: "SuperCurator" },
      { id: "pl_5", title: "Indie Mix", author: "IndieVibes" },
      { id: "pl_6", title: "Rock Mix", author: "RockWorld" },
    ];

    const result = selectDiversePlaylists(candidates, {
      targetCount: 12,
      maxPerAuthor: 2,
    });

    const superCuratorCount = result.filter(
      (p) => p.author === "SuperCurator"
    ).length;
    assert.equal(superCuratorCount, 2);
    assert.equal(result.length, 4);
  });

  test("eliminates duplicate playlist IDs and near-duplicate normalized titles", () => {
    const candidates = [
      { id: "pl_dup", title: "Today's Top Hits", author: "Curator A" },
      { id: "pl_dup", title: "Today's Top Hits (Re-uploaded)", author: "Curator B" },
      { id: "pl_unique_1", title: "Todays Top Hits!", author: "Curator C" },
      { id: "pl_unique_2", title: "Acoustic Afternoon", author: "Curator D" },
    ];

    const result = selectDiversePlaylists(candidates, { targetCount: 12 });
    // Should drop identical ID and duplicate normalized title "todays top hits"
    assert.equal(result.length, 2);
    assert.equal(result[0].id, "pl_dup");
    assert.equal(result[1].id, "pl_unique_2");
  });

  test("rotates playlist selection with offset for refresh variety", () => {
    const candidates = Array.from({ length: 10 }, (_, i) => ({
      id: `pl_${i}`,
      title: `Unique Playlist Title ${i}`,
      author: `Author ${i}`,
    }));

    const page1 = selectDiversePlaylists(candidates, { targetCount: 4, offset: 0 });
    const page2 = selectDiversePlaylists(candidates, { targetCount: 4, offset: 4 });

    assert.equal(page1.length, 4);
    assert.equal(page2.length, 4);
    assert.notDeepEqual(
      page1.map((p) => p.id),
      page2.map((p) => p.id)
    );
    assert.deepEqual(
      page2.map((p) => p.id),
      ["pl_4", "pl_5", "pl_6", "pl_7"]
    );
  });
});

import { GET as getArtistsPersonalized } from "../src/app/api/artists/personalized/route";
import { GET as getPlaylistsPersonalized } from "../src/app/api/playlists/personalized/route";

describe("Personalized Artists & Playlists Route Handlers", () => {
  test("GET /api/artists/personalized returns 401 when unauthorized", async () => {
    const req = new Request("http://localhost/api/artists/personalized");
    const res = await getArtistsPersonalized(req);
    assert.equal(res.status, 401);
  });

  test("GET /api/artists/personalized returns diverse deduplicated artists", async () => {
    const originalFetch = global.fetch;
    const ytm = await getYTMusic();
    const origSearchArtists = ytm.searchArtists;

    try {
      ytm.searchArtists = (async (q: string) => [
        {
          artistId: `id_${q.toLowerCase().replace(/\s+/g, "_")}`,
          name: q,
          thumbnails: [{ url: `https://example.com/${q}.jpg` }],
        },
      ]) as any;

      global.fetch = async (url: string | URL | Request) => {
        const u = String(url);
        if (u.includes("channels?part=contentDetails")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [{ contentDetails: { relatedPlaylists: { likes: "LL123" } } }],
            }),
          } as any;
        }
        if (u.includes("playlistItems")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  contentDetails: { videoId: "art_vid_1" },
                  snippet: { title: "Song 1", videoOwnerChannelTitle: "The Weeknd" },
                },
                {
                  contentDetails: { videoId: "art_vid_2" },
                  snippet: { title: "Song 2", videoOwnerChannelTitle: "Kendrick Lamar" },
                },
                {
                  contentDetails: { videoId: "art_vid_3" },
                  snippet: { title: "Song 3", videoOwnerChannelTitle: "Dua Lipa" },
                },
              ],
            }),
          } as any;
        }
        return { ok: true, status: 200, json: async () => ({ items: [] }) } as any;
      };

      const req = new Request("http://localhost/api/artists/personalized", {
        headers: { authorization: "Bearer test_token" },
      });

      const res = await getArtistsPersonalized(req);
      assert.equal(res.status, 200);

      const data = await res.json();
      assert.ok(Array.isArray(data.items));
      // Artists must be deduplicated
      const names = data.items.map((a: any) => a.name.toLowerCase());
      const uniqueNames = new Set(names);
      assert.equal(names.length, uniqueNames.size);
    } finally {
      ytm.searchArtists = origSearchArtists;
      global.fetch = originalFetch;
    }
  });

  test("GET /api/playlists/personalized returns 401 when unauthorized", async () => {
    const req = new Request("http://localhost/api/playlists/personalized");
    const res = await getPlaylistsPersonalized(req);
    assert.equal(res.status, 401);
  });

  test("GET /api/playlists/personalized returns diverse playlists", async () => {
    const originalFetch = global.fetch;
    const ytm = await getYTMusic();
    const origSearchPlaylists = ytm.searchPlaylists;

    try {
      ytm.searchPlaylists = (async (q: string) => [
        {
          playlistId: `pl_${q.toLowerCase().replace(/\s+/g, "_")}`,
          name: `${q} Mix`,
          author: "Curator",
          thumbnails: [{ url: `https://example.com/${q}.jpg` }],
        },
      ]) as any;

      global.fetch = async (url: string | URL | Request) => {
        const u = String(url);
        if (u.includes("channels?part=contentDetails")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [{ contentDetails: { relatedPlaylists: { likes: "LL123" } } }],
            }),
          } as any;
        }
        if (u.includes("playlistItems")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  contentDetails: { videoId: "pl_vid_1" },
                  snippet: { title: "Starboy", videoOwnerChannelTitle: "The Weeknd" },
                },
              ],
            }),
          } as any;
        }
        return { ok: true, status: 200, json: async () => ({ items: [] }) } as any;
      };

      const req = new Request("http://localhost/api/playlists/personalized", {
        headers: { authorization: "Bearer test_token" },
      });

      const res = await getPlaylistsPersonalized(req);
      assert.equal(res.status, 200);

      const data = await res.json();
      assert.ok(Array.isArray(data.items));
      // Playlists must be capped per curator
      const authorMap = new Map<string, number>();
      for (const pl of data.items) {
        if (pl.author && pl.author !== "YouTube Music") {
          authorMap.set(pl.author, (authorMap.get(pl.author) || 0) + 1);
        }
      }
      for (const [author, count] of authorMap.entries()) {
        assert.ok(
          count <= 2,
          `Expected curator ${author} to have at most 2 playlists, got ${count}`
        );
      }
    } finally {
      ytm.searchPlaylists = origSearchPlaylists;
      global.fetch = originalFetch;
    }
  });
});

describe("Recommendation Engine: False Artist Matching Prevention & Explicit Title Collaborations", () => {
  test("does not treat 'Channuka' appearing in a song title by another artist as performed by Channuka", () => {
    // Song 1: "The Channuka Song" by Adam Sandler
    const artists1 = extractConstituentArtists("Adam Sandler", "The Channuka Song");
    assert.deepEqual(artists1, ["adam sandler"]);
    assert.equal(isArtistMatch("Adam Sandler", "The Channuka Song", "Channuka"), false);

    // Song 2: "Channuka Miracle" by Rabbi Shlomo
    const artists2 = extractConstituentArtists("Rabbi Shlomo", "Channuka Miracle");
    assert.deepEqual(artists2, ["rabbi shlomo"]);
    assert.equal(isArtistMatch("Rabbi Shlomo", "Channuka Miracle", "Channuka"), false);

    // Song 3: "Happy Channuka" by The Maccabeats
    const artists3 = extractConstituentArtists("The Maccabeats", "Happy Channuka");
    assert.deepEqual(artists3, ["the maccabeats"]);
    assert.equal(isArtistMatch("The Maccabeats", "Happy Channuka", "Channuka"), false);
  });

  test("correctly identifies songs actually performed by Channuka", () => {
    // Official single
    const artists1 = extractConstituentArtists("Channuka", "Aloke");
    assert.deepEqual(artists1, ["channuka"]);
    assert.equal(isArtistMatch("Channuka", "Aloke", "Channuka"), true);

    // Topic channel variant
    const artists2 = extractConstituentArtists("Channuka - Topic", "Sandawatha");
    assert.deepEqual(artists2, ["channuka"]);
    assert.equal(isArtistMatch("Channuka - Topic", "Sandawatha", "Channuka"), true);

    // Multi-artist collaboration in artist field
    const artists3 = extractConstituentArtists("Channuka & Chamath Sangeeth", "Neth Mane");
    assert.deepEqual(artists3, ["channuka", "chamath sangeeth"]);
    assert.equal(isArtistMatch("Channuka & Chamath Sangeeth", "Neth Mane", "Channuka"), true);
  });

  test("correctly identifies collaborations explicitly featuring Channuka", () => {
    // Parenthetical "(feat. Channuka)"
    const artists1 = extractConstituentArtists("Chamath Sangeeth", "Dewani Inima (feat. Channuka)");
    assert.deepEqual(artists1, ["chamath sangeeth", "channuka"]);
    assert.equal(isArtistMatch("Chamath Sangeeth", "Dewani Inima (feat. Channuka)", "Channuka"), true);

    // Unbracketed "ft. Channuka"
    const artists2 = extractConstituentArtists("Chamath Sangeeth", "Dewani Inima ft. Channuka");
    assert.deepEqual(artists2, ["chamath sangeeth", "channuka"]);
    assert.equal(isArtistMatch("Chamath Sangeeth", "Dewani Inima ft. Channuka", "Channuka"), true);

    // Square brackets "[featuring Channuka]"
    const artists3 = extractConstituentArtists("Chamath Sangeeth", "Dewani Inima [featuring Channuka]");
    assert.deepEqual(artists3, ["chamath sangeeth", "channuka"]);
    assert.equal(isArtistMatch("Chamath Sangeeth", "Dewani Inima [featuring Channuka]", "Channuka"), true);
  });

  test("does not extract artist names from unrelated titles without explicit collaboration markers", () => {
    // Interlude naming another artist
    const artists1 = extractConstituentArtists("Kendrick Lamar", "Taylor Swift (Interlude)");
    assert.deepEqual(artists1, ["kendrick lamar"]);
    assert.equal(isArtistMatch("Kendrick Lamar", "Taylor Swift (Interlude)", "Taylor Swift"), false);

    // Prince in title
    const artists2 = extractConstituentArtists("Will Smith", "The Fresh Prince of Bel-Air");
    assert.deepEqual(artists2, ["will smith"]);
    assert.equal(isArtistMatch("Will Smith", "The Fresh Prince of Bel-Air", "Prince"), false);

    // Song referencing Drake
    const artists3 = extractConstituentArtists("Another Artist", "Song for Drake");
    assert.deepEqual(artists3, ["another artist"]);
    assert.equal(isArtistMatch("Another Artist", "Song for Drake", "Drake"), false);

    // Non-collaboration title tags: "with" does not extract non-artist words
    const artists4 = extractConstituentArtists("Artist A", "Channuka (Live with Audience)");
    assert.deepEqual(artists4, ["artist a"]);
    assert.equal(artists4.includes("audience"), false);
    assert.equal(artists4.includes("channuka"), false);

    const artists5 = extractConstituentArtists("Artist A", "Channuka (Official Video with Lyrics)");
    assert.deepEqual(artists5, ["artist a"]);
    assert.equal(artists5.includes("lyrics"), false);
  });

  test("selectDiverseRecommendations does not assign songs with 'Channuka' in the title to the Channuka queue", () => {
    const candidates: CandidateTrack[] = [
      {
        videoId: "sandler_vid",
        title: "The Channuka Song",
        artist: "Adam Sandler",
      },
      {
        videoId: "channuka_real_1",
        title: "Aloke",
        artist: "Channuka",
      },
      {
        videoId: "channuka_real_2",
        title: "Sandawatha",
        artist: "Channuka",
      },
      {
        videoId: "taylor_vid_1",
        title: "Blank Space",
        artist: "Taylor Swift",
      },
    ];

    const result = selectDiverseRecommendations(candidates, {
      preferredArtists: ["Channuka", "Taylor Swift"],
      targetCount: 4,
      maxPerArtist: 2,
    });

    // "The Channuka Song" must NOT be treated as a song by Channuka
    const channukaSongs = result.filter(
      (t) => t.artist.toLowerCase() === "channuka"
    );
    assert.equal(channukaSongs.length, 2);
    assert.ok(channukaSongs.every((t) => t.title !== "The Channuka Song"));
  });

  test("GET /api/audio/personalized rejects false keyword matches returned by artist search", async () => {
    const originalFetch = global.fetch;
    const ytm = await getPublicYTMusic();
    const origGetUpNexts = ytm.getUpNexts;
    const origSearchSongs = ytm.searchSongs;

    try {
      // Simulate empty UpNext
      ytm.getUpNexts = async () => [];

      // Simulate searchSongs for "Channuka audio" returning 1 genuine song and 2 false title matches
      ytm.searchSongs = (async (q: string) => {
        if (q.toLowerCase().includes("channuka")) {
          return [
            {
              videoId: "false_match_1",
              title: "The Channuka Song",
              artists: [{ name: "Adam Sandler" }],
              duration: "3:40",
            },
            {
              videoId: "false_match_2",
              title: "Channuka Miracle",
              artists: [{ name: "Rabbi Shlomo" }],
              duration: "2:50",
            },
            {
              videoId: "genuine_channuka_1",
              title: "Aloke",
              artists: [{ name: "Channuka" }],
              duration: "3:30",
            },
          ];
        }
        return [
          {
            videoId: `other_vid_1`,
            title: "Other Song",
            artists: [{ name: "Other Artist" }],
            duration: "3:00",
          },
        ];
      }) as any;

      // Mock liked songs feed indicating user's top artist is "Channuka"
      global.fetch = async (url: string | URL | Request) => {
        const u = String(url);
        if (u.includes("channels?part=contentDetails")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [{ contentDetails: { relatedPlaylists: { likes: "LL123" } } }],
            }),
          } as any;
        }
        if (u.includes("playlistItems")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  contentDetails: { videoId: "chan_hist_1" },
                  snippet: { title: "Neth Mane", videoOwnerChannelTitle: "Channuka" },
                },
              ],
            }),
          } as any;
        }
        if (u.includes("videos?part=")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  id: "chan_hist_1",
                  snippet: { title: "Neth Mane", channelTitle: "Channuka", categoryId: "10" },
                  contentDetails: { duration: "PT3M30S" },
                },
              ],
            }),
          } as any;
        }
        return { ok: true, status: 200, json: async () => ({ items: [] }) } as any;
      };

      const req = new Request("http://localhost/api/audio/personalized", {
        headers: { authorization: "Bearer test_token" },
      });

      const res = await getAudioPersonalized(req);
      assert.equal(res.status, 200);

      const data = await res.json();
      assert.ok(Array.isArray(data.items));

      // Neither "The Channuka Song" by Adam Sandler nor "Channuka Miracle" by Rabbi Shlomo should be in recommendations!
      const adamSandlerSong = data.items.find(
        (t: any) => t.author.toLowerCase() === "adam sandler"
      );
      assert.equal(adamSandlerSong, undefined, "Adam Sandler should not be recommended for Channuka taste");

      const rabbiShlomoSong = data.items.find(
        (t: any) => t.author.toLowerCase() === "rabbi shlomo"
      );
      assert.equal(rabbiShlomoSong, undefined, "Rabbi Shlomo should not be recommended for Channuka taste");

      // The genuine Channuka track should be present
      const genuineTrack = data.items.find(
        (t: any) => t.videoId === "genuine_channuka_1"
      );
      assert.ok(genuineTrack, "Genuine Channuka track must be recommended");
    } finally {
      ytm.getUpNexts = origGetUpNexts;
      ytm.searchSongs = origSearchSongs;
      global.fetch = originalFetch;
    }
  });
});


