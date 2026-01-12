"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "rai_search_history";
const MAX_HISTORY_ITEMS = 20;

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  type: "semantic" | "keyword";
}

export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // localStorage에서 기록 불러오기
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SearchHistoryItem[];
        setHistory(parsed);
      }
    } catch (error) {
      console.error("Failed to load search history:", error);
    }
    setIsLoaded(true);
  }, []);

  // 기록 저장
  const saveToStorage = useCallback((items: SearchHistoryItem[]) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error("Failed to save search history:", error);
    }
  }, []);

  // 검색 기록 추가
  const addSearch = useCallback(
    (query: string, type: "semantic" | "keyword" = "keyword") => {
      if (!query.trim()) return;

      const newItem: SearchHistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        query: query.trim(),
        timestamp: Date.now(),
        type,
      };

      setHistory((prev) => {
        // 중복 제거 (같은 쿼리가 있으면 제거)
        const filtered = prev.filter(
          (item) => item.query.toLowerCase() !== query.trim().toLowerCase()
        );
        // 최신 항목을 맨 앞에 추가, 최대 20개 유지
        const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  // 개별 기록 삭제
  const removeSearch = useCallback(
    (id: string) => {
      setHistory((prev) => {
        const updated = prev.filter((item) => item.id !== id);
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  // 전체 기록 삭제
  const clearHistory = useCallback(() => {
    setHistory([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return {
    history,
    isLoaded,
    addSearch,
    removeSearch,
    clearHistory,
  };
}
