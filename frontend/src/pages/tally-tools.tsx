import { useState } from "react";
import { useLocation } from "wouter";
import { clearToken } from "@/lib/api";
import { usePlanColors } from "@/contexts/plan-colors-context";
import { FileSpreadsheet, Search, Package, FileText, Sparkles, Calculator } from "lucide-react";

export default function ToolsPage() {
  const [location, navigate] = useLocation();
  const { getPlanColor } = usePlanColors();

  const handleLogout = () => {
    clearToken();
    navigate("/");
  };

  const categories = [
    {
      name: "Tally & ERP Integration",
      description: "Automated bookkeeping utilities, XML generation tools, and custom extensions for Tally Prime and other ERP tools.",
      tools: [
        {
          id: 'tally-generator',
          title: 'ERP XML Generator',
          description: 'Convert Excel transactions to ERP-ready XML for seamless import.',
          icon: FileSpreadsheet,
          price: 'Premium',
          action: () => { navigate('/tally-generator'); }
        },
        {
          id: 'tally-tdls',
          title: 'Tally TDLs',
          description: 'Discover and install Tally add-ons to enhance your accounting workflow.',
          icon: Package,
          price: 'Free',
          action: () => { navigate('/tally-tdls'); }
        }
      ]
    },
    {
      name: "Document Converters",
      description: "High-performance document extraction, PDF converters, and smart utility engines.",
      tools: [
        {
          id: 'acrozo-pdf-extractor',
          title: 'Acrozo PDF Extractor',
          description: 'Extract PDF to Excel or Word — supports tables, invoices, bank statements and reports.',
          icon: FileSpreadsheet,
          price: 'Premium',
          action: () => { navigate('/pdf-converter'); }
        },

        {
          id: 'adobe-pdf-excel',
          title: 'PDF to Excel (Acrozo Engine)',
          description: 'Convert PDF to Excel using the official Acrozo online converter engine.',
          icon: FileSpreadsheet,
          price: 'Premium',
          action: () => { navigate('/tools/pdf-to-excel'); }
        },
        {
          id: 'adobe-pdf-word',
          title: 'PDF to Word (Acrozo Engine)',
          description: 'Convert PDF to Word using the official Acrozo online converter engine.',
          icon: FileText,
          price: 'Premium',
          action: () => { navigate('/tools/pdf-to-word'); }
        }
      ]
    },
    {
      name: "Calculators & Utilities",
      description: "Side-by-side comparative tools and official rate computation presets.",
      tools: [
        {
          id: 'gst-calculator',
          title: 'GST Calculator',
          description: 'Calculate GST (CGST, SGST, IGST) values with standard rate presets or custom inputs.',
          icon: Calculator,
          price: 'Free',
          action: () => { navigate('/tools/gst-calculator'); }
        },
        {
          id: 'tds-interest-calculator',
          title: 'TDS Interest Calculator',
          description: 'Calculate interest on late deduction/payment (Sec 201(1A)) and late filing fees (Sec 234E).',
          icon: Calculator,
          price: 'Free',
          action: () => { navigate('/tools/tds-interest-calculator'); }
        },
        {
          id: 'income-tax-calculator',
          title: 'Income Tax Calculator',
          description: 'Compare Old vs New Tax Regime side-by-side with custom details for FY 2026-27.',
          icon: Calculator,
          price: 'Free',
          action: () => { navigate('/tools/income-tax-calculator'); }
        }
      ]
    }
  ];

  return (
    <div>
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">ERP & Acrozo Smart Tools</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Access high-performance document extraction engines, automated bookkeeping utilities, and smart tax calculators in one unified suite.
          </p>
        </div>

        <div className="space-y-12">
          {categories.map((category) => (
            <div key={category.name} className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-foreground border-l-4 border-[#6b8cc4] pl-3">{category.name}</h2>
                <p className="text-xs text-muted-foreground mt-1 pl-4">{category.description}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {category.tools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <div key={tool.id} className="bg-card border border-card-border rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow flex flex-col">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                          <Icon className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-foreground leading-snug">{tool.title}</h3>
                          <span className={`inline-block px-2 py-0.5 mt-1 text-[10px] font-medium rounded-full ${tool.price === 'Free'
                              ? 'bg-green-100 text-green-700'
                              : tool.price === 'Coming Soon'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                            {tool.price}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-6 flex-1 min-h-[3rem] line-clamp-3 leading-relaxed">{tool.description}</p>
                      <button
                        onClick={tool.action}
                        disabled={tool.price === 'Coming Soon'}
                        className={`w-full px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${tool.price === 'Coming Soon'
                            ? 'bg-muted text-muted-foreground cursor-not-allowed'
                            : 'bg-[#6b8cc4] text-white hover:bg-[#5c7ab5]'
                          }`}
                      >
                        {tool.price === 'Coming Soon' ? 'Coming Soon' : 'Use Tool'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
