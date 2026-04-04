import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: {
      has_google_id: !!process.env.GOOGLE_CLIENT_ID,
      has_hf_token: !!(process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN),
      node_version: process.version,
    }
  });
}
