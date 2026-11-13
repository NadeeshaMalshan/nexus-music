import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cleanDisplayWord,
  groupWordsByBracket,
  processLineWords,
  calculateWordFill,
  cleanMonotonicSegment,
  type RenderWord,
} from "../src/components/echoai/KaraokeWordLine";
import { parseTtml } from "../src/lib/lyrics/parsers/ttmlParser";

describe("Background Vocal Lyrics & Brackets Transformation", () => {
  describe("cleanDisplayWord", () => {
    it("strips outer parentheses from background vocal words", () => {
      assert.strictEqual(cleanDisplayWord("(You", true), "You");
      assert.strictEqual(cleanDisplayWord("it)", true), "it");
      assert.strictEqual(cleanDisplayWord("(yeah)", true), "yeah");
      assert.strictEqual(cleanDisplayWord("[ad-lib]", true), "ad-lib");
    });

    it("preserves trailing punctuation on words", () => {
      assert.strictEqual(cleanDisplayWord("walk,", true), "walk,");
      assert.strictEqual(cleanDisplayWord("it).", true), "it.");
      assert.strictEqual(cleanDisplayWord("now?", true), "now?");
    });

    it("returns empty string for standalone bracket punctuation", () => {
      assert.strictEqual(cleanDisplayWord("(", true), "");
      assert.strictEqual(cleanDisplayWord(")", true), "");
      assert.strictEqual(cleanDisplayWord("[", true), "");
      assert.strictEqual(cleanDisplayWord("]", true), "");
    });

    it("does not strip text if isBracketed is false", () => {
      assert.strictEqual(cleanDisplayWord("gunnin'", false), "gunnin'");
      assert.strictEqual(cleanDisplayWord("back", false), "back");
    });
  });

  describe("groupWordsByBracket", () => {
    it("splits main line and background vocal into clean segments without brackets", () => {
      const words = [
        { text: "Guess", start: 10.0, end: 10.5 },
        { text: "we", start: 10.5, end: 11.0 },
        { text: "gunnin'", start: 11.0, end: 11.5 },
        { text: "back", start: 11.5, end: 12.0 },
        { text: "(You", start: 11.2, end: 11.6 },
        { text: "know", start: 11.6, end: 11.9 },
        { text: "I", start: 11.9, end: 12.3 },
        { text: "walk,", start: 12.3, end: 12.7 },
        { text: "yeah,", start: 12.7, end: 13.0 },
        { text: "I", start: 13.0, end: 13.2 },
        { text: "talk", start: 13.2, end: 13.4 },
        { text: "it)", start: 13.4, end: 13.5 },
      ];

      const segments = groupWordsByBracket(words);
      assert.strictEqual(segments.length, 2);

      // Segment 0: Main vocal
      assert.strictEqual(segments[0].isBracketed, false);
      assert.strictEqual(segments[0].words.map((w) => w.text).join(" "), "Guess we gunnin' back");

      // Segment 1: Background vocal (brackets stripped with cleanDisplayWord)
      assert.strictEqual(segments[1].isBracketed, true);
      assert.strictEqual(
        segments[1].words.map((w) => cleanDisplayWord(w.text, true)).join(" "),
        "You know I walk, yeah, I talk it"
      );
      assert.strictEqual(cleanDisplayWord(segments[1].words[0].text, true), "You");
      assert.strictEqual(cleanDisplayWord(segments[1].words[segments[1].words.length - 1].text, true), "it");
    });
  });

  describe("TTML Nested Span Extraction", () => {
    it("correctly extracts leaf spans from nested role='x-bg' containers without corrupting word 0 timestamps", () => {
      const sampleTtml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <body>
    <div>
      <p begin="00:10.000" end="00:14.000">
        <span begin="00:10.000" end="00:10.500">Guess</span>
        <span begin="00:10.500" end="00:11.000">we</span>
        <span begin="00:11.000" end="00:11.500">gunnin'</span>
        <span begin="00:11.500" end="00:12.000">back</span>
        <span ttm:role="x-bg" begin="00:11.200" end="00:13.500">
          <span begin="00:11.200" end="00:11.600">(You</span>
          <span begin="00:11.600" end="00:11.900">know</span>
          <span begin="00:11.900" end="00:12.300">I</span>
          <span begin="00:12.300" end="00:12.700">walk,</span>
          <span begin="00:12.700" end="00:13.000">yeah,</span>
          <span begin="00:13.000" end="00:13.200">I</span>
          <span begin="00:13.200" end="00:13.400">talk</span>
          <span begin="00:13.400" end="00:13.500">it)</span>
        </span>
      </p>
    </div>
  </body>
</tt>`;

      const parsed = parseTtml(sampleTtml);
      assert.strictEqual(parsed.lines.length, 1);
      const line = parsed.lines[0];
      assert.ok(line.words);
      assert.strictEqual(line.words.length, 12);

      // Verify that (You did NOT get the container span's end timestamp (13.5), but its own true end (11.6)
      const wordYou = line.words[4];
      assert.strictEqual(wordYou.text, "(You");
      assert.strictEqual(wordYou.start, 11.2);
      assert.strictEqual(wordYou.end, 11.6);

      // Verify lead vocal words
      assert.strictEqual(line.words[3].text, "back");
      assert.strictEqual(line.words[3].start, 11.5);
      assert.strictEqual(line.words[3].end, 12.0);

      // Verify all words have valid monotonic non-negative durations
      for (const w of line.words) {
        assert.ok(w.end >= w.start, `Word "${w.text}" end (${w.end}) must be >= start (${w.start})`);
      }
    });
  });

  describe("Sequential Word Fill & Middle Word Integrity", () => {
    it("strictly fills words left-to-right: preceding words are 100%, following words are 0%", () => {
      const words: RenderWord[] = [
        { globalIndex: 0, wordIndex: 0, text: "You", start: 29.3, end: 29.6, isBracketed: true },
        { globalIndex: 1, wordIndex: 1, text: "know", start: 29.6, end: 29.8, isBracketed: true },
        { globalIndex: 2, wordIndex: 2, text: "I", start: 29.8, end: 30.0, isBracketed: true },
        { globalIndex: 3, wordIndex: 3, text: "walk,", start: 30.0, end: 30.2, isBracketed: true },
        { globalIndex: 4, wordIndex: 4, text: "yeah,", start: 30.3, end: 30.5, isBracketed: true },
        { globalIndex: 5, wordIndex: 5, text: "I", start: 30.5, end: 30.7, isBracketed: true },
        { globalIndex: 6, wordIndex: 6, text: "talk", start: 30.7, end: 30.9, isBracketed: true },
        { globalIndex: 7, wordIndex: 7, text: "it", start: 30.9, end: 31.1, isBracketed: true },
      ];

      function computeSegmentFills(segWords: RenderWord[], t: number) {
        let activeIdx = -1;
        for (let j = 0; j < segWords.length; j++) {
          if (t >= segWords[j].start) {
            activeIdx = j;
          } else {
            break;
          }
        }

        const fills: number[] = [];
        for (let j = 0; j < segWords.length; j++) {
          const w = segWords[j];
          let fill = 0;
          if (activeIdx === -1) {
            fill = 0;
          } else if (j < activeIdx) {
            fill = 100;
          } else if (j === activeIdx) {
            fill = calculateWordFill(w, t);
          } else {
            fill = 0;
          }
          fills.push(fill);
        }
        return { activeIdx, fills };
      }

      // Test at t = 30.4 (when "yeah," is active)
      const res = computeSegmentFills(words, 30.4);
      assert.strictEqual(res.activeIdx, 4); // "yeah,"

      // Words 0..3 ("You", "know", "I", "walk,") MUST be 100% filled! (Can NEVER be left gray)
      assert.strictEqual(res.fills[0], 100);
      assert.strictEqual(res.fills[1], 100);
      assert.strictEqual(res.fills[2], 100);
      assert.strictEqual(res.fills[3], 100);

      // Word 4 ("yeah,") is actively filling: (30.4 - 30.3) / 0.2 = 50%
      assert.strictEqual(Math.round(res.fills[4]), 50);

      // Words 5..7 ("I", "talk", "it") MUST be 0% filled! (Can NEVER fill early)
      assert.strictEqual(res.fills[5], 0);
      assert.strictEqual(res.fills[6], 0);
      assert.strictEqual(res.fills[7], 0);
    });

    it("prevents middle words from filling early even if raw timestamps have gaps or provider holes", () => {
      const lineText = "Guess we gunnin' back (You know I walk, yeah, I talk it)";
      // Suppose rawWords is missing "I" and "walk,"
      const partialRawWords = [
        { text: "Guess", start: 28.661, end: 29.003 },
        { text: "we", start: 29.003, end: 29.225 },
        { text: "gunnin'", start: 29.225, end: 29.451 },
        { text: "back", start: 29.451, end: 29.580 },
        { text: "(You", start: 29.323, end: 29.642 },
        { text: "know", start: 29.642, end: 29.838 },
        { text: "yeah,", start: 30.275, end: 30.431 },
        { text: "I", start: 30.431, end: 30.643 },
        { text: "talk", start: 30.643, end: 30.893 },
        { text: "it)", start: 30.893, end: 31.060 },
      ];

      const processed = processLineWords(lineText, partialRawWords, 28.661, 31.060);
      assert.strictEqual(processed.length, 12);

      // Background segment words (indices 4..11)
      const bgWords = processed.filter((w) => w.isBracketed);
      assert.strictEqual(bgWords.length, 8);

      // Verify strict monotonic ordering
      for (let i = 1; i < bgWords.length; i++) {
        assert.ok(
          bgWords[i].start >= bgWords[i - 1].end,
          `Word "${bgWords[i].text}" start (${bgWords[i].start}) must be >= "${bgWords[i - 1].text}" end (${bgWords[i - 1].end})`
        );
        assert.ok(
          bgWords[i].end > bgWords[i].start,
          `Word "${bgWords[i].text}" end (${bgWords[i].end}) must be > start (${bgWords[i].start})`
        );
      }

      // "I" and "walk," must have valid interpolated timestamps between "know" and "yeah,"
      const wordI = bgWords[2];
      const wordWalk = bgWords[3];
      assert.strictEqual(wordI.text, "I");
      assert.strictEqual(wordWalk.text, "walk,");
      assert.ok(wordI.start >= 29.838);
      assert.ok(wordWalk.end <= 30.275);
    });
  });
});
