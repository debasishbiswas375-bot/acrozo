import { useState } from "react";
import { useLocation } from "wouter";
import { clearToken } from "@/lib/api";
import { usePlanColors } from "@/contexts/plan-colors-context";
import { Package, Download, Star, Shield, Zap, Settings, FileText, Database, Calculator, ArrowLeft } from "lucide-react";

export default function TallyTdlsPage() {
  const [location, navigate] = useLocation();
  const { getPlanColor } = usePlanColors();

  const handleLogout = () => {
    clearToken();
    navigate("/");
  };

  const tdls = [
    {
      id: 'voucher-changer',
      title: 'Tally Voucher Changer',
      description: 'Quick and easy voucher type conversion with batch processing capabilities',
      icon: FileText,
      category: 'Essential',
      rating: 4.6,
      downloads: '1.9k',
      price: 'Free',
      action: () => {}
    },
    {
      id: 'ledger-changer',
      title: 'Tally Ledger Changer',
      description: 'Efficient ledger modification and restructuring tools for account management',
      icon: Database,
      category: 'Essential',
      rating: 4.5,
      downloads: '1.6k',
      price: 'Free',
      action: () => {}
    },
    {
      id: 'advance-search',
      title: 'Tally Advance Search',
      description: 'Powerful search functionality across multiple ledgers with advanced filters',
      icon: Package,
      category: 'Essential',
      rating: 4.8,
      downloads: '2.1k',
      price: 'Free',
      action: () => {}
    }
  ];

  const otherTools: [] = [];

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Essential': return 'bg-blue-100 text-blue-700';
      case 'Professional': return 'bg-purple-100 text-purple-700';
      case 'Advanced': return 'bg-orange-100 text-orange-700';
      case 'Other': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriceColor = (price: string) => {
    return price === 'Free' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';
  };

  return (
    <div>
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">
        <button
          onClick={() => navigate("/tally-tools")}
          className="flex items-center gap-2 text-sm text-[#6b8cc4] hover:text-indigo-800 transition-colors mb-6 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to More Tools
        </button>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Tally TDLs</h1>
          <p className="text-muted-foreground mt-2">Discover and install Tally add-ons to enhance your accounting workflow</p>
        </div>

        <div className="space-y-8">
          {/* Main TDLs Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Essential Tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tdls.map((tdl) => {
                const Icon = tdl.icon;
                return (
                  <div key={tdl.id} className="bg-card border border-card-border rounded-xl shadow-sm p-6 hover:shadow-lg transition-all duration-200">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(tdl.category)}`}>
                          {tdl.category}
                        </span>
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getPriceColor(tdl.price)}`}>
                          {tdl.price}
                        </span>
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-semibold text-foreground mb-2">{tdl.title}</h3>
                    <p className="text-muted-foreground text-sm mb-4">{tdl.description}</p>
                    
                    <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        <span>{tdl.rating}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Download className="w-4 h-4" />
                        <span>{tdl.downloads}</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={tdl.action}
                      className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                        tdl.price === 'Free'
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : ' text-white hover: hover:'
                      }`}
                    >
                      {tdl.price === 'Free' ? 'Install Free' : 'Get Premium'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

                  </div>
      </main>    </div>
  );
}
