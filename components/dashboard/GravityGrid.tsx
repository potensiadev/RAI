"use client";

import LevitatingCard from "./LevitatingCard";

const MOCK_CANDIDATES = [
    { id: 1, name: "Elena Fisher", role: "Senior UX Designer", matchScore: 98, riskLevel: "low" as const },
    { id: 2, name: "Marcus Reed", role: "Frontend Architect", matchScore: 94, riskLevel: "medium" as const },
    { id: 3, name: "Sarah Connor", role: "Security Analyst", matchScore: 89, riskLevel: "high" as const }, // Risk
    { id: 4, name: "John Doe", role: "Product Manager", matchScore: 91, riskLevel: "low" as const },
    { id: 5, name: "Jane Smith", role: "Backend Engineer", matchScore: 96, riskLevel: "low" as const },
    { id: 6, name: "Alex Chen", role: "Data Scientist", matchScore: 85, riskLevel: "medium" as const },
];

export default function GravityGrid() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
            {MOCK_CANDIDATES.map((candidate, index) => (
                <LevitatingCard
                    key={candidate.id}
                    name={candidate.name}
                    role={candidate.role}
                    matchScore={candidate.matchScore}
                    riskLevel={candidate.riskLevel}
                    delay={index * 0.1} // Staggered entrance
                />
            ))}
        </div>
    );
}
