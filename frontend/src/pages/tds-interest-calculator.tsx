import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator,
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  Info,
  Calendar,
  Layers,
  Sparkles
} from "lucide-react";
import { useLocation } from "wouter";

type CalcType = "late_deduction" | "late_payment" | "late_filing";

export default function TdsInterestCalculatorPage() {
  const [, navigate] = useLocation();
  const [amount, setAmount] = useState<number>(100000);
  const [calcType, setCalcType] = useState<CalcType>("late_deduction");

  // Dates (stored as YYYY-MM-DD strings)
  const [date1, setDate1] = useState<string>("");
  const [date2, setDate2] = useState<string>("");

  const [copied, setCopied] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Calculated values
  const [results, setResults] = useState({
    duration: 0,
    rate: 0,
    interest: 0,
    total: 0
  });

  const getLocalDate = (dateStr: string) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  useEffect(() => {
    const amt = amount || 0;
    const d1 = getLocalDate(date1);
    const d2 = getLocalDate(date2);

    if (!d1 || !d2 || d2 <= d1) {
      setResults({ duration: 0, rate: 0, interest: 0, total: amt });
      return;
    }

    if (calcType === "late_deduction" || calcType === "late_payment") {
      // Month-based calculation
      const months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) + 1;
      const rate = calcType === "late_deduction" ? 1.0 : 1.5;
      const interest = amt * (rate / 100) * months;
      setResults({
        duration: months,
        rate,
        interest,
        total: amt + interest
      });
    } else {
      // Day-based calculation (Late filing fee of Rs. 200 per day capped at TDS amount)
      const diffTime = Math.abs(d2.getTime() - d1.getTime());
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const rate = 200; // Rs. 200 per day
      const interest = Math.min(amt, days * rate);
      setResults({
        duration: days,
        rate,
        interest,
        total: amt + interest
      });
    }
  }, [amount, calcType, date1, date2]);

  const copyToClipboard = (val: number, fieldName: string) => {
    navigator.clipboard.writeText(val.toFixed(2));
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleCopySummary = () => {
    const d1Formatted = date1 ? new Date(date1).toLocaleDateString("en-IN") : "N/A";
    const d2Formatted = date2 ? new Date(date2).toLocaleDateString("en-IN") : "N/A";
    
    let label1 = "";
    let label2 = "";
    let durationLabel = "";
    let rateLabel = "";

    if (calcType === "late_deduction") {
      label1 = "Deductible Due Date";
      label2 = "Actual Deduction Date";
      durationLabel = `${results.duration} Month(s)`;
      rateLabel = "1.0% per month";
    } else if (calcType === "late_payment") {
      label1 = "Date of Deduction";
      label2 = "Actual Deposit Date";
      durationLabel = `${results.duration} Month(s)`;
      rateLabel = "1.5% per month";
    } else {
      label1 = "Filing Due Date";
      label2 = "Actual Filing Date";
      durationLabel = `${results.duration} Day(s)`;
      rateLabel = "₹200 per day (capped at TDS)";
    }

    const summaryText = `--- Acrozo TDS Interest Calculation ---
TDS Tax Amount: ₹${amount.toFixed(2)}
Calculation Type: ${calcType.replace("_", " ").toUpperCase()}
------------------------------------
${label1}: ${d1Formatted}
${label2}: ${d2Formatted}
Calculated Delay: ${durationLabel}
Applied Rate: ${rateLabel}
------------------------------------
TDS Interest/Fee: ₹${results.interest.toFixed(2)}
Total Outstanding: ₹${results.total.toFixed(2)}
------------------------------------
Generated via Acrozo Tools`;

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setAmount(100000);
    setCalcType("late_deduction");
    setDate1("");
    setDate2("");
  };

  return (
    <div>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 pt-24">
        <button
          onClick={() => navigate("/tally-tools")}
          className="flex items-center gap-2 text-sm text-[#6b8cc4] hover:text-[#5c7ab5] transition-colors mb-6 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to More Tools
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl mb-4 text-[#7f9eff] dark:text-[#8ba6fc] shadow-md">
            <Calculator className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Acrozo TDS Interest Calculator</h1>
          <p className="text-muted-foreground mt-2 max-w-lg mx-auto text-sm sm:text-base">
            Calculate TDS interest under Sec 201(1A) for late deduction or late payment, and late filing fees under Sec 234E instantly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Inputs Section */}
          <div className="md:col-span-7 bg-card border border-card-border rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
              <Layers className="w-5 h-5 text-primary shrink-0" /> Calculation Settings
            </h2>

            {/* TDS Amount */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Enter Amount Of Tax Deducted (₹)
              </label>
              <div className="relative rounded-xl overflow-hidden shadow-inner border border-input">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-lg">₹</span>
                <input
                  type="number"
                  className="w-full pl-10 pr-4 py-3 bg-background text-foreground text-lg focus:outline-none focus:ring-2 focus:ring-primary/20 border-0"
                  value={amount === 0 ? "" : amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="e.g. 100000"
                />
              </div>
            </div>

            {/* Calculation Type */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Type Of Interest Calculation
              </label>
              <select
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                value={calcType}
                onChange={(e) => {
                  setCalcType(e.target.value as CalcType);
                  setDate1("");
                  setDate2("");
                }}
              >
                <option value="late_deduction">Interest on Late Deduction (1% p.m.)</option>
                <option value="late_payment">Interest on Late Payment (1.5% p.m.)</option>
                <option value="late_filing">Late Filing Fee (₹200/day under 234E)</option>
              </select>
            </div>

            {/* Dates Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  {calcType === "late_deduction"
                    ? "Date Tax Was Deductible"
                    : calcType === "late_payment"
                    ? "Date Of Tax Deduction"
                    : "Due Date of Filing"}
                </label>
                <div className="relative rounded-xl overflow-hidden border border-input">
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 bg-background text-foreground text-sm focus:outline-none"
                    value={date1}
                    onChange={(e) => setDate1(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  {calcType === "late_deduction"
                    ? "Actual Date of Deduction"
                    : calcType === "late_payment"
                    ? "Actual Date of Deposit/Payment"
                    : "Actual Date of Filing"}
                </label>
                <div className="relative rounded-xl overflow-hidden border border-input">
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 bg-background text-foreground text-sm focus:outline-none"
                    value={date2}
                    onChange={(e) => setDate2(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {date1 && date2 && getLocalDate(date2)! <= getLocalDate(date1)! && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-100 dark:border-yellow-900/30 rounded-xl flex items-start gap-2.5">
                <Info className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                  The completion date must be later than the start/due date to calculate interest.
                </p>
              </div>
            )}
          </div>

          {/* Results Summary Section */}
          <div className="md:col-span-5 bg-gradient-to-br from-[#304d8c] to-[#121f3b] text-white rounded-2xl shadow-xl p-6 sm:p-8 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-white shrink-0" /> Interest Output
                </h2>
                <button
                  onClick={handleReset}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
                  title="Reset Calculation"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Base TDS Tax */}
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-sm text-blue-100/70">Base TDS Amount</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg tabular-nums">₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <button
                    onClick={() => copyToClipboard(amount, "base")}
                    className="p-1 hover:bg-white/10 rounded transition-colors text-blue-200 hover:text-white"
                    title="Copy Base Amount"
                  >
                    {copiedField === "base" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Delay Duration */}
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-sm text-blue-100/70">
                  {calcType === "late_filing" ? "Delay (Days)" : "Delay (Months)"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg tabular-nums">
                    {results.duration} {calcType === "late_filing" ? "Days" : "Month(s)"}
                  </span>
                  <button
                    onClick={() => copyToClipboard(results.duration, "duration")}
                    className="p-1 hover:bg-white/10 rounded transition-colors text-blue-200 hover:text-white"
                    title="Copy Delay Duration"
                  >
                    {copiedField === "duration" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Interest Rate */}
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-sm text-blue-100/70">Applied Rate</span>
                <span className="font-semibold text-sm">
                  {calcType === "late_deduction"
                    ? "1.0% per month"
                    : calcType === "late_payment"
                    ? "1.5% per month"
                    : "₹200 per day"}
                </span>
              </div>

              {/* Calculated Interest */}
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-sm text-blue-100/70">
                  {calcType === "late_filing" ? "Late Filing Fee (234E)" : "TDS Interest (201(1A))"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-[#a5bcff] tabular-nums">₹{results.interest.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <button
                    onClick={() => copyToClipboard(results.interest, "interest")}
                    className="p-1 hover:bg-white/10 rounded transition-colors text-[#a5bcff] hover:text-white"
                    title="Copy Interest Amount"
                  >
                    {copiedField === "interest" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Total Outstanding */}
              <div className="flex justify-between items-center py-4 bg-white/5 rounded-xl px-4 mt-4 border border-white/10">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-blue-200/60 uppercase tracking-wider">Total Amount Payable</span>
                  <span className="text-3xl font-extrabold text-white tabular-nums">₹{results.total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(results.total, "total")}
                  className="p-2 hover:bg-white/15 rounded-lg transition-colors text-blue-200 hover:text-white shrink-0"
                  title="Copy Total Amount"
                >
                  {copiedField === "total" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="mt-8 pt-4">
              <button
                onClick={handleCopySummary}
                className="w-full py-3.5 bg-white text-[#121f3b] hover:bg-[#e8eeff] rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm shadow-md"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-[#415e9b]" /> Copied summary!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy Calculation Summary
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Info/Guide Section */}
        <div className="bg-white dark:bg-card border border-card-border rounded-xl p-6 mt-12 shadow-sm">
          <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" /> TDS Interest & Fee Guide (India)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-muted-foreground font-normal">
            <div>
              <h4 className="font-semibold text-foreground mb-1">Late Deduction (Sec 201(1A)(i))</h4>
              <p className="text-xs leading-relaxed">
                If tax is not deducted on time, interest is charged at **1% per month** (or part of a month) from the date tax was deductible to the actual date of deduction.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Late Payment (Sec 201(1A)(ii))</h4>
              <p className="text-xs leading-relaxed">
                If tax is deducted but not deposited on time, interest is charged at **1.5% per month** (or part of a month) from the date of deduction to the actual date of payment.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Late Filing Fee (Sec 234E)</h4>
              <p className="text-xs leading-relaxed">
                If the TDS return is filed after the due date, a fee of **₹200 per day** is charged from the due date until the return is filed. Total fee is capped at the TDS amount.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
