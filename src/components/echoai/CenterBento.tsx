import { Play } from "lucide-react";
import { aiPlaylists, weeklyStats } from "./data";

export type SearchResult = {
  videoId: string;
  title: string;
  author: string;
  duration: string;
  thumbnail: string;
};

type CenterBentoProps = {
  view: "home" | "explorer" | "stats" | "settings";
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  searchResults: SearchResult[];
  searchLoading: boolean;
  onSelectTrack: (item: SearchResult) => void;
};

export function CenterBento({
  view,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  searchResults,
  searchLoading,
  onSelectTrack,
}: CenterBentoProps) {
  const featuredItems = searchResults.slice(0, 6);
  const explorerItems = searchResults.slice(0, 12);

  return (
    <section className="glass h-[calc(100vh-5.5rem)] min-w-0 flex-1 overflow-y-auto rounded-3xl px-10 py-8">
      <div className="mb-8">
        <h2 className="mb-2 text-4xl font-bold text-white">
          {view === "home" && "For You"}
          {view === "explorer" && "AI Explorer"}
          {view === "stats" && "Listening Stats"}
          {view === "settings" && "Settings"}
        </h2>
        <p className="text-white/50">
          {view === "home" && "AI-curated playlists based on your unique taste"}
          {view === "explorer" && "Search and explore tracks, artists, and recommendations"}
          {view === "stats" && "Insights from your listening behavior this week"}
          {view === "settings" && "Tune your Nexus experience and personalization"}
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSearchSubmit();
        }}
        className="mb-6 flex items-center gap-3 rounded-2xl border border-white/[0.12] bg-white/[0.04] p-3"
      >
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search songs, artists, albums..."
          className="w-full bg-transparent px-2 text-sm text-white outline-none placeholder:text-white/40"
        />
        <button
          type="submit"
          className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white transition hover:bg-white/20"
        >
          Search
        </button>
      </form>

      {view === "stats" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {weeklyStats.map((stat) => (
            <article key={stat.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-white/40">{stat.label}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{stat.value}</p>
              <p className="mt-1 text-sm text-purple-300">{stat.trend} vs last week</p>
            </article>
          ))}
          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 lg:col-span-2">
            <h3 className="text-lg font-semibold text-white">Mood Distribution</h3>
            <div className="mt-4 space-y-3">
              {aiPlaylists.map((playlist) => (
                <div key={playlist.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-white/80">{playlist.mood}</span>
                    <span className="text-white/50">{playlist.bpm} BPM avg</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/8">
                    <div className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${Math.min(100, playlist.bpm - 40)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      ) : view === "settings" ? (
        <div className="space-y-4">
          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <h3 className="text-lg font-semibold text-white">Audio Preferences</h3>
            <p className="mt-1 text-sm text-white/50">Crossfade, normalization, and playback quality controls are coming next.</p>
          </article>
          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <h3 className="text-lg font-semibold text-white">AI Personalization</h3>
            <p className="mt-1 text-sm text-white/50">Use recent likes and skips to tune recommendations and lyrical explanations.</p>
          </article>
          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <h3 className="text-lg font-semibold text-white">Connected Services</h3>
            <p className="mt-1 text-sm text-white/50">Spotify, YouTube, and lyrics providers are integrated and active.</p>
          </article>
        </div>
      ) : searchLoading ? (
        <p className="text-sm text-white/50">Searching...</p>
      ) : (view === "home" ? featuredItems : explorerItems).length === 0 ? (
        <p className="text-sm text-white/50">No results yet. Try searching for a track.</p>
      ) : (
        <div className={`grid grid-cols-1 gap-6 ${view === "explorer" ? "lg:grid-cols-3" : "lg:grid-cols-2 2xl:grid-cols-3"}`}>
          {(view === "home" ? featuredItems : explorerItems).map((item) => (
            <button
              key={item.videoId}
              type="button"
              onClick={() => onSelectTrack(item)}
              className="group relative cursor-pointer text-left"
            >
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] transition-all duration-500 hover:scale-[1.02] hover:border-white/[0.15] hover:shadow-[0_8px_32px_rgba(139,92,246,0.2)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.thumbnail} alt={item.title} className="aspect-square w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-purple-300/45 bg-gradient-to-br from-purple-500/70 to-pink-500/60">
                    <Play size={22} fill="white" className="ml-1 text-white" />
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="mb-1 truncate text-lg font-semibold text-white transition-colors group-hover:text-purple-300">
                    {item.title}
                  </h3>
                  <p className="truncate text-sm text-white/50">{item.author}</p>
                  <p className="mt-2 text-xs text-white/35">{item.duration}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {view === "home" && searchResults.length > 6 && (
        <div className="mt-6 space-y-2">
          {searchResults.slice(6).map((item) => (
            <button
              key={item.videoId}
              type="button"
              onClick={() => onSelectTrack(item)}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-2 text-left transition hover:border-white/20"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.thumbnail} alt={item.title} className="h-10 w-14 rounded-md object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-zinc-100">{item.title}</p>
                <p className="truncate text-[11px] text-zinc-500">{item.author}</p>
              </div>
              <span className="text-[11px] text-zinc-500">{item.duration}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
