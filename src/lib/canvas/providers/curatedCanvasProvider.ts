import { CanvasQuery, CanvasResponse, ICanvasProvider } from "../types";
import { cleanCanvasArtist, cleanCanvasTitle, isArtistMatch, isTitleMatch, isAlbumMatch } from "../matching";

interface CuratedItem {
  title: string;
  artist: string;
  album?: string;
  url: string;
  format: "hls" | "mp4";
  bgColor?: string;
}

/**
 * Curated registry of verified animated cover arts for top songs.
 * Ensures zero-latency, 100% accurate visual experience for major hits.
 */
const CURATED_CANVASES: CuratedItem[] = [
  {
    title: "Blinding Lights",
    artist: "The Weeknd",
    album: "After Hours",
    url: "https://mvod.itunes.apple.com/itunes-assets/HLSMusic126/v4/21/67/52/21675282-f02b-b806-f98b-ecda247e8720/P359475928_default.m3u8",
    format: "hls",
    bgColor: "#820f18",
  },
  {
    title: "Levitating",
    artist: "Dua Lipa",
    album: "Future Nostalgia",
    url: "https://mvod.itunes.apple.com/itunes-assets/HLSMusic116/v4/91/31/3f/91313f89-8c65-5c1a-5bf3-018ceba0a47d/P393608112_default.m3u8",
    format: "hls",
    bgColor: "#09142b",
  },
  {
    title: "Cruel Summer",
    artist: "Taylor Swift",
    album: "Lover",
    url: "https://mvod.itunes.apple.com/itunes-assets/HLSMusic116/v4/0d/67/bd/0d67bd34-399a-f4ef-5e43-e692138eb15d/P393607994_default.m3u8",
    format: "hls",
    bgColor: "#d99bb5",
  },
  {
    title: "Anti-Hero",
    artist: "Taylor Swift",
    album: "Midnights",
    url: "https://mvod.itunes.apple.com/itunes-assets/HLSMusic122/v4/a4/c8/ff/a4c8ffe8-be48-38bb-ff0c-85a2107147b2/P455799793_default.m3u8",
    format: "hls",
    bgColor: "#232b38",
  },
  {
    title: "bad guy",
    artist: "Billie Eilish",
    album: "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?",
    url: "https://mvod.itunes.apple.com/itunes-assets/HLSMusic126/v4/4a/1c/70/4a1c70e5-79a0-ee46-63e8-8a8b13970bcf/P359475960_default.m3u8",
    format: "hls",
    bgColor: "#ebe436",
  },
  {
    title: "BIRDS OF A FEATHER",
    artist: "Billie Eilish",
    album: "HIT ME HARD AND SOFT",
    url: "https://mvod.itunes.apple.com/itunes-assets/HLSMusic221/v4/a3/52/a9/a352a95c-9c71-085e-b2d0-8f9f743ee299/P608976451_default.m3u8",
    format: "hls",
    bgColor: "#142542",
  },
  {
    title: "Die With A Smile",
    artist: "Lady Gaga & Bruno Mars",
    album: "MAYHEM",
    url: "https://mvod.itunes.apple.com/itunes-assets/HLSMusic211/v4/c3/00/cb/c300cb40-9a25-a131-01ce-2ca549e390c5/P627236594_default.m3u8",
    format: "hls",
    bgColor: "#1a1a24",
  },
  {
    title: "Circles",
    artist: "Post Malone",
    album: "Hollywood's Bleeding",
    url: "https://mvod.itunes.apple.com/itunes-assets/HLSMusic116/v4/36/ae/a0/36aea030-cf2a-5942-5f65-27a3a3036c07/P393608226_default.m3u8",
    format: "hls",
    bgColor: "#1c1d22",
  },
  {
    title: "As It Was",
    artist: "Harry Styles",
    album: "Harry's House",
    url: "https://mvod.itunes.apple.com/itunes-assets/HLSMusic122/v4/5a/b6/ec/5ab6ecad-59d8-910a-dd76-5fa4a1795c47/P455799839_default.m3u8",
    format: "hls",
    bgColor: "#c5b79e",
  },
  {
    title: "Flowers",
    artist: "Miley Cyrus",
    album: "Endless Summer Vacation",
    url: "https://mvod.itunes.apple.com/itunes-assets/HLSMusic126/v4/b8/b8/b6/b8b8b61c-80ee-8be5-6184-75053e198651/P480133242_default.m3u8",
    format: "hls",
    bgColor: "#4b4034",
  },
  {
    title: "Kill Bill",
    artist: "SZA",
    album: "SOS",
    url: "https://mvod.itunes.apple.com/itunes-assets/HLSMusic112/v4/64/00/a3/6400a359-28c1-657c-d760-4966d557161b/P470129851_default.m3u8",
    format: "hls",
    bgColor: "#1e355b",
  },
  {
    title: "Espresso",
    artist: "Sabrina Carpenter",
    album: "Short n' Sweet",
    url: "https://mvod.itunes.apple.com/itunes-assets/HLSVideo221/v4/f9/e7/bc/f9e7bc17-b0db-3d1b-a4c7-27f666b33b0a/P899578198_default.m3u8",
    format: "hls",
    bgColor: "#1b3f90",
  },
  {
    title: "Taste",
    artist: "Sabrina Carpenter",
    album: "Short n' Sweet",
    url: "https://mvod.itunes.apple.com/itunes-assets/HLSVideo221/v4/cc/26/52/cc265254-fcef-87f2-1c45-d3af4fd6b289/P899570426_default.m3u8",
    format: "hls",
    bgColor: "#1b3f90",
  },
  {
    title: "Save Your Tears",
    artist: "The Weeknd",
    album: "After Hours",
    url: "https://mvod.itunes.apple.com/itunes-assets/HLSMusic126/v4/fe/c6/65/fec6656a-f81d-fc16-c1a6-ccaf080c279d/P359428352_default.m3u8",
    format: "hls",
    bgColor: "#621a04",
  },
  {
    title: "vampire",
    artist: "Olivia Rodrigo",
    album: "GUTS",
    url: "https://mvod.itunes.apple.com/itunes-assets/HLSMusic126/v4/b6/d6/9e/b6d69e5c-0e74-682b-f119-05b55a06d5fd/P609219218_default.m3u8",
    format: "hls",
    bgColor: "#100c37",
  },
  {
    title: "good 4 u",
    artist: "Olivia Rodrigo",
    album: "SOUR",
    url: "https://mvod.itunes.apple.com/itunes-assets/HLSMusic126/v4/11/28/8e/11288e5f-85a1-3de0-1e5d-733e57650c41/P359426827_default.m3u8",
    format: "hls",
    bgColor: "#8980c4",
  },
  {
    title: "greedy",
    artist: "Tate McRae",
    album: "greedy - Single",
    url: "https://mvod.itunes.apple.com/itunes-assets/HLSVideo126/v4/96/14/ba/9614baf7-2bac-8444-7026-63e49ddd3e27/P630358477_default.m3u8",
    format: "hls",
    bgColor: "#f7f7f7",
  },
];

