import React, { useState, useRef, useMemo } from 'react';
import {
  Upload, FileText, Download, Loader2, AlertCircle, CheckCircle,
  RefreshCw, Edit3, ChevronDown, ChevronUp, Plus, X, Search
} from 'lucide-react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { getToken, getApiUrl } from '@/lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: 'Bearer ' + t } : {};
}

const BACKEND = getApiUrl();

const DEFAULT_LEDGERS: string[] = [];

function escapeXml(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface Transaction {
  id: string;
  date: string;
  narration: string;
  voucherType: string;
  amount: number;
  debitLedger: string;
  creditLedger: string;
  newLedgerNeeded?: boolean;
  newLedgerName?: string;
  newLedgerGroup?: string;
  confidence?: number;
}

function generateVoucherXML(txs: Transaction[], company: string) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<ENVELOPE>',
    '  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>',
    '  <BODY><IMPORTDATA>',
    '    <REQUESTDESC>',
    '      <REPORTNAME>Vouchers</REPORTNAME>',
    `      <STATICVARIABLES><SVCURRENTCOMPANY>${escapeXml(company)}</SVCURRENTCOMPANY></STATICVARIABLES>`,
    '    </REQUESTDESC>',
    '    <REQUESTDATA>',
  ];
  txs.forEach((tx, i) => {
    const guid = `${tx.date}-${i}-${Math.random().toString(36).slice(2, 10)}`;
    const amt = Math.abs(tx.amount);
    lines.push(
      `      <TALLYMESSAGE xmlns:UDF="TallyUDF">`,
      `        <VOUCHER REMOTEID="${guid}" VCHTYPE="${escapeXml(tx.voucherType)}" ACTION="Create">`,
      `          <DATE>${tx.date}</DATE>`,
      `          <EFFECTIVEDATE>${tx.date}</EFFECTIVEDATE>`,
      `          <VOUCHERTYPENAME>${escapeXml(tx.voucherType)}</VOUCHERTYPENAME>`,
      `          <VOUCHERNUMBER>0</VOUCHERNUMBER>`,
      `          <NARRATION>${escapeXml(tx.narration)}</NARRATION>`,
      `          <GUID>${guid}</GUID>`,
      `          <ALLLEDGERENTRIES.LIST>`,
      `            <LEDGERNAME>${escapeXml(tx.debitLedger)}</LEDGERNAME>`,
      `            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`,
      `            <AMOUNT>${(-amt).toFixed(2)}</AMOUNT>`,
      `          </ALLLEDGERENTRIES.LIST>`,
      `          <ALLLEDGERENTRIES.LIST>`,
      `            <LEDGERNAME>${escapeXml(tx.creditLedger)}</LEDGERNAME>`,
      `            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>`,
      `            <AMOUNT>${amt.toFixed(2)}</AMOUNT>`,
      `          </ALLLEDGERENTRIES.LIST>`,
      `        </VOUCHER>`,
      `      </TALLYMESSAGE>`,
    );
  });
  lines.push('    </REQUESTDATA>', '  </IMPORTDATA></BODY>', '</ENVELOPE>');
  return lines.join('\n');
}

function generateMasterXML(newLedgers: { name: string; group: string }[], company: string) {
  if (!newLedgers.length) return '';
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<ENVELOPE>',
    '  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>',
    '  <BODY><IMPORTDATA>',
    '    <REQUESTDESC>',
    '      <REPORTNAME>All Masters</REPORTNAME>',
    `      <STATICVARIABLES><SVCURRENTCOMPANY>${escapeXml(company)}</SVCURRENTCOMPANY></STATICVARIABLES>`,
    '    </REQUESTDESC>',
    '    <REQUESTDATA>',
  ];
  newLedgers.forEach(l => {
    lines.push(
      `      <TALLYMESSAGE xmlns:UDF="TallyUDF">`,
      `        <LEDGER NAME="${escapeXml(l.name)}" ACTION="Create">`,
      `          <NAME>${escapeXml(l.name)}</NAME>`,
      `          <PARENT>${escapeXml(l.group || 'Indirect Expenses')}</PARENT>`,
      `        </LEDGER>`,
      `      </TALLYMESSAGE>`,
    );
  });
  lines.push('    </REQUESTDATA>', '  </IMPORTDATA></BODY>', '</ENVELOPE>');
  return lines.join('\n');
}

