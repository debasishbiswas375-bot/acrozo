import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle,
  FileText,
  X,
  ArrowLeft
} from "lucide-react";
import { getToken, getApiUrl } from "@/lib/api";
import { useLocation } from "wouter";

// ── Point this at your Hugging Face Space URL ─────────────────────────────────
// Set VITE_ADOBE_API_URL in your frontend .env (or Vercel/Render env vars):
//   VITE_ADOBE_API_URL=https://<hf-username>-zaiz-adobe-converter.hf.space
// Falls back to the main backend (VITE_API_URL or Vite proxy in dev).
const ADOBE_BACKEND =
  (import.meta.env.VITE_ADOBE_API_URL as string | undefined) || getApiUrl();

const token = () => getToken();
const authH = (): Record<string, string> =>
  token() ? { Authorization: `Bearer ${token()}` } : {};

// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 0, label: "Secure Document Upload",      description: "Uploading your PDF file to the secure server" },
  { id: 1, label: "acrozo checking the file",     description: "Initializing secure verification process" },
  { id: 2, label: "acrozo analysing",             description: "Injecting document to the Acrozo Excel converter" },
  { id: 3, label: "Table Extraction & OCR",      description: "Running Acrozo OCR engine to extract structured sheets" },
  { id: 4, label: "Compile Spreadsheet Download",description: "Retrieving and streaming converted XLSX back" },
];

