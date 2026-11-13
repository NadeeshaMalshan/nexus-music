import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { isSongExplicit } from "../src/components/echoai/ExplicitBadge";
import { prepareAppleLyricsLines } from "../src/lib/lyrics/prepareAppleLyricsLines";
import { LyricsLine } from "../src/lib/lyrics/types";

describe("Explicit Song Detection (isSongExplicit)", () => {
  test("identifies explicit songs by boolean flags", () => {
    assert.equal(isSongExplicit({ title: "Song A", isExplicit: true }), true);
    assert.equal(isSongExplicit({ title: "Song B", explicit: true }), true);
    assert.equal(isSongExplicit({ title: "Song C", isExplicit: false, explicit: false }), false);
  });

  test("identifies explicit songs from title tags", () => {
    assert.equal(isSongExplicit({ title: "drivers license (Explicit)" }), true);
    assert.equal(isSongExplicit({ title: "WAP [feat. Megan Thee Stallion] [Explicit]" }), true);
    assert.equal(isSongExplicit({ title: "vampire (Dirty Version)" }), true);
    assert.equal(isSongExplicit({ title: "Parental Advisory Track" }), true);
    assert.equal(isSongExplicit({ title: "Die With A Smile" }), false);
  });

  test("identifies explicit songs from YouTube Music badge metadata", () => {
    assert.equal(
      isSongExplicit({
        title: "good 4 u",
        badges: [{ iconType: "MUSIC_EXPLICIT_BADGE" }],
      }),
      true
    );
    assert.equal(
      isSongExplicit({
        title: "deja vu",
        badges: [{ metadataBadgeRenderer: { style: "BADGE_STYLE_TYPE_EXPLICIT" } }],
      }),
      true
    );
    assert.equal(
      isSongExplicit({
        title: "Clean Track",
        badges: [{ metadataBadgeRenderer: { style: "BADGE_STYLE_TYPE_LIVE_NOW" } }],
      }),
      false
    );
  });

  test("handles empty or null song gracefully", () => {
    assert.equal(isSongExplicit(null), false);
    assert.equal(isSongExplicit(undefined), false);
    assert.equal(isSongExplicit({}), false);
  });
});

describe("Apple Music Instrumental Intro & 3-Dot Lyrics Line Generation", () => {
  test("automatically inserts instrumental intro line when first lyric starts after 3s", () => {
    const rawLines: LyricsLine[] = [
      { text: "First line of vocals starts at 8.5 seconds", start: 8.5, end: 12.0 },
      { text: "Second line of vocals", start: 12.0, end: 16.0 },
    ];
    const res = prepareAppleLyricsLines(rawLines);

    assert.equal(res.length, 3);
    // Line 0 must be an instrumental intro line for the 3-dot animation
    const intro = res[0];
    assert.equal(intro.start, 0);
    assert.equal(intro.end, 8.5);
    assert.equal(intro.isInstrumental, true);
    assert.equal(intro.text, "♪");

    // Line 1 is the actual vocal line
    assert.equal(res[1].start, 8.5);
    assert.equal(res[1].text, "First line of vocals starts at 8.5 seconds");
  });

  test("does not insert extra intro line if song starts right away (start < 3s)", () => {
    const rawLines: LyricsLine[] = [
      { text: "Immediate vocal intro", start: 1.2, end: 4.5 },
      { text: "Next line", start: 4.5, end: 8.0 },
    ];
    const res = prepareAppleLyricsLines(rawLines);
    assert.equal(res.length, 2);
    assert.equal(res[0].start, 1.2);
  });

  test("inserts instrumental line for gaps >= 5.0s between lines", () => {
    const rawLines: LyricsLine[] = [
      { text: "Verse 1", start: 2.0, end: 5.0 },
      { text: "Chorus starts after a long guitar break", start: 18.0, end: 24.0 },
    ];
    const res = prepareAppleLyricsLines(rawLines);

    assert.ok(res.length >= 3);
    const breakLine = res.find((l) => l.isInstrumental && l.start >= 5.0 && l.end <= 18.0);
    assert.ok(breakLine, "Must generate instrumental 3-dot line for gap between 5s and 18s");
    assert.equal(breakLine.isInstrumental, true);
  });

  test("handles empty raw lines array gracefully", () => {
    assert.deepEqual(prepareAppleLyricsLines([]), []);
  });
});
