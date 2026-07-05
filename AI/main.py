from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from ytmusicapi import YTMusic
import services
import hashlib
import json
from schemas import TasteProfile
from config import redis_client

app = FastAPI()
ytm = YTMusic()

class PlaylistRequest(BaseModel):
    user_id: str
    prompt: str
    raw_history: List[dict]

class TrackItem(BaseModel):
    id: str
    title: str
    artist: str
    artwork: str

@app.get("/")
def read_root():
    return {"status": "running", "service": "Nexus AI Backend Server"}

@app.post("/api/recommendations")
def create_ai_playlist(req: PlaylistRequest):
    # Deterministic cache key based on prompt and history
    history_str = json.dumps(req.raw_history, sort_keys=True)
    request_hash = hashlib.md5(f"{req.prompt}:{history_str}".encode("utf-8")).hexdigest()
    cache_key = f"user:playlist_rec:{req.user_id}:{request_hash}"
    
    # Check cache
    try:
        cached_res = redis_client.get(cache_key)
        if cached_res:
            print("Playlist recommendation loaded from Redis cache!")
            if isinstance(cached_res, bytes):
                cached_res = cached_res.decode("utf-8")
            return json.loads(cached_res)
    except Exception as cache_err:
        print(f"Cache lookup failed: {cache_err}")

    # 1. Taste Profile Predictor
    taste = services.get_user_taste(req.user_id, req.raw_history)
    
    # 2. Generate search terms
    queries = services.generate_playlist_searches(req.prompt, taste)
    
    # 3. Search YT Music and collect unique songs
    seen_ids = set()
    compiled_songs: List[TrackItem] = []
    is_blocked = False
    
    for q in queries:
        if len(compiled_songs) >= 20:
            break
        try:
            results = ytm.search(q, filter="songs")
            for item in results:
                vid = item.get("videoId")
                if vid and vid not in seen_ids:
                    seen_ids.add(vid)
                    artists = item.get("artists", [])
                    artist_name = ", ".join([a["name"] for a in artists]) if artists else "Unknown Artist"
                    thumbnails = item.get("thumbnails", [{}])
                    thumbnail = thumbnails[-1].get("url", "") if thumbnails else ""
                    
                    compiled_songs.append(TrackItem(
                        id=vid,
                        title=item.get("title", "Unknown"),
                        artist=artist_name,
                        artwork=thumbnail
                    ))
                    if len(compiled_songs) >= 20:
                        break
        except Exception as e:
            print(f"Search failed for query '{q}': {e}")
            if any(term in str(e) for term in ["SSL", "Max retries exceeded", "EOF", "Connection", "SSLEOFError"]):
                print("Detected network or SSL block on YouTube Music. Skipping remaining searches to prevent delays.")
                is_blocked = True
                break
            
    # If no songs were found, fall back to search for prompt itself
    if not compiled_songs and not is_blocked:
        try:
            results = ytm.search(req.prompt, filter="songs")
            for item in results[:20]:
                vid = item.get("videoId")
                if vid:
                    artists = item.get("artists", [])
                    artist_name = ", ".join([a["name"] for a in artists]) if artists else "Unknown Artist"
                    thumbnails = item.get("thumbnails", [{}])
                    thumbnail = thumbnails[-1].get("url", "") if thumbnails else ""
                    compiled_songs.append(TrackItem(
                        id=vid,
                        title=item.get("title", "Unknown"),
                        artist=artist_name,
                        artwork=thumbnail
                    ))
        except Exception as e:
            print(f"Fallback search failed: {e}")
            
    # Ultimate LLM Recommendations Fallback (when YT Music completely blocks datacenter IPs)
    if not compiled_songs:
        print("All YouTube Music searches failed due to IP/SSL block. Generating LLM fallback recommendations...")
        fallback_playlist = services.get_fallback_recommendations(req.prompt, taste)
        for s in fallback_playlist.songs:
            # Generate a deterministic dummy ID based on title and artist
            dummy_id = f"fallback_{hashlib.md5((s.title + s.artist).encode('utf-8')).hexdigest()[:11]}"
            compiled_songs.append(TrackItem(
                id=dummy_id,
                title=s.title,
                artist=s.artist,
                artwork="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=250&h=250&fit=crop"
            ))
            
    # 4. Generate Name, Description and Cover Image
    songs_dict = [{"title": s.title, "artist": s.artist} for s in compiled_songs]
    branding = services.generate_playlist_branding(req.prompt, songs_dict)
    
    cover_url = services.generate_cover_image(branding.image_prompt, req.prompt)
    
    response = {
        "title": branding.title,
        "description": branding.description,
        "cover_url": cover_url,
        "queries": queries,
        "taste_vibe": taste.vibe_description,
        "songs": [s.model_dump() if hasattr(s, "model_dump") else s.dict() for s in compiled_songs]
    }
    
    try:
        redis_client.setex(cache_key, 86400, json.dumps(response))
        print("Playlist recommendation cached in Redis!")
    except Exception as cache_err:
        print(f"Failed to cache response in Redis: {cache_err}")
        
    return response