function downloadXML(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BankToTallyPage() {
  // Config
  const [groqKey, setGroqKey] = useState('');
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [bankLedger, setBankLedger] = useState('HDFC Bank');

  // Files
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [ledgerFile, setLedgerFile] = useState<File | null>(null);
  const [isDraggingBank, setIsDraggingBank] = useState(false);
  const bankInputRef = useRef<HTMLInputElement>(null);
  const ledgerInputRef = useRef<HTMLInputElement>(null);

  // Ledgers
  const [ledgersText, setLedgersText] = useState(DEFAULT_LEDGERS.join('\n'));
  const [showLedgerEditor, setShowLedgerEditor] = useState(false);

  // Processing
  const [status, setStatus] = useState<'idle' | 'processing' | 'review' | 'error'>('idle');
  const [logs, setLogs] = useState<{ msg: string; type: string }[]>([]);
  const [error, setError] = useState('');

  // Results
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [newLedgers, setNewLedgers] = useState<{ name: string; group: string }[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [narrationFilter, setNarrationFilter] = useState('');

  const filteredIndices = useMemo(() => {
    const query = narrationFilter.toLowerCase().trim();
    if (!query) return transactions.map((_, i) => i);
    return transactions
      .map((tx, i) => ({ tx, i }))
      .filter(({ tx }) => (tx.narration || '').toLowerCase().includes(query))
      .map(({ i }) => i);
  }, [transactions, narrationFilter]);

  const addLog = (msg: string, type = 'info') =>
    setLogs(prev => [...prev, { msg, type }]);

  const allLedgers = [...new Set([
    bankLedger,
    ...ledgersText.split('\n').map(l => l.trim()).filter(Boolean),
  ])];

  // Handle ledger.html upload
  const handleLedgerFile = (file: File) => {
    setLedgerFile(file);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      // Extract ledger names from Tally HTML export
      const matches = text.match(/(?:LEDGER NAME="|<NAME>)([^"<\n]+)/g) || [];
      const names = matches
        .map(m => m.replace(/LEDGER NAME="|<NAME>/g, '').trim())
        .filter(n => n.length > 1 && n.length < 80);
      if (names.length > 0) {
        setLedgersText(prev => {
          const existing = new Set(prev.split('\n').map(l => l.trim().toLowerCase()));
          const fresh = names.filter(n => !existing.has(n.toLowerCase()));
          return prev + (fresh.length ? '\n' + fresh.join('\n') : '');
        });
        addLog(`✅ Imported ${names.length} ledgers from ${file.name}`, 'success');
      }
    };
    reader.readAsText(file);
  };

  const handleProcess = async () => {
    if (!bankFile) return;
    setStatus('processing');
    setError('');
    setLogs([]);

    try {
      // Step 1: read file text
      addLog('📄 Reading bank statement...');
      let rawText = '';

      if (bankFile.name.endsWith('.csv') || bankFile.name.endsWith('.txt')) {
        rawText = await bankFile.text();
      } else if (bankFile.name.endsWith('.xlsx') || bankFile.name.endsWith('.xls')) {
        rawText = `[Excel file: ${bankFile.name} — ${(bankFile.size / 1024).toFixed(0)} KB]\nPlease extract transactions manually or convert to CSV first.`;
      } else if (bankFile.type === 'application/pdf') {
        addLog('📤 Uploading PDF for AI OCR extraction...');
        // Use MinerU via backend for PDF OCR
        try {
          // Request upload URL
          const uploadRes = await fetch(BACKEND + '/api/mineru/request-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ file_name: bankFile.name }),
          });
          if (!uploadRes.ok) throw new Error('PDF upload request failed: ' + uploadRes.status);
          const { batch_id: batchId, upload_url: uploadUrl } = await uploadRes.json();

          // Upload PDF through backend
          const form = new FormData();
          form.append('file', bankFile);
          const ossRes = await fetch(BACKEND + '/api/mineru/upload-to-oss?oss_url=' + encodeURIComponent(uploadUrl), {
            method: 'PUT',
            headers: { ...authHeaders() },
            body: form,
          });
          if (!ossRes.ok) throw new Error('OSS upload failed: ' + ossRes.status);
          addLog('⏳ Waiting for ZaiZ AI to extract text...');

          // Poll for result
          let zipUrl = '';
          for (let i = 0; i < 60; i++) {
            await new Promise(r => setTimeout(r, 4000));
            const pollRes = await fetch(BACKEND + '/api/mineru/status/' + batchId, { headers: authHeaders() });
            if (!pollRes.ok) throw new Error('Poll failed');
            const poll = await pollRes.json();
            if (poll.state === 'done') { zipUrl = poll.zip_url; break; }
            if (poll.state === 'failed') throw new Error(poll.err_msg || 'ZaiZ processing failed');
            if (poll.total_pages > 0) addLog(`⚙️ Processing page ${poll.extracted_pages}/${poll.total_pages}...`);
          }
          if (!zipUrl) throw new Error('ZaiZ processing timed out');

          // Download zip and extract markdown/text
          addLog('📥 Downloading extracted text...');
          const zipRes = await fetch(BACKEND + '/api/mineru/download-zip?zip_url=' + encodeURIComponent(zipUrl), { headers: authHeaders() });
          if (!zipRes.ok) throw new Error('Zip download failed');
          const zipBuf = await zipRes.arrayBuffer();

          // Dynamically import JSZip (bundled in project)
          const JSZip = (await import('jszip')).default;
          const zip = await JSZip.loadAsync(zipBuf);
          const mdEntry = Object.values(zip.files).find(f => !f.dir && f.name.endsWith('.md'));
          const htmlEntry = Object.values(zip.files).find(f => !f.dir && f.name.endsWith('.html'));
          if (mdEntry) rawText = await mdEntry.async('string');
          else if (htmlEntry) {
            const html = await htmlEntry.async('string');
            rawText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          }
          addLog(`✅ Extracted ${rawText.length} chars from PDF`, 'success');
        } catch (e: any) {
          addLog('⚠️ ZaiZ AI extraction failed, using basic text mode: ' + e.message, 'warn');
          rawText = `[PDF: ${bankFile.name}] Could not extract text automatically. Please paste the statement text below.`;
        }
      }

      if (!rawText.trim()) {
        throw new Error('Could not read any text from the file. Try CSV or paste statement text.');
      }

      // Step 2: AI parse via backend
      addLog('🤖 Sending to AI for ledger mapping...');

      const aiRes = await fetch(BACKEND + '/api/tally/smart-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          raw_text: rawText.substring(0, 12000),
          ledgers: allLedgers,
          bank_ledger: bankLedger,
          groq_key: groqKey || null,
        }),
      });

      if (!aiRes.ok) {
        const errBody = await aiRes.json().catch(() => ({}));
        throw new Error(errBody.detail || 'AI parsing failed: ' + aiRes.status);
      }

      const parsed: Transaction[] = await aiRes.json();
      addLog(`✅ Mapped ${parsed.length} transactions`, 'success');

      const txsWithIds = parsed.map(tx => ({ ...tx, id: Math.random().toString(36).slice(2) }));
      setTransactions(txsWithIds);

      // Collect new ledgers needed
      const knownSet = new Set(allLedgers.map(l => l.toLowerCase()));
      const newMap = new Map<string, { name: string; group: string }>();
      txsWithIds.forEach(tx => {
        if (tx.newLedgerNeeded && tx.newLedgerName && !knownSet.has(tx.newLedgerName.toLowerCase())) {
          newMap.set(tx.newLedgerName, { name: tx.newLedgerName, group: tx.newLedgerGroup || 'Indirect Expenses' });
        }
      });
      const nl = [...newMap.values()];
      setNewLedgers(nl);
      if (nl.length) addLog(`📋 ${nl.length} new ledger(s) will be created in Tally`, 'warn');

      setStatus('review');
    } catch (err: any) {
      setError(err.message || 'Unknown error');
      setStatus('error');
    }
  };

  const updateTx = (idx: number, field: keyof Transaction, value: string | number) => {
    setTransactions(prev => prev.map((tx, i) => i === idx ? { ...tx, [field]: value } : tx));
  };

  const voucherXML = generateVoucherXML(transactions, companyName);
  const masterXML = generateMasterXML(newLedgers, companyName);

  const VOUCHER_TYPES = ['Payment', 'Receipt', 'Contra', 'Journal', 'Sales', 'Purchase'];

  return (
    <div>
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pt-20">

        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            🏦 Bank Statement → Tally XML
            <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-100 text-indigo-700 rounded-full">AI-Powered</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload any bank statement (PDF via ZaiZ AI OCR, CSV, Excel) — AI maps every narration to your Tally ledgers and generates import-ready XML.
          </p>
        </div>

        {/* ── SETUP ── */}
        {(status === 'idle' || status === 'error') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left */}
            <div className="space-y-5">
              {/* Config card */}
              <div className="bg-card border border-card-border rounded-xl shadow-sm p-5">
                <h2 className="text-base font-semibold mb-4">⚙️ Configuration</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                      API Key <span className="text-xs font-normal">(optional — uses default model if empty)</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showGroqKey ? 'text' : 'password'}
                        className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring pr-16"
                        placeholder="API authorization key..."
                        value={groqKey}
                        onChange={e => setGroqKey(e.target.value)}
                      />
                      <button className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setShowGroqKey(!showGroqKey)}>
                        {showGroqKey ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Company Name in Tally</label>
                    <input className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="e.g. ABC Traders (blank = current company)"
                      value={companyName} onChange={e => setCompanyName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Bank Ledger Name (as in Tally)</label>
                    <input className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="e.g. HDFC Bank Current A/c"
                      value={bankLedger} onChange={e => setBankLedger(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Bank file upload */}
              <div className="bg-card border border-card-border rounded-xl shadow-sm p-5">
                <h2 className="text-base font-semibold mb-4">📄 Bank Statement</h2>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDraggingBank ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'}`}
                  onDragOver={e => { e.preventDefault(); setIsDraggingBank(true); }}
                  onDragLeave={() => setIsDraggingBank(false)}
                  onDrop={e => { e.preventDefault(); setIsDraggingBank(false); const f = e.dataTransfer.files?.[0]; if (f) setBankFile(f); }}
                  onClick={() => bankInputRef.current?.click()}
                >
                  <input ref={bankInputRef} type="file" accept=".pdf,.csv,.xlsx,.xls,.txt"
                    className="hidden" onChange={e => e.target.files?.[0] && setBankFile(e.target.files[0])} />
                  {bankFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-6 h-6 text-primary" />
                      <div className="text-left">
                        <p className="text-sm font-medium truncate max-w-xs">{bankFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(bankFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button className="ml-2 text-muted-foreground hover:text-destructive" onClick={e => { e.stopPropagation(); setBankFile(null); }}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-medium">Drop or click to upload</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF (AI OCR) · CSV · Excel · TXT</p>
                    </>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <button
                className="w-full py-3 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                disabled={!bankFile}
                onClick={handleProcess}
              >
                ⚡ Process with AI
              </button>
            </div>

            {/* Right: Ledger editor */}
            <div className="bg-card border border-card-border rounded-xl shadow-sm p-5 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold">📋 Tally Ledger List</h2>
                <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-input rounded-lg hover:bg-muted transition-colors"
                  onClick={() => ledgerInputRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5" /> Import ledger.html
                </button>
                <input ref={ledgerInputRef} type="file" accept=".html,.htm,.xml,.txt" className="hidden"
                  onChange={e => e.target.files?.[0] && handleLedgerFile(e.target.files[0])} />
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Export from Tally: <em>Gateway → Display → List of Accounts → Print → Save as HTML</em>, then upload above. Or edit the list directly.
              </p>
              <textarea
                className="flex-1 min-h-[280px] px-3 py-2 text-xs font-mono border border-input rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring leading-relaxed"
                value={ledgersText}
                onChange={e => setLedgersText(e.target.value)}
                placeholder="One ledger name per line..."
              />
              <p className="text-xs text-muted-foreground mt-2">{allLedgers.length} ledgers loaded</p>
            </div>
          </div>
        )}

        {/* ── PROCESSING ── */}
        {status === 'processing' && (
          <div className="max-w-lg mx-auto bg-card border border-card-border rounded-xl shadow-sm p-8 text-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">AI is analysing your statement…</h2>
            <p className="text-sm text-muted-foreground mb-6">This takes 15–60 seconds depending on file size.</p>
            <div className="text-left space-y-1.5 max-h-56 overflow-y-auto">
              {logs.map((l, i) => (
                <div key={i} className={`text-xs flex gap-2 ${l.type === 'success' ? 'text-green-600' : l.type === 'warn' ? 'text-yellow-600' : l.type === 'error' ? 'text-red-500' : 'text-muted-foreground'}`}>
                  <span className="shrink-0">›</span>{l.msg}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── REVIEW ── */}
        {status === 'review' && (
          <div className="space-y-4">
            {/* Action bar */}
            <div className="flex flex-wrap items-center gap-3 bg-card border border-card-border rounded-xl shadow-sm px-5 py-4">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-sm">{transactions.length} transactions mapped</span>
              {newLedgers.length > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-700 rounded-full">
                  ⚠️ {newLedgers.length} new ledger(s)
                </span>
              )}
              <div className="ml-auto flex gap-2 flex-wrap">
                <button className="flex items-center gap-1.5 px-3 py-2 border border-input rounded-lg text-sm hover:bg-muted"
                  onClick={() => { setStatus('idle'); setTransactions([]); }}>
                  <RefreshCw className="w-3.5 h-3.5" /> Start Over
                </button>
                <button className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold"
                  onClick={() => downloadXML(voucherXML, 'tally_vouchers.xml')}>
                  <Download className="w-3.5 h-3.5" /> Download Vouchers XML
                </button>
              </div>
            </div>

            {/* New ledger warning */}
            {newLedgers.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-yellow-800 mb-2">New ledgers to be created:</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {newLedgers.map((l, i) => (
                    <span key={i} className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                      {l.name} <span className="text-yellow-600">({l.group})</span>
                    </span>
                  ))}
                </div>
                <p className="text-xs text-yellow-700">
                  ⚡ Ledger definitions are already included directly in the vouchers XML file.
                </p>
              </div>
            )}

            {/* Transaction table */}
            <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <p className="text-sm font-semibold">Transaction Review <span className="text-muted-foreground font-normal text-xs">— click a row to edit ledger mapping</span></p>
              </div>
              <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap border-b border-border">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border min-w-[250px]">
                        <div className="flex items-center gap-3">
                          <span>Narration</span>
                          <div className="relative inline-block max-w-xs w-full normal-case">
                            <input
                              type="text"
                              placeholder="Search/Filter narration..."
                              value={narrationFilter}
                              onChange={e => setNarrationFilter(e.target.value)}
                              className="w-full h-7 pl-8 pr-7 text-[11px] font-normal border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all placeholder-muted-foreground/60 shadow-sm"
                            />
                            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                            {narrationFilter && (
                              <button
                                onClick={e => { e.stopPropagation(); setNarrationFilter(""); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap border-b border-border">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap border-b border-border">Amount (₹)</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap border-b border-border">Debit Ledger (Dr)</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap border-b border-border">Credit Ledger (Cr)</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap border-b border-border">Conf.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIndices.map(idx => {
                      const tx = transactions[idx];
                      const isEditing = editingIdx === idx;
                      const dateStr = tx.date?.length === 8
                        ? `${tx.date.slice(6, 8)}/${tx.date.slice(4, 6)}/${tx.date.slice(0, 4)}`
                        : tx.date;
                      return (
                        <tr key={tx.id}
                          className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => setEditingIdx(isEditing ? null : idx)}>
                          <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">{dateStr}</td>
                          <td className="px-4 py-2.5 max-w-[200px] truncate text-xs" title={tx.narration}>{tx.narration}</td>
                          <td className="px-4 py-2.5">
                            {isEditing ? (
                              <select className="text-xs border border-input rounded px-2 py-1 bg-background"
                                value={tx.voucherType}
                                onChange={e => { e.stopPropagation(); updateTx(idx, 'voucherType', e.target.value); }}
                                onClick={e => e.stopPropagation()}>
                                {VOUCHER_TYPES.map(v => <option key={v}>{v}</option>)}
                              </select>
                            ) : (
                              <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${tx.voucherType === 'Receipt' ? 'bg-green-100 text-green-700' :
                                  tx.voucherType === 'Payment' ? 'bg-red-100 text-red-700' :
                                    'bg-blue-100 text-blue-700'}`}>
                                {tx.voucherType}
                              </span>
                            )}
                          </td>
                          <td className={`px-4 py-2.5 font-semibold text-xs tabular-nums ${tx.voucherType === 'Receipt' ? 'text-green-600' : 'text-red-500'}`}>
                            {Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {isEditing ? (
                              <select className="w-full text-xs border border-input rounded px-2 py-1 bg-background"
                                value={tx.debitLedger}
                                onChange={e => { e.stopPropagation(); updateTx(idx, 'debitLedger', e.target.value); }}
                                onClick={e => e.stopPropagation()}>
                                {allLedgers.map(l => <option key={l}>{l}</option>)}
                              </select>
                            ) : <span className="text-amber-700 font-medium">{tx.debitLedger}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {isEditing ? (
                              <select className="w-full text-xs border border-input rounded px-2 py-1 bg-background"
                                value={tx.creditLedger}
                                onChange={e => { e.stopPropagation(); updateTx(idx, 'creditLedger', e.target.value); }}
                                onClick={e => e.stopPropagation()}>
                                {allLedgers.map(l => <option key={l}>{l}</option>)}
                              </select>
                            ) : <span className="text-indigo-700 font-medium">{tx.creditLedger}</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-10 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${(tx.confidence || 0.8) > 0.8 ? 'bg-green-500' : 'bg-yellow-500'}`}
                                  style={{ width: `${(tx.confidence || 0.8) * 100}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground">{Math.round((tx.confidence || 0.8) * 100)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Import guide */}
            <div className="border rounded-xl p-4 bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900/30">
              <p className="text-sm font-semibold mb-2 text-green-800 dark:text-green-300">Importing to Tally</p>
              <ol className="text-xs space-y-1 list-decimal list-inside text-green-700 dark:text-green-400/85">
                <li>Download the <strong>tally_vouchers.xml</strong> file (which automatically includes any new ledger master definitions).</li>
                <li>Go to Tally → Gateway of Tally → Import Data.</li>
                <li>Choose <strong>Vouchers</strong> and browse to the downloaded file.</li>
                <li>Accept the import and verify the transactions in the Day Book.</li>
              </ol>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
