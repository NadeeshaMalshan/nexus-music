import os
import requests
import hashlib
from typing import List
from schemas import TasteProfile, SearchQueries, PlaylistBranding, FallbackPlaylist, FallbackSong
from config import redis_client, llm, get_structured_llm, imagen_client

# --- STEP 1: Taste Profile Predictor ---
def get_user_taste(user_id: str, raw_history: List[dict]) -> TasteProfile:
    cache_key = f"user:taste_profile:{user_id}"
    
    cached = redis_client.get(cache_key)
    if cached:
        try:
            if isinstance(cached, str):
                profile = TasteProfile.model_validate_json(cached)
                print("Taste profile loaded from Redis cache!")
                return profile
            elif isinstance(cached, dict):
                profile = TasteProfile.model_validate(cached) if hasattr(TasteProfile, "model_validate") else TasteProfile.parse_obj(cached)
                print("Taste profile loaded from Redis cache (decoded dict)!")
                return profile
        except Exception as e:
            print(f"Failed to parse cached taste profile: {e}")
            pass
    
    # 2. If Cache Miss, predict using Gemini
    print("Cache Miss. Predicting Taste Profile...")
    if not raw_history:
        # Fallback profile if history is empty
        return TasteProfile(
            preferred_genres=["General"],
            vibe_description="A diverse mix of music styles",
            tempo_preference="any",
            top_artists=[]
        )
        
    formatted_history = ", ".join([f"{item['title']} by {item['artist']}" for item in raw_history])
    
    structured_llm = get_structured_llm(TasteProfile)
    system_prompt = "Analyze the music listening history and output a structured profile."
    user_prompt = f"Listening history: {formatted_history}"
    
    taste_profile = structured_llm.invoke([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ])
    
    # Cache taste profile in Redis for 7 days (604800 seconds)
    redis_client.setex(cache_key, 604800, taste_profile.model_dump_json())
    return taste_profile


# --- STEP 2: Generate Taste-Aware Searches ---
def generate_playlist_searches(user_prompt: str, taste: TasteProfile) -> List[str]:
    structured_llm = get_structured_llm(SearchQueries)
    system_prompt = "You generate search keywords for YouTube Music."
    user_content = f"""
    User Query/Theme: {user_prompt}
    User Taste Profile: {taste.model_dump_json()}
    Generate 5 queries blending both elements.
    """
    
    result = structured_llm.invoke([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content}
    ])
    return result.queries


# --- STEP 3: Playlist Name & Cover Art with Fallback ---
def generate_playlist_branding(user_prompt: str, songs: List[dict]) -> PlaylistBranding:
    structured_llm = get_structured_llm(PlaylistBranding)
    song_list = "\n".join([f"- {s['title']} by {s['artist']}" for s in songs[:10]])
    
    branding = structured_llm.invoke([
        {"role": "system", "content": "Create a playlist title, description, and image prompt based on the prompt and songs."},
        {"role": "user", "content": f"Prompt: {user_prompt}\nSongs:\n{song_list}"}
    ])
    return branding

def generate_cover_image(image_prompt: str, theme: str) -> str:
    """
    Tries to generate with Imagen 3, falls back to Unsplash if rate-limited.
    """
    # Deterministic file naming using MD5
    prompt_hash = hashlib.md5(image_prompt.encode("utf-8")).hexdigest()
    
    # Try Option A: Imagen 4
    try:
        result = imagen_client.models.generate_images(
            model='imagen-4.0-generate-001',
            prompt=image_prompt,
            config=dict(number_of_images=1, aspect_ratio="1:1")
        )
        for gen_img in result.generated_images:
            # We want to make sure the target directories exist in Next.js workspace
            os.makedirs("public/covers", exist_ok=True)
            output_path = f"public/covers/{prompt_hash}.jpg"
            with open(output_path, "wb") as f:
                f.write(gen_img.image.image_bytes)
            return f"/covers/{prompt_hash}.jpg"
    except Exception as e:
        if "paid plans" in str(e) or "INVALID_ARGUMENT" in str(e):
            print("Imagen generation skipped (requires paid API key). Falling back to Unsplash...")
        else:
            print(f"Imagen generation failed ({e}). Falling back to Unsplash...")
        
    # Try Option B: Unsplash Fallback
    unsplash_key = os.getenv("UNSPLASH_ACCESS_KEY")
    if unsplash_key:
        url = f"https://api.unsplash.com/photos/random?query={theme}&orientation=squarish&client_id={unsplash_key}"
        try:
            res = requests.get(url).json()
            return res["urls"]["regular"]
        except Exception:
            pass
            
    # Ultimate Static Fallback
    return "https://images.unsplash.com/photo-1614149162883-504ce4d13909"

def get_fallback_recommendations(user_prompt: str, taste: TasteProfile) -> FallbackPlaylist:
    structured_llm = get_structured_llm(FallbackPlaylist)
    system_prompt = "Recommend 15 real, highly-relevant popular songs with titles and artists matching the user theme and preference. Do not use dummy data."
    user_content = f"""
    Theme/Prompt: {user_prompt}
    User Genre/Vibe Preferences: {taste.preferred_genres}, {taste.vibe_description}
    Generate exactly 15 songs.
    """
    try:
        return structured_llm.invoke([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ])
    except Exception as e:
        print(f"Fallback generation failed: {e}")
        return FallbackPlaylist(songs=[
            FallbackSong(title="Summer", artist="Calvin Harris"),
            FallbackSong(title="Paradise", artist="Coldplay"),
            FallbackSong(title="Stay", artist="The Kid LAROI, Justin Bieber"),
            FallbackSong(title="Save Your Tears", artist="The Weeknd"),
            FallbackSong(title="Sweater Weather", artist="The Neighbourhood"),
            FallbackSong(title="Blinding Lights", artist="The Weeknd"),
            FallbackSong(title="Perfect", artist="Ed Sheeran"),
            FallbackSong(title="Lovely", artist="Billie Eilish, Khalid"),
            FallbackSong(title="Stay", artist="Rihanna"),
            FallbackSong(title="Watermelon Sugar", artist="Harry Styles")
        ])
