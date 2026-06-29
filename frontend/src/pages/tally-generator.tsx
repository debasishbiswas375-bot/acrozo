import React, { useState } from 'react';
import { useLocation } from 'wouter';
import {
  Upload, FileSpreadsheet, Download, Loader2, AlertCircle,
  CheckCircle, ArrowLeft
} from 'lucide-react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { getToken, getApiUrl } from '@/lib/api';

const BACKEND = getApiUrl();
const token = () => getToken();
const authH = (): Record<string, string> => token() ? { Authorization: `Bearer ${token()}` } : {};

// ── Tab 1: Excel → XML ────────────────────────────────────────────────────────
function ExcelTab() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; downloadUrl?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && (f.name.endsWith('.xls') || f.name.endsWith('.xlsx'))) {
      setFile(f); setError(null); setResult(null);
    } else { setError('Please select an Excel file (.xls or .xlsx)'); setFile(null); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && (f.name.endsWith('.xls') || f.name.endsWith('.xlsx'))) { setFile(f); setError(null); setResult(null); }
    else setError('Please drop an Excel file (.xls or .xlsx)');
  };

  const handleGenerate = async () => {
    if (!file) return;
    setIsProcessing(true); setError(null); setResult(null);
    try {
      const formData = new FormData();
      formData.append('excel_file', file);
      const response = await fetch(`${BACKEND}/api/tally/generate-xml`, { method: 'POST', body: formData, headers: authH() });
      if (!response.ok) throw new Error('Failed to generate Tally XML');
      const blob = await response.blob();
      setResult({ success: true, message: 'Tally XML generated successfully!', downloadUrl: URL.createObjectURL(blob) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally { setIsProcessing(false); }
  };

  const SAMPLE_URL = 'https://hcfgpbknvppimqvswgjq.supabase.co/storage/v1/object/public/samples/ZAIZ_V1.0.xlsm';

  const reset = () => {
    setFile(null); setResult(null); setError(null);
    const input = document.getElementById('excel-file-upload') as HTMLInputElement;
    if (input) input.value = '';
  };

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">How to use:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-xs">
              <li>Download the Excel Creator Template below</li>
              <li>Export ledger details from Tally as HTML</li>
              <li>Import HTML data into the Excel template</li>
              <li>Fill in your transaction data</li>
              <li>Upload the completed Excel file and click Generate</li>
            </ol>
          </div>
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragging ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-400'}`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('excel-file-upload')?.click()}
      >
        <input type="file" accept=".xls,.xlsx" onChange={handleFileChange} className="hidden" id="excel-file-upload" />
        <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-green-600' : 'text-gray-400'}`} />
        <p className="text-gray-600 font-medium">{file ? file.name : (isDragging ? 'Drop Excel file here' : 'Click or drag & drop Excel file')}</p>
        <p className="text-xs text-gray-400 mt-1">Supports .xls and .xlsx</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>}
      {result && (
        <div className={`border rounded-lg p-4 flex items-center gap-2 ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          {result.success ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
          <p className={`text-sm ${result.success ? 'text-green-800' : 'text-red-800'}`}>{result.message}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button onClick={handleGenerate} disabled={!file || isProcessing}
          className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
          {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : <><FileSpreadsheet className="w-4 h-4" />Generate Tally XML</>}
        </button>
        <a href={SAMPLE_URL} download="ZAIZ_V1.0.xlsm"
          className="bg-[#5c7ab5] text-white py-3 px-4 rounded-lg font-medium hover:bg-[#4d6aa4] transition-colors flex items-center gap-2 whitespace-nowrap">
          <Download className="w-4 h-4" />Excel Creator Template
        </a>
        {result?.success && result.downloadUrl && (
          <a href={result.downloadUrl} download="tally_import.xml"
            className="bg-[#6b8cc4] text-white py-3 px-4 rounded-lg font-medium hover:bg-[#5c7ab5] transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />Download XML
          </a>
        )}
        {result && <button onClick={reset} className="bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors">Reset</button>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TallyGenerator() {
  const [, navigate] = useLocation();
  return (
    <div>
      <main className="flex-1 flex items-start justify-center p-4 pt-20">
        <button
          onClick={() => navigate("/tally-tools")}
          className="absolute left-6 top-20 flex items-center gap-2 text-sm text-[#6b8cc4] hover:text-indigo-800 transition-colors mb-6 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to More Tools
        </button>
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-4xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-full mb-3">
              <FileSpreadsheet className="w-7 h-7 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Tally XML Generator</h1>
            <p className="text-gray-500 text-sm mt-1">Convert your transactions to Tally-ready XML for seamless import</p>
          </div>
          <ExcelTab />
        </div>
      </main>    </div>
  );
}
