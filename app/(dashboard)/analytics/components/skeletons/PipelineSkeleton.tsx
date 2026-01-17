"use client";

export function PipelineSkeleton() {
    return (
        <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm animate-pulse">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <div className="w-32 h-6 bg-gray-100 rounded mb-2" />
                    <div className="w-48 h-4 bg-gray-100 rounded" />
                </div>
                <div className="w-24 h-8 bg-gray-50 rounded-lg" />
            </div>

            <div className="flex items-end gap-1">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                        <div className="w-12 h-8 bg-gray-100 rounded mb-2" />
                        <div
                            className="w-full bg-gray-100 rounded-t"
                            style={{ height: `${40 + (6 - i) * 12}px` }}
                        />
                        <div className="w-16 h-4 bg-gray-100 rounded mt-2" />
                    </div>
                ))}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                    <div className="w-40 h-4 bg-gray-100 rounded" />
                    <div className="w-16 h-5 bg-gray-100 rounded" />
                </div>
            </div>
        </div>
    );
}
