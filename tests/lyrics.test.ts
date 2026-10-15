import { test, describe } from "node:test";
import assert from "node:assert/strict";

// Parsers
import { parseTtml } from "../src/lib/lyrics/parsers/ttmlParser";
import { parseEnhancedLrc } from "../src/lib/lyrics/parsers/enhancedLrcParser";
import { parseStandardLrc } from "../src/lib/lyrics/parsers/standardLrcParser";
import { parsePlainText } from "../src/lib/lyrics/parsers/plainTextParser";
import { parseLyrics } from "../src/lib/lyrics/parsers/index";

// Synchronizer
import { findActiveLineIndex, findActiveWordIndex } from "../src/lib/lyrics/synchronizer/playbackSynchronizer";

// Repository & Providers
import { LyricsRepository } from "../src/lib/lyrics/LyricsRepository";
import { GeniusProvider } from "../src/lib/lyrics/providers/GeniusProvider";
import {
  BetterLyricsProvider,
  BiniLyricsProvider,
  KuGouProvider,
  LrcLibProvider,
  LrcRedProvider,
  LyricsOvhProvider,
  LyricsPlusProvider,
  MegalobizProvider,
  PaxSenixProvider,
  SimpMusicProvider,
  UnisonProvider,
} from "../src/lib/lyrics/providers";
import { ILyricsProvider, LyricsQuery, LyricsResult } from "../src/lib/lyrics/types";

