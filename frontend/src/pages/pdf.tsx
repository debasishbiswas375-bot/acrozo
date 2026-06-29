import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { getToken } from "@/lib/api";
import {
  Upload,
  FileText,
  AlertCircle,
  Download,
  CheckCircle,
  Loader2,
  FileSpreadsheet,
  Zap,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import JSZip from "jszip";
import * as XLSX from "xlsx";

// All MinerU calls go through the Acrozo backend so the API key stays server-side
// and Alibaba OSS / CDN CORS issues are handled transparently.

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: "Bearer " + token } : {};
}

const BACKEND =
  (import.meta.env.VITE_API_URL || "").replace(/\/$/, "") ||
  (import.meta.env.PROD ? "" : "http://localhost:8000");

type ConvertStep =
  | "idle"
  | "requesting-url"
  | "uploading"
  | "processing"
  | "downloading"
  | "done"
  | "error";

interface ProgressState {
  step: ConvertStep;
  uploadPct: number;
  extractedPages: number;
  totalPages: number;
  error: string;
}

async function requestUploadUrl(fileName: string): Promise<{ batchId: string; uploadUrl: string }> {
  const res = await fetch(BACKEND + "/api/mineru/request-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ file_name: fileName }),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("You must be logged in to use the PDF converter. Please sign in and try again.");
  }
  if (!res.ok) throw new Error("Upload request failed: " + await res.text().catch(() => res.statusText));
  const json = await res.json();
  return { batchId: json.batch_id, uploadUrl: json.upload_url };
}

async function uploadFileThroughBackend(
  ossUrl: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    const xhr = new XMLHttpRequest();
    const url = BACKEND + "/api/mineru/upload-to-oss?oss_url=" + encodeURIComponent(ossUrl);
    xhr.open("PUT", url, true);
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("Backend OSS upload failed — HTTP " + xhr.status + ": " + xhr.responseText.slice(0, 200)));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.send(formData);
  });
}

async function pollBatchStatus(
  batchId: string,
  onProgress: (extracted: number, total: number) => void,
  signal: AbortSignal
): Promise<string> {
  while (true) {
    if (signal.aborted) throw new Error("Cancelled");
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(BACKEND + "/api/mineru/status/" + batchId, {
      headers: { ...authHeaders() },
      signal,
    });
    if (!res.ok) throw new Error("Poll failed: " + res.status);
    const json = await res.json();
    if (json.state === "done") return json.zip_url as string;
    if (json.state === "failed") throw new Error(json.err_msg || "Acrozo processing failed");
    onProgress(json.extracted_pages ?? 0, json.total_pages ?? 0);
  }
}

async function downloadZipViaBackend(zipUrl: string): Promise<ArrayBuffer> {
  const res = await fetch(
    BACKEND + "/api/mineru/download-zip?zip_url=" + encodeURIComponent(zipUrl),
    { headers: { ...authHeaders() } }
  );
  if (!res.ok) throw new Error("Failed to download result zip: " + res.status);
  return res.arrayBuffer();
}

