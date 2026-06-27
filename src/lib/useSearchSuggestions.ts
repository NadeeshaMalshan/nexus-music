"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SearchSuggestionRichItem = {
  youtubeId: string;
  title: string;
  artists: string[];
  thumbnailUrl: string;
  type: "song" | "video" | "artist" | "album" | "playlist" | "user";
  badge?: string;
  user?: any;
};

export type SearchSuggestionsPayload = {
  textSuggestions: string[];
  richResults: SearchSuggestionRichItem[];
};

export function useSearchSuggestions(query: string) {
  const [textSuggestions, setTextSuggestions] = useState<string[]>([]);
  const [richResults, setRichResults] = useState<SearchSuggestionRichItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const fetchIdRef = useRef(0);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) {
      setTextSuggestions([]);
      setRichResults([]);
      setLoading(false);
      return;
    }

    const fetchId = ++fetchIdRef.current;
    setLoading(true);

    try {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}`, {
        cache: "no-store",
      });

      if (fetchId !== fetchIdRef.current) return;
      if (!res.ok) {
        setTextSuggestions([]);
        setRichResults([]);
        return;
      }

      const payload = (await res.json()) as SearchSuggestionsPayload;
      if (fetchId !== fetchIdRef.current) return;

      setTextSuggestions(Array.isArray(payload.textSuggestions) ? payload.textSuggestions : []);
      setRichResults(Array.isArray(payload.richResults) ? payload.richResults : []);
    } catch (error) {
      if (fetchId !== fetchIdRef.current) return;
      setTextSuggestions([]);
      setRichResults([]);
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!query.trim() || !open) {
      setTextSuggestions([]);
      setRichResults([]);
      setLoading(false);
      return;
    }

    // Clear old suggestions immediately when query changes to prevent stale data
    setTextSuggestions([]);
    setRichResults([]);

    const timeout = window.setTimeout(() => {
      void fetchSuggestions(query);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [fetchSuggestions, open, query]);

  return {
    textSuggestions,
    richResults,
    loading,
    open,
    setOpen,
  };
}