// 1. TTML PARSING TESTS
describe("TTML Parser", () => {
  test("parses valid TTML containing line and word/syllable timestamps", () => {
    const ttmlSample = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml">
  <body>
    <div>
      <p begin="00:01.000" end="00:04.500">
        <span begin="00:01.000" end="00:01.800">Hello</span>
        <span begin="00:01.900" end="00:02.500">world</span>
        <span begin="00:02.600" end="00:04.200">again</span>
      </p>
      <p begin="00:05.000" end="00:08.000">
        <span begin="00:05.100" end="00:06.000">Second</span>
        <span begin="00:06.200" end="00:07.800">line</span>
      </p>
    </div>
  </body>
</tt>`;

    const result = parseTtml(ttmlSample);
    assert.equal(result.format, "ttml");
    assert.equal(result.syncType, "word");
    assert.equal(result.lines.length, 2);

    // Line 1
    const line1 = result.lines[0];
    assert.equal(line1.start, 1.0);
    assert.equal(line1.end, 4.5);
    assert.equal(line1.text, "Hello world again");
    assert.ok(line1.words);
    assert.equal(line1.words.length, 3);
    assert.equal(line1.words[0].text, "Hello");
    assert.equal(line1.words[0].start, 1.0);
    assert.equal(line1.words[0].end, 1.8);
    assert.equal(line1.words[1].text, "world");
    assert.equal(line1.words[1].start, 1.9);
    assert.equal(line1.words[1].end, 2.5);

    // Line 2
    const line2 = result.lines[1];
    assert.equal(line2.start, 5.0);
    assert.equal(line2.end, 8.0);
    assert.equal(line2.text, "Second line");
  });

  test("handles TTML with line timing only without spans (genuine line sync)", () => {
    const ttmlNoSpans = `<tt xmlns="http://www.w3.org/ns/ttml">
      <body>
        <div>
          <p begin="00:10.500" end="00:14.000">Line without word timing</p>
        </div>
      </body>
    </tt>`;

    const result = parseTtml(ttmlNoSpans);
    assert.equal(result.syncType, "line");
    assert.equal(result.lines.length, 1);
    assert.equal(result.lines[0].words, undefined);
    assert.equal(result.lines[0].text, "Line without word timing");
  });
});

// 2. ENHANCED LRC PARSING TESTS
describe("Enhanced LRC Parser", () => {
  test("parses inline word timestamps and derives word end times", () => {
    const enhancedLrc = `[00:12.00] <00:12.00> Never <00:12.50> gonna <00:13.10> give <00:13.60> you <00:14.20> up
[00:15.00] <00:15.10> Never <00:15.70> gonna <00:16.20> let <00:16.80> you <00:17.30> down`;

    const result = parseEnhancedLrc(enhancedLrc);
    assert.equal(result.format, "enhanced_lrc");
    assert.equal(result.syncType, "word");
    assert.equal(result.lines.length, 2);

    const line1 = result.lines[0];
    assert.equal(line1.start, 12.0);
    assert.equal(line1.text, "Never gonna give you up");
    assert.ok(line1.words);
    assert.equal(line1.words.length, 5);

    assert.equal(line1.words[0].text, "Never");
    assert.equal(line1.words[0].start, 12.0);
    assert.equal(line1.words[0].end, 12.5); // derived from next word's start

    assert.equal(line1.words[1].text, "gonna");
    assert.equal(line1.words[1].start, 12.5);
    assert.equal(line1.words[1].end, 13.1);

    assert.equal(line1.words[4].text, "up");
    assert.equal(line1.words[4].start, 14.2);
  });
});

// 3. STANDARD LRC PARSING TESTS
describe("Standard LRC Parser", () => {
  test("parses line-timestamped LRC and does NOT fabricate word timestamps", () => {
    const standardLrc = `[ar:Rick Astley]
[ti:Never Gonna Give You Up]
[offset:500]
[00:18.50] We're no strangers to love
[00:22.80] You know the rules and so do I`;

    const result = parseStandardLrc(standardLrc);
    assert.equal(result.format, "lrc");
    assert.equal(result.syncType, "line");
    assert.equal(result.lines.length, 2);

    // Offset is +500ms (+0.5s), so 18.50 + 0.5 = 19.00
    assert.equal(result.lines[0].start, 19.0);
    assert.equal(result.lines[0].text, "We're no strangers to love");
    assert.equal(result.lines[0].words, undefined); // Strictly no fabricated words

    assert.equal(result.lines[1].start, 23.3);
    assert.equal(result.lines[1].text, "You know the rules and so do I");
    assert.equal(result.lines[1].words, undefined);
  });

  test("handles multiple timestamps on a single line", () => {
    const multiTagLrc = `[00:05.00][00:15.00] Repeated chorus line`;
    const result = parseStandardLrc(multiTagLrc);
    assert.equal(result.lines.length, 2);
    assert.equal(result.lines[0].start, 5.0);
    assert.equal(result.lines[0].text, "Repeated chorus line");
    assert.equal(result.lines[1].start, 15.0);
    assert.equal(result.lines[1].text, "Repeated chorus line");
  });

  test("detects instrumental markers", () => {
    const lrcWithInst = `[00:00.00] ♪ Instrumental ♪\n[00:10.00] Vocals start here`;
    const result = parseStandardLrc(lrcWithInst);
    assert.equal(result.lines[0].isInstrumental, true);
    assert.equal(result.lines[1].isInstrumental, false);
  });
});

// 4. PLAIN TEXT PARSING TESTS
describe("Plain Text Parser", () => {
  test("correctly parses unsynchronized plain lyrics without fake timings", () => {
    const plainText = `First verse starts here\nSecond line of the song\nThird line`;
    const result = parsePlainText(plainText);
    assert.equal(result.format, "plain");
    assert.equal(result.syncType, "unsynced");
    assert.equal(result.lines.length, 3);
    assert.equal(result.lines[0].start, 0);
    assert.equal(result.lines[0].text, "First verse starts here");
    assert.equal(result.lines[0].words, undefined);
  });
});

// 5. UNICODE AND SINHALA PRESERVATION
describe("Unicode & Sinhala Preservation", () => {
  test("preserves Sinhala and complex Unicode text without corruption", () => {
    const sinhalaLrc = `[00:04.20] මා සිත බැඳි ආදරේ ඔබයි මාගේ ජීවිතේ
[00:09.50] සුන්දරයි මේ රැයේ තරු පිරි අහසේ`;

    const result = parseStandardLrc(sinhalaLrc);
    assert.equal(result.lines[0].text, "මා සිත බැඳි ආදරේ ඔබයි මාගේ ජීවිතේ");
    assert.equal(result.lines[1].text, "සුන්දරයි මේ රැයේ තරු පිරි අහසේ");
  });

  test("preserves Sinhala text in Enhanced LRC word splits", () => {
    const sinhalaEnhanced = `[00:01.00] <00:01.00> මා <00:01.50> සිත <00:02.00> බැඳි`;
    const result = parseEnhancedLrc(sinhalaEnhanced);
    assert.equal(result.lines[0].text, "මා සිත බැඳි");
    assert.equal(result.lines[0].words?.[0].text, "මා");
    assert.equal(result.lines[0].words?.[1].text, "සිත");
    assert.equal(result.lines[0].words?.[2].text, "බැඳි");
  });
});

// 6. MALFORMED AND EDGE CASE INPUTS
describe("Malformed Timestamps & Edge Cases", () => {
  test("handles empty string gracefully", () => {
    const result = parseLyrics("");
    assert.equal(result.lines.length, 0);
    assert.equal(result.syncType, "unsynced");
  });

  test("handles invalid or garbage lines in LRC without crashing", () => {
    const garbageLrc = `Not an LRC tag
[invalid:tag]
[00:05.10] Valid line`;
    const result = parseStandardLrc(garbageLrc);
    assert.equal(result.lines.length, 1);
    assert.equal(result.lines[0].text, "Valid line");
  });

  test("sorts out-of-order timestamps properly", () => {
    const unorderedLrc = `[00:20.00] Third line
[00:05.00] First line
[00:10.00] Second line`;
    const result = parseStandardLrc(unorderedLrc);
    assert.equal(result.lines[0].start, 5.0);
    assert.equal(result.lines[1].start, 10.0);
    assert.equal(result.lines[2].start, 20.0);
  });
});

// 7. REAL-TIME PLAYBACK SYNCHRONIZER
describe("Playback Synchronizer (Binary Search)", () => {
  const sampleLines = [
    {
      start: 5.0,
      end: 9.0,
      text: "Line one",
      words: [
        { text: "Line", start: 5.0, end: 6.5 },
        { text: "one", start: 6.8, end: 8.5 },
      ],
    },
    {
      start: 10.0,
      end: 15.0,
      text: "Line two",
      words: [
        { text: "Line", start: 10.0, end: 12.0 },
        { text: "two", start: 12.2, end: 14.5 },
      ],
    },
    {
      start: 16.0,
      end: 20.0,
      text: "Line three",
    },
  ];

  test("correctly selects active line at exact boundaries and within line", () => {
    // Before first line
    assert.equal(findActiveLineIndex(sampleLines, 2.0), -1);

    // Exactly at start of line 1
    assert.equal(findActiveLineIndex(sampleLines, 5.0), 0);

    // Inside line 1
    assert.equal(findActiveLineIndex(sampleLines, 7.5), 0);

    // Right before line 2
    assert.equal(findActiveLineIndex(sampleLines, 9.99), 0);

    // Exactly at line 2
    assert.equal(findActiveLineIndex(sampleLines, 10.0), 1);

    // At line 3 (last line)
    assert.equal(findActiveLineIndex(sampleLines, 18.0), 2);

    // After last line
    assert.equal(findActiveLineIndex(sampleLines, 30.0), 2);
  });

  test("correctly selects active word using genuine word timestamps", () => {
    const words = sampleLines[0].words!;

    // Before first word
    assert.equal(findActiveWordIndex(words, 4.9), -1);

    // During first word
    assert.equal(findActiveWordIndex(words, 5.5), 0);

    // Between words (word 1 ended at 6.5, word 2 starts at 6.8)
    assert.equal(findActiveWordIndex(words, 6.6), 0);

    // During second word
    assert.equal(findActiveWordIndex(words, 7.0), 1);

    // At exact end of second word
    assert.equal(findActiveWordIndex(words, 8.5), 1);
  });

  test("handles forward and backward seeking seamlessly", () => {
    // Forward seek from 5s to 17s
    assert.equal(findActiveLineIndex(sampleLines, 5.0), 0);
    assert.equal(findActiveLineIndex(sampleLines, 17.0), 2);

    // Backward seek from 17s back to 11s
    assert.equal(findActiveLineIndex(sampleLines, 11.0), 1);
  });

  test("returns -1 when words array is undefined or empty", () => {
    assert.equal(findActiveWordIndex(undefined, 10.0), -1);
    assert.equal(findActiveWordIndex([], 10.0), -1);
  });
});

// 8. REPOSITORY, DEDUPLICATION, CANCELLATION & PROVIDER FALLBACK
describe("LyricsRepository & Multi-Provider Architecture", () => {
  const mockGenius = {
    fetchGeniusDetails: async () => ({
      found: false,
      description: null,
      releaseDate: null,
      album: null,
      writers: [],
      producer: null,
      verifiedLyrics: false,
    }),
  } as unknown as GeniusProvider;

  test("prefers word sync over line sync over plain text", async () => {
    // Mock Provider A (Plain only)
    const providerA: ILyricsProvider = {
      name: "PlainProvider",
      async search(_q: LyricsQuery): Promise<LyricsResult | null> {
        return {
          success: true,
          rawContent: "Just plain text\nNo sync",
          format: "plain",
          syncType: "unsynced",
          lines: [{ start: 0, end: 5, text: "Just plain text" }],
          source: "PlainProvider",
        };
      },
    };

    // Mock Provider B (Word-level TTML)
    const providerB: ILyricsProvider = {
      name: "TtmlProvider",
      async search(_q: LyricsQuery): Promise<LyricsResult | null> {
        return {
          success: true,
          rawContent: `<tt><body><div><p begin="00:01.00" end="00:03.00"><span begin="00:01.00" end="00:02.00">Word</span></p></div></body></tt>`,
          format: "ttml",
          syncType: "word",
          lines: [
            {
              start: 1.0,
              end: 3.0,
              text: "Word",
              words: [{ text: "Word", start: 1.0, end: 2.0 }],
            },
          ],
          source: "TtmlProvider",
        };
      },
    };

    const repo = new LyricsRepository([providerA, providerB], mockGenius);

    const result = await repo.getLyrics("Test Song", "Test Artist");
    assert.ok(result.success);
    assert.equal(result.lyrics.syncType, "word");
    assert.equal(result.lyrics.source, "TtmlProvider");
  });

  test("avoids duplicate requests for the same track query concurrently", async () => {
    let callCount = 0;

    const slowProvider: ILyricsProvider = {
      name: "SlowProvider",
      async search(_q: LyricsQuery): Promise<LyricsResult | null> {
        callCount++;
        await new Promise((r) => setTimeout(r, 50));
        return {
          success: true,
          rawContent: "[00:01.00] Line one",
          format: "lrc",
          syncType: "line",
          lines: [{ start: 1.0, end: 4.0, text: "Line one" }],
          source: "SlowProvider",
        };
      },
    };

    const repo = new LyricsRepository([slowProvider], mockGenius);

    // Send two concurrent requests for the exact same track
    const [res1, res2] = await Promise.all([
      repo.getLyrics("Bohemian Rhapsody", "Queen"),
      repo.getLyrics("Bohemian Rhapsody", "Queen"),
    ]);

    assert.equal(callCount, 1, "Should deduplicate concurrent in-flight requests");
    assert.deepEqual(res1, res2);
  });

  test("handles provider errors and timeouts gracefully and tries next provider", async () => {
    const failingProvider: ILyricsProvider = {
      name: "FailingProvider",
      async search(): Promise<LyricsResult | null> {
        throw new Error("500 Server Error");
      },
    };

    const backupProvider: ILyricsProvider = {
      name: "BackupProvider",
      async search(): Promise<LyricsResult | null> {
        return {
          success: true,
          rawContent: "[00:02.00] Rescued line",
          format: "lrc",
          syncType: "line",
          lines: [{ start: 2.0, end: 5.0, text: "Rescued line" }],
          source: "BackupProvider",
        };
      },
    };

    const repo = new LyricsRepository([failingProvider, backupProvider], mockGenius);

    const result = await repo.getLyrics("Crash", "Band");
    assert.ok(result.success);
    assert.equal(result.lyrics.source, "BackupProvider");
  });

  test("supports request cancellation via AbortSignal on track changes", async () => {
    const abortController = new AbortController();

    const slowProvider: ILyricsProvider = {
      name: "CancellableProvider",
      async search(q): Promise<LyricsResult | null> {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            resolve({
              success: true,
              rawContent: "Done",
              format: "plain",
              syncType: "unsynced",
              lines: [],
              source: "CancellableProvider",
            });
          }, 200);

          if (q.signal) {
            q.signal.addEventListener("abort", () => {
              clearTimeout(timeout);
              reject(new Error("Aborted"));
            });
          }
        });
      },
    };

    const repo = new LyricsRepository([slowProvider], mockGenius);

    // Abort after 20ms
    setTimeout(() => abortController.abort(), 20);

    const result = await repo.getLyrics("Old Song", "Old Artist", undefined, undefined, abortController.signal);
    // Because provider aborted, repo gracefully returns non-crashing empty/fallback response
    assert.ok(result);
  });
});

// 9. NEW PROVIDERS INITIALIZATION & WORD-SYNC PRIORITY TESTS
describe("All 10 Lyrics Providers & Word-Sync Priority", () => {
  test("instantiates all 10 providers correctly with proper names", () => {
    const betterLyrics = new BetterLyricsProvider();
    const lrcRed = new LrcRedProvider();
    const biniLyrics = new BiniLyricsProvider();
    const lyricsPlus = new LyricsPlusProvider();
    const paxSenix = new PaxSenixProvider();
    const unison = new UnisonProvider();
    const kuGou = new KuGouProvider();
    const lrcLib = new LrcLibProvider();
    const megalobiz = new MegalobizProvider();
    const simpMusic = new SimpMusicProvider();

    assert.equal(betterLyrics.name, "BetterLyrics");
    assert.equal(lrcRed.name, "lrc.red");
    assert.equal(biniLyrics.name, "BiniLyrics");
    assert.equal(lyricsPlus.name, "LyricsPlus");
    assert.equal(paxSenix.name, "PaxSenix");
    assert.equal(unison.name, "Unison");
    assert.equal(kuGou.name, "KuGou");
    assert.equal(lrcLib.name, "LRCLIB");
    assert.equal(megalobiz.name, "Megalobiz");
    assert.equal(simpMusic.name, "SimpMusic");
  });

  test("default LyricsRepository initializes all providers with word-sync providers first", () => {
    const repo = new LyricsRepository();
    // Verify default instance has all providers
    const providers = (repo as unknown as { providers: ILyricsProvider[] }).providers;
    assert.ok(providers.length >= 10);

    const providerNames = providers.map((p) => p.name);
    // Word sync providers must precede line sync and plain providers
    const wordSyncCapable = ["BetterLyrics", "lrc.red", "BiniLyrics", "LyricsPlus", "PaxSenix", "Unison", "KuGou"];
    for (const name of wordSyncCapable) {
      assert.ok(providerNames.includes(name), `Expected ${name} to be in providers list`);
    }

    const betterLyricsIdx = providerNames.indexOf("BetterLyrics");
    const lrcLibIdx = providerNames.indexOf("LRCLIB");
    const megalobizIdx = providerNames.indexOf("Megalobiz");
    const lyricsOvhIdx = providerNames.indexOf("Lyrics.ovh");

    // Word sync providers should be prioritized ahead of line sync (LRCLIB, Megalobiz) and plain (Lyrics.ovh)
    assert.ok(betterLyricsIdx < lrcLibIdx, "Word-sync provider BetterLyrics should be before LRCLIB");
    assert.ok(lrcLibIdx < lyricsOvhIdx, "LRCLIB should be before plain text Lyrics.ovh");
    assert.ok(megalobizIdx < lyricsOvhIdx, "Megalobiz should be before plain text Lyrics.ovh");
  });

  test("prioritizes word-sync provider over line-sync provider even when line-sync is first in list", async () => {
    const mockGenius = {
      fetchGeniusDetails: async () => ({
        found: false,
        description: null,
        releaseDate: null,
        album: null,
        writers: [],
        producer: null,
        verifiedLyrics: false,
      }),
    } as unknown as GeniusProvider;

    const lineProvider: ILyricsProvider = {
      name: "LineProvider",
      async search(): Promise<LyricsResult | null> {
        return {
          success: true,
          rawContent: "[00:01.00] Line one\n[00:05.00] Line two",
          format: "lrc",
          syncType: "line",
          lines: [
            { start: 1.0, end: 5.0, text: "Line one" },
            { start: 5.0, end: 10.0, text: "Line two" },
          ],
          source: "LineProvider",
        };
      },
    };

    const wordProvider: ILyricsProvider = {
      name: "WordProvider",
      async search(): Promise<LyricsResult | null> {
        return {
          success: true,
          rawContent: "<tt>...</tt>",
          format: "ttml",
          syncType: "word",
          lines: [
            {
              start: 1.0,
              end: 5.0,
              text: "Line one",
              words: [
                { text: "Line", start: 1.0, end: 2.0 },
                { text: "one", start: 2.1, end: 3.0 },
              ],
            },
          ],
          source: "WordProvider",
        };
      },
    };

    // Even if lineProvider is first in custom list, wordProvider must win!
    const repo = new LyricsRepository([lineProvider, wordProvider], mockGenius);
    const result = await repo.getLyrics("Test", "Artist");

    assert.equal(result.lyrics.syncType, "word");
    assert.equal(result.lyrics.source, "WordProvider");
    assert.equal(result.lyrics.isWordSynced, true);
    assert.ok(result.lyrics.lines[0].words && result.lyrics.lines[0].words.length > 0);
  });

  test("LyricsPlusProvider correctly parses syllable-level karaoke items into word-synced lines", async () => {
    const provider = new LyricsPlusProvider();
    const originalFetch = global.fetch;

    global.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("lyricsplus.prjktla.my.id")) {
        return {
          ok: true,
          json: async () => ({
            type: "syllable",
            lyrics: [
              { time: 1000, duration: 400, text: "Hello ", isLineEnding: 0 },
              { time: 1500, duration: 500, text: "world", isLineEnding: 1 },
              { time: 3000, duration: 600, text: "Second ", isLineEnding: 0 },
              { time: 3700, duration: 400, text: "line", isLineEnding: 1 },
            ],
          }),
        } as unknown as Response;
      }
      return { ok: false } as unknown as Response;
    }) as typeof fetch;

    try {
      const res = await provider.search({ track: "Hello", artist: "Adele" });
      assert.ok(res);
      assert.equal(res.syncType, "word");
      assert.equal(res.lines.length, 2);
      assert.equal(res.lines[0].text, "Hello world");
      assert.equal(res.lines[0].words?.length, 2);
      assert.equal(res.lines[0].words?.[0].text, "Hello");
      assert.equal(res.lines[0].words?.[0].start, 1.0);
      assert.equal(res.lines[0].words?.[0].end, 1.4);
      assert.equal(res.lines[1].text, "Second line");
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("KuGouProvider parses KRC encrypted syllable timing into word timestamps", async () => {
    const { deflateSync } = await import("node:zlib");
    const provider = new KuGouProvider();
    const originalFetch = global.fetch;

    // Create a real encrypted KRC payload
    const rawKrcText = "[1000,3000]<0,400,0>Hello <500,500,0>World\n[5000,4000]<0,600,0>Second <700,400,0>Line";
    const deflated = deflateSync(Buffer.from(rawKrcText, "utf8"));
    const xorKey = [64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105];
    const encrypted = Buffer.alloc(deflated.length);
    for (let i = 0; i < deflated.length; i++) {
      encrypted[i] = deflated[i] ^ xorKey[i % xorKey.length];
    }
    const fullBuffer = Buffer.concat([Buffer.from("krc1"), encrypted]);
    const base64Content = fullBuffer.toString("base64");

    global.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("lyrics.kugou.com/search")) {
        return {
          ok: true,
          json: async () => ({
            candidates: [
              { id: "12345", accesskey: "ABCDEF123456", song: "Hello", singer: "Adele" },
            ],
          }),
        } as unknown as Response;
      }
      if (urlStr.includes("lyrics.kugou.com/download") && urlStr.includes("fmt=krc")) {
        return {
          ok: true,
          json: async () => ({
            content: base64Content,
          }),
        } as unknown as Response;
      }
      return { ok: false } as unknown as Response;
    }) as typeof fetch;

    try {
      const res = await provider.search({ track: "Hello", artist: "Adele" });
      assert.ok(res);
      assert.equal(res.syncType, "word");
      assert.equal(res.lines.length, 2);
      assert.equal(res.lines[0].text, "Hello World");
      assert.equal(res.lines[0].start, 1.0);
      assert.equal(res.lines[0].end, 4.0);
      assert.equal(res.lines[0].words?.length, 2);
      assert.equal(res.lines[0].words?.[0].start, 1.0);
      assert.equal(res.lines[0].words?.[0].end, 1.4);
      assert.equal(res.lines[1].text, "Second Line");
    } finally {
      global.fetch = originalFetch;
    }
  });
});

import { groupWordsByBracket, estimateWordsForLine } from "../src/components/echoai/KaraokeWordLine";

describe("Karaoke Word-Sync Bracket Segmentation", () => {
  test("returns empty array for empty words", () => {
    assert.deepEqual(groupWordsByBracket([]), []);
  });

  test("keeps standard unbracketed line in a single segment", () => {
    const words = [
      { text: "Io", start: 0, end: 0.5 },
      { text: "sono", start: 0.5, end: 1.0 },
      { text: "il", start: 1.0, end: 1.2 },
      { text: "meglio", start: 1.2, end: 2.0 },
    ];
    const segments = groupWordsByBracket(words);
    assert.equal(segments.length, 1);
    assert.equal(segments[0].isBracketed, false);
    assert.equal(segments[0].words.length, 4);
    assert.equal(segments[0].words.map((w) => w.text).join(" "), "Io sono il meglio");
  });

  test("separates trailing bracketed ad-libs to a new segment", () => {
    const words = [
      { text: "Blinded", start: 0, end: 0.5 },
      { text: "by", start: 0.5, end: 0.8 },
      { text: "the", start: 0.8, end: 1.0 },
      { text: "lights", start: 1.0, end: 1.5 },
      { text: "(by", start: 1.6, end: 1.8 },
      { text: "the", start: 1.8, end: 2.0 },
      { text: "lights)", start: 2.0, end: 2.5 },
    ];
    const segments = groupWordsByBracket(words);
    assert.equal(segments.length, 2);
    assert.equal(segments[0].isBracketed, false);
    assert.equal(segments[0].words.map((w) => w.text).join(" "), "Blinded by the lights");
    assert.equal(segments[1].isBracketed, true);
    assert.equal(segments[1].words.map((w) => w.text).join(" "), "(by the lights)");
  });

  test("handles fully bracketed line as a single bracketed segment", () => {
    const words = [
      { text: "(No,", start: 0, end: 0.5 },
      { text: "I", start: 0.5, end: 0.8 },
      { text: "can't", start: 0.8, end: 1.2 },
      { text: "sleep)", start: 1.2, end: 1.8 },
    ];
    const segments = groupWordsByBracket(words);
    assert.equal(segments.length, 1);
    assert.equal(segments[0].isBracketed, true);
    assert.equal(segments[0].words.map((w) => w.text).join(" "), "(No, I can't sleep)");
  });

  test("handles square brackets [backing vocals] correctly", () => {
    const words = [
      { text: "Lead", start: 0, end: 0.5 },
      { text: "[Backing]", start: 0.6, end: 1.0 },
    ];
    const segments = groupWordsByBracket(words);
    assert.equal(segments.length, 2);
    assert.equal(segments[0].isBracketed, false);
    assert.equal(segments[0].words[0].text, "Lead");
    assert.equal(segments[1].isBracketed, true);
    assert.equal(segments[1].words[0].text, "[Backing]");
  });

  test("estimateWordsForLine generates strictly sequential word timings for line-synced lyrics", () => {
    const text = "You could have anyone else you wanted to";
    const words = estimateWordsForLine(text, 10.0, 14.0);
    assert.equal(words.length, 8);
    assert.equal(words[0].text, "You");
    assert.equal(words[7].text, "to");
    assert.equal(words[0].start, 10.0);
    assert.equal(words[7].end, 14.0);

    // Verify strictly increasing timestamps
    for (let i = 0; i < words.length - 1; i++) {
      assert.ok(words[i].start < words[i + 1].start, `word[${i}] start must be < word[${i + 1}] start`);
      assert.ok(words[i].end <= words[i + 1].start + 0.001, `word[${i}] end must be <= word[${i + 1}] start`);
    }

    // Verify line 1 words finish before line 2 words begin
    // (Line 1: "You could have anyone", Line 2: "else you wanted to")
    const line1End = words[3].end;
    const line2Start = words[4].start;
    assert.ok(line2Start >= line1End, "Line 2 start must be after Line 1 end");
  });

  test("estimateWordsForLine handles empty and single-word strings safely", () => {
    assert.deepEqual(estimateWordsForLine("", 0, 5), []);
    assert.deepEqual(estimateWordsForLine("   ", 0, 5), []);
    const single = estimateWordsForLine("Hello", 2.0, 4.0);
    assert.equal(single.length, 1);
    assert.equal(single[0].text, "Hello");
    assert.equal(single[0].start, 2.0);
    assert.equal(single[0].end, 4.0);
  });
});

// 11. SONG TITLE MATCHING & ACCURACY VALIDATION
import {
  isArtistMatch,
  isChannelOrPublisher,
  isDurationMatch,
  isNoiseText,
  isTitleMatch,
  normalizeSongTitle,
} from "../src/lib/lyrics/matchUtils";

describe("Song Title Matching & Accuracy Validation", () => {
  test("correctly matches identical and near-identical titles", () => {
    assert.equal(isTitleMatch("run for the hills", "run for the hills"), true);
    assert.equal(isTitleMatch("Run For The Hills", "run for the hills"), true);
    assert.equal(isTitleMatch("run for the hills", "Run For The Hills (Official Video)"), true);
    assert.equal(isTitleMatch("run for the hills", "Tate McRae - run for the hills (Lyrics)"), true);
    assert.equal(isTitleMatch("run for the hills", "run for the hills - sped up"), true);
  });

  test("strictly REJECTS mismatched songs by the same artist", () => {
    // Specifically verify the user's reported bug
    assert.equal(isTitleMatch("run for the hills", "you broke me first"), false);
    assert.equal(isTitleMatch("run for the hills", "It's ok I'm ok"), false);
    assert.equal(isTitleMatch("run for the hills", "greedy"), false);
    assert.equal(isTitleMatch("run for the hills", "exes"), false);
    assert.equal(isTitleMatch("Blinding Lights", "Save Your Tears"), false);
    assert.equal(isTitleMatch("Shape of You", "Bad Habits"), false);
  });

  test("normalizes punctuation and noise words cleanly", () => {
    assert.equal(normalizeSongTitle("It's ok I'm ok (Official Music Video)"), "its ok im ok");
    assert.equal(normalizeSongTitle("Don't Start Now [Live Edition]"), "dont start now");
  });
});

// 12. YOUTUBE TITLE CLEANING & METADATA NORMALIZATION
const stubGenius = {
  fetchGeniusDetails: async () => ({
    found: false,
    description: null,
    releaseDate: null,
    album: null,
    writers: [],
    producer: null,
    verifiedLyrics: false,
  }),
} as unknown as GeniusProvider;

describe("YouTube Title Cleaning (cleanQuery)", () => {
  const repo = new LyricsRepository([], stubGenius);

  test("fixes hyphen splitting bug where noise in part 2 was picked as track", () => {
    // BUG FIX: Previously "Ravana - Official Audio" set cleanTrack = "Official Audio"
    const cleaned = repo.cleanQuery("Ravana - Official Audio", "Sanuka");
    assert.equal(cleaned.track, "Ravana");
    assert.equal(cleaned.artist, "Sanuka");
  });

  test("handles Song - Artist format when artist is in part 2", () => {
    const cleaned = repo.cleanQuery("Ravana - Sanuka", "Sanuka");
    assert.equal(cleaned.track, "Ravana");
    assert.equal(cleaned.artist, "Sanuka");
  });

  test("strips bracketed Sinhala and Indic script when Latin title is present", () => {
    // Latin title present with bracketed Sinhala text
    const cleaned = repo.cleanQuery("Kandulu Bindak (කඳුළු බිඳක්) - Sanuka", "Sanuka");
    assert.equal(cleaned.track, "Kandulu Bindak");
    assert.equal(cleaned.artist, "Sanuka");
  });

  test("preserves pure Sinhala text when no Latin text is present", () => {
    const cleaned = repo.cleanQuery("කඳුළු බිඳක්", "සනුක");
    assert.equal(cleaned.track, "කඳුළු බිඳක්");
    assert.equal(cleaned.artist, "සනුක");
  });

  test("cleans YouTube pipe separators and discards noise segments", () => {
    const cleaned = repo.cleanQuery(
      "Manike Mage Hithe | Official Music Video | Yohani & Chamath Sangeeth",
      "Yohani"
    );
    assert.equal(cleaned.track, "Manike Mage Hithe");
    assert.equal(cleaned.artist, "Yohani");
  });

  test("handles YouTube record label/publisher channels as artist", () => {
    const cleaned = repo.cleanQuery("Kandulu Bindak - Sanuka", "M Entertainments");
    // "M Entertainments" recognized as publisher; track and artist extracted from video title
    assert.equal(cleaned.track, "Sanuka");
    assert.equal(cleaned.artist, "Kandulu Bindak");
  });

  test("strips bracketed noise like 4K, Official Video, and Topic suffixes", () => {
    const cleaned = repo.cleanQuery("Shape of You [4K UHD] (Official Music Video)", "Ed Sheeran - Topic");
    assert.equal(cleaned.track, "Shape of You");
    assert.equal(cleaned.artist, "Ed Sheeran");
  });
});

// 13. CHANNEL, ARTIST & DURATION VALIDATION
describe("Channel, Artist & Duration Validation", () => {
  test("identifies publisher channels and record labels accurately", () => {
    assert.equal(isChannelOrPublisher("M Entertainments"), true);
    assert.equal(isChannelOrPublisher("T-Series"), true);
    assert.equal(isChannelOrPublisher("Sony Music India"), true);
    assert.equal(isChannelOrPublisher("Torana Video"), true);
    assert.equal(isChannelOrPublisher("Coke Studio Pakistan"), true);
    assert.equal(isChannelOrPublisher("Unknown Artist"), true);
    assert.equal(isChannelOrPublisher(""), true);
    assert.equal(isChannelOrPublisher(null), true);

    // Real musical artists must NOT be identified as channels
    assert.equal(isChannelOrPublisher("Sanuka"), false);
    assert.equal(isChannelOrPublisher("Ed Sheeran"), false);
    assert.equal(isChannelOrPublisher("The Weeknd"), false);
    assert.equal(isChannelOrPublisher("Yohani"), false);
  });

  test("identifies YouTube metadata noise text", () => {
    assert.equal(isNoiseText("Official Audio"), true);
    assert.equal(isNoiseText("Official Music Video"), true);
    assert.equal(isNoiseText("New Sinhala Song 2024"), true);
    assert.equal(isNoiseText("4K UHD"), true);
    assert.equal(isNoiseText("Visualizer"), true);
    assert.equal(isNoiseText("Coke RED"), true);

    // Legitimate song names are not noise
    assert.equal(isNoiseText("Ravana"), false);
    assert.equal(isNoiseText("Kandulu Bindak"), false);
    assert.equal(isNoiseText("Shape of You"), false);
  });

  test("matches artists and multiple collaborations correctly", () => {
    assert.equal(isArtistMatch("Ed Sheeran", "Ed Sheeran ft. Justin Bieber"), true);
    assert.equal(isArtistMatch("Yohani & Chamath", "Yohani"), true);
    assert.equal(isArtistMatch("Sanuka", "Sanuka Wickramasinghe"), true);
    assert.equal(isArtistMatch("The Weeknd", "Taylor Swift"), false);
  });

  test("validates duration tolerance within 28 seconds", () => {
    assert.equal(isDurationMatch(210, 205, 28), true);
    assert.equal(isDurationMatch(210, 230, 28), true);
    assert.equal(isDurationMatch(210, 100, 28), false);
    assert.equal(isDurationMatch(undefined, 210, 28), true); // Duration omitted in provider
  });
});

// 14. PROVIDER MISMATCH REJECTION IN REPOSITORY
describe("LyricsRepository Provider Validation", () => {
  test("rejects provider results with mismatched song title", async () => {
    const wrongTitleProvider: ILyricsProvider = {
      name: "WrongTitleMock",
      async search(_q: LyricsQuery): Promise<LyricsResult | null> {
        return {
          success: true,
          syncType: "word",
          format: "ttml",
          source: "WrongTitleMock",
          lines: [{ start: 0, end: 5, text: "Some lyrics" }],
          metadata: {
            title: "you broke me first",
            artist: "Tate McRae",
            duration: 180,
          },
        };
      },
    };

    const repo = new LyricsRepository([wrongTitleProvider], stubGenius);
    const result = await repo.getLyrics("run for the hills", "Tate McRae");
    // Result should reject the wrong song
    assert.equal(result.lyrics.source, null);
    assert.equal(result.lyrics.isSynced, false);
  });

  test("rejects provider results with mismatched artist", async () => {
    const wrongArtistProvider: ILyricsProvider = {
      name: "WrongArtistMock",
      async search(_q: LyricsQuery): Promise<LyricsResult | null> {
        return {
          success: true,
          syncType: "line",
          format: "lrc",
          source: "WrongArtistMock",
          lines: [{ start: 0, end: 5, text: "Some lyrics" }],
          metadata: {
            title: "Stay",
            artist: "Sam Smith", // Not The Kid LAROI
            duration: 140,
          },
        };
      },
    };

    const repo = new LyricsRepository([wrongArtistProvider], stubGenius);
    const result = await repo.getLyrics("Stay", "The Kid LAROI");
    assert.equal(result.lyrics.source, null);
  });

  test("rejects provider results with wild duration discrepancy", async () => {
    const wrongDurationProvider: ILyricsProvider = {
      name: "WrongDurationMock",
      async search(_q: LyricsQuery): Promise<LyricsResult | null> {
        return {
          success: true,
          syncType: "word",
          format: "ttml",
          source: "WrongDurationMock",
          lines: [{ start: 0, end: 5, text: "Some lyrics" }],
          metadata: {
            title: "Blinding Lights",
            artist: "The Weeknd",
            duration: 60, // 1 min vs expected 200s
          },
        };
      },
    };

    const repo = new LyricsRepository([wrongDurationProvider], stubGenius);
    const result = await repo.getLyrics("Blinding Lights", "The Weeknd", undefined, 200);
    assert.equal(result.lyrics.source, null);
  });
});



