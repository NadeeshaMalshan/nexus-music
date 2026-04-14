import { NextResponse } from "next/server";
import { getLiveMetadata } from "@/lib/live-tracker";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";
    const title = searchParams.get("title") || "";
    
    // We poll this to get dynamic Artist - Song data from Live Streams
    if (query === "" && title === "") return NextResponse.json({ artist: "", title: "", source: "" });
    
    const data = await getLiveMetadata(query, title);
    return NextResponse.json(data || { artist: "", title: "", source: "" });
  } catch (error) {
    console.error("API Error Live Tracker:", error);
    return NextResponse.json({ artist: "", title: "", source: "" });
  }
}
