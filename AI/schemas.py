from pydantic import BaseModel, Field
from typing import List, Literal

class TasteProfile(BaseModel):
    preferred_genres: List[str] = Field(description="Music genres based on user history")
    vibe_description: str = Field(description="A 1-sentence vibe/mood summary of their listening habits")
    tempo_preference: Literal["slow", "moderate", "fast", "any"] = Field(description="Tempo preference")
    top_artists: List[str] = Field(description="Top 3 artist names detected in history")

class SearchQueries(BaseModel):
    queries: List[str] = Field(description="Exactly 5 search queries optimized for YouTube Music search engine")

class PlaylistBranding(BaseModel):
    title: str = Field(description="A creative 2-4 word playlist name")
    description: str = Field(description="A 1-sentence poetic description for the playlist")
    image_prompt: str = Field(description="A detailed prompt for Imagen 3 describing a square cover art matching the mood")

class FallbackSong(BaseModel):
    title: str
    artist: str

class FallbackPlaylist(BaseModel):
    songs: List[FallbackSong]
    
# For backward compatibility with older pydantic versions
FallbackSong.model_rebuild() if hasattr(FallbackSong, "model_rebuild") else None
FallbackPlaylist.model_rebuild() if hasattr(FallbackPlaylist, "model_rebuild") else None
