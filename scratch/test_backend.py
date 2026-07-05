import os
import sys
sys.path.append(os.path.abspath("AI"))

from dotenv import load_dotenv
load_dotenv("AI/.env")

# Mock FastAPI request
from main import PlaylistRequest, create_ai_playlist
from config import redis_client
import hashlib
import json

req = PlaylistRequest(
    user_id="test_user",
    prompt="chill acoustic mix",
    raw_history=[
        {"title": "Skinny Love", "artist": "Bon Iver"},
        {"title": "Blowin' in the Wind", "artist": "Bob Dylan"}
    ]
)

# Clear cache first to force cache miss on run 1
history_str = json.dumps(req.raw_history, sort_keys=True)
request_hash = hashlib.md5(f"{req.prompt}:{history_str}".encode("utf-8")).hexdigest()
cache_key = f"user:playlist_rec:{req.user_id}:{request_hash}"

try:
    redis_client.delete(cache_key)
    print("Pre-cleared cache key:", cache_key)
except Exception as e:
    print("Failed to delete cache key:", e)

print("\n--- RUN 1 (Cache Miss) ---")
try:
    response = create_ai_playlist(req)
    print("Run 1 Title:", response.get("title"))
except Exception as e:
    print("Run 1 Failed:", e)

print("\n--- RUN 2 (Cache Hit) ---")
try:
    response = create_ai_playlist(req)
    print("Run 2 Title:", response.get("title"))
except Exception as e:
    print("Run 2 Failed:", e)