export class CuratedCanvasProvider implements ICanvasProvider {
  public readonly name = "curated";

  public async getCanvas(query: CanvasQuery): Promise<CanvasResponse | null> {
    const cleanTitle = cleanCanvasTitle(query.title, query.artist);
    const cleanArtist = cleanCanvasArtist(query.artist);
    if ((!cleanTitle && !query.album) || !cleanArtist) return null;

    for (const item of CURATED_CANVASES) {
      const titleMatch = cleanTitle ? isTitleMatch(cleanTitle, item.title) : { isMatch: false, score: 0 };
      const artistMatch = isArtistMatch(cleanArtist, item.artist);
      const albumMatch = item.album
        ? (query.album && isAlbumMatch(query.album, item.album)) || isAlbumMatch(cleanTitle, item.album)
        : false;

      if ((titleMatch.isMatch || albumMatch) && artistMatch.isMatch) {
        return {
          hasCanvas: true,
          animatedCover: {
            url: item.url,
            width: 720,
            height: 720,
            durationMs: null,
            format: item.format,
            source: "curated",
            matchedTitle: item.title,
            matchedArtist: item.artist,
            album: item.album,
            bgColor: item.bgColor,
          },
          fallbackRequired: false,
          source: "curated",
        };
      }
    }

    return null;
  }
}

