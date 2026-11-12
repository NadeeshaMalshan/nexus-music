import { isArtistMatch } from "./canvas/matching";

export interface KnownOAC {
  name: string;
  channelId: string;
  topicId?: string;
  subscribers: number;
}

export const KNOWN_OAC_LIST: KnownOAC[] = [
  {
    name: "Dua Lipa",
    channelId: "UC-J-KZfRV8c13fOCkhXdLiQ",
    topicId: "UCzVb0SIXp9q9PeKCcFjsBtA",
    subscribers: 25500000,
  },
  {
    name: "Olivia Rodrigo",
    channelId: "UCy3zgWom-5AGypGX_FVTKpg",
    topicId: "UCE5XNpliPM-SmyFEp61tL_g",
    subscribers: 16900000,
  },
  {
    name: "Taylor Swift",
    channelId: "UCqECaJ8Gagnn7YCbPEzWH6g",
    topicId: "UCqECaJ8Gagnn7YCbPEzWH6g",
    subscribers: 60400000,
  },
  {
    name: "The Weeknd",
    channelId: "UC0WP5P-ufpRfjbNrmOWwLBQ",
    topicId: "UC0WP5P-ufpRfjbNrmOWwLBQ",
    subscribers: 36200000,
  },
  {
    name: "BLACKPINK",
    channelId: "UCOmHUn--16B90oW2L6FRR3A",
    topicId: "UCOmHUn--16B90oW2L6FRR3A",
    subscribers: 96000000,
  },
  {
    name: "BTS",
    channelId: "UCLkAepWjdylmXSltofFvsYQ",
    topicId: "UCLkAepWjdylmXSltofFvsYQ",
    subscribers: 79000000,
  },
  {
    name: "Billie Eilish",
    channelId: "UCiGm_E4ZwYSHV3bcW1pnSeQ",
    topicId: "UCiGm_E4ZwYSHV3bcW1pnSeQ",
    subscribers: 52300000,
  },
  {
    name: "Ariana Grande",
    channelId: "UC9CoOnJ6IIwnGs0545jNmGw",
    topicId: "UC9CoOnJ6IIwnGs0545jNmGw",
    subscribers: 55800000,
  },
  {
    name: "Sabrina Carpenter",
    channelId: "UCafSFdbabflrnbekmsff8EQ",
    topicId: "UCafSFdbabflrnbekmsff8EQ",
    subscribers: 13600000,
  },
  {
    name: "Bruno Mars",
    channelId: "UCE_M8A5KAOGgh2C2Ufv9URg",
    topicId: "UCE_M8A5KAOGgh2C2Ufv9URg",
    subscribers: 40500000,
  },
  {
    name: "Ed Sheeran",
    channelId: "UC0C-w0YjGpqDXGB8IHb662A",
    topicId: "UC0C-w0YjGpqDXGB8IHb662A",
    subscribers: 55400000,
  },
  {
    name: "Justin Bieber",
    channelId: "UCIwFjwMjI0y7PDBVEO9-bkQ",
    topicId: "UCIwFjwMjI0y7PDBVEO9-bkQ",
    subscribers: 74800000,
  },
  {
    name: "Eminem",
    channelId: "UCfM3zsQsOnfWNUppiycmBuw",
    topicId: "UCfM3zsQsOnfWNUppiycmBuw",
    subscribers: 62800000,
  },
  {
    name: "Drake",
    channelId: "UCByOQJjav0CUDwxCk-jVNRQ",
    topicId: "UCByOQJjav0CUDwxCk-jVNRQ",
    subscribers: 31200000,
  },
  {
    name: "Kendrick Lamar",
    channelId: "UC3lBXqo7q44VAMb7u8n99mg",
    topicId: "UC3lBXqo7q44VAMb7u8n99mg",
    subscribers: 16100000,
  },
  {
    name: "Chappell Roan",
    channelId: "UCe6vK-eGgN3uW8gqM_G8V3w",
    topicId: "UCe6vK-eGgN3uW8gqM_G8V3w",
    subscribers: 3200000,
  },
  {
    name: "Gracie Abrams",
    channelId: "UC8aKkW7-wYJq4o7N7jJg8hQ",
    topicId: "UC8aKkW7-wYJq4o7N7jJg8hQ",
    subscribers: 3100000,
  },
  {
    name: "Tate McRae",
    channelId: "UCQh6DkEb1NhhA-0qM6e3q0w",
    topicId: "UCQh6DkEb1NhhA-0qM6e3q0w",
    subscribers: 6500000,
  },
  {
    name: "Lana Del Rey",
    channelId: "UCqk3CdGN_NZEVW4575APbGg",
    topicId: "UCqk3CdGN_NZEVW4575APbGg",
    subscribers: 17400000,
  },
  {
    name: "SZA",
    channelId: "UCc4T6G8u-87Gk4k7Q-0NfAg",
    topicId: "UCc4T6G8u-87Gk4k7Q-0NfAg",
    subscribers: 9200000,
  },
  {
    name: "Post Malone",
    channelId: "UCeLHszkByNZtqek_EDMrPvw",
    topicId: "UCeLHszkByNZtqek_EDMrPvw",
    subscribers: 27100000,
  },
  {
    name: "Doja Cat",
    channelId: "UCpJaGapqmwtU_jOqg4vG20g",
    topicId: "UCpJaGapqmwtU_jOqg4vG20g",
    subscribers: 13100000,
  },
  {
    name: "Charli xcx",
    channelId: "UCA8hn9qT4i0t_Vlq1sC_VjQ",
    topicId: "UCA8hn9qT4i0t_Vlq1sC_VjQ",
    subscribers: 4300000,
  },
  {
    name: "Lady Gaga",
    channelId: "UCNL1ZbcRFi014-9PZkM0q0A",
    topicId: "UCNL1ZbcRFi014-9PZkM0q0A",
    subscribers: 25000000,
  },
  {
    name: "Rihanna",
    channelId: "UC2xskkQVFEpLcGFnNSLQY0A",
    topicId: "UC2xskkQVFEpLcGFnNSLQY0A",
    subscribers: 44000000,
  },
  {
    name: "Katy Perry",
    channelId: "UC-8Q-hLdECw9gkL2A_S7gmg",
    topicId: "UC-8Q-hLdECw9gkL2A_S7gmg",
    subscribers: 45000000,
  },
  {
    name: "Coldplay",
    channelId: "UCDPM_n1atn2ijUwHd0NNRQw",
    topicId: "UCDPM_n1atn2ijUwHd0NNRQw",
    subscribers: 28000000,
  },
  {
    name: "Imagine Dragons",
    channelId: "UCT9zcQNlyht7fRlcjmflRSA",
    topicId: "UCT9zcQNlyht7fRlcjmflRSA",
    subscribers: 32000000,
  },
  {
    name: "Shakira",
    channelId: "UCvlE5gUxA0K-97gN-3A0w9A",
    topicId: "UCvlE5gUxA0K-97gN-3A0w9A",
    subscribers: 46000000,
  },
  {
    name: "Selena Gomez",
    channelId: "UCe_3x5C1Wz6U8Xk-S7Y-a8w",
    topicId: "UCe_3x5C1Wz6U8Xk-S7Y-a8w",
    subscribers: 34000000,
  },
  {
    name: "Olivia Dean",
    channelId: "UCFwKz2hZ4UomZfG4Y7812yA",
    topicId: "UCFwKz2hZ4UomZfG4Y7812yA",
    subscribers: 350000,
  },
];

