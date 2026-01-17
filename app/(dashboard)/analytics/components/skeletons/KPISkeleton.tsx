"use client";

export function KPISkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm animate-pulse">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-100" />
                        <div className="w-12 h-5 rounded-full bg-gray-100" />
                    </div>
                    <div className="w-20 h-8 bg-gray-100 rounded mb-2" />
                    <div className="w-24 h-4 bg-gray-100 rounded" />
                </div>
            ))}
        </div>
    );
}