function parseHtmlTable(html: string): string[][] {
  const rowMatches = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) ?? [];
  return rowMatches.map((row) => {
    const cellMatches = [...row.matchAll(/<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/gi)];
    const cells: string[] = [];
    for (const [, attrs, inner] of cellMatches) {
      const spanMatch = attrs.match(/colspan=["']?(\d+)["']?/i);
      const span = spanMatch ? parseInt(spanMatch[1], 10) : 1;
      const text = inner.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
      cells.push(text);
      for (let i = 1; i < span; i++) cells.push("");
    }
    return cells;
  });
}

function contentToExcelBlob(content: string, baseName: string): { blob: Blob; filename: string } {
  const wb = XLSX.utils.book_new();
  const textOnly = content.replace(/<table[\s\S]*?<\/table>/gi, "").trim();
  if (textOnly) {
    const infoRows = textOnly
      .split("\n")
      .map((l) => l.replace(/^#+\s*/, "").replace(/<[^>]+>/g, "").trim())
      .filter(Boolean)
      .map((l) => [l]);
    if (infoRows.length > 0) {
      const wsInfo = XLSX.utils.aoa_to_sheet(infoRows);
      wsInfo["!cols"] = [{ wch: 80 }];
      XLSX.utils.book_append_sheet(wb, wsInfo, "Info");
    }
  }
  const tableMatches = [...content.matchAll(/<table[\s\S]*?>([\s\S]*?)<\/table>/gi)];
  if (tableMatches.length > 0) {
    const grids = tableMatches.map((m) => parseHtmlTable(m[0])).filter((g) => g.length > 0);
    const maxCols = Math.max(...grids.flatMap((g) => g.map((r) => r.length)), 1);
    const normalise = (row: string[]) => { const r = [...row]; while (r.length < maxCols) r.push(""); return r; };
    const merged: string[][] = [];
    grids.forEach((grid, gi) => {
      grid.forEach((row, ri) => {
        if (gi > 0 && ri === 0) return;
        merged.push(normalise(row));
      });
    });
    const ws = XLSX.utils.aoa_to_sheet(merged);
    const colWidths = Array.from({ length: maxCols }, (_, ci) =>
      Math.min(50, Math.max(10, ...merged.map((r) => (r[ci] ?? "").length + 2)))
    );
    ws["!cols"] = colWidths.map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
  }
  if (wb.SheetNames.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([[content]]);
    XLSX.utils.book_append_sheet(wb, ws, "Content");
  }
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  return { blob, filename: baseName.replace(/\.pdf$/i, "") + ".xlsx" };
}

async function extractXlsxFromZip(zipBuf: ArrayBuffer, originalName: string): Promise<{ blob: Blob; filename: string }> {
  const zip = await JSZip.loadAsync(zipBuf);
  console.log("📦 Zip contents:", Object.keys(zip.files));

  // Preference: .html > .md > .xlsx > raw zip
  const htmlEntry = Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith(".html"));
  if (htmlEntry) {
    const html = await htmlEntry.async("string");
    console.log("🌐 HTML file found:", htmlEntry.name);
    return contentToExcelBlob(html, originalName);
  }
  const mdEntry = Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith(".md"));
  if (mdEntry) {
    const md = await mdEntry.async("string");
    console.log("📄 MD file found:", mdEntry.name);
    return contentToExcelBlob(md, originalName);
  }
  const xlsxEntry = Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith(".xlsx"));
  if (xlsxEntry) {
    const blob = new Blob([await xlsxEntry.async("arraybuffer")], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    return { blob, filename: xlsxEntry.name.split("/").pop() || "converted.xlsx" };
  }
  return { blob: new Blob([zipBuf], { type: "application/zip" }), filename: "acrozo-result.zip" };
}

export default function PdfConverterMineruPage() {
  const [, navigate] = useLocation();
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({
    step: "idle", uploadPct: 0, extractedPages: 0, totalPages: 0, error: "",
  });
  const [downloadInfo, setDownloadInfo] = useState<{ url: string; filename: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const resetState = () => {
    if (downloadInfo) URL.revokeObjectURL(downloadInfo.url);
    setDownloadInfo(null);
    setProgress({ step: "idle", uploadPct: 0, extractedPages: 0, totalPages: 0, error: "" });
  };

  const handleFile = (file: File) => {
    if (file.type !== "application/pdf") {
      setProgress((p) => ({ ...p, step: "error", error: "Please select a PDF file only." }));
      return;
    }
    resetState();
    setPdfFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleConvert = useCallback(async () => {
    if (!pdfFile) return;
    abortRef.current = new AbortController();
    resetState();
    try {
      setProgress((p) => ({ ...p, step: "requesting-url" }));
      const { batchId, uploadUrl } = await requestUploadUrl(pdfFile.name);

      setProgress((p) => ({ ...p, step: "uploading", uploadPct: 0 }));
      await uploadFileThroughBackend(uploadUrl, pdfFile, (pct) =>
        setProgress((p) => ({ ...p, uploadPct: pct }))
      );

      setProgress((p) => ({ ...p, step: "processing", uploadPct: 100 }));
      const zipUrl = await pollBatchStatus(
        batchId,
        (extracted, total) => setProgress((p) => ({ ...p, extractedPages: extracted, totalPages: total })),
        abortRef.current.signal
      );

      setProgress((p) => ({ ...p, step: "downloading" }));
      const zipBuf = await downloadZipViaBackend(zipUrl);
      const { blob, filename } = await extractXlsxFromZip(zipBuf, pdfFile.name);
      const objectUrl = URL.createObjectURL(blob);
      setDownloadInfo({ url: objectUrl, filename });

      const a = document.createElement("a");
      a.href = objectUrl; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);

      setProgress((p) => ({ ...p, step: "done" }));
    } catch (err: any) {
      if (err.name === "AbortError" || err.message === "Cancelled") return;
      setProgress((p) => ({ ...p, step: "error", error: err.message || "Unknown error occurred." }));
    }
  }, [pdfFile]);

  const handleCancel = () => { abortRef.current?.abort(); resetState(); };

  const isRunning = ["requesting-url", "uploading", "processing", "downloading"].includes(progress.step);
  const isDone = progress.step === "done";
  const isError = progress.step === "error";

  const stepLabel: Record<ConvertStep, string> = {
    idle: "",
    "requesting-url": "Requesting upload slot...",
    uploading: "Uploading to Acrozo... " + progress.uploadPct + "%",
    processing: progress.totalPages > 0
      ? "Processing page " + progress.extractedPages + " of " + progress.totalPages + "..."
      : "Processing PDF...",
    downloading: "Downloading result...",
    done: "Conversion complete!",
    error: "",
  };

  const overallPct = (() => {
    switch (progress.step) {
      case "requesting-url": return 5;
      case "uploading": return 5 + Math.round(progress.uploadPct * 0.3);
      case "processing": return progress.totalPages > 0
        ? 35 + Math.round((progress.extractedPages / progress.totalPages) * 55) : 40;
      case "downloading": return 92;
      case "done": return 100;
      default: return 0;
    }
  })();

  return (
    <div className="min-h-screen">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">
        <button
          onClick={() => navigate("/tally-tools")}
          className="flex items-center gap-2 text-sm text-[#6b8cc4] hover:text-indigo-800 transition-colors mb-6 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to More Tools
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-foreground">PDF Extractor</h1>
            <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded-full flex items-center gap-1">
              <Zap className="w-3 h-3" /> Powered by Acrozo
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Your file is converted using Acrozo AI — fast and accurate.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-card-border rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">Convert PDF</h2>
            <div
              className={"border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer " +
                (isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 bg-muted/5 hover:border-muted-foreground/50")}
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
              <div className="flex flex-col items-center gap-3">
                <Upload className={"w-12 h-12 " + (isDragging ? "text-primary" : "text-muted-foreground")} />
                <div>
                  <p className="text-base font-medium text-foreground">{isDragging ? "Drop your PDF here" : "Drag & Drop PDF file"}</p>
                  <p className="text-sm text-muted-foreground mt-1">{isDragging ? "Release to select" : "or click to browse"}</p>
                </div>
              </div>
            </div>

            {pdfFile && (
              <div className="mt-4 p-3 bg-muted/30 rounded-lg flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground truncate">{pdfFile.name}</span>
                <span className="text-xs text-muted-foreground ml-auto shrink-0">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            )}

            {isRunning && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">{stepLabel[progress.step]}</span>
                  <span className="text-sm text-muted-foreground">{overallPct}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: overallPct + "%" }} />
                </div>
              </div>
            )}

            {isDone && downloadInfo && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-800">Conversion complete!</p>
                  <p className="text-xs text-green-600 truncate">{downloadInfo.filename}</p>
                </div>
                <a href={downloadInfo.url} download={downloadInfo.filename}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white hover:bg-green-700 rounded-lg text-sm font-medium transition-colors shrink-0">
                  <Download className="w-4 h-4" /> Download
                </a>
              </div>
            )}

            {isError && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{progress.error}</p>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button onClick={handleConvert} disabled={isRunning || !pdfFile}
                className="flex-1 px-4 py-3 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 rounded-lg transition-colors font-medium flex items-center justify-center gap-2">
                {isRunning ? (<><Loader2 className="w-4 h-4 animate-spin" />{progress.step === "uploading" ? "Uploading..." : "Processing..."}</>) : (<><FileSpreadsheet className="w-4 h-4" />Convert to Excel</>)}
              </button>
              {isRunning && (
                <button onClick={handleCancel} className="px-4 py-3 border border-border text-foreground hover:bg-muted rounded-lg transition-colors font-medium text-sm">Cancel</button>
              )}
              {(isDone || isError) && (
                <button onClick={() => { resetState(); setPdfFile(null); }}
                  className="px-4 py-3 border border-border text-foreground hover:bg-muted rounded-lg transition-colors font-medium text-sm flex items-center gap-1">
                  <RefreshCw className="w-4 h-4" />Reset
                </button>
              )}
            </div>
          </div>

          <div className="bg-card border border-card-border rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">How It Works</h2>
            <div className="space-y-5">
              <Step n={1} title="Select or Drop your PDF">Drag and drop a PDF onto the upload area, or click to browse. Files up to 200 MB and 600 pages are supported.</Step>
              <Step n={2} title="Secure Backend Upload">Your PDF is uploaded securely through Acrozo's backend — the processing is private, secure, and handled transparently without third-party leaks.</Step>
              <Step n={3} title="AI-powered extraction">Acrozo extracts tables, text, and structure using optimized HTML output format for maximum fidelity — even scanned or complex layouts.</Step>
              <Step n={4} title="Extracted Excel">Once processing is complete, the Excel file downloads automatically. Click <strong>Download</strong> again if needed.</Step>
            </div>
            <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-xs font-semibold text-blue-700 mb-1">Acrozo Limits</p>
              <ul className="text-xs text-blue-600 space-y-0.5">
                <li>• Max file size: 200 MB</li>
                <li>• Max pages: 600 per file</li>
                <li>• Daily quota: 2,000 pages (high priority)</li>
                <li>• Token expires: 2026-08-10</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</div>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{children}</p>
      </div>
    </div>
  );
}
