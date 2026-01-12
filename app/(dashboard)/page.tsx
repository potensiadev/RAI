"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Upload, SlidersHorizontal } from "lucide-react";
import SpotlightSearch from "@/components/dashboard/SpotlightSearch";
import GravityGrid from "@/components/dashboard/GravityGrid";
import FacetPanel from "@/components/dashboard/FacetPanel";
import type { CandidateSearchResult, SearchFacets, SearchFilters } from "@/types";

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState<CandidateSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [facets, setFacets] = useState<SearchFacets | undefined>(undefined);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showFacets, setShowFacets] = useState(true);

  const handleSearchResults = useCallback((
    results: CandidateSearchResult[],
    searching: boolean,
    newFacets?: SearchFacets
  ) => {
    setSearchResults(results);
    setIsSearching(searching);
    if (newFacets) {
      setFacets(newFacets);
    }
  }, []);

  const handleFiltersChange = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Candidate Assets</h1>
          <p className="text-slate-400 mt-1">
            AI가 분석한 후보자 자산을 검색하고 관리하세요
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isSearchMode && (
            <button
              onClick={() => setShowFacets(!showFacets)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg
                       transition-colors ${
                         showFacets
                           ? "bg-primary/20 text-primary border border-primary/30"
                           : "bg-slate-800 text-slate-400 border border-slate-700 hover:text-white"
                       }`}
            >
              <SlidersHorizontal size={16} />
              <span className="text-sm">Facets</span>
            </button>
          )}
          <Link
            href="/upload"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                     bg-primary hover:bg-primary/90 text-white font-medium
                     transition-colors shadow-lg shadow-primary/25"
          >
            <Upload size={18} />
            이력서 업로드
          </Link>
        </div>
      </div>

      {/* Search */}
      <SpotlightSearch
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onSearchResults={handleSearchResults}
        onSearchModeChange={setIsSearchMode}
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {/* Content Area with Facets */}
      <div className="flex gap-6">
        {/* Facet Panel */}
        {isSearchMode && (
          <FacetPanel
            facets={facets}
            filters={filters}
            onFilterChange={handleFiltersChange}
            isVisible={showFacets}
          />
        )}

        {/* Grid */}
        <div className="flex-1">
          <GravityGrid
            isSearchMode={isSearchMode}
            searchResults={searchResults}
            isSearching={isSearching}
            searchQuery={searchQuery}
          />
        </div>
      </div>
    </div>
  );
}
