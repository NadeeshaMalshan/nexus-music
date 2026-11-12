import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  alignLyricsToCaption,
  normalizeToken,
  tokensMatch,
  CaptionWord,
} from "../src/lib/lyrics/captionAlign";
import { LyricsLine } from "../src/lib/lyrics/types";

describe("Caption-Based Lyrics Re-sync (captionAlign)", () => {
  it("normalizes tokens and preserves non-Latin scripts (Sinhala) without crashing", () => {
    assert.strictEqual(normalizeToken("Hello, World!"), "helloworld");
    assert.strictEqual(normalizeToken("don't stop"), "dontstop");
    assert.strictEqual(normalizeToken("Café"), "cafe");
    // Sinhala script
    assert.strictEqual(normalizeToken("ආයුබෝවන්"), "ආයුබෝවන්");
    assert.strictEqual(normalizeToken("සින්දුව..."), "සින්දුව");
  });

  it("matches tokens exactly or with Levenshtein <= 1 for >= 4 char words", () => {
    assert.ok(tokensMatch("dancing", "dancing"));
    assert.ok(tokensMatch("dancing", "dancin")); // dist 1, len >= 4
    assert.ok(!tokensMatch("the", "thy")); // dist 1 but len < 4
    assert.ok(!tokensMatch("apple", "banana"));
  });

  it("handles constant 8s offset (e.g. video intro) with MAD <= 0.35s in constant mode", () => {
    const rawLines: LyricsLine[] = [
      {
        text: "There's a fire starting in my heart",
        start: 10.0,
        end: 14.0,
        words: [
          { text: "There's", start: 10.0, end: 10.5 },
          { text: "a", start: 10.5, end: 10.7 },
          { text: "fire", start: 10.7, end: 11.2 },
          { text: "starting", start: 11.2, end: 12.0 },
          { text: "in", start: 12.0, end: 12.3 },
          { text: "my", start: 12.3, end: 12.6 },
          { text: "heart", start: 12.6, end: 13.5 },
        ],
      },
      {
        text: "Reaching a fever pitch and it's bringing me out the dark",
        start: 14.0,
        end: 18.0,
        words: [
          { text: "Reaching", start: 14.0, end: 14.5 },
          { text: "a", start: 14.5, end: 14.7 },
          { text: "fever", start: 14.7, end: 15.2 },
          { text: "pitch", start: 15.2, end: 15.8 },
          { text: "and", start: 15.8, end: 16.0 },
          { text: "it's", start: 16.0, end: 16.3 },
          { text: "bringing", start: 16.3, end: 16.8 },
          { text: "me", start: 16.8, end: 17.0 },
          { text: "out", start: 17.0, end: 17.3 },
          { text: "the", start: 17.3, end: 17.5 },
          { text: "dark", start: 17.5, end: 18.0 },
        ],
      },
    ];

    // Captions delayed by exactly 8.0 seconds
    const offset = 8.0;
    const captionWords: CaptionWord[] = [
      { text: "There's", start: 10.0 + offset, end: 10.5 + offset },
      { text: "a", start: 10.5 + offset, end: 10.7 + offset },
      { text: "fire", start: 10.7 + offset, end: 11.2 + offset },
      { text: "starting", start: 11.2 + offset, end: 12.0 + offset },
      { text: "in", start: 12.0 + offset, end: 12.3 + offset },
      { text: "my", start: 12.3 + offset, end: 12.6 + offset },
      { text: "heart", start: 12.6 + offset, end: 13.5 + offset },
      { text: "Reaching", start: 14.0 + offset, end: 14.5 + offset },
      { text: "a", start: 14.5 + offset, end: 14.7 + offset },
      { text: "fever", start: 14.7 + offset, end: 15.2 + offset },
      { text: "pitch", start: 15.2 + offset, end: 15.8 + offset },
      { text: "and", start: 15.8 + offset, end: 16.0 + offset },
      { text: "it's", start: 16.0 + offset, end: 16.3 + offset },
      { text: "bringing", start: 16.3 + offset, end: 16.8 + offset },
      { text: "me", start: 16.8 + offset, end: 17.0 + offset },
      { text: "out", start: 17.0 + offset, end: 17.3 + offset },
      { text: "the", start: 17.3 + offset, end: 17.5 + offset },
      { text: "dark", start: 17.5 + offset, end: 18.0 + offset },
    ];

    const result = alignLyricsToCaption(rawLines, captionWords);
    assert.ok(result);
    assert.strictEqual(result.stats.mode, "constant");
    assert.strictEqual(result.stats.medianOffset, 8.0);

    // Verify first line is shifted by 8.0
    // Because line starts at 18.0 >= 4.0, an instrumental intro break is inserted at index 0
    assert.strictEqual(result.lines[0].isInstrumental, true);
    assert.strictEqual(result.lines[0].start, 0);
    assert.strictEqual(result.lines[0].end, 18.0);

    const lyricLine1 = result.lines[1];
    assert.strictEqual(lyricLine1.text, rawLines[0].text);
    assert.strictEqual(lyricLine1.start, 18.0);
    assert.strictEqual(lyricLine1.end, 22.0);
    assert.strictEqual(lyricLine1.words?.[0].start, 18.0);
  });

  it("handles ASR missing ~30% of words gracefully", () => {
    const rawLines: LyricsLine[] = [
      {
        text: "We could have had it all rolling in the deep",
        start: 20.0,
        end: 25.0,
        words: [
          { text: "We", start: 20.0, end: 20.3 },
          { text: "could", start: 20.3, end: 20.7 },
          { text: "have", start: 20.7, end: 21.0 },
          { text: "had", start: 21.0, end: 21.4 },
          { text: "it", start: 21.4, end: 21.7 },
          { text: "all", start: 21.7, end: 22.2 },
          { text: "rolling", start: 22.5, end: 23.2 },
          { text: "in", start: 23.2, end: 23.5 },
          { text: "the", start: 23.5, end: 23.8 },
          { text: "deep", start: 23.8, end: 24.5 },
        ],
      },
    ];

    // Caption has ~30% missing words ("could", "it", "in" omitted by ASR) with 5.0s offset
    const offset = 5.0;
    const captionWords: CaptionWord[] = [
      { text: "We", start: 20.0 + offset, end: 20.4 + offset },
      { text: "have", start: 20.7 + offset, end: 21.0 + offset },
      { text: "had", start: 21.0 + offset, end: 21.4 + offset },
      { text: "all", start: 21.7 + offset, end: 22.2 + offset },
      { text: "rolling", start: 22.5 + offset, end: 23.2 + offset },
      { text: "the", start: 23.5 + offset, end: 23.8 + offset },
      { text: "deep", start: 23.8 + offset, end: 24.5 + offset },
      // Extra trailing caption words to reach >= 8 words threshold
      { text: "you", start: 25.0 + offset, end: 25.5 + offset },
    ];

    // Add extra line to have enough words
    const extendedLines: LyricsLine[] = [
      ...rawLines,
      {
        text: "You had my heart inside of your hand",
        start: 26.0,
        end: 30.0,
        words: [
          { text: "You", start: 26.0, end: 26.5 },
          { text: "had", start: 26.5, end: 27.0 },
          { text: "my", start: 27.0, end: 27.3 },
          { text: "heart", start: 27.3, end: 28.0 },
          { text: "inside", start: 28.0, end: 28.6 },
          { text: "of", start: 28.6, end: 28.8 },
          { text: "your", start: 28.8, end: 29.2 },
          { text: "hand", start: 29.2, end: 30.0 },
        ],
      },
    ];

    const extendedCaptions: CaptionWord[] = [
      ...captionWords,
      { text: "had", start: 26.5 + offset, end: 27.0 + offset },
      { text: "my", start: 27.0 + offset, end: 27.3 + offset },
      { text: "heart", start: 27.3 + offset, end: 28.0 + offset },
      { text: "inside", start: 28.0 + offset, end: 28.6 + offset },
      { text: "your", start: 28.8 + offset, end: 29.2 + offset },
      { text: "hand", start: 29.2 + offset, end: 30.0 + offset },
    ];

    const result = alignLyricsToCaption(extendedLines, extendedCaptions);
    assert.ok(result);
    assert.ok(result.stats.matched >= 8);
    assert.strictEqual(Math.round(result.stats.medianOffset), 5);
  });

  it("does not mis-anchor repeated choruses or repeated words", () => {
    const chorusWords = [
      { text: "Baby", start: 0, end: 0.5 },
      { text: "baby", start: 0.5, end: 1.0 },
      { text: "baby", start: 1.0, end: 1.5 },
      { text: "oh", start: 1.5, end: 2.0 },
    ];

    const lines: LyricsLine[] = [
      {
        text: "Baby baby baby oh",
        start: 10.0,
        end: 13.0,
        words: chorusWords.map((w) => ({ ...w, start: w.start + 10.0, end: w.end + 10.0 })),
      },
      {
        text: "Thought you'd always be mine",
        start: 14.0,
        end: 17.0,
        words: [
          { text: "Thought", start: 14.0, end: 14.5 },
          { text: "you'd", start: 14.5, end: 15.0 },
          { text: "always", start: 15.0, end: 15.8 },
          { text: "be", start: 15.8, end: 16.2 },
          { text: "mine", start: 16.2, end: 17.0 },
        ],
      },
      {
        text: "Baby baby baby oh",
        start: 30.0,
        end: 33.0,
        words: chorusWords.map((w) => ({ ...w, start: w.start + 30.0, end: w.end + 30.0 })),
      },
      {
        text: "Thought you'd always be mine",
        start: 34.0,
        end: 37.0,
        words: [
          { text: "Thought", start: 34.0, end: 34.5 },
          { text: "you'd", start: 34.5, end: 35.0 },
          { text: "always", start: 35.0, end: 35.8 },
          { text: "be", start: 35.8, end: 36.2 },
          { text: "mine", start: 36.2, end: 37.0 },
        ],
      },
    ];

    // Offset of 12 seconds in video
    const offset = 12.0;
    const captionWords: CaptionWord[] = [];
    for (const l of lines) {
      if (l.words) {
        for (const w of l.words) {
          captionWords.push({
            text: w.text,
            start: w.start + offset,
            end: w.end + offset,
          });
        }
      }
    }

    const result = alignLyricsToCaption(lines, captionWords);
    assert.ok(result);
    assert.strictEqual(result.stats.mode, "constant");
    assert.strictEqual(result.stats.medianOffset, 12.0);
  });

  it("returns null when too few matches exist", () => {
    const lines: LyricsLine[] = [
      {
        text: "A completely different set of lyric words that does not match video captions at all",
        start: 10.0,
        end: 20.0,
      },
    ];

    const captionWords: CaptionWord[] = [
      { text: "Bonjour", start: 12.0, end: 13.0 },
      { text: "le", start: 13.0, end: 13.5 },
      { text: "monde", start: 13.5, end: 14.0 },
    ];

    const result = alignLyricsToCaption(lines, captionWords);
    assert.strictEqual(result, null);
  });

  it("never mutates the input lines or words", () => {
    const rawLines: LyricsLine[] = [
      {
        text: "One two three four five six seven eight nine ten",
        start: 1.0,
        end: 5.0,
        words: [
          { text: "One", start: 1.0, end: 1.3 },
          { text: "two", start: 1.3, end: 1.6 },
          { text: "three", start: 1.6, end: 2.0 },
          { text: "four", start: 2.0, end: 2.5 },
          { text: "five", start: 2.5, end: 3.0 },
          { text: "six", start: 3.0, end: 3.5 },
          { text: "seven", start: 3.5, end: 4.0 },
          { text: "eight", start: 4.0, end: 4.5 },
          { text: "nine", start: 4.5, end: 4.8 },
          { text: "ten", start: 4.8, end: 5.0 },
        ],
      },
    ];

    const rawSnapshot = JSON.parse(JSON.stringify(rawLines));

    const captionWords: CaptionWord[] = rawLines[0].words!.map((w) => ({
      text: w.text,
      start: w.start + 10,
      end: w.end + 10,
    }));

    const result = alignLyricsToCaption(rawLines, captionWords);
    assert.ok(result);

    // Verify original was not mutated
    assert.deepStrictEqual(rawLines, rawSnapshot);
  });

  it("handles Sinhala tokens without crashing and aligns them", () => {
    const lines: LyricsLine[] = [
      {
        text: "ඔබ මගේ සිතේ රැඳී තිබේ සැමදා",
        start: 5.0,
        end: 10.0,
        words: [
          { text: "ඔබ", start: 5.0, end: 5.5 },
          { text: "මගේ", start: 5.5, end: 6.2 },
          { text: "සිතේ", start: 6.2, end: 7.0 },
          { text: "රැඳී", start: 7.0, end: 7.8 },
          { text: "තිබේ", start: 7.8, end: 8.5 },
          { text: "සැමදා", start: 8.5, end: 9.5 },
        ],
      },
      {
        text: "ජීවිතේ පුරා ඔබේ සෙනෙහස පතමි",
        start: 11.0,
        end: 16.0,
        words: [
          { text: "ජීවිතේ", start: 11.0, end: 11.8 },
          { text: "පුරා", start: 11.8, end: 12.5 },
          { text: "ඔබේ", start: 12.5, end: 13.2 },
          { text: "සෙනෙහස", start: 13.2, end: 14.5 },
          { text: "පතමි", start: 14.5, end: 15.5 },
        ],
      },
    ];

    const offset = 4.0;
    const captionWords: CaptionWord[] = [];
    for (const l of lines) {
      if (l.words) {
        for (const w of l.words) {
          captionWords.push({
            text: w.text,
            start: w.start + offset,
            end: w.end + offset,
          });
        }
      }
    }

    const result = alignLyricsToCaption(lines, captionWords);
    assert.ok(result);
    assert.strictEqual(result.stats.matched, 11);
    assert.strictEqual(result.stats.medianOffset, 4.0);
  });
});
