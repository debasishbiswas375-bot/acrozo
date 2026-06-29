import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { clearToken, getApiUrl} from "@/lib/api";
import Header from "@/components/header";
import {
  Upload,
  FileText,
  AlertCircle,
  Download,
  CheckCircle,
  FileSpreadsheet,
  Building2,
  Lock,
  Table,
  AlignLeft,
  Eye,
  EyeOff,
} from "lucide-react";

export default function PdfConverterPage() {
  const [, navigate] = useLocation();
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const [pdfType, setPdfType] = useState<"general" | "bank">("general");
  const [pdfPassword, setPdfPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Extraction mode — matches convert.py extract_mode values
  const [extractMode, setExtractMode] = useState<"tablesOnly" | "allText">("tablesOnly");

  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (downloadUrl) window.URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  const resetState = () => {
    setError("");
    setResult(null);
    setCurrentPage(0);
    setTotalPages(0);
    if (downloadUrl) {
      window.URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === "application/pdf") {
        setPdfFile(file);
        resetState();
      } else {
        setError("Please drop a PDF file only");
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === "application/pdf") {
        setPdfFile(file);
        resetState();
      } else {
        setError("Please select a PDF file only");
      }
    }
  };

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const handleConvert = async () => {
    if (!pdfFile) {
      setError("Please select or drop a PDF file");
      return;
    }

    setLoading(true);
    resetState();

    const formData = new FormData();
    formData.append("pdf_file", pdfFile);
    formData.append("pdf_type", pdfType);
    formData.append("pdf_password", pdfPassword);
    formData.append("extract_mode", extractMode);


    try {
      const response = await fetch(`${getApiUrl()}/api/users/convert-pdf-progress`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => "Connection failed");
        setError(errText || "Conversion failed");
        setLoading(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "progress") {
              setCurrentPage(data.current);
              setTotalPages(data.total);
            } else if (data.type === "complete") {
              const binaryStr = atob(data.file);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              const blob = new Blob([bytes], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              });
              const url = window.URL.createObjectURL(blob);
              setDownloadUrl(url);
              setResult({ success: true, filename: data.filename });
              setLoading(false);
            } else if (data.type === "error") {
              const msg = data.message || "Conversion failed";
              setError(
                msg === "PDF_PASSWORD_REQUIRED"
                  ? "This PDF is password-protected. Please enter the password and try again."
                  : msg
              );
              setLoading(false);
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch (err) {
      setError("Network error occurred while uploading. Please check your connection.");
      setLoading(false);
    }
  };

  const progressPercent =
    totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

  const progressText = loading
    ? totalPages > 0
      ? `Processing page ${currentPage} of ${totalPages}...`
      : "Uploading PDF..."
    : "";

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">PDF to Excel Converter</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Convert PDF tables to Excel with advanced processing
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-card-border rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">Convert PDF</h2>

            {/* ── DRAG & DROP ZONE ── */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/30 bg-muted/5 hover:border-muted-foreground/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="space-y-4">
                {isDragging ? (
                  <div className="flex flex-col items-center">
                    <Upload className="w-12 h-12 text-primary mb-4" />
                    <p className="text-lg font-medium text-foreground">Drop your PDF file here</p>
                    <p className="text-sm text-muted-foreground">Release to upload</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-foreground">Drag & Drop PDF file</p>
                    <p className="text-sm text-muted-foreground mb-4">or</p>
                    <button
                      onClick={handleBrowse}
                      disabled={loading}
                      className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 rounded-lg transition-colors font-medium"
                    >
                      Browse Files
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Selected File Badge */}
            {pdfFile && (
              <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">
                    {pdfFile.name}
                  </span>
                </div>
              </div>
            )}

            {/* ── STICKY PASSWORD FIELD — below drag & drop ── */}
            <div className="mt-4 p-4 rounded-lg border border-muted bg-muted/20 sticky top-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  PDF Password
                </label>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                  Optional
                </span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={pdfPassword}
                  onChange={(e) => setPdfPassword(e.target.value)}
                  placeholder="Leave empty if PDF has no password"
                  className="w-full pl-3 pr-10 py-2 text-sm border border-muted rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                If the PDF is password-protected, enter it above. Otherwise leave it empty.
              </p>
            </div>

            {/* ── PROCESSING OPTION (checkbox cards) ── */}
            <div className="mt-5">
              <label className="text-sm font-medium text-foreground mb-3 block">
                Processing Option:
              </label>
              <div className="grid grid-cols-2 gap-4">
                {/* All Text + Tables */}
                <label
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all select-none ${
                    extractMode === "allText"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-primary/50"
                  }`}
                  onClick={() => setExtractMode("allText")}
                >
                  <div className="relative mb-2">
                    <AlignLeft
                      className={`w-6 h-6 ${
                        extractMode === "allText" ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    {extractMode === "allText" && (
                      <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium text-center leading-tight ${
                      extractMode === "allText" ? "text-primary" : "text-foreground"
                    }`}
                  >
                    All Text
                  </span>
                  <span className="text-xs text-muted-foreground text-center mt-0.5">
                    Text + Tables
                  </span>
                </label>

                {/* Tables Only */}
                <label
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all select-none ${
                    extractMode === "tablesOnly"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-primary/50"
                  }`}
                  onClick={() => setExtractMode("tablesOnly")}
                >
                  <div className="relative mb-2">
                    <Table
                      className={`w-6 h-6 ${
                        extractMode === "tablesOnly" ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    {extractMode === "tablesOnly" && (
                      <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium text-center leading-tight ${
                      extractMode === "tablesOnly" ? "text-primary" : "text-foreground"
                    }`}
                  >
                    Tables Only
                  </span>
                  <span className="text-xs text-muted-foreground text-center mt-0.5">
                    Structured data
                  </span>
                </label>
              </div>
            </div>

            {/* ── PDF TYPE SELECTOR ── */}
            <div className="mt-5">
              <label className="text-sm font-medium text-foreground mb-3 block">
                Select PDF Type:
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all select-none ${
                    pdfType === "general"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-primary/50"
                  }`}
                  onClick={() => setPdfType("general")}
                >
                  <div className="relative mb-2">
                    <FileSpreadsheet
                      className={`w-6 h-6 ${
                        pdfType === "general" ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    {pdfType === "general" && (
                      <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      pdfType === "general" ? "text-primary" : "text-foreground"
                    }`}
                  >
                    General PDF
                  </span>
                </label>

                <label
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all select-none ${
                    pdfType === "bank"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-primary/50"
                  }`}
                  onClick={() => setPdfType("bank")}
                >
                  <div className="relative mb-2">
                    <Building2
                      className={`w-6 h-6 ${
                        pdfType === "bank" ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    {pdfType === "bank" && (
                      <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      pdfType === "bank" ? "text-primary" : "text-foreground"
                    }`}
                  >
                    Bank Statement
                  </span>
                </label>
              </div>
            </div>

            {/* ── REAL-TIME PROGRESS / DOWNLOAD / CONVERT BUTTON ── */}
            {loading ? (
              <div className="mt-6 space-y-2">
                <div className="flex justify-between items-center text-sm font-medium text-foreground">
                  <span>{progressText}</span>
                  <span className="text-primary font-semibold">
                    {totalPages > 0 ? `${progressPercent}%` : ""}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`bg-primary h-2.5 rounded-full transition-all duration-300 ease-out ${
                      totalPages === 0 ? "animate-pulse" : ""
                    }`}
                    style={{ width: totalPages > 0 ? `${progressPercent}%` : "40%" }}
                  />
                </div>
                {totalPages > 0 && (
                  <p className="text-xs text-muted-foreground text-right">
                    {currentPage} / {totalPages} pages
                  </p>
                )}
              </div>
            ) : !loading && downloadUrl ? (
              <a
                href={downloadUrl}
                download={result?.filename || "converted_data.xlsx"}
                className="w-full mt-6 px-4 py-3 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download Excel File
              </a>
            ) : (
              <button
                onClick={handleConvert}
                disabled={!pdfFile || loading}
                className="w-full px-4 py-3 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 rounded-lg transition-colors font-medium mt-4"
              >
                Convert to Excel
              </button>
            )}

            {/* Error panel */}
            {error && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              </div>
            )}

            {/* Success panel */}
            {result && downloadUrl && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h3 className="text-sm font-bold text-green-800">Conversion Successful!</h3>
                </div>
                <div className="text-sm text-green-700 space-y-1 ml-7">
                  <p>
                    <strong>Output File:</strong> {result.filename}
                  </p>
                  <p>
                    {extractMode === "allText"
                      ? "Your PDF text and tables have been merged into a single sheet. Click download to save."
                      : "Each table has been extracted into its own sheet. Click the download button to save."}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* How to Use */}
          <div className="bg-card border border-card-border rounded-xl shadow-sm p-6 h-fit">
            <h2 className="text-lg font-semibold text-foreground mb-6">How to Use</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-foreground mb-2">1. Drag & Drop or Browse</h3>
                <p className="text-sm text-muted-foreground">
                  Drag and drop your PDF onto the upload area, or click "Browse Files" to pick one from your device.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground mb-2">2. Enter Password (if needed)</h3>
                <p className="text-sm text-muted-foreground">
                  If your PDF is password-protected, type the password in the field below the upload zone. Leave it blank for unprotected files.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground mb-2">3. Choose Processing Option</h3>
                <p className="text-sm text-muted-foreground">
                  <strong>All Text</strong> — extracts all text content and tables into a single merged sheet. Best when you need both data and free-form text.{" "}
                  <strong>Tables Only</strong> — extracts each table into its own sheet using high-accuracy tabula extraction. Best for structured documents and bank statements.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground mb-2">4. Select PDF Type</h3>
                <p className="text-sm text-muted-foreground">
                  Choose <strong>Bank Statement</strong> for Indian bank statements — au Date, Narration, Payment and Receive columns. Choose <strong>General PDF</strong> for all other structured documents.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground mb-2">5. Watch Real-Time Progress</h3>
                <p className="text-sm text-muted-foreground">
                  A live progress bar shows page-by-page processing. When complete, a download button appears.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground mb-2">6. Download Excel</h3>
                <p className="text-sm text-muted-foreground">
                  Click "Download Excel File" to save the converted spreadsheet to your device.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