export default function AdobePdfToExcelPage() {
  const [, navigate] = useLocation();
  const [pdfFile, setPdfFile]           = useState<File | null>(null);
  const [status, setStatus]             = useState<"idle" | "converting" | "success" | "error">("idle");
  const [activeStep, setActiveStep]     = useState(0);
  const [error, setError]               = useState("");
  const [downloadUrl, setDownloadUrl]   = useState<string | null>(null);
  const [convertedFilename, setConvertedFilename] = useState("");
  const [isDragging, setIsDragging]     = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // downloadUrl is now an HF bucket URL — no revocation needed

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === "converting") {
      interval = setInterval(() => {
        setActiveStep(prev => (prev < STEPS.length - 1 ? prev + 1 : prev));
      }, 5500);
    } else {
      setActiveStep(0);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type === "application/pdf") { setPdfFile(file); setError(""); setStatus("idle"); }
    else setError("Please drop a valid PDF file.");
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file?.type === "application/pdf") { setPdfFile(file); setError(""); setStatus("idle"); }
    else setError("Please select a valid PDF file.");
  };
  const removeFile = () => {
    setPdfFile(null); setError(""); setStatus("idle");
    if (downloadUrl) { window.URL.revokeObjectURL(downloadUrl); setDownloadUrl(null); }
  };

  const handleConvert = async () => {
    if (!pdfFile) return;
    setStatus("converting"); setActiveStep(0); setError("");
    if (downloadUrl) { window.URL.revokeObjectURL(downloadUrl); setDownloadUrl(null); }

    // Verify user is authenticated before hitting the backend
    if (!token()) {
      setStatus("error");
      setError("You must be logged in to use this tool. Please log in and try again.");
      return;
    }

    const formData = new FormData();
    formData.append("file", pdfFile);

    try {
      // 1. Initiate — hits HF Space (or fallback main backend)
      const initiateResponse = await fetch(`${ADOBE_BACKEND}/api/adobe-pdf-to-excel`, {
        method: "POST",
        body: formData,
        headers: authH(),
      });

      if (!initiateResponse.ok) {
        const err = await initiateResponse.json().catch(() => ({}));
        throw new Error(err.detail || "PDF to Excel conversion could not be started. Please try again.");
      }

      const { task_id } = await initiateResponse.json();
      if (!task_id) throw new Error("Invalid response from server: task_id missing.");

      // 2. Poll status
      let isDone = false;
      let attempts = 0;
      const maxAttempts = 60; // 2 s × 60 = 120 s max

      while (!isDone && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 2000));
        attempts++;

        const statusResponse = await fetch(`${ADOBE_BACKEND}/api/adobe/status/${task_id}`, {
          headers: authH(),
        });
        if (!statusResponse.ok) throw new Error("Failed to check conversion status.");

        const taskStatus = await statusResponse.json();

        if (taskStatus.status === "completed") {
          isDone = true;

          // 3. Get HF bucket URL directly — no download through Render
          const dlRes = await fetch(`${ADOBE_BACKEND}/api/adobe/download/${task_id}`, {
            headers: authH(),
          });
          if (!dlRes.ok) {
            const errDetail = await dlRes.json().catch(() => ({}));
            throw new Error(errDetail.detail || "Failed to get download URL.");
          }
          const dlData = await dlRes.json();
          const bucketUrl = dlData.url as string;
          const outName   = dlData.filename as string || `${pdfFile.name.replace(/\.pdf$/i, "")}.xlsx`;

          // Full URL for direct browser download from Render /api/bucket/files/
          const fullUrl = `${ADOBE_BACKEND}${bucketUrl}`;
          setDownloadUrl(fullUrl);
          setConvertedFilename(outName);
          setStatus("success");
          setActiveStep(STEPS.length - 1);

          // Auto-trigger download
          const a = document.createElement("a");
          a.href = fullUrl; a.download = outName;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);

        } else if (taskStatus.status === "failed") {
          throw new Error(taskStatus.error || "PDF to Excel conversion failed.");
        }
      }

      if (!isDone) throw new Error("Conversion timed out. Please try again.");

    } catch (err: any) {
      setStatus("error");
      setError(err.message || "An unexpected error occurred during conversion.");
    }
  };

  return (
    <div>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 pt-24">
        <button
          onClick={() => navigate("/tally-tools")}
          className="flex items-center gap-2 text-sm text-[#6b8cc4] hover:text-indigo-800 transition-colors mb-6 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to More Tools
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-red-100 rounded-2xl mb-4 text-red-600 shadow-md shadow-red-100">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Acrozo PDF To Excel</h1>
          <p className="text-gray-500 mt-2 max-w-lg mx-auto text-sm sm:text-base">
            Extract high-fidelity tables from your PDF files using Acrozo's industry-leading conversion engine.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-indigo-50/50 overflow-hidden">
          <div className=" px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping" />
              <p className="text-sm font-semibold text-white tracking-wider uppercase">Acrozo PDF Engine Active</p>
            </div>
            <span className="text-xs px-2.5 py-1 bg-white/20 text-white rounded-full font-medium backdrop-blur-sm">
              Highly Accurate
            </span>
          </div>

          <div className="p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {status === "idle" && (
                <motion.div key="idle" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                  <div
                    onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                      isDragging ? "border-blue-500 bg-blue-50/50 scale-[0.99]" : "border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/10"
                    }`}
                  >
                    <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 shadow-inner">
                        <Upload className="w-8 h-8" />
                      </div>
                      <p className="text-gray-700 font-bold text-lg">Drag & drop your PDF file here</p>
                      <p className="text-sm text-gray-400 mt-1">or click to browse local files</p>
                      <div className="mt-4 px-4 py-1.5 bg-gray-100 rounded-full text-xs text-gray-500 font-medium">Supports PDF files only</div>
                    </div>
                  </div>

                  {pdfFile && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center justify-between p-4 bg-red-50/30 border border-red-100 rounded-xl"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-red-100 text-red-600 rounded-lg"><FileText className="w-5 h-5" /></div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{pdfFile.name}</p>
                          <p className="text-xs text-gray-400">{(pdfFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <button onClick={removeFile} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}

                  {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700 font-medium">{error}</p>
                    </div>
                  )}

                  <button
                    disabled={!pdfFile} onClick={handleConvert}
                    className="w-full bg-[#6b8cc4] text-white py-4 px-6 rounded-xl font-bold hover:bg-[#5c7ab5] disabled:bg-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed shadow-lg shadow-blue-200/50 transition-all flex items-center justify-center gap-2"
                  >
                    <FileSpreadsheet className="w-5 h-5" />Convert to Excel
                  </button>
                </motion.div>
              )}

              {status === "converting" && (
                <motion.div key="converting" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8 py-4">
                  <div className="text-center space-y-3">
                    <Loader2 className="w-12 h-12 text-[#6b8cc4] animate-spin mx-auto" />
                    <h3 className="text-lg font-bold text-gray-800">Processing conversion...</h3>
                    <p className="text-sm text-gray-400 max-w-sm mx-auto">
                      Acrozo conversion engine is running. Please do not close this tab.
                    </p>
                  </div>
                  <div className="relative max-w-md mx-auto space-y-6">
                    <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-100" />
                    {STEPS.map((step, idx) => {
                      const isCompleted = idx < activeStep;
                      const isActive = idx === activeStep;
                      return (
                        <div key={step.id} className="flex gap-4 relative">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors duration-300 ${
                            isCompleted ? "bg-green-500 text-white" : isActive ? "bg-[#6b8cc4] text-white animate-pulse" : "bg-gray-100 text-gray-400"
                          }`}>
                            {isCompleted ? <CheckCircle className="w-5 h-5" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                          </div>
                          <div className="flex-1 pt-0.5">
                            <h4 className={`text-sm font-semibold transition-colors duration-300 ${isActive ? "text-[#6b8cc4]" : isCompleted ? "text-gray-700" : "text-gray-400"}`}>
                              {step.label}
                            </h4>
                            <p className="text-xs text-gray-400 mt-0.5">{step.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {status === "success" && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6 space-y-6">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-gray-900">Conversion Complete!</h2>
                    <p className="text-sm text-gray-400 max-w-sm mx-auto">Your Excel spreadsheet is ready. Automatic download should begin immediately.</p>
                  </div>
                  <div className="max-w-md mx-auto p-4 bg-green-50/50 border border-green-100 rounded-xl flex items-center gap-3">
                    <div className="p-2 bg-green-100 text-green-700 rounded-lg"><FileSpreadsheet className="w-5 h-5" /></div>
                    <div className="text-left min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-800 truncate">{convertedFilename}</p>
                      <p className="text-xs text-green-600 font-medium">Ready to download</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                    {downloadUrl && (
                      <a href={downloadUrl} download={convertedFilename}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-100 transition-colors"
                      >
                        <Download className="w-4 h-4" />Download Manually
                      </a>
                    )}
                    <button onClick={removeFile} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 px-4 rounded-xl transition-colors">
                      Convert Another File
                    </button>
                  </div>
                </motion.div>
              )}

              {status === "error" && (
                <motion.div key="error" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6 space-y-6">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-md">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-gray-900">Conversion Failed</h2>
                    <p className="text-sm text-red-600 font-medium max-w-md mx-auto">{error}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                    <button onClick={handleConvert} className="flex-1 bg-[#6b8cc4] hover:bg-[#5c7ab5] text-white font-bold py-3.5 px-4 rounded-xl transition-colors">Try Again</button>
                    <button onClick={removeFile} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 px-4 rounded-xl transition-colors">Choose Another File</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          {[
            { step: "01", title: "Upload Document",   text: "Select your source PDF containing one or multiple tables." },
            { step: "02", title: "Acrozo Engine Execution", text: "Our secure Acrozo conversion engine is processing your document." },
            { step: "03", title: "Get Converted File", text: "Download the formatted .xlsx table containing original layouts." },
          ].map((item, idx) => (
            <div key={idx} className="bg-white p-6 rounded-xl border border-indigo-50/50 shadow-sm relative overflow-hidden">
              <span className="absolute right-4 top-4 text-4xl font-extrabold text-indigo-50 select-none">{item.step}</span>
              <h3 className="text-base font-bold text-gray-800 mb-2 relative z-10">{item.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed relative z-10">{item.text}</p>
            </div>
          ))}
        </div>
      </main>    </div>
  );
}
