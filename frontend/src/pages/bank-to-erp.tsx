import React, { useState, useRef, useCallback, useMemo } from "react";
import {
  Upload, FileText, Download, Loader2, AlertCircle, CheckCircle,
  ChevronDown, ChevronUp, RefreshCw, ArrowRight, Database,
  Sparkles, X, ArrowLeft, Cpu, Clock, Terminal, Check, Activity, Search, Filter
} from "lucide-react";
import { useLocation } from "wouter";
import { getToken, getApiUrl, isLoggedIn } from "@/lib/api";

const BACKEND = getApiUrl();
const authH = (): Record<string, string> => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface Transaction {
  date_tally: string;
  date_display: string;
  narration: string;
  amount: number;
  direction: "debit" | "credit";
  balance: number | null;
  balance_ok: boolean;
  voucherType: string;
  debitLedger: string;
  creditLedger: string;
  newLedgerNeeded: boolean;
  newLedgerName: string;
  newLedgerGroup: string;
  hasSuspense?: boolean;
}

interface TaskStatus {
  status: "pending" | "converting" | "extracting" | "mapping" | "partial" | "done" | "error";
  step: string;
  progress: number;
  error?: string;
  transaction_count?: number;
  transactions_done?: number;
  batches_done?: number;
  total_batches?: number;
  pages_done?: number;
  total_pages?: number;
  queue_position?: number;
  transactions?: Transaction[];
}

// ── Default ledgers ───────────────────────────────────────────────────────────
const DEFAULT_LEDGERS: string[] = [];

