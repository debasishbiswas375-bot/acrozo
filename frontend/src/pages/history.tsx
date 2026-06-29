import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { clearToken, getToken, getApiUrl } from "@/lib/api";
import {
  Clock,
  FileText,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  FileDown,
  FileSearch,
  FileSpreadsheet,
  FileType,
  Landmark,
  History,
  FolderOpen,
} from "lucide-react";

const PDF_TOOL_TYPES = [
  "Acrozo PDF Extractor",
  "Acrozo PDF to Excel",
  "Acrozo PDF to Word",
  "Bank Statements to ERP Tools",
  "Tally XML Generator",
  "Bank→ERP Smart Parse",
];

// Lucide icon components per tool type
const TOOL_ICON_MAP: Record<string, React.ElementType> = {
  "Acrozo PDF Extractor":  FileSearch,
  "Acrozo PDF to Excel":   FileSpreadsheet,
  "Acrozo PDF to Word":    FileType,
  "Bank Statements to ERP Tools": Landmark,
  "Tally XML Generator":   FileSpreadsheet,
  "Bank→ERP Smart Parse": Landmark,
};

const TOOL_COLORS: Record<string, { badge: string; icon: string }> = {
  "Acrozo PDF Extractor":    { badge: "bg-blue-50 text-blue-700 border-blue-200",    icon: "text-blue-600" },
  "Acrozo PDF to Excel":     { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "text-emerald-600" },
  "Acrozo PDF to Word":      { badge: "bg-violet-50 text-violet-700 border-violet-200",  icon: "text-violet-600" },
  "Bank Statements to ERP Tools": { badge: "bg-amber-50 text-amber-700 border-amber-200",   icon: "text-amber-600" },
  "Tally XML Generator":   { badge: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: "text-indigo-600" },
  "Bank→ERP Smart Parse": { badge: "bg-cyan-50 text-cyan-700 border-cyan-200",     icon: "text-cyan-600" },
};

const ALL_FILTERS = ["All", ...PDF_TOOL_TYPES];

function ToolIcon({ type, className = "" }: { type: string; className?: string }) {
  const Icon = TOOL_ICON_MAP[type] ?? FileText;
  return <Icon className={className} />;
}

const BACKEND = getApiUrl();

export default function HistoryPage() {
  const [, navigate] = useLocation();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("All");

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const response = await fetch("/api/conversion-history", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Map backend history names to frontend display names
        const mappedData = data.map((item: any) => {
          let type = item.type || "";
          if (type === "ZaiZ PDF Extractor") {
            type = "Acrozo PDF Extractor";
          } else if (type === "ZaiZ PDF to Excel" || type === "ZaiZ PDF to Xlsx") {
            type = "Acrozo PDF to Excel";
          } else if (type === "ZaiZ PDF to Word" || type === "ZaiZ PDF to Docx") {
            type = "Acrozo PDF to Word";
          } else if (
            type === "Bank PDF to Tally XML" ||
            type === "Bank XLSX to Tally XML" ||
            (type.startsWith("Bank ") && type.endsWith(" to Tally XML"))
          ) {
            type = "Bank Statements to ERP Tools";
          }
          return { ...item, type };
        });
        // Only show PDF tool entries
        const pdfOnly = mappedData.filter((item: any) => PDF_TOOL_TYPES.includes(item.type));
        setHistory(pdfOnly);
      } else {
        setError("Failed to load history. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  const filtered = activeFilter === "All"
    ? history
    : history.filter(item => item.type === activeFilter);

  const statusIcon = (status: string) => {
    if (status === "completed" || status === "downloaded")
      return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
    if (status === "failed")
      return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    return <Clock className="w-3.5 h-3.5 text-amber-500" />;
  };

  const statusLabel: Record<string, string> = {
    completed: "Completed",
    downloaded: "Downloaded",
    failed: "Failed",
    processing: "Processing",
  };

  const statusClass: Record<string, string> = {
    completed:  "bg-emerald-50 text-emerald-700",
    downloaded: "bg-emerald-50 text-emerald-700",
    failed:     "bg-red-50 text-red-700",
    processing: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <History className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">PDF Tools History</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Records of all your Acrozo PDF conversions and extractions
              </p>
            </div>
          </div>
          <button
            onClick={fetchHistory}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {ALL_FILTERS.map(filter => {
            const colors = TOOL_COLORS[filter];
            const isActive = activeFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {filter !== "All" && (
                  <ToolIcon
                    type={filter}
                    className={`w-3.5 h-3.5 ${isActive ? "text-primary-foreground" : (colors?.icon ?? "text-muted-foreground")}`}
                  />
                )}
                {filter === "All" ? "All PDF Tools" : filter}
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                  isActive ? "bg-white/20" : "bg-muted"
                }`}>
                  {filter === "All" ? history.length : history.filter(h => h.type === filter).length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading your history…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={fetchHistory}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
            >
              Try Again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              {activeFilter !== "All" ? (
                <ToolIcon type={activeFilter} className={`w-8 h-8 ${TOOL_COLORS[activeFilter]?.icon ?? "text-muted-foreground"}`} />
              ) : (
                <FolderOpen className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="text-center">
              <p className="text-base font-medium text-foreground">No records yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                {activeFilter === "All"
                  ? "Use any Acrozo PDF tool to start building your history."
                  : `No records for "${activeFilter}" yet.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tool</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Input File</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Output</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Size</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Download</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const colors = TOOL_COLORS[item.type];
                    return (
                      <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        {/* Tool */}
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors?.badge ?? "bg-muted text-muted-foreground border-border"}`}>
                            <ToolIcon type={item.type} className={`w-3.5 h-3.5 ${colors?.icon ?? "text-muted-foreground"}`} />
                            {item.type}
                          </span>
                        </td>
                        {/* Input file */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 max-w-[200px]">
                            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm text-foreground truncate" title={item.fileName}>
                              {item.fileName}
                            </span>
                          </div>
                        </td>
                        {/* Output */}
                        <td className="px-5 py-4">
                          {item.outputFileName ? (
                            <div className="flex items-center gap-2 max-w-[180px]">
                              <FileDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm text-muted-foreground truncate" title={item.outputFileName}>
                                {item.outputFileName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground/50">—</span>
                          )}
                        </td>
                        {/* Date */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{item.date}</span>
                          </div>
                        </td>
                        {/* Size */}
                        <td className="px-5 py-4">
                          <span className="text-sm text-muted-foreground">{item.size ?? "—"}</span>
                        </td>
                        {/* Status */}
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusClass[item.status] ?? "bg-muted text-muted-foreground"}`}>
                            {statusIcon(item.status)}
                            {statusLabel[item.status] ?? item.status}
                          </span>
                        </td>
                        {/* Download */}
                        <td className="px-5 py-4">
                          {(item.status === "completed" || item.status === "downloaded") && item.outputFileUrl ? (
                            <a
                              href={item.outputFileUrl.startsWith("http") 
                            ? item.outputFileUrl 
                            : `${BACKEND}${item.outputFileUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                              title="Download output file"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-md hover:bg-primary/10 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground/40 flex items-center gap-1">
                              <Download className="w-3.5 h-3.5" />
                              N/A
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer count */}
            <div className="px-5 py-3 border-t border-border bg-muted/20">
              <p className="text-xs text-muted-foreground">
                Showing {filtered.length} record{filtered.length !== 1 ? "s" : ""}
                {activeFilter !== "All" ? ` for "${activeFilter}"` : " across all PDF tools"}
                {" · "}Last 50 entries
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
