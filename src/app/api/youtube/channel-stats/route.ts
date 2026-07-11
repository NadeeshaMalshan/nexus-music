import { NextResponse } from "next/server";
import { fetchChannelStats, searchOfficialChannel, scrapeChannelStats } from "@/lib/youtubeData";
import { getRequestAccessToken } from "@/lib/requestAccessToken";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");
    
    if (!channelId) {
      return NextResponse.json({ error: "Missing channelId" }, { status: 400 });
    }

    const accessToken = await getRequestAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let stats = await scrapeChannelStats(channelId);
    if (!stats) {
      try {
        stats = await fetchChannelStats(accessToken, channelId);
      } catch (e) {
        console.warn("scrapeChannelStats failed, trying fallback fetchChannelStats:", e);
      }
    }

    if (!stats) return NextResponse.json({ error: "No statistics found" }, { status: 404 });

    const subs = parseInt(stats.statistics?.subscriberCount || "0");
    const name = stats.snippet?.title || "Artist";

    // ─── Verification & Fallback Logic ──────────────────────────────────────────
    // Many YT Music artist IDs (Topic channels) have very low sub counts.
    // If we find a "Low authority" ID for a known big name or if it looks suspicious,
    // we try to find the Official Artist Channel (OAC) by searching for it.
    // We define a threshold: if sub count < 1M AND the channel title doesn't look like an OAC,
    // we attempt to find a higher-authority profile with the same name.
    
    const isTopicOrSmall = name.toLowerCase().includes(" - topic") || subs < 1500000;
    
    if (isTopicOrSmall) {
      // Search for the primary channel with the same name
      const query = name.replace(/\s*-\s*Topic$/i, "").trim();
      const officialCandidate = await searchOfficialChannel(accessToken, query);
      
      const fs = require('fs');
      fs.appendFileSync('debug.log', `[Stats API] Candidate for ${query}: ${JSON.stringify(officialCandidate)}\n`);

      if (officialCandidate && officialCandidate.id?.channelId && officialCandidate.id.channelId !== channelId) {
        // Fetch stats for the candidate to compare
        const officialStats = await fetchChannelStats(accessToken, officialCandidate.id.channelId);
        const officialSubs = parseInt(officialStats?.statistics?.subscriberCount || "0");
        
        fs.appendFileSync('debug.log', `[Stats API] Compared: Target (${subs}) vs Candidate (${officialSubs})\n`);

        // If the official candidate has significantly more subscribers, we favor it
        if (officialStats && officialSubs > subs) {
           console.log(`[Stats API] UPGRADING channel stats: ${name} (${subs} subs) -> ${officialStats.snippet.title} (${officialSubs} subs)`);
           stats = officialStats;
        }
      }
    }

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error("[YouTube Stats] Error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