// ── Helpers ───────────────────────────────────────────────────────────────────
function downloadBlob(content: string, filename: string, mime = "application/xml") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function cleanTallyDate(dateStr: string, fallbackDate: string): string {
  if (!dateStr) return fallbackDate;
  let s = String(dateStr).trim();
  if (/^\d{8}$/.test(s)) return s;

  const parts = s.split(/[-/.\s]+/);
  if (parts.length === 3) {
    let day = 0, month = 0, year = 0;
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else if (parts[2].length === 4) {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    } else if (parts[2].length === 2) {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = 2000 + parseInt(parts[2], 10);
    }

    if (day > 0 && day <= 31 && month > 0 && month <= 12 && year > 1000) {
      const yy = String(year);
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return `${yy}${mm}${dd}`;
    }
  }

  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    const yy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}${mm}${dd}`;
  }

  return fallbackDate;
}

function sanitizeTransaction(tx: Transaction): Transaction {
  const cleanName = (name: string): string => {
    if (!name) return "";
    const trimmed = name.trim();
    const nameUpper = trimmed.toUpperCase();

    // 1. UPI Pattern: UPI/DR/123456789012/NAME/BANK or UPI/CR/123456789012/NAME/BANK
    if (nameUpper.startsWith("UPI/")) {
      const parts = trimmed.split('/');
      if (parts.length >= 4) {
        const candidate = parts[3].trim();
        if (candidate) return candidate;
      }
    }

    // 2. NEFT Pattern: NEFT CR-YESPH50920408120-YESB0000001-PHONEPE PRIVATE LIMI FOR PHONEPE PR
    if (nameUpper.startsWith("NEFT ")) {
      const parts = trimmed.split('-');
      if (parts.length >= 3) {
        const candidate = parts.slice(3).join('-').trim() || parts[parts.length - 1].trim();
        if (candidate.toUpperCase().includes("PHONEPE PRIVATE")) {
          return "PHONEPE PVT LTD";
        }
        if (candidate) return candidate;
      }
    }

    return trimmed;
  };

  const newTx = { ...tx };
  if (newTx.newLedgerName) {
    const orig = newTx.newLedgerName;
    const cleaned = cleanName(orig);
    if (cleaned) {
      newTx.newLedgerName = cleaned;
      if (newTx.debitLedger === orig) {
        newTx.debitLedger = cleaned;
      }
      if (newTx.creditLedger === orig) {
        newTx.creditLedger = cleaned;
      }
    }
  }

  if (newTx.debitLedger) {
    newTx.debitLedger = cleanName(newTx.debitLedger);
  }
  if (newTx.creditLedger) {
    newTx.creditLedger = cleanName(newTx.creditLedger);
  }

  return newTx;
}

function rebuildXML(
  transactions: Transaction[],
  company: string,
  bankLedger: string,
  newLedgers: { name: string; group: string }[] = []
): string {
  const esc = (s: string) => String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<ENVELOPE>',
    '  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>',
    '  <BODY><IMPORTDATA>',
    '    <REQUESTDESC>',
    '      <REPORTNAME>Vouchers</REPORTNAME>',
    `      <STATICVARIABLES><SVCURRENTCOMPANY>${esc(company)}</SVCURRENTCOMPANY></STATICVARIABLES>`,
    '    </REQUESTDESC>',
    '    <REQUESTDATA>',
  ];

  // Prepend ledger master definitions first if any are required
  newLedgers.forEach(l => {
    lines.push(
      '      <TALLYMESSAGE xmlns:UDF="TallyUDF">',
      `        <LEDGER NAME="${esc(l.name)}" ACTION="Create">`,
      `          <NAME>${esc(l.name)}</NAME>`,
      `          <PARENT>${esc(l.group || "Indirect Expenses")}</PARENT>`,
      '        </LEDGER>',
      '      </TALLYMESSAGE>',
    );
  });

  // Determine a global fallback date
  let globalFallback = "";
  for (const tx of transactions) {
    if (tx.date_tally && /^\d{8}$/.test(tx.date_tally.trim())) {
      globalFallback = tx.date_tally.trim();
      break;
    }
    if (tx.date_display) {
      const cleaned = cleanTallyDate(tx.date_display, "");
      if (cleaned) {
        globalFallback = cleaned;
        break;
      }
    }
  }
  if (!globalFallback) {
    const today = new Date();
    const yy = String(today.getFullYear());
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    globalFallback = `${yy}${mm}${dd}`;
  }

  let runningDate = globalFallback;

  transactions.forEach((tx, i) => {
    const rawDate = tx.date_tally || tx.date_display || "";
    const cleanDate = cleanTallyDate(rawDate, runningDate);
    runningDate = cleanDate;

    const guid = `ACROZO-${cleanDate}-${i}-${Math.random().toString(36).slice(2, 10)}`;
    const amt = Math.abs(tx.amount);

    // Structure such that first ledger is always bankLedger and second is always other ledger
    const bankIsDebit = tx.direction === "credit";
    // Prefer explicitly suggested new ledger name when available — this prevents
    // accidentally using a group name (e.g. "Sundry Creditors") instead of
    // the actual created ledger (e.g. "HPCLVAN").
    let otherLedger = bankIsDebit ? (tx.creditLedger || "Suspense A/c") : (tx.debitLedger || "Suspense A/c");
    if (tx.newLedgerNeeded && tx.newLedgerName) {
      otherLedger = tx.newLedgerName;
    }

    lines.push(
      '      <TALLYMESSAGE xmlns:UDF="TallyUDF">',
      `        <VOUCHER REMOTEID="${guid}" VCHTYPE="${esc(tx.voucherType)}" ACTION="Create" DATE="${cleanDate}">`,
      `          <DATE>${cleanDate}</DATE>`,
      `          <EFFECTIVEDATE>${cleanDate}</EFFECTIVEDATE>`,
      `          <VOUCHERTYPENAME>${esc(tx.voucherType)}</VOUCHERTYPENAME>`,
      `          <VOUCHERNUMBER>${i + 1}</VOUCHERNUMBER>`,
      `          <PARTYLEDGERNAME>${esc(bankLedger)}</PARTYLEDGERNAME>`,
      '          <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>',
      `          <NARRATION>${esc(tx.narration)}</NARRATION>`,
      `          <GUID>${guid}</GUID>`,
      '          <ALLLEDGERENTRIES.LIST>',
      `            <LEDGERNAME>${esc(bankLedger)}</LEDGERNAME>`,
      `            <ISDEEMEDPOSITIVE>${bankIsDebit ? "Yes" : "No"}</ISDEEMEDPOSITIVE>`,
      `            <AMOUNT>${bankIsDebit ? (-amt).toFixed(2) : amt.toFixed(2)}</AMOUNT>`,
      '          </ALLLEDGERENTRIES.LIST>',
      '          <ALLLEDGERENTRIES.LIST>',
      `            <LEDGERNAME>${esc(otherLedger)}</LEDGERNAME>`,
      `            <ISDEEMEDPOSITIVE>${bankIsDebit ? "No" : "Yes"}</ISDEEMEDPOSITIVE>`,
      `            <AMOUNT>${bankIsDebit ? amt.toFixed(2) : (-amt).toFixed(2)}</AMOUNT>`,
      '          </ALLLEDGERENTRIES.LIST>',
      '        </VOUCHER>',
      '      </TALLYMESSAGE>',
    );
  });
  lines.push('    </REQUESTDATA>', '  </IMPORTDATA></BODY>', '</ENVELOPE>');
  return lines.join("\n");
}

function guessLedgerGroup(name: string, direction?: "debit" | "credit"): string {
  const n = String(name || "").toLowerCase().trim();
  if (n === "suspense a/c" || n === "suspense") return "Suspense a/c";
  if (direction === "debit") return "Sundry Creditors";
  if (direction === "credit") return "Sundry Debtors";
  return "Suspense a/c";
}

function generateMasterXML(newLedgers: { name: string; group: string }[], company: string) {
  if (!newLedgers.length) return "";
  const esc = (s: string) => String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<ENVELOPE>',
    '  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>',
    '  <BODY><IMPORTDATA>',
    '    <REQUESTDESC>',
    '      <REPORTNAME>All Masters</REPORTNAME>',
    `      <STATICVARIABLES><SVCURRENTCOMPANY>${esc(company)}</SVCURRENTCOMPANY></STATICVARIABLES>`,
    '    </REQUESTDESC>',
    '    <REQUESTDATA>',
  ];
  newLedgers.forEach(l => {
    lines.push(
      '      <TALLYMESSAGE xmlns:UDF="TallyUDF">',
      `        <LEDGER NAME="${esc(l.name)}" ACTION="Create">`,
      `          <NAME>${esc(l.name)}</NAME>`,
      `          <PARENT>${esc(l.group || "Indirect Expenses")}</PARENT>`,
      '        </LEDGER>',
      '      </TALLYMESSAGE>',
    );
  });
  lines.push('    </REQUESTDATA>', '  </IMPORTDATA></BODY>', '</ENVELOPE>');
  return lines.join("\n");
}

// ── Step bar ──────────────────────────────────────────────────────────────────
const STEPS = [
  { label: "Upload PDF", icon: Upload },
  { label: "Extract Txns", icon: Database },
  { label: "AI Map Ledgers", icon: Sparkles },
  { label: "Review & Export", icon: Download },
];

function StepBar({ active }: { active: number }) {
  return (
    <div className="max-w-4xl mx-auto mb-12 select-none">
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2.5s infinite;
        }
      `}} />
      {/* High-tech glow line container */}
      <div className="relative bg-gray-50/40 dark:bg-gray-950/20 border border-gray-100 dark:border-gray-800/60 rounded-3xl p-4 shadow-inner">
        <div className="w-full flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < active;
            const current = i === active;

            return (
              <React.Fragment key={i}>
                <div
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all duration-500 w-full md:flex-1 relative overflow-hidden border
                    ${current
                      ? "bg-gradient-to-r from-indigo-500/10 to-violet-500/10 dark:from-indigo-500/15 dark:to-violet-500/15 border-indigo-500/25 shadow-[0_0_15px_rgba(99,102,241,0.08)] scale-[1.02]"
                      : done
                        ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/15"
                        : "border-transparent opacity-60"
                    }`}
                >
                  {/* Step status indicator / icon */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-500 shrink-0
                    ${done
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                      : current
                        ? "bg-gradient-to-tr from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/20 ring-2 ring-indigo-200/50 dark:ring-indigo-950/50"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {done ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : (
                      <Icon className={`w-4 h-4 ${current ? "animate-pulse" : ""}`} />
                    )}
                  </div>

                  {/* Step label / details */}
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400 dark:text-gray-500 leading-none">
                      Step 0{i + 1}
                    </span>
                    <span className={`text-xs font-bold whitespace-nowrap mt-0.5
                      ${current
                        ? "bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent"
                        : done
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>

                  {/* Glass shimmer overlay on active step */}
                  {current && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer pointer-events-none" />
                  )}
                </div>

                {/* Connecting arrow/line (only on desktop md+) */}
                {i < STEPS.length - 1 && (
                  <div className="hidden md:flex items-center text-gray-200 dark:text-gray-800 shrink-0 mx-1">
                    <ArrowRight className={`w-4 h-4 transition-colors duration-500 
                      ${done ? "text-emerald-500/60" : current ? "text-indigo-500/40" : "text-gray-200 dark:text-gray-800"}`}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Editable ledger cell: pick from known ledgers or type a new one ───────────
function LedgerCell({ value, knownLedgers, onChange }: {
  value: string;
  knownLedgers: string[];
  onChange: (val: string) => void;
}) {
  const [customMode, setCustomMode] = useState(!knownLedgers.includes(value) && value !== "");

  if (customMode) {
    return (
      <input
        autoFocus
        className="text-xs border border-indigo-200 dark:border-indigo-900 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full"
        value={value}
        placeholder="Type ledger name"
        onChange={e => onChange(e.target.value)}
        onBlur={() => { if (knownLedgers.includes(value)) setCustomMode(false); }}
      />
    );
  }

  return (
    <select
      className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer w-full"
      value={knownLedgers.includes(value) ? value : ""}
      onChange={e => {
        if (e.target.value === "__custom__") { setCustomMode(true); return; }
        onChange(e.target.value);
      }}
    >
      {!knownLedgers.includes(value) && <option value="">{value || "Select ledger…"}</option>}
      {knownLedgers.map(l => <option key={l} value={l}>{l}</option>)}
      <option value="__custom__">— Type custom ledger —</option>
    </select>
  );
}

// ── Transaction table ─────────────────────────────────────────────────────────
function TxnTable({ txns, onEdit, knownLedgers, onBulkEdit, ledgerFilter, onClearLedgerFilter }: {
  txns: Transaction[];
  onEdit: (i: number, field: keyof Transaction, val: string) => void;
  knownLedgers: string[];
  onBulkEdit: (indices: Set<number>, field: "voucherType" | "ledger", val: string) => void;
  ledgerFilter?: string | null;
  onClearLedgerFilter?: () => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkField, setBulkField] = useState<"voucherType" | "ledger">("voucherType");
  const [bulkValue, setBulkValue] = useState("");
  const [narrationFilter, setNarrationFilter] = useState("");

  const filteredIndices = useMemo(() => {
    const query = narrationFilter.toLowerCase().trim();
    const targetLedger = ledgerFilter ? ledgerFilter.toLowerCase().trim() : "";
    return txns
      .map((tx, i) => ({ tx, i }))
      .filter(({ tx }) => {
        const matchesNarration = !query || (tx.narration || "").toLowerCase().includes(query);
        const matchesLedger = !targetLedger ||
          (tx.debitLedger || "").toLowerCase().trim() === targetLedger ||
          (tx.creditLedger || "").toLowerCase().trim() === targetLedger;
        return matchesNarration && matchesLedger;
      })
      .map(({ i }) => i);
  }, [txns, narrationFilter, ledgerFilter]);

  const toggleOne = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };
  const allSelected = filteredIndices.length > 0 && filteredIndices.every(i => selected.has(i));
  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) {
        filteredIndices.forEach(i => next.delete(i));
      } else {
        filteredIndices.forEach(i => next.add(i));
      }
      return next;
    });
  };
  const applyBulk = () => {
    if (!bulkValue.trim() || selected.size === 0) return;
    onBulkEdit(selected, bulkField, bulkValue.trim());
    setSelected(new Set());
    setBulkValue("");
  };
  const debitTotal = txns.filter(t => t.direction === "debit").reduce((s, t) => s + t.amount, 0);
  const creditTotal = txns.filter(t => t.direction === "credit").reduce((s, t) => s + t.amount, 0);
  const newCount = txns.filter(t => t.newLedgerNeeded).length;

  // Compute running balance per row, anchored fresh at every row that has a
  // real PDF-printed balance. We deliberately do NOT trust the AI's own
  // balance_ok flag for the mismatch banner — that flag is only reliable
  // within a single AI batch and can't see across batch boundaries, so a
  // value derived purely from consecutive PDF-printed balances is used
  // instead. A row only gets flagged when an actual arithmetic gap exists
  // between two PDF balances we can see.
  //
  // Important: rows between two anchors (i.e. rows with no printed balance
  // of their own) still move the money, so their amounts must accumulate
  // into the running total — we can't just compare the next anchor against
  // the last anchor plus only the latest row's amount, or every statement
  // with even one blank-balance row produces a false mismatch.
  const parseTxnDate = (dateStr: string): number => {
    if (!dateStr) return 0;
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getTime();
      }
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
    }
    const t = Date.parse(dateStr);
    return isNaN(t) ? 0 : t;
  };

  const runCalculation = (reverseOrder: boolean) => {
    const orderedTxns = reverseOrder ? [...txns].reverse() : [...txns];

    let normalVotes = 0;
    let odVotes = 0;
    for (let i = 1; i < orderedTxns.length; i++) {
      const prev = orderedTxns[i - 1];
      const curr = orderedTxns[i];
      if (prev.balance !== null && curr.balance !== null && curr.amount !== 0) {
        const diff = curr.balance - prev.balance;
        if (curr.direction === "credit") {
          if (Math.abs(diff - curr.amount) < 0.05) normalVotes++;
          else if (Math.abs(diff + curr.amount) < 0.05) odVotes++;
        } else if (curr.direction === "debit") {
          if (Math.abs(diff + curr.amount) < 0.05) normalVotes++;
          else if (Math.abs(diff - curr.amount) < 0.05) odVotes++;
        }
      }
    }
    const localIsOD = odVotes > normalVotes;

    const expectedBals = new Array(orderedTxns.length).fill(null);
    const mismatches = new Array(orderedTxns.length).fill(false);

    let lastAnchorIdx = -1;
    for (let i = 0; i < orderedTxns.length; i++) {
      if (orderedTxns[i].balance !== null) {
        if (lastAnchorIdx === -1) {
          expectedBals[i] = orderedTxns[i].balance;
        } else {
          // Calculate expected balance by summing deltas since last anchor
          let running = orderedTxns[lastAnchorIdx].balance as number;
          for (let j = lastAnchorIdx + 1; j <= i; j++) {
            const tx = orderedTxns[j];
            const delta = tx.direction === "credit"
              ? (localIsOD ? -tx.amount : tx.amount)
              : (localIsOD ? tx.amount : -tx.amount);
            running += delta;
          }
          expectedBals[i] = running;

          if (Math.abs((orderedTxns[i].balance as number) - running) > 0.05) {
            mismatches[i] = true;
          }
        }
        lastAnchorIdx = i;
      }
    }

    let currentAnchorBal: number | null = null;
    for (let i = 0; i < orderedTxns.length; i++) {
      if (orderedTxns[i].balance !== null) {
        currentAnchorBal = orderedTxns[i].balance;
      } else if (currentAnchorBal !== null) {
        const tx = orderedTxns[i];
        const delta = tx.direction === "credit"
          ? (localIsOD ? -tx.amount : tx.amount)
          : (localIsOD ? tx.amount : -tx.amount);
        currentAnchorBal += delta;
        expectedBals[i] = currentAnchorBal;
      }
    }

    let nextAnchorBal: number | null = null;
    for (let i = orderedTxns.length - 1; i >= 0; i--) {
      if (orderedTxns[i].balance !== null) {
        nextAnchorBal = orderedTxns[i].balance;
      } else if (expectedBals[i] === null && nextAnchorBal !== null) {
        const tx = orderedTxns[i + 1];
        const delta = tx.direction === "credit"
          ? (localIsOD ? -tx.amount : tx.amount)
          : (localIsOD ? tx.amount : -tx.amount);
        nextAnchorBal -= delta;
        expectedBals[i] = nextAnchorBal;
      }
    }

    const results = [];
    let localMismatchCount = 0;
    for (let i = 0; i < orderedTxns.length; i++) {
      const tx = orderedTxns[i];
      const expected = expectedBals[i];
      const mismatch = mismatches[i];
      if (mismatch) localMismatchCount++;
      results.push({ pdfBal: tx.balance, expected, mismatch });
    }

    if (reverseOrder) {
      results.reverse();
    }
    return { results, mismatchCount: localMismatchCount, isOD: localIsOD };
  };

  // Determine chronological direction based on dates to resolve tie-breakers
  let isReverseChronological = false;
  let firstDate = 0;
  let lastDate = 0;
  for (let i = 0; i < txns.length; i++) {
    const d = parseTxnDate(txns[i].date_display || txns[i].date_tally);
    if (d > 0) { firstDate = d; break; }
  }
  for (let i = txns.length - 1; i >= 0; i--) {
    const d = parseTxnDate(txns[i].date_display || txns[i].date_tally);
    if (d > 0) { lastDate = d; break; }
  }
  if (firstDate > 0 && lastDate > 0 && firstDate > lastDate) {
    isReverseChronological = true;
  }

  // Calculate under both options and select the one with fewer mismatches
  const calcNormal = runCalculation(false);
  const calcReverse = runCalculation(true);

  let finalCalculation = calcNormal;
  if (calcReverse.mismatchCount < calcNormal.mismatchCount) {
    finalCalculation = calcReverse;
  } else if (calcReverse.mismatchCount === calcNormal.mismatchCount && isReverseChronological) {
    finalCalculation = calcReverse;
  }

  const computedBalances = finalCalculation.results;
  // Contra vouchers (ATM/cash transfers) are known self-transfers — exclude them
  // from the visible mismatch count so they don't alarm users unnecessarily.
  const mismatchCount = finalCalculation.results.reduce((acc, r, i) => {
    return acc + (r.mismatch && txns[i]?.voucherType !== "Contra" ? 1 : 0);
  }, 0);
  const isOD = finalCalculation.isOD;

  const fmtBal = (v: number | null) => {
    if (v === null) return "—";
    const abs = Math.abs(v);
    const str = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return v < 0 ? `(${str})` : str;
  };

  return (
    <div className="space-y-4">
      {/* Active Ledger Filter Pill */}
      {ledgerFilter && (
        <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-455 px-3 py-1.5 rounded-xl text-xs font-semibold w-fit border border-yellow-200/50 dark:border-yellow-900/50 animate-fade-in shadow-sm">
          <span>Active Filter: Mapped to <strong className="font-extrabold">{ledgerFilter}</strong></span>
          <button
            onClick={onClearLedgerFilter}
            title="Clear filter"
            className="hover:bg-yellow-250 dark:hover:bg-yellow-900/50 p-0.5 rounded-full transition-colors flex items-center justify-center cursor-pointer ml-1 text-yellow-750 dark:text-yellow-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-xs text-green-600 font-medium">Total Credits</p>
          <p className="text-base font-bold text-green-700">₹{creditTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-xs text-red-600 font-medium">Total Debits</p>
          <p className="text-base font-bold text-red-700">₹{debitTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <p className="text-xs text-blue-600 font-medium">Transactions</p>
          <p className="text-base font-bold text-blue-700">{txns.length}</p>
        </div>
        {mismatchCount > 0 ? (
          <div className="bg-orange-50 border border-orange-300 rounded-xl p-3 text-center">
            <p className="text-xs text-orange-600 font-medium">Balance Mismatches</p>
            <p className="text-base font-bold text-orange-700">{mismatchCount}</p>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <p className="text-xs text-amber-600 font-medium">New Ledgers</p>
            <p className="text-base font-bold text-amber-700">{newCount}</p>
          </div>
        )}
      </div>

      {/* Balance legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 px-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-green-400"></span>Balance verified ✓
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-orange-400"></span>Balance mismatch ⚠
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-gray-300"></span>No balance in PDF
        </span>
      </div>

      {/* Bulk action bar — appears once one or more rows are checked,
          Gmail-style, replacing the old narration-filter bulk panel. */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-indigo-600 text-white rounded-xl px-4 py-2.5 text-sm">
          <span className="font-semibold whitespace-nowrap">{selected.size} selected</span>
          <select
            className="text-xs rounded-lg px-2 py-1.5 bg-indigo-500 text-white border border-indigo-400 focus:outline-none cursor-pointer"
            value={bulkField}
            onChange={e => setBulkField(e.target.value as typeof bulkField)}
          >
            <option value="voucherType">Voucher Type</option>
            <option value="ledger">Ledger</option>
          </select>
          {bulkField === "voucherType" ? (
            <select
              className="text-xs rounded-lg px-2 py-1.5 bg-white text-gray-700 border border-indigo-400 focus:outline-none cursor-pointer min-w-[120px]"
              value={bulkValue}
              onChange={e => setBulkValue(e.target.value)}
            >
              <option value="">Set to…</option>
              {["Payment", "Receipt", "Contra", "Journal"].map(v => <option key={v}>{v}</option>)}
            </select>
          ) : (
            <select
              className="text-xs rounded-lg px-2 py-1.5 bg-white text-gray-700 border border-indigo-400 focus:outline-none cursor-pointer min-w-[140px]"
              value={knownLedgers.includes(bulkValue) ? bulkValue : ""}
              onChange={e => setBulkValue(e.target.value)}
            >
              <option value="">Set to…</option>
              {knownLedgers.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          )}
          <button
            onClick={applyBulk}
            disabled={!bulkValue.trim()}
            className="bg-white text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            Apply
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-indigo-100 hover:text-white ml-auto whitespace-nowrap"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          <table className="w-full text-sm min-w-[620px]">
            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2.5 text-left w-8">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-indigo-600 focus:ring-indigo-400 cursor-pointer bg-white dark:bg-gray-800"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all transactions"
                  />
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">#</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Date</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 w-full">
                  <div className="flex items-center gap-3">
                    <span className="whitespace-nowrap">Narration</span>
                    <div className="relative inline-block max-w-xs w-full">
                      <input
                        type="text"
                        placeholder="Search/Filter narration..."
                        value={narrationFilter}
                        onChange={e => setNarrationFilter(e.target.value)}
                        className="w-full h-7 pl-8 pr-7 text-[11px] font-normal border border-indigo-150/40 dark:border-gray-800 rounded-lg bg-white/90 dark:bg-gray-950/70 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all placeholder-gray-400 dark:placeholder-gray-650 shadow-sm"
                      />
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      {narrationFilter && (
                        <button
                          onClick={() => setNarrationFilter("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Amount</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Balance</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap min-w-[260px]">Ledger</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap min-w-[125px]">Voucher Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredIndices.map(i => {
                const tx = txns[i];
                const { pdfBal, expected, mismatch: rawMismatch } = computedBalances[i];
                // Contra entries are known self-transfers; never flag them as a balance mismatch.
                const hasMismatch = rawMismatch && tx.voucherType !== "Contra";
                const rowBg = tx.hasSuspense
                  ? "bg-red-50/60 dark:bg-red-950/20 border-l-2 border-red-300 dark:border-red-900"
                  : hasMismatch
                    ? "bg-yellow-50/60 dark:bg-yellow-950/20 border-l-2 border-yellow-400 dark:border-yellow-900"
                    : "";
                return (
                  <React.Fragment key={i}>
                    <tr className={`transition-colors ${rowBg} ${selected.has(i) ? "bg-indigo-50/70 dark:bg-indigo-950/30" : ""}`}>
                      {/* Selection checkbox — Gmail-style multi-select for bulk edit */}
                      <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-indigo-600 focus:ring-indigo-400 cursor-pointer bg-white dark:bg-gray-800"
                          checked={selected.has(i)}
                          onChange={() => toggleOne(i)}
                          aria-label={`Select row ${i + 1}`}
                        />
                      </td>

                      {/* Row number */}
                      <td className="px-3 py-2 text-gray-400 dark:text-gray-500 text-xs tabular-nums">{i + 1}</td>

                      {/* Date */}
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">{tx.date_display}</td>

                      {/* Narration — full width, wraps, click to expand */}
                      <td
                        className="px-3 py-2 text-gray-800 dark:text-gray-200 cursor-pointer"
                        onClick={() => setExpanded(expanded === i ? null : i)}
                      >
                        <p className="text-xs break-words whitespace-normal leading-relaxed">{tx.narration}</p>
                      </td>

                      {/* Amount */}
                      <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                        <span className={`text-xs ${tx.direction === "credit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {tx.direction === "credit" ? "+" : "−"}₹{tx.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Balance column */}
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {pdfBal === null ? (
                          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                        ) : hasMismatch ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">₹{fmtBal(pdfBal)}</span>
                            {expected !== null && (
                              <span className="text-[10px] text-orange-400 dark:text-orange-500/80 leading-tight">exp ₹{fmtBal(expected)}</span>
                            )}
                            <span className="text-[10px] text-orange-500 font-bold">⚠</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={`text-xs font-medium ${pdfBal < 0 ? "text-red-500 dark:text-red-400" : "text-gray-700 dark:text-gray-300"}`}>
                              ₹{fmtBal(pdfBal)}
                            </span>
                            <span className="text-[10px] text-green-500 dark:text-green-400 leading-tight">✓</span>
                          </div>
                        )}
                      </td>

                      {/* Ledger — inline select, editable, shows the side relevant to direction */}
                      <td className="px-2 py-1.5 min-w-[260px]" onClick={e => e.stopPropagation()}>
                        <LedgerCell
                          value={tx.direction === "debit" ? tx.debitLedger : tx.creditLedger}
                          knownLedgers={knownLedgers}
                          onChange={val => onEdit(i, tx.direction === "debit" ? "debitLedger" : "creditLedger", val)}
                        />
                      </td>

                      {/* Voucher Type — inline select, no expand needed */}
                      <td className="px-2 py-1.5 min-w-[125px]" onClick={e => e.stopPropagation()}>
                        <select
                          className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer w-full"
                          value={tx.voucherType}
                          onChange={e => onEdit(i, "voucherType", e.target.value)}
                        >
                          {["Payment", "Receipt", "Contra", "Journal"].map(v => <option key={v}>{v}</option>)}
                        </select>
                      </td>
                    </tr>

                    {/* Expanded detail row — full double-entry view + balance info */}
                    {expanded === i && (
                      <tr className="bg-gray-50/80 dark:bg-gray-800/40">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="flex flex-wrap gap-4 text-xs mb-3">
                            <div onClick={e => e.stopPropagation()}>
                              <p className="text-gray-400 dark:text-gray-500 font-medium mb-1">Mapped Ledger</p>
                              <LedgerCell
                                value={tx.direction === "debit" ? tx.debitLedger : tx.creditLedger}
                                knownLedgers={knownLedgers}
                                onChange={val => onEdit(i, tx.direction === "debit" ? "debitLedger" : "creditLedger", val)}
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs">
                            {/* Balance detail */}
                            {pdfBal !== null && (
                              <>
                                <div>
                                  <p className="text-gray-400 dark:text-gray-500 font-medium mb-0.5">PDF Balance</p>
                                  <p className={`font-bold ${pdfBal < 0 ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-gray-200"}`}>
                                    ₹{fmtBal(pdfBal)}{pdfBal < 0 ? " (OD)" : ""}
                                  </p>
                                </div>
                                {expected !== null && (
                                  <div>
                                    <p className="text-gray-400 dark:text-gray-500 font-medium mb-0.5">Expected Balance</p>
                                    <p className={`font-bold ${hasMismatch ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`}>
                                      ₹{fmtBal(expected)}
                                    </p>
                                  </div>
                                )}
                                {expected !== null && (
                                  <div>
                                    <p className="text-gray-400 dark:text-gray-500 font-medium mb-0.5">Difference</p>
                                    <p className={`font-bold ${hasMismatch ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`}>
                                      {hasMismatch ? `₹${Math.abs(pdfBal - expected).toFixed(2)}` : "₹0.00 ✓"}
                                    </p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          {hasMismatch && (
                            <div className="mt-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-300 dark:border-yellow-900/40 rounded-lg p-2 text-xs text-yellow-800 dark:text-yellow-300">
                              ⚠️ Balance mismatch — PDF shows ₹{fmtBal(pdfBal)} but calculated ₹{fmtBal(expected)}. Check if a row is missing or the amount is wrong.
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const sanitizeErrorMessage = (msg: string | null | undefined): string => {
  if (!msg) return "";
  let clean = msg;
  clean = clean.replace(/gemini/ig, "the AI engine");
  clean = clean.replace(/google/ig, "the system");
  clean = clean.replace(/gpt-oss-120b/ig, "the mapping engine");
  clean = clean.replace(/gpt-oss/ig, "the mapping engine");
  clean = clean.replace(/groq/ig, "the mapping engine");
  return clean;
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BankPdfToTally({ onAuthRequired }: { onAuthRequired?: () => void } = {}) {
  const [, navigate] = useLocation();
  const [uiStep, setUiStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [bankLedger, setBankLedger] = useState("Bank Account");
  const [bankLedgerOptions, setBankLedgerOptions] = useState<string[]>([]);
  const [company, setCompany] = useState("");
  const [ledgersText, setLedgersText] = useState(DEFAULT_LEDGERS.join("\n"));
  const [showLedgers, setShowLedgers] = useState(false);
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const elapsedTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ledgerHtmlRef = useRef<HTMLInputElement>(null);

  const parseTallyLedgerHtml = (htmlContent: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");
    const names = new Set<string>();

    doc.querySelectorAll("tr").forEach(row => {
      const cells = row.querySelectorAll("td");
      cells.forEach(cell => {
        const text = cell.textContent?.trim() ?? "";
        if (
          text.length > 1 && text.length < 100 &&
          !/^\d[\d,.\s]*$/.test(text) &&
          !/^(sl\.?\s*no|s\.no|no\.|sr\.)/i.test(text) &&
          !/^(name|ledger name|group|closing|opening|debit|credit|balance|amount|total|particulars|date)$/i.test(text)
        ) { names.add(text); }
      });
    });

    if (names.size === 0) {
      doc.querySelectorAll("p, div, span, li").forEach(el => {
        const text = el.textContent?.trim() ?? "";
        if (text.length > 1 && text.length < 100 && !/^\d[\d,.\s]*$/.test(text)) names.add(text);
      });
    }

    const allNames = Array.from(names);

    // Detect bank/cash ledgers for bank ledger dropdown
    const BANK_KEYWORDS = /bank|hdfc|sbi|icici|axis|kotak|yes bank|pnb|canara|union|uco|boi|bob|idbi|federal|indusind|rbl|cash|petty cash|current a\/c|savings a\/c|od account/i;
    const bankLedgers = allNames.filter(n => BANK_KEYWORDS.test(n));
    setBankLedgerOptions(bankLedgers);
    if (bankLedgers.length === 1) setBankLedger(bankLedgers[0]);

    return allNames;
  };

  // Bulk edit is now handled via checkbox selection inside TxnTable
  // (see onBulkApply prop) instead of a narration-filter panel.

  const pickFile = (f: File) => {
    const allowed = [".pdf", ".xlsx", ".xls", ".csv"];
    const nameLower = f.name.toLowerCase();
    if (!allowed.some(ext => nameLower.endsWith(ext))) {
      setError("Supported formats: PDF, Excel (.xlsx / .xls), CSV"); return;
    }
    setFile(f); setError(null);
  };

  const handleStart = async () => {
    if (!file) return;
    if (!isLoggedIn()) {
      onAuthRequired?.();
      return;
    }
    setError(null);
    setUiStep(1);

    // Replace generic "Bank Account" in ledger list with user's actual bank ledger name
    // so Groq AI uses the correct name instead of defaulting to "Bank Account"
    const effectiveBankLedger = bankLedger === "__custom__" ? "Bank Account" : bankLedger;
    const ledgerLines = ledgersText.split("\n").map(l => l.trim()).filter(Boolean);
    const ledgerListWithBank = ledgerLines.map(l =>
      l.toLowerCase() === "bank account" ? effectiveBankLedger : l
    );
    // Ensure the bank ledger is in the list
    if (!ledgerListWithBank.some(l => l === effectiveBankLedger)) {
      ledgerListWithBank.unshift(effectiveBankLedger);
    }
    const ledgers = ledgerListWithBank.join(",");
    const form = new FormData();
    form.append("file", file);
    form.append("ledgers", ledgers);
    form.append("bank_ledger", effectiveBankLedger);
    form.append("company", company);

    try {
      const res = await fetch(`${BACKEND}/api/tally/pdf-smart-convert`, {
        method: "POST", body: form, headers: authH(),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || "Upload failed");
      }
      const { task_id } = await res.json();
      startPolling(task_id);
    } catch (e: any) {
      setError(e.message || "Failed to start conversion.");
      setUiStep(0);
    }
  };

  const startPolling = (tid: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (elapsedTickRef.current) clearInterval(elapsedTickRef.current);

    const t0 = Date.now();
    setStartedAt(t0);
    setElapsedSec(0);
    elapsedTickRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 1000);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND}/api/tally/pdf-smart-convert/status/${tid}`, { headers: authH() });
        if (!res.ok) return;
        const s: TaskStatus = await res.json();
        setTaskStatus(s);

        if (s.progress < 65) setUiStep(1);
        else if (s.progress < 90) setUiStep(2);

        // As soon as the first batch's transactions exist, show them — don't
        // wait for every batch to finish. The status endpoint already
        // includes the running list, so this can render immediately.
        if (s.transactions && s.transactions.length > 0) {
          setUiStep(3);
          setTransactions((s.transactions || []).map(sanitizeTransaction));
        }

        if (s.status === "done") {
          clearInterval(pollRef.current!);
          if (elapsedTickRef.current) clearInterval(elapsedTickRef.current);
          setUiStep(3);
          // Final fetch guarantees we have the fully-settled result
          // (e.g. credits_deducted), even though transactions were
          // likely already shown from the status payload above.
          const rRes = await fetch(`${BACKEND}/api/tally/pdf-smart-convert/result/${tid}`, { headers: authH() });
          const r = await rRes.json();
          setTransactions((r.transactions || []).map(sanitizeTransaction));
        }
        if (s.status === "error") {
          clearInterval(pollRef.current!);
          if (elapsedTickRef.current) clearInterval(elapsedTickRef.current);
          setError(s.error || "Processing failed.");
        }
      } catch { }
    }, 1500);
  };

  // Rough ETA: once we know how many batches are done vs total, estimate
  // remaining time from the average time-per-batch observed so far. Hidden
  // entirely until we have at least one completed batch to base it on, so
  // we never show a guess pulled out of thin air.
  const etaSeconds = (() => {
    const done = taskStatus?.batches_done ?? 0;
    const total = taskStatus?.total_batches ?? 0;
    if (!total) return null;
    if (done >= total) return 0;
    if (done > 0) {
      const avgPerBatch = elapsedSec / done;
      const remaining = (total - done) * avgPerBatch;
      return Math.max(1, Math.round(remaining));
    } else {
      const remaining = (total * 12) - elapsedSec;
      return Math.max(1, remaining);
    }
  })();

  const pageDisplayInfo = (() => {
    // When the local eng parser has already extracted transactions and we're
    // now in the ledger-mapping step, show live voucher progress instead of pages.
    const txnCount = taskStatus?.transaction_count;
    const txnsDone = taskStatus?.transactions_done ?? 0;
    const isLedgerMappingStep = taskStatus?.step?.toLowerCase().includes("mapping");
    if (txnCount && txnCount > 0 && isLedgerMappingStep) {
      const showLive = txnsDone > 0 && txnsDone < txnCount;
      return {
        showPagesToggle: true,
        text: showLive ? `${txnsDone}/${txnCount}` : `${txnCount}`,
        label: showLive ? "Vouchers" : "Vouchers",
      };
    }
    const totalPages = taskStatus?.total_pages ?? 0;
    if (totalPages > 0 && totalPages < 5) {
      const fakePagesDone = Math.min(totalPages, Math.floor(elapsedSec / 3) + 1);
      const isFinished = fakePagesDone >= totalPages;
      return {
        showPagesToggle: !isFinished,
        text: `${fakePagesDone}/${totalPages}`,
        label: "Pages",
      };
    }
    const pagesDone = taskStatus?.pages_done ?? ((taskStatus?.batches_done ?? 0) * 12);
    return {
      showPagesToggle: true,
      text: totalPages > 0 ? `${pagesDone}/${totalPages}` : `${pagesDone}`,
      label: "Pages",
    };
  })();

  const fmtDuration = (sec: number) => {
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  const editTx = useCallback((i: number, field: keyof Transaction, val: string) => {
    setTransactions(prev => {
      const next = [...prev];
      if (field === "voucherType") {
        const tx = next[i];
        const effectiveBankLedger = bankLedger === "__custom__" ? "Bank Account" : bankLedger;
        let newDirection = tx.direction;
        if (val === "Receipt") {
          newDirection = "credit";
        } else if (val === "Payment") {
          newDirection = "debit";
        }

        const updatedTx = { ...tx, voucherType: val };
        if (newDirection !== tx.direction) {
          updatedTx.direction = newDirection;
          if (newDirection === "credit") {
            const oldOther = tx.debitLedger && tx.debitLedger !== effectiveBankLedger ? tx.debitLedger : (tx.creditLedger || "Suspense A/c");
            updatedTx.debitLedger = effectiveBankLedger;
            updatedTx.creditLedger = oldOther === effectiveBankLedger ? "Suspense A/c" : oldOther;
          } else {
            const oldOther = tx.creditLedger && tx.creditLedger !== effectiveBankLedger ? tx.creditLedger : (tx.debitLedger || "Suspense A/c");
            updatedTx.creditLedger = effectiveBankLedger;
            updatedTx.debitLedger = oldOther === effectiveBankLedger ? "Suspense A/c" : oldOther;
          }
        }
        next[i] = updatedTx;
      } else {
        next[i] = { ...next[i], [field]: val };
      }
      return next;
    });
  }, [bankLedger]);

  // Combined ledger list for the editable dropdowns: configured ledgers + bank
  // ledger + "Suspense A/c" + every debit/credit ledger Gemini actually used
  // (including any newLedgerName it introduced), so nothing is missing.
  const allKnownLedgers = useMemo(() => {
    const effectiveBankLedger = bankLedger === "__custom__" ? "Bank Account" : bankLedger;
    const set = new Set<string>();
    ledgersText.split("\n").map(l => l.trim()).filter(Boolean).forEach(l => set.add(l));
    set.add(effectiveBankLedger);
    set.add("Suspense A/c");
    transactions.forEach(tx => {
      if (tx.debitLedger) set.add(tx.debitLedger);
      if (tx.creditLedger) set.add(tx.creditLedger);
      if (tx.newLedgerNeeded && tx.newLedgerName) set.add(tx.newLedgerName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [ledgersText, bankLedger, transactions]);

  const newLedgers = useMemo(() => {
    const effectiveBankLedger = bankLedger === "__custom__" ? "Bank Account" : bankLedger;
    const existingSet = new Set<string>();
    ledgersText.split("\n").map(l => l.trim()).filter(Boolean).forEach(l => existingSet.add(l.toLowerCase()));
    existingSet.add(effectiveBankLedger.toLowerCase());

    const newMap = new Map<string, { name: string; group: string }>();
    transactions.forEach(tx => {
      if (tx.newLedgerNeeded && tx.newLedgerName && !existingSet.has(tx.newLedgerName.toLowerCase())) {
        newMap.set(tx.newLedgerName, { name: tx.newLedgerName, group: tx.newLedgerGroup || "Indirect Expenses" });
      }
    });
    return Array.from(newMap.values());
  }, [transactions, ledgersText, bankLedger]);

  const allReferencedLedgers = useMemo(() => {
    const effectiveBankLedger = bankLedger === "__custom__" ? "Bank Account" : bankLedger;
    const ledgerMap = new Map<string, { name: string; group: string }>();

    // 1. Add Bank Ledger
    const bLower = effectiveBankLedger.toLowerCase();
    const bankGroup = (bLower.includes("od") || bLower.includes("loan") || bLower.includes("kcc") || bLower.includes("overdraft"))
      ? "Bank OD A/c"
      : "Bank Accounts";
    ledgerMap.set(effectiveBankLedger.toLowerCase(), { name: effectiveBankLedger, group: bankGroup });

    // 2. Add Counter-party ledgers from transactions
    transactions.forEach(tx => {
      const mappedLedger = tx.direction === "debit" ? (tx.debitLedger || "Suspense A/c") : (tx.creditLedger || "Suspense A/c");
      const key = mappedLedger.toLowerCase();

      // Exclude cash and profit & loss (pre-existing reserved names in Tally)
      if (key === "cash" || key === "profit & loss a/c" || key === "profit and loss" || key === "p&l") {
        return;
      }

      if (!ledgerMap.has(key)) {
        let group = "Indirect Expenses";
        if (tx.newLedgerNeeded && tx.newLedgerName && tx.newLedgerName.toLowerCase() === key) {
          group = tx.newLedgerGroup || "Indirect Expenses";
        } else {
          group = guessLedgerGroup(mappedLedger, tx.direction);
        }
        ledgerMap.set(key, { name: mappedLedger, group });
      }
    });

    return Array.from(ledgerMap.values());
  }, [transactions, bankLedger]);

  const handleDownloadXml = async () => {
    const effectiveBankLedger = bankLedger === "__custom__" ? "Bank Account" : bankLedger;
    const xmlContent = rebuildXML(transactions, company, effectiveBankLedger, allReferencedLedgers);

    let filename = "tally_vouchers.xml";
    if (file && file.name) {
      const dotIndex = file.name.lastIndexOf('.');
      const baseName = dotIndex !== -1 ? file.name.substring(0, dotIndex) : file.name;
      filename = `${baseName}.xml`;
    }

    // 1. Trigger immediate browser download (never blocked by upload)
    downloadBlob(xmlContent, filename);

    // 2. Save to HF storage + record in history
    if (!isLoggedIn()) {
      // Guest users get the local download only; no cloud save
      return;
    }
    if (isUploading) return; // prevent double-click
    setIsUploading(true);
    try {
      // Detect the source file extension so the backend stores the right conversion_type
      const srcExt = file?.name
        ? (file.name.lastIndexOf(".") !== -1
          ? file.name.substring(file.name.lastIndexOf(".") + 1).toLowerCase()
          : "pdf")
        : "pdf";

      const res = await fetch(`${BACKEND}/api/tally/upload-xml`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authH() },
        body: JSON.stringify({
          xml_content: xmlContent,
          filename,
          history_input_file: file?.name ?? "",
          file_ext: srcExt,
        }),
      });
      if (res.ok) {
        const { url } = await res.json();
        setUploadedUrl(url ?? null);
      } else {
        console.warn("[Tally] upload-xml returned status", res.status);
      }
    } catch (e) {
      // Non-fatal — user already has the local file
      console.warn("[Tally] history record failed (non-fatal):", e);
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setUiStep(0); setFile(null); setTaskStatus(null); setTransactions([]); setError(null);
    setUploadedUrl(null); setIsUploading(false);
    setLedgerFilter(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-[95%] mx-auto px-4 py-8 pt-20">
        <button
          onClick={() => navigate(isLoggedIn() ? "/dashboard" : "/")}
          className="flex items-center gap-2 text-sm text-[#6b8cc4] hover:text-indigo-800 transition-colors mb-6 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          {isLoggedIn() ? "Back to Dashboard" : "Back to Home"}
        </button>
        <div className="glass-card rounded-3xl shadow-xl p-6 md:p-10 relative overflow-hidden bg-white/70 dark:bg-gray-900/60 backdrop-blur-xl border border-indigo-100/20">

          {/* Decorative background gradients */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-44 h-44 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="text-center mb-8 relative">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-800 shadow-md mb-4 hover:scale-105 transition-transform duration-300"
            >
              <img src="/logo.png" alt="Acrozo Logo" className="w-10 h-10 object-contain invert dark:invert-0" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Bank Statements → ERP Tools</h1>
            <p className="text-muted-foreground text-sm mt-2 max-w-xl mx-auto leading-relaxed">
              Upload your bank statement (PDF, Excel, CSV). Acrozo extracts every transaction and generates clean import templates for your ERP Tools (e.g., Tally Prime, Marg, Busy, etc.).
            </p>
          </div>

          <StepBar active={uiStep} />

          {/* Error banner */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 mb-5">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="flex-1 text-sm text-red-700">{sanitizeErrorMessage(error)}</p>
              <button onClick={() => setError(null)}><X className="w-4 h-4 text-red-400 hover:text-red-600" /></button>
            </div>
          )}

          {/* ── Step 0: Upload ── */}
          {uiStep === 0 && (
            <div className="space-y-6">
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 select-none relative overflow-hidden group
                  ${isDragging
                    ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-lg shadow-indigo-500/5"
                    : "border-gray-200 dark:border-gray-800 hover:border-indigo-400 hover:bg-indigo-50/5 dark:hover:bg-indigo-950/5 hover:shadow-xl hover:shadow-indigo-500/5"
                  }`}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) pickFile(f); }}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />

                {file ? (
                  <div className="flex flex-col items-center justify-center space-y-4 py-2">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center border border-indigo-100/30 shadow-md">
                      <FileText className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 dark:text-gray-200 text-base max-w-md mx-auto truncate">{file.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB • {
                        file.name.toLowerCase().endsWith(".csv") ? "CSV Statement" :
                          file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls") ? "Excel Statement" :
                            "PDF Statement"
                      }</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setFile(null); }}
                      className="px-4 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 border border-red-200/30"
                    >
                      <X className="w-3.5 h-3.5" /> Remove Statement
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 py-4">
                    <div className="w-16 h-16 rounded-full bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center border border-gray-100 dark:border-gray-800 mx-auto transition-transform duration-300 group-hover:scale-110 shadow-sm group-hover:border-indigo-100">
                      <Upload className="w-7 h-7 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-700 dark:text-gray-300 text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Drop your bank statement here</p>
                      <p className="text-xs text-gray-400 mt-1">PDF, Excel (.xlsx) or CSV — or click to browse</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Configuration Panel */}
              <div className="bg-gray-50/50 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 md:p-6 space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-500 animate-pulse" /> Extraction Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">

                  {/* Left Column: Bank Ledger Name */}
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5 uppercase tracking-wide">Bank Ledger Name in Tally</label>
                    {bankLedgerOptions.length > 0 ? (
                      <select
                        className="w-full h-11 border border-gray-200 dark:border-gray-800 rounded-xl px-3.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 transition-all shadow-sm"
                        value={bankLedger}
                        onChange={e => setBankLedger(e.target.value)}
                      >
                        {bankLedgerOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        <option value="__custom__">— Type custom name —</option>
                      </select>
                    ) : (
                      <input
                        className="w-full h-11 border border-gray-200 dark:border-gray-800 rounded-xl px-3.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 transition-all shadow-sm"
                        value={bankLedger}
                        onChange={e => setBankLedger(e.target.value)}
                        placeholder="e.g. HDFC Bank Current A/c"
                      />
                    )}
                    {bankLedger === "__custom__" && (
                      <input
                        className="w-full h-11 border border-indigo-200 dark:border-indigo-900 rounded-xl px-3.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 transition-all mt-2"
                        placeholder="Type custom bank ledger name..."
                        autoFocus
                        onChange={e => setBankLedger(e.target.value)}
                      />
                    )}
                  </div>

                  {/* Right Column: Ledger directory accordion */}
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5 uppercase tracking-wide invisible select-none">Ledger Directory Spacer</label>
                    <div className="border border-gray-200 dark:border-gray-800/80 rounded-xl overflow-hidden shadow-sm bg-background">
                      {/* Always-rendered file input for Sync (HTML) */}
                      <input
                        ref={ledgerHtmlRef}
                        type="file"
                        accept=".html,.htm"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (!f) return;

                          const sniffer = new FileReader();
                          sniffer.onload = sniffEv => {
                            const buf = sniffEv.target?.result as ArrayBuffer;
                            const bytes = new Uint8Array(buf.slice(0, 4));

                            let encoding = "UTF-8";
                            if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
                              encoding = "UTF-16LE";
                            } else if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
                              encoding = "UTF-16BE";
                            }

                            const reader = new FileReader();
                            reader.onload = ev => {
                              const html = ev.target?.result as string;
                              const names = parseTallyLedgerHtml(html);
                              if (names.length > 0) {
                                setLedgersText(names.join("\n"));
                              } else {
                                alert("Could not find any ledger names in this HTML file. Please check the file.");
                              }
                            };
                            reader.readAsText(f, encoding);
                          };
                          sniffer.readAsArrayBuffer(f.slice(0, 4));
                          e.target.value = "";
                        }}
                      />

                      {/* Header bar: always visible */}
                      <div className="w-full h-11 flex items-center justify-between px-4 bg-gray-50/50 dark:bg-gray-900/30">
                        <button
                          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          onClick={() => setShowLedgers(!showLedgers)}
                        >
                          <Database className="w-3.5 h-3.5 text-indigo-500" />
                          Ledger Mapping Directory
                          <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full ml-1 border border-indigo-100/30">
                            {ledgersText.split("\n").filter(Boolean).length} Mapped
                          </span>
                          {showLedgers ? <ChevronUp className="w-4 h-4 text-gray-400 ml-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            ledgerHtmlRef.current?.click();
                          }}
                          className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg transition-all shadow-sm font-bold hover:shadow-indigo-500/10 active:scale-95 shrink-0"
                        >
                          <Upload className="w-3.5 h-3.5" /> Upload Ledger/Master (html)
                        </button>
                      </div>

                      {showLedgers && (
                        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800/50 pt-3.5 space-y-3 bg-gray-50/10">
                          <span className="text-[10px] text-gray-400 leading-tight block">
                            Export: Gateway → Display → Account Books → Ledger (Save as HTML, e.g. master.html)
                          </span>
                          <div className="space-y-1">
                            <textarea
                              className="w-full border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-[11px] font-mono text-gray-600 dark:text-gray-300 bg-background h-32 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 leading-relaxed shadow-inner"
                              value={ledgersText}
                              onChange={e => setLedgersText(e.target.value)}
                              placeholder="Type ledgers (one per line)..."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              <button
                disabled={!file}
                onClick={handleStart}
                className="w-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-700 hover:to-violet-800 text-white py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.005] disabled:from-gray-100 disabled:to-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <Sparkles className="w-4.5 h-4.5" />
                Initialize AI Parsing Pipeline
                <ArrowRight className="w-4.5 h-4.5" />
              </button>

              {/* How it works pipeline */}
              <div className="bg-gradient-to-br from-indigo-50/30 to-violet-50/10 dark:from-indigo-950/10 dark:to-violet-950/5 border border-indigo-100/10 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center border border-indigo-100/20">
                    <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">Pipeline Processing Mechanics</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-100/50 dark:bg-indigo-950/60 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 shrink-0 shadow-sm border border-indigo-200/20">1</div>
                    <div>
                      <p className="font-bold text-gray-700 dark:text-gray-300">Intelligent PDF Extraction</p>
                      <p className="text-gray-400 mt-0.5 leading-relaxed font-normal">Statements are fed into our secure OCR engine for digital, scanned, and password-secured reading.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-100/50 dark:bg-indigo-950/60 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 shrink-0 shadow-sm border border-indigo-200/20">2</div>
                    <div>
                      <p className="font-bold text-gray-700 dark:text-gray-300">Balance Integrity Check</p>
                      <p className="text-gray-400 mt-0.5 leading-relaxed font-normal">Mathematical validation aligns all credit/debit totals against the running PDF balance continuously.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-100/50 dark:bg-indigo-950/60 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 shrink-0 shadow-sm border border-indigo-200/20">3</div>
                    <div>
                      <p className="font-bold text-gray-700 dark:text-gray-300">Single-Entry XML Blueprint</p>
                      <p className="text-gray-400 mt-0.5 leading-relaxed font-normal">Generates one bank ledger entry per voucher. Tally automatically resolves the contra leg via reconciliation.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-100/50 dark:bg-indigo-950/60 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 shrink-0 shadow-sm border border-indigo-200/20">4</div>
                    <div>
                      <p className="font-bold text-gray-700 dark:text-gray-300">Review &amp; Export Gate</p>
                      <p className="text-gray-400 mt-0.5 leading-relaxed font-normal">Audited voucher assignments can be inspected, updated in bulk, and downloaded directly into Tally ERP.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Steps 1–2: Processing ── */}
          {uiStep >= 1 && uiStep <= 2 && (
            <div className="py-6 max-w-2xl mx-auto">
              <div className="glass-card rounded-3xl p-8 shadow-2xl relative overflow-hidden transition-all duration-500 border border-indigo-100/20 bg-white/70 dark:bg-gray-900/60 backdrop-blur-xl">

                {/* Decorative background gradients */}
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

                {taskStatus ? (
                  <div className="space-y-8">

                    {/* Error / Exception Panel */}
                    {taskStatus.status === "error" || error ? (
                      <div className="space-y-6 text-center transition-all duration-500">
                             {/* Error Log Box */}
                        <div className="bg-red-950/5 border border-red-200/50 dark:border-red-900/40 rounded-2xl p-4 text-left font-mono text-xs text-red-700 dark:text-red-400 overflow-y-auto max-h-40 shadow-inner backdrop-blur-sm">
                          <div className="flex items-center gap-1.5 font-bold text-red-800 dark:text-red-300 mb-2 border-b border-red-200/30 pb-1.5">
                            <Terminal className="w-3.5 h-3.5" /> Exception Traceback
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{sanitizeErrorMessage(error || taskStatus.error || "Unknown server execution fault.")}</p>
                        </div>

                        <div className="flex justify-center gap-3 pt-2">
                          <button
                            onClick={reset}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-500/10 flex items-center gap-2"
                          >
                            <RefreshCw className="w-4 h-4" /> Try Uploading Again
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* In-Progress Premium Loader */
                      <div className="space-y-7">

                        {taskStatus.status === "pending" && taskStatus.queue_position !== undefined && taskStatus.queue_position > 0 ? (
                          <div className="bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 rounded-xl p-4 text-center mb-6 shadow-sm">
                            <h3 className="text-amber-800 dark:text-amber-300 font-bold flex items-center justify-center gap-2">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Waiting in Queue
                            </h3>
                            <p className="text-amber-700 dark:text-amber-450 mt-1 text-sm font-semibold">
                              Position in queue: <span className="text-lg text-amber-600 dark:text-amber-300 mx-1">{taskStatus.queue_position}</span>
                            </p>
                            <p className="text-amber-600/80 dark:text-amber-500 mt-0.5 text-xs">
                              Please wait, your document will be processed as soon as a slot is available.
                            </p>
                          </div>
                        ) : null}

                        {/* Circular animated loading status */}
                        <div className="flex flex-col items-center text-center">
                          <p className="text-sm text-amber-600 dark:text-amber-400/80 font-semibold max-w-md mx-auto mb-6 animate-pulse">
                            Please be patient, the process will take a few minutes or more depending on your PDF pages & Transaction Count.
                          </p>
                          <div className="relative flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-tr from-indigo-500/10 to-violet-500/10 dark:from-indigo-500/15 dark:to-violet-500/15 shadow-[0_0_30px_rgba(99,102,241,0.15)] border border-indigo-200/30 dark:border-indigo-900/40 mb-4">
                            <div className="absolute inset-1 rounded-full bg-white/90 dark:bg-gray-900 flex flex-col items-center justify-center backdrop-blur-md">
                              {!pageDisplayInfo.showPagesToggle || elapsedSec % 2 === 0 ? (
                                <span className="text-sm font-extrabold text-gray-700 dark:text-gray-200 tabular-nums">
                                  {fmtDuration(elapsedSec)}
                                </span>
                              ) : (
                                <div className="text-center">
                                  <span className="text-base font-extrabold text-indigo-650 dark:text-indigo-400 block leading-none">
                                    {pageDisplayInfo.text}
                                  </span>
                                  <span className="text-[9px] text-gray-400 font-bold block mt-1 uppercase tracking-wider leading-none">
                                    {pageDisplayInfo.label}
                                  </span>
                                </div>
                              )}
                            </div>
                            {/* Spinning outer ring */}
                            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary-blue border-r-indigo-500 animate-spin" />
                          </div>
                          <div className="mb-4">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                              {taskStatus.progress >= 95 ? "Finalizing Vouchers..." : "Processing Document"}
                            </h3>
                            <p className="text-xs text-gray-450 mt-0.5 font-medium">Please keep this window open while the AI parses data</p>
                          </div>

                          <div className="flex justify-center pt-1 mb-4">
                            <button
                              onClick={reset}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/25 dark:border-red-950/40 font-bold text-xs px-4.5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
                            >
                              <X className="w-3.5 h-3.5" /> Stop & Start Over
                            </button>
                          </div>
                        </div>

                        {/* Current step label */}
                        <div className="text-center font-bold text-sm text-indigo-655 dark:text-indigo-400 tracking-wide">
                          {taskStatus.step}
                        </div>

                        {/* Checkpoint Pipeline cards */}
                        <div className="grid grid-cols-3 gap-3 text-center text-xs text-gray-500">
                          {[
                            { label: "Reading statement", done: taskStatus.progress >= 10 },
                            { label: "Extracting transactions", done: (taskStatus.batches_done ?? 0) > 0 },
                            { label: "Ledger mapping", done: taskStatus.status === "done" },
                          ].map((s, i) => (
                            <div
                              key={i}
                              className={`rounded-2xl p-3.5 flex flex-col items-center gap-2.5 transition-all duration-300 border backdrop-blur-sm
                                ${s.done
                                  ? "border-emerald-250/20 bg-emerald-500/5 dark:bg-emerald-950/15 text-emerald-700 dark:text-emerald-400 shadow-sm"
                                  : "border-white/10 dark:border-white/5 bg-white/20 dark:bg-gray-950/10 text-gray-400"}`}
                            >
                              {s.done ? (
                                <div className="w-7 h-7 rounded-full bg-emerald-100/60 dark:bg-emerald-950/40 flex items-center justify-center border border-emerald-200/30">
                                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                </div>
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-white/10 dark:bg-gray-800 flex items-center justify-center border border-white/10">
                                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                                </div>
                              )}
                              <span className={`font-semibold tracking-wide ${s.done ? "text-emerald-700 dark:text-emerald-300" : ""}`}>
                                {s.label}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Live voucher progress — shown only during ledger mapping */}
                        {(() => {
                          const txnTotal = taskStatus.transaction_count ?? 0;
                          const txnDone = taskStatus.transactions_done ?? 0;
                          const isMappingStep = taskStatus.step?.toLowerCase().includes("mapping");
                          if (!isMappingStep || txnTotal === 0) return null;
                          const pct = Math.min(100, Math.round((txnDone / txnTotal) * 100));
                          return (
                            <div className="mt-1 space-y-1.5 px-1">
                              <div className="flex items-center justify-between text-xs font-semibold">
                                <span className="text-indigo-650 dark:text-indigo-400 flex items-center gap-1.5">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  Mapping vouchers to ledgers
                                </span>
                                <span className="text-gray-700 dark:text-gray-200 tabular-nums font-bold">
                                  {txnDone}/{txnTotal}
                                  <span className="text-gray-400 font-normal ml-1">({pct}%)</span>
                                </span>
                              </div>
                              <div className="h-2 bg-indigo-100 dark:bg-indigo-950/40 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-primary-blue to-indigo-600 rounded-full transition-all duration-700"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}

                      </div>
                    )}
                  </div>
                ) : (
                  /* Initial upload/buffer stage */
                  <div className="flex flex-col items-center justify-center py-10 space-y-4">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Uploading File to Engine</p>
                      <p className="text-xs text-gray-400 mt-1">Establishing secure SSL connection to parser workers...</p>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ── Step 3: Review ── */}
          {uiStep === 3 && transactions.length > 0 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Review Transactions</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Click any row to edit both ledgers (Dr/Cr). ⚠ Yellow = balance mismatch. 🔴 Red = Suspense A/c (unclear narration).</p>
                </div>
              </div>

              {/* New ledger warning */}
              {newLedgers.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-yellow-800 mb-2">New ledgers to be created:</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {newLedgers.map((l, i) => (
                      <button
                        key={i}
                        onClick={() => setLedgerFilter(l.name)}
                        title={`Click to filter transactions by ${l.name}`}
                        className="px-2.5 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 border border-yellow-200/50"
                      >
                        <span>{l.name}</span>
                        <span className="text-yellow-600 font-normal">({l.group})</span>
                        <Filter className="w-3 h-3 text-yellow-600" />
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-yellow-700">
                    ⚡ Ledger definitions are already included directly in the vouchers XML file. Click any ledger above to filter the table.
                  </p>
                </div>
              )}

              <TxnTable
                txns={transactions}
                onEdit={editTx}
                knownLedgers={allKnownLedgers}
                ledgerFilter={ledgerFilter}
                onClearLedgerFilter={() => setLedgerFilter(null)}
                onBulkEdit={(indices, field, val) => {
                  const effectiveBankLedger = bankLedger === "__custom__" ? "Bank Account" : bankLedger;
                  setTransactions(prev => prev.map((tx, i) => {
                    if (!indices.has(i)) return tx;
                    if (field === "ledger") {
                      return {
                        ...tx,
                        debitLedger: tx.direction === "debit" ? val : tx.debitLedger,
                        creditLedger: tx.direction === "credit" ? val : tx.creditLedger,
                      };
                    }
                    if (field === "voucherType") {
                      let newDirection = tx.direction;
                      if (val === "Receipt") {
                        newDirection = "credit";
                      } else if (val === "Payment") {
                        newDirection = "debit";
                      }

                      const updatedTx = { ...tx, voucherType: val };
                      if (newDirection !== tx.direction) {
                        updatedTx.direction = newDirection;
                        if (newDirection === "credit") {
                          const oldOther = tx.debitLedger && tx.debitLedger !== effectiveBankLedger ? tx.debitLedger : (tx.creditLedger || "Suspense A/c");
                          updatedTx.debitLedger = effectiveBankLedger;
                          updatedTx.creditLedger = oldOther === effectiveBankLedger ? "Suspense A/c" : oldOther;
                        } else {
                          const oldOther = tx.creditLedger && tx.creditLedger !== effectiveBankLedger ? tx.creditLedger : (tx.debitLedger || "Suspense A/c");
                          updatedTx.creditLedger = effectiveBankLedger;
                          updatedTx.debitLedger = oldOther === effectiveBankLedger ? "Suspense A/c" : oldOther;
                        }
                      }
                      return updatedTx;
                    }
                    return { ...tx, [field]: val };
                  }));
                }}
              />

              {/* Loading indicator for transactions still being analyzed in
                  the background. Deliberately shows only elapsed time, an
                  ETA, and a percent-complete bar — never page/batch counts,
                  which are an internal implementation detail. */}
              {taskStatus && taskStatus.status !== "done" && taskStatus.status !== "error" && (
                <div className="space-y-2 py-3 px-4 text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing more transactions…
                    </span>
                    <span className="text-xs text-indigo-500 font-medium whitespace-nowrap">
                      {fmtDuration(elapsedSec)} elapsed
                      {etaSeconds !== null && ` · ~${fmtDuration(etaSeconds)} left`}
                    </span>
                  </div>
                  {taskStatus.total_batches ? (
                    <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(100, Math.round(((taskStatus.batches_done ?? 0) / taskStatus.total_batches) * 100))}%`,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              )}

              {/* Downloads */}
              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  onClick={handleDownloadXml}
                  disabled={isUploading || (!!taskStatus && taskStatus.status !== "done" && taskStatus.status !== "error")}
                  className="flex-[3] min-w-[200px] bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-70 transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving to cloud…
                    </>
                  ) : taskStatus && taskStatus.status !== "done" && taskStatus.status !== "error" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Waiting for all batches…
                    </>
                  ) : uploadedUrl ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-300" />
                      Download Tally Voucher XML
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download Tally Voucher XML
                    </>
                  )}
                </button>

                <button
                  onClick={reset}
                  className="flex-[1] min-w-[120px] bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer shadow-md shadow-red-500/10 hover:shadow-lg"
                >
                  <RefreshCw className="w-4 h-4" />
                  Start Over
                </button>
              </div>

              {/* Upload success notice */}
              {uploadedUrl && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  <span>
                    {uploadedUrl && uploadedUrl.includes("xml-fallback")
                      ? <>File temporarily saved. Download from <strong>History</strong> within the next hour (HF bucket unavailable).</>
                      : <>File saved to cloud. You can download it anytime from <strong>History</strong>.</>
                    }
                  </span>
                </div>
              )}

              {/* Import guide */}
              <div className="pt-2">
                <div className="border rounded-xl p-4 bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900/30">
                  <p className="text-sm font-semibold mb-2 text-green-800 dark:text-green-300">Importing to Tally</p>
                  {file && (file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls") || file.name.toLowerCase().endsWith(".csv")) && (
                    <p className="text-xs mb-2 text-indigo-700 dark:text-indigo-400 font-medium">
                      ✨ Excel/CSV processed at half credit cost — only ledger mapping charged.
                    </p>
                  )}
                  <ol className="text-xs space-y-1 list-decimal list-inside text-green-700 dark:text-green-400/85">
                    <li>Download the generated XML file (which automatically includes any new ledger master definitions).</li>
                    <li>Go to Tally → Gateway of Tally → Import Data.</li>
                    <li>Choose <strong>Vouchers</strong> and browse to the downloaded file.</li>
                    <li>Accept the import and verify the transactions in the Day Book.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
