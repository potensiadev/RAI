import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function MarketingFooter() {
    return (
        <footer className="border-t border-gray-100 bg-white py-12 px-6">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-gray-400" />
                    </div>
                    <span className="text-sm text-gray-500">
                        © 2025 서치드. All rights reserved.
                    </span>
                </div>
                <div className="flex items-center gap-8 text-sm text-gray-500">
                    <Link href="/terms" className="hover:text-gray-900 transition-colors">
                        이용약관
                    </Link>
                    <Link href="/privacy" className="hover:text-gray-900 transition-colors">
                        개인정보처리방침
                    </Link>
                    <Link href="/support" className="hover:text-gray-900 transition-colors">
                        문의하기
                    </Link>
                </div>
            </div>
        </footer>
    );
}
