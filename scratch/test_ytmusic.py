from ytmusicapi import YTMusic
import sys

try:
    print("Initializing YTMusic...")
    ytm = YTMusic()
    print("Searching for 'happy summer'...")
    results = ytm.search("happy summer", filter="songs")
    print(f"Success! Found {len(results)} results:")
    for r in results[:3]:
        print(f"- {r.get('title')} by {r.get('artists')}")
except Exception as e:
    print("Failed:", e)
