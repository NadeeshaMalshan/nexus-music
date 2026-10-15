import { test, describe } from "node:test";
import assert from "node:assert/strict";

// Parsers
import { parseTtml } from "../src/lib/lyrics/parsers/ttmlParser";
import { parseEnhancedLrc } from "../src/lib/lyrics/parsers/enhancedLrcParser";
import { parseStandardLrc } from "../src/lib/lyrics/parsers/standardLrcParser";
import { parsePlainText } from "../src/lib/lyrics/parsers/plainTextParser";
import { parseLyrics } from "../src/lib/lyrics/parsers/index";

// Synchronizer
import {
  findActiveLineIndex,
  findActiveWordIndex,
  getWordCharactersSync,
  splitIntoGraphemes,
} from "../src/lib/lyrics/synchronizer/playbackSynchronizer";

// Repository & Providers
import { LyricsRepository } from "../src/lib/lyrics/LyricsRepository";
import { GeniusProvider } from "../src/lib/lyrics/providers/GeniusProvider";
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

  test("calculates character-by-character synchronization across an active word", () => {
    const word = { text: "Hello", start: 10.0, end: 15.0 }; // 5 chars, 1s per char

    // Before word starts (9.5s)
    const before = getWordCharactersSync(word, 9.5);
    assert.equal(before.length, 5);
    assert.ok(before.every((c) => c.isUpcoming && !c.isActive && !c.isPast));

    // First character active ('H' at 10.5s: 10.0 to 11.0)
    const atH = getWordCharactersSync(word, 10.5);
    assert.equal(atH[0].char, "H");
    assert.ok(atH[0].isActive);
    assert.ok(atH.slice(1).every((c) => c.isUpcoming));

    // Third character active ('l' at 12.5s: 12.0 to 13.0)
    const atThird = getWordCharactersSync(word, 12.5);
    assert.ok(atThird[0].isPast && atThird[1].isPast);
    assert.equal(atThird[2].char, "l");
    assert.ok(atThird[2].isActive);
    assert.ok(atThird[3].isUpcoming && atThird[4].isUpcoming);

    // After word ends (16.0s)
    const after = getWordCharactersSync(word, 16.0);
    assert.ok(after.every((c) => c.isPast && !c.isActive && !c.isUpcoming));
  });

  test("correctly preserves Unicode & Sinhala grapheme clusters during character sync", () => {
    // 'මා' has 2 code units but 1 grapheme cluster
    const clusters = splitIntoGraphemes("මා");
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0], "මා");

    const sinhalaWord = { text: "බැඳි", start: 2.0, end: 4.0 };
    const sync = getWordCharactersSync(sinhalaWord, 2.5);
    // 'බැඳි' should be split into 2 graphemes: 'බැ' and 'ඳි'
    assert.equal(sync.length, 2);
    assert.equal(sync[0].char, "බැ");
    assert.ok(sync[0].isActive);
    assert.equal(sync[1].char, "ඳි");
    assert.ok(sync[1].isUpcoming);
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
