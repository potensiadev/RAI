"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Upload, Search, Filter, SlidersHorizontal, Plus } from "lucide-react";
import CandidateGrid from "@/components/dashboard/CandidateGrid";
import type { CandidateSearchResult, SearchFacets, SearchFilters } from "@/types";

// Mock Data for consistent display
const MOCK_CANDIDATES: CandidateSearchResult[] = [
  {
    id: "1",
    name: "이지훈",
    role: "Senior Frontend Engineer",
    company: "Tech Corp",
    skills: ["React", "TypeScript", "Next.js", "Node.js"],
    matchScore: 94,
    expYears: 5,
    aiConfidence: 0,
    confidenceLevel: "high",
    riskLevel: "low",
    requiresReview: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    matchedChunks: [],
  },
  {
    id: "2",
    name: "김서연",
    role: "Product Designer",
    company: "Creative Studio",
    skills: ["Figma", "UI/UX", "Prototyping"],
    matchScore: 88,
    expYears: 3,
    aiConfidence: 0,
    confidenceLevel: "high",
    riskLevel: "low",
    requiresReview: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    matchedChunks: [],
  },
  {
    id: "3",
    name: "박준호",
    role: "Backend Developer",
    company: "Data Systems",
    skills: ["Python", "Django", "AWS", "Docker"],
    matchScore: 76,
    expYears: 4,
    aiConfidence: 0,
    confidenceLevel: "high",
    riskLevel: "low",
    requiresReview: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    matchedChunks: [],
  },
  {
    id: "4",
    name: "최수민",
    role: "Marketing Manager",
    company: "Global Brands",
    skills: ["Digital Marketing", "SEO", "Analytics"],
    matchScore: 91,
    expYears: 6,
    aiConfidence: 0,
    confidenceLevel: "high",
    riskLevel: "low",
    requiresReview: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    matchedChunks: [],
  },
  {
    id: "5",
    name: "정우성",
    role: "DevOps Engineer",
    company: "Cloud Nine",
    skills: ["Kubernetes", "Terraform", "CI/CD"],
    matchScore: 82,
    expYears: 5,
    aiConfidence: 0,
    confidenceLevel: "high",
    riskLevel: "low",
    requiresReview: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    matchedChunks: [],
  }

];

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CandidateSearchResult[]>(MOCK_CANDIDATES);
  const [isSearching, setIsSearching] = useState(false);

  // Simple search filter for mock data
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query) {
      setSearchResults(MOCK_CANDIDATES);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const lowerQuery = query.toLowerCase();
    const filtered = MOCK_CANDIDATES.filter(c =>
      c.name.toLowerCase().includes(lowerQuery) ||
      c.role.toLowerCase().includes(lowerQuery) ||
      c.company.toLowerCase().includes(lowerQuery) ||
      c.skills.some(s => s.toLowerCase().includes(lowerQuery))
    );
    setSearchResults(filtered);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Candidates</h1>
          <p className="text-gray-500 mt-1">
            Manage your recruitment pipeline and candidate assets
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/upload"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                     bg-primary hover:bg-blue-600 text-white font-semibold
                     transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <Plus size={18} />
            Add Candidate
          </Link>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 p-1">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by name, skills, or position..."
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 
                         placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                         transition-all shadow-sm"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {/* Filter Button */}
        <button className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white border border-gray-200 
                          text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">
          <Filter size={18} />
          Filters
        </button>
      </div>

      {/* Content Area */}
      <div className="mt-6">
        <CandidateGrid
          searchResults={searchResults}
          isSearching={isSearching}
          searchQuery={searchQuery}
        />
      </div>
    </div>
  );
}