// Build instant lookup maps
const OAC_BY_NAME = new Map<string, KnownOAC>();
const OAC_BY_CHANNEL_ID = new Map<string, KnownOAC>();

for (const entry of KNOWN_OAC_LIST) {
  OAC_BY_NAME.set(entry.name.toLowerCase().trim(), entry);
  OAC_BY_CHANNEL_ID.set(entry.channelId, entry);
  if (entry.topicId) {
    OAC_BY_CHANNEL_ID.set(entry.topicId, entry);
  }
}

/**
 * Resolves a known Official Artist Channel (OAC) by name, channel ID, or topic channel ID.
 * Supports exact name, channel ID, topic channel ID, and fuzzy artist name matching.
 */
export function getKnownOAC(query: string): KnownOAC | null {
  if (!query) return null;
  const q = query.trim();
  const lower = q.toLowerCase();

  // 1. Direct channel/topic ID match
  if (OAC_BY_CHANNEL_ID.has(q)) {
    return OAC_BY_CHANNEL_ID.get(q)!;
  }

  // 2. Direct name match
  if (OAC_BY_NAME.has(lower)) {
    return OAC_BY_NAME.get(lower)!;
  }

  // Strip common suffixes
  const stripped = lower.replace(/\s*-\s*topic$/i, "").trim();
  if (OAC_BY_NAME.has(stripped)) {
    return OAC_BY_NAME.get(stripped)!;
  }

  // 3. Fuzzy artist name match (tolerating typos like "olivia ridrigi")
  for (const entry of KNOWN_OAC_LIST) {
    const match = isArtistMatch(stripped, entry.name);
    if (match.isMatch && match.score >= 0.82) {
      return entry;
    }
  }

  return null;
}
