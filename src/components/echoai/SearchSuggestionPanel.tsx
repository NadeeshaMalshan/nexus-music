import { Search, Play } from "lucide-react";
import { MusicArtwork } from "./MusicArtwork";

export type SearchSuggestionRichItem = {
  youtubeId: string;
  title: string;
  artists: string[];
  thumbnailUrl: string;
  type: "song" | "video" | "artist";
  badge?: string;
  views?: string;
};

const formatCount = (count: string | number | undefined) => {
  if (!count) return "0";
  const num = typeof count === "string" ? parseInt(count, 10) : count;
  if (!num) return "0";
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + "B";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
};

interface SearchSuggestionPanelProps {
  query: string;
  textSuggestions: string[];
  richResults: SearchSuggestionRichItem[];
  loading: boolean;
  onTextSuggestionClick: (suggestion: string) => void;
  onRichResultClick: (item: SearchSuggestionRichItem) => void;
}

export function SearchSuggestionPanel({
  query,
  textSuggestions,
  richResults,
  loading,
  onTextSuggestionClick,
  onRichResultClick,
}: SearchSuggestionPanelProps) {
  return (
    <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-[#121212] shadow-2xl rounded-xl border border-white/10 max-h-[450px] overflow-hidden overflow-y-auto">
      {loading && (
        <div className="flex items-center justify-center px-4 py-4 text-white/50">Loading suggestions…</div>
      )}

      {textSuggestions.length > 0 && (
        <div className="space-y-1 px-2 py-2">
          {textSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onTextSuggestionClick(suggestion)}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-white/80 hover:bg-white/5 transition-colors"
            >
              <Search className="w-4 h-4 text-white/40" />
              <span className="truncate text-[15px] font-bold">{suggestion}</span>
            </button>
          ))}
        </div>
      )}

      {richResults.length > 0 && (
        <div className="divide-y divide-white/5 bg-[#111111]">
          {richResults.map((item) => (
            <button
              key={`${item.youtubeId}-${item.type}`}
              type="button"
              onClick={() => onRichResultClick(item)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-white hover:bg-white/5 transition-colors"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-white/5">
                <MusicArtwork
                  src={item.thumbnailUrl}
                  alt={item.title}
                  iconSize={18}
                  variant={item.type === "artist" ? "artist" : "track"}
                  rounded={item.type === "artist" ? "full" : "md"}
                  className="h-full w-full"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Play size={16} className="text-white" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-white">{item.title}</span>
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.2em] text-white/50">{item.badge}</span>
                </div>
                <p className="mt-1 truncate text-[13px] text-white/40">
                  {item.type === "artist"
                    ? item.artists.join(", ")
                    : item.artists.length > 0
                      ? item.artists.join(", ")
                      : "Unknown Artist"}
                  {item.type !== "artist" && item.views ? ` • ${formatCount(item.views)} plays` : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && textSuggestions.length === 0 && richResults.length === 0 && (
        <div className="px-4 py-4 text-white/40">No suggestions found for “{query}”.</div>
      )}
    </div>
  );
}
