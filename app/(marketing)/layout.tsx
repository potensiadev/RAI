import MarketingNavbar from "@/components/layout/MarketingNavbar";
import MarketingFooter from "@/components/layout/MarketingFooter";

export default function MarketingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-primary/10 selection:text-primary">
            <MarketingNavbar />
            {children}
            <MarketingFooter />
        </div>
    );
}
