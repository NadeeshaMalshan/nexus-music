import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { searchSongsRobust } from "@/lib/ytmSearchService";

const ACR_ACCESS_KEY = process.env.ACR_ACCESS_KEY || "";
const ACR_ACCESS_SECRET = process.env.ACR_ACCESS_SECRET || "";
const ACR_HOST = process.env.ACR_HOST || "identify-eu-west-1.acrcloud.com";

function youtubeHqThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function formatSeconds(total: number): string {
  if (!Number.isFinite(total) || total < 0) return "0:00";
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export async function POST(request: Request) {
  try {
    if (!ACR_ACCESS_KEY || !ACR_ACCESS_SECRET) {
      return NextResponse.json(
        { error: "ACRCloud credentials not configured. Please add ACR_ACCESS_KEY and ACR_ACCESS_SECRET to your .env.local file." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const audioBlob = formData.get("audio") as Blob;

    if (!audioBlob) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    }

    const audioBuffer = Buffer.from(await audioBlob.arrayBuffer());

    // ACRCloud Parameters
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const httpMethod = "POST";
    const httpUri = "/v1/identify";
    const dataType = "audio";
    const signatureVersion = "1";

    // Generate Signature
    const stringToSign = [
      httpMethod,
      httpUri,
      ACR_ACCESS_KEY,
      dataType,
      signatureVersion,
      timestamp
    ].join("\n");

    const signature = crypto
      .createHmac("sha1", ACR_ACCESS_SECRET)
      .update(Buffer.from(stringToSign, "utf-8"))
      .digest()
      .toString("base64");

    // Prepare Request to ACRCloud
    const acrFormData = new FormData();
    acrFormData.append("sample", audioBlob, "sample.wav");
    acrFormData.append("access_key", ACR_ACCESS_KEY);
    acrFormData.append("data_type", dataType);
    acrFormData.append("signature_version", signatureVersion);
    acrFormData.append("signature", signature);
    acrFormData.append("sample_bytes", audioBuffer.length.toString());
    acrFormData.append("timestamp", timestamp);

    const response = await fetch(`https://${ACR_HOST}${httpUri}`, {
      method: "POST",
      body: acrFormData,
    });

    if (!response.ok) {
      throw new Error(`ACRCloud responded with status ${response.status}`);
    }

    const result = await response.json();

    if (result.status.code !== 0) {
      // Code 1001 means no result found
      if (result.status.code === 1001) {
          return NextResponse.json({ error: "No music identified. Try playing the music louder or moving closer to the source." }, { status: 404 });
      }
      return NextResponse.json({ error: result.status.msg || "ACRCloud identification failed" }, { status: 500 });
    }

    const metadata = result.metadata.music[0];
    const detectedTitle = metadata.title;
    const detectedArtist = metadata.artists?.map((a: any) => a.name).join(", ") || "Unknown Artist";
    
    // Now search this on YouTube Music to get a playable version
    const searchQuery = `${detectedTitle} ${detectedArtist}`;
    const ytResults = await searchSongsRobust(searchQuery);

    if (!ytResults || ytResults.length === 0) {
        // Fallback to returning just the metadata if YT search fails
        return NextResponse.json({
            identified: true,
            title: detectedTitle,
            artist: detectedArtist,
            message: "Song identified but not found on YouTube Music."
        });
    }

    const bestMatch = ytResults[0];
    const song = {
        id: bestMatch.youtubeId,
        title: bestMatch.title,
        artist: bestMatch.artists?.map(a => a.name).join(", ") || "Unknown Artist",
        artwork: bestMatch.thumbnailUrl || youtubeHqThumbnail(bestMatch.youtubeId!),
        duration: bestMatch.duration?.label || formatSeconds(bestMatch.duration?.totalSeconds || 0),
        color: "#FA243C" // Default color, will be updated by frontend extractor
    };

    return NextResponse.json(song);

  } catch (error) {
    console.error("Identify route failed:", error);
    return NextResponse.json({ error: "Failed to identify track." }, { status: 500 });
  }
}
