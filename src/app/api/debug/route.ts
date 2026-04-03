import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { searchOfficialChannel } from "@/lib/youtubeData";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "BLACKPINK";
    const session = await getServerSession(authOptions);
    
    if (!session?.accessToken) return NextResponse.json({ error: "no token" });

    const official = await searchOfficialChannel(session.accessToken, q);

    return NextResponse.json({
        query: q,
        official
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
