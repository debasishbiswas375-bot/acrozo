import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator,
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  Info,
  DollarSign,
  Briefcase,
  SlidersHorizontal,
  BarChart3
} from "lucide-react";
import { useLocation } from "wouter";

const GST_RATES = [5, 12, 18, 28];

export default function GstCalculatorPage() {
  const [, navigate] = useLocation();
  const [amount, setAmount] = useState<number>(1000);
  const [customRate, setCustomRate] = useState<string>("");
  const [selectedRate, setSelectedRate] = useState<number>(18);
  const [isCustomRate, setIsCustomRate] = useState<boolean>(false);
  const [gstType, setGstType] = useState<"exclude" | "include">("exclude");
  const [stateType, setStateType] = useState<"intra" | "inter">("intra");
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (val: number, fieldName: string) => {
    navigator.clipboard.writeText(val.toFixed(2));
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 1500);
  };

  // Calculated values
  const [calculations, setCalculations] = useState({
    netAmount: 0,
    gstAmount: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    totalAmount: 0,
  });

  const activeRate = isCustomRate ? parseFloat(customRate) || 0 : selectedRate;

  useEffect(() => {
    const amt = amount || 0;
    const rate = activeRate;

    let netAmount = 0;
    let gstAmount = 0;
    let totalAmount = 0;

    if (gstType === "exclude") {
      // Exclude GST: amount is net amount, GST is added on top
      netAmount = amt;
      gstAmount = amt * (rate / 100);
      totalAmount = amt + gstAmount;
    } else {
      // Include GST: amount is gross amount, GST is extracted
      totalAmount = amt;
      netAmount = amt / (1 + rate / 100);
      gstAmount = amt - netAmount;
    }

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (stateType === "intra") {
      cgst = gstAmount / 2;
      sgst = gstAmount / 2;
    } else {
      igst = gstAmount;
    }

    setCalculations({
      netAmount,
      gstAmount,
      cgst,
      sgst,
      igst,
      totalAmount,
    });
  }, [amount, activeRate, gstType, stateType]);

  const handleCopy = () => {
    const typeLabel = gstType === "exclude" ? "Exclude GST (Add GST)" : "Include GST (Retrieve GST)";
    const stateLabel = stateType === "intra" ? "Intra-State (CGST + SGST)" : "Inter-State (IGST)";
    const taxBreakdown = stateType === "intra" 
      ? `CGST (9.00%): ₹${calculations.cgst.toFixed(2)}\nSGST (9.00%): ₹${calculations.sgst.toFixed(2)}`
      : `IGST (18.00%): ₹${calculations.igst.toFixed(2)}`;

    const text = `--- Acrozo GST Calculation ---
Base Amount: ₹${amount.toFixed(2)}
GST Rate: ${activeRate}%
Calculation Mode: ${typeLabel}
Location: ${stateLabel}
----------------------------
Net Amount (Excl. Tax): ₹${calculations.netAmount.toFixed(2)}
Total GST Tax: ₹${calculations.gstAmount.toFixed(2)}
${taxBreakdown}
Gross Amount (Incl. Tax): ₹${calculations.totalAmount.toFixed(2)}
----------------------------
Generated via Acrozo Tools`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setAmount(1000);
    setSelectedRate(18);
    setIsCustomRate(false);
    setCustomRate("");
    setGstType("exclude");
    setStateType("intra");
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
          <div className="inline-flex items-center justify-center p-3 bg-[#e8eeff] dark:bg-[#20365f]/30 rounded-2xl mb-4 text-[#7f9eff] dark:text-[#8ba6fc] shadow-md">
            <Calculator className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Acrozo GST Calculator</h1>
          <p className="text-muted-foreground mt-2 max-w-lg mx-auto text-sm sm:text-base">
            Calculate Goods and Services Tax (GST) values instantly with custom rate settings, CGST/SGST splitting, and detail exports.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Inputs Section */}
          <div className="md:col-span-7 bg-card border border-card-border rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
              <SlidersHorizontal className="w-5 h-5 text-primary shrink-0" /> Calculation Inputs
            </h2>

            {/* Base Amount */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Base Amount (₹)
              </label>
              <div className="relative rounded-xl overflow-hidden shadow-inner border border-input">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-lg">₹</span>
                <input
                  type="number"
                  className="w-full pl-10 pr-4 py-3 bg-background text-foreground text-lg focus:outline-none focus:ring-2 focus:ring-primary/20 border-0"
                  value={amount === 0 ? "" : amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="e.g. 1000"
                />
              </div>
            </div>

            {/* GST Rate */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                GST Rate (%)
              </label>
              <div className="grid grid-cols-5 gap-2">
                {GST_RATES.map((rate) => (
                  <button
                    key={rate}
                    onClick={() => {
                      setSelectedRate(rate);
                      setIsCustomRate(false);
                    }}
                    className={`py-2 px-1 text-sm font-bold rounded-lg border transition-all ${
                      !isCustomRate && selectedRate === rate
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background text-muted-foreground hover:bg-muted border-input"
                    }`}
                  >
                    {rate}%
                  </button>
                ))}
                <button
                  onClick={() => setIsCustomRate(true)}
                  className={`py-2 px-1 text-sm font-bold rounded-lg border transition-all ${
                    isCustomRate
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background text-muted-foreground hover:bg-muted border-input"
                  }`}
                >
                  Custom
                </button>
              </div>

              <AnimatePresence>
                {isCustomRate && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden pt-2"
                  >
                    <div className="relative rounded-xl overflow-hidden border border-input">
                      <input
                        type="number"
                        className="w-full px-4 py-2.5 bg-background text-foreground text-sm focus:outline-none"
                        value={customRate}
                        onChange={(e) => setCustomRate(e.target.value)}
                        placeholder="Enter custom percentage (e.g. 18.5)"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">%</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Include / Exclude GST */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Calculation Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setGstType("exclude")}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                    gstType === "exclude"
                      ? "bg-primary/5 border-primary text-primary shadow-sm"
                      : "bg-background text-muted-foreground hover:bg-muted border-input"
                  }`}
                >
                  <span className="text-sm font-bold">Exclude GST</span>
                  <span className="text-[10px] opacity-75">Add GST on top of amount</span>
                </button>
                <button
                  onClick={() => setGstType("include")}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                    gstType === "include"
                      ? "bg-primary/5 border-primary text-primary shadow-sm"
                      : "bg-background text-muted-foreground hover:bg-muted border-input"
                  }`}
                >
                  <span className="text-sm font-bold">Include GST</span>
                  <span className="text-[10px] opacity-75">Retrieve GST from total amount</span>
                </button>
              </div>
            </div>

            {/* State Type */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Tax Type Split
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setStateType("intra")}
                  className={`p-3 rounded-lg border text-xs font-semibold transition-all ${
                    stateType === "intra"
                      ? "bg-primary/5 border-primary text-primary shadow-sm"
                      : "bg-background text-muted-foreground hover:bg-muted border-input"
                  }`}
                >
                  Intra-State (CGST + SGST)
                </button>
                <button
                  onClick={() => setStateType("inter")}
                  className={`p-3 rounded-lg border text-xs font-semibold transition-all ${
                    stateType === "inter"
                      ? "bg-primary/5 border-primary text-primary shadow-sm"
                      : "bg-background text-muted-foreground hover:bg-muted border-input"
                  }`}
                >
                  Inter-State (IGST)
                </button>
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="md:col-span-5 bg-gradient-to-br from-[#304d8c] to-[#121f3b] text-white rounded-2xl shadow-xl p-6 sm:p-8 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-white shrink-0" /> Summary Output
                </h2>
                <button
                  onClick={handleReset}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
                  title="Reset Calculation"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Net Amount */}
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-sm text-blue-100/70">Net Amount (Excl. Tax)</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg tabular-nums">₹{calculations.netAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <button
                    onClick={() => copyToClipboard(calculations.netAmount, "net")}
                    className="p-1 hover:bg-white/10 rounded transition-colors text-blue-200 hover:text-white"
                    title="Copy Net Amount"
                  >
                    {copiedField === "net" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* CGST + SGST / IGST Splits */}
              {stateType === "intra" ? (
                <>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-sm text-blue-100/70">CGST ({(activeRate / 2).toFixed(1)}%)</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm tabular-nums">₹{calculations.cgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <button
                        onClick={() => copyToClipboard(calculations.cgst, "cgst")}
                        className="p-1 hover:bg-white/10 rounded transition-colors text-blue-200 hover:text-white"
                        title="Copy CGST"
                      >
                        {copiedField === "cgst" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-sm text-blue-100/70">SGST ({(activeRate / 2).toFixed(1)}%)</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm tabular-nums">₹{calculations.sgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <button
                        onClick={() => copyToClipboard(calculations.sgst, "sgst")}
                        className="p-1 hover:bg-white/10 rounded transition-colors text-blue-200 hover:text-white"
                        title="Copy SGST"
                      >
                        {copiedField === "sgst" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-blue-100/70">IGST ({activeRate.toFixed(1)}%)</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm tabular-nums">₹{calculations.igst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <button
                      onClick={() => copyToClipboard(calculations.igst, "igst")}
                      className="p-1 hover:bg-white/10 rounded transition-colors text-blue-200 hover:text-white"
                      title="Copy IGST"
                    >
                      {copiedField === "igst" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Total GST */}
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-sm text-blue-100/70">Total Tax Amount (GST)</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-[#a5bcff] tabular-nums">₹{calculations.gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <button
                    onClick={() => copyToClipboard(calculations.gstAmount, "gst")}
                    className="p-1 hover:bg-white/10 rounded transition-colors text-[#a5bcff] hover:text-white"
                    title="Copy GST Amount"
                  >
                    {copiedField === "gst" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Gross Amount */}
              <div className="flex justify-between items-center py-4 bg-white/5 rounded-xl px-4 mt-4 border border-white/10">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-blue-200/60 uppercase tracking-wider">Gross Amount (Incl. Tax)</span>
                  <span className="text-3xl font-extrabold text-white tabular-nums">₹{calculations.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(calculations.totalAmount, "gross")}
                  className="p-2 hover:bg-white/15 rounded-lg transition-colors text-blue-200 hover:text-white shrink-0"
                  title="Copy Gross Amount"
                >
                  {copiedField === "gross" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="mt-8 pt-4 space-y-3">
              <button
                onClick={handleCopy}
                className="w-full py-3.5 bg-white text-[#121f3b] hover:bg-[#e8eeff] rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm shadow-md"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-[#415e9b]" /> Copied summary!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy Tax Breakdown
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* GST Info Section */}
        <div className="bg-white dark:bg-card border border-card-border rounded-xl p-6 mt-12 shadow-sm">
          <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" /> Goods & Services Tax (GST) Guide
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-muted-foreground">
            <div>
              <h4 className="font-semibold text-foreground mb-1">What is Intra-State?</h4>
              <p className="text-xs leading-relaxed">Transactions within the same state. Split equally into CGST (Central GST) and SGST (State GST).</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">What is Inter-State?</h4>
              <p className="text-xs leading-relaxed">Transactions between different states. Covered under a single tax category called IGST (Integrated GST).</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Calculation Rules</h4>
              <p className="text-xs leading-relaxed">Include mode extracts the tax portion embedded in the total. Exclude mode applies the tax percentage on top of base amount.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
