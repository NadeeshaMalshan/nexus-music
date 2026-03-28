import { NextResponse } from "next/server";
import { OpenAI } from "openai";

const client = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: process.env.HF_TOKEN,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const seed = searchParams.get("seed") || "trending hits";

  try {
    const chatCompletion = await client.chat.completions.create({
      model: "meta-llama/Llama-3.1-8B-Instruct:novita",
      messages: [
        {
          role: "system",
          content: "You are a specialized music recommendation engine. Your response must be a valid JSON object with a single key 'songs' which is an array of objects. Each object must have 'title' and 'artist' (string). Provide 6 recommendations based on the user's seed.",
        },
        {
          role: "user",
          content: `Seed: ${seed}`,
        },
      ],
      // We don't use response_format here to stay safe with router compatibility, 
      // but the system prompt is very strict.
    });

    const content = chatCompletion.choices[0].message.content?.trim();
    if (!content) {
      throw new Error("Empty response from Hugging Face router");
    }

    // Attempt to extract JSON if there's any markdown fluff
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    
    const parsed = JSON.parse(jsonStr);
    const recommendations = Array.isArray(parsed.songs) ? parsed.songs : [];

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("Hugging Face API Error:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations", details: (error as Error).message },
      { status: 500 }
    );
  }
}
