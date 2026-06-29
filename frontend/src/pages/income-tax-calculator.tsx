import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator,
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  Info,
  ChevronRight,
  TrendingUp,
  Sliders,
  DollarSign,
  Briefcase
} from "lucide-react";
import { useLocation } from "wouter";

type TabType = "basic" | "income" | "deductions";

interface Slab {
  limit: number;
  rate: number;
}

interface TaxRule {
  newSlabs: Slab[];
  newStdDeduction: number;
  newRebateThreshold: number;
  newMaxRebate: number;
  oldStdDeduction: number;
  oldRebateThreshold: number;
  oldMaxRebate: number;
}

const taxRules: Record<string, TaxRule> = {
  "2024-2025": {
    newSlabs: [
      { limit: 300000, rate: 0 },
      { limit: 700000, rate: 0.05 },
      { limit: 1000000, rate: 0.10 },
      { limit: 1200000, rate: 0.15 },
      { limit: 1500000, rate: 0.20 },
      { limit: Infinity, rate: 0.30 }
    ],
    newStdDeduction: 75000,
    newRebateThreshold: 700000,
    newMaxRebate: 20000,
    oldStdDeduction: 50000,
    oldRebateThreshold: 500000,
    oldMaxRebate: 12500
  },
  "2025-2026": {
    newSlabs: [
      { limit: 400000, rate: 0 },
      { limit: 800000, rate: 0.05 },
      { limit: 1200000, rate: 0.10 },
      { limit: 1600000, rate: 0.15 },
      { limit: 2000000, rate: 0.20 },
      { limit: 2400000, rate: 0.25 },
      { limit: Infinity, rate: 0.30 }
    ],
    newStdDeduction: 75000,
    newRebateThreshold: 1200000,
    newMaxRebate: 60000,
    oldStdDeduction: 50000,
    oldRebateThreshold: 500000,
    oldMaxRebate: 12500
  },
  "2026-2027": {
    newSlabs: [
      { limit: 400000, rate: 0 },
      { limit: 800000, rate: 0.05 },
      { limit: 1200000, rate: 0.10 },
      { limit: 1600000, rate: 0.15 },
      { limit: 2000000, rate: 0.20 },
      { limit: 2400000, rate: 0.25 },
      { limit: Infinity, rate: 0.30 }
    ],
    newStdDeduction: 75000,
    newRebateThreshold: 1200000,
    newMaxRebate: 60000,
    oldStdDeduction: 50000,
    oldRebateThreshold: 500000,
    oldMaxRebate: 12500
  },
  "2027-2028": {
    newSlabs: [
      { limit: 400000, rate: 0 },
      { limit: 800000, rate: 0.05 },
      { limit: 1200000, rate: 0.10 },
      { limit: 1600000, rate: 0.15 },
      { limit: 2000000, rate: 0.20 },
      { limit: 2400000, rate: 0.25 },
      { limit: Infinity, rate: 0.30 }
    ],
    newStdDeduction: 75000,
    newRebateThreshold: 1200000,
    newMaxRebate: 60000,
    oldStdDeduction: 50000,
    oldRebateThreshold: 500000,
    oldMaxRebate: 12500
  },
  "2028-2029": {
    newSlabs: [
      { limit: 400000, rate: 0 },
      { limit: 800000, rate: 0.05 },
      { limit: 1200000, rate: 0.10 },
      { limit: 1600000, rate: 0.15 },
      { limit: 2000000, rate: 0.20 },
      { limit: 2400000, rate: 0.25 },
      { limit: Infinity, rate: 0.30 }
    ],
    newStdDeduction: 75000,
    newRebateThreshold: 1200000,
    newMaxRebate: 60000,
    oldStdDeduction: 50000,
    oldRebateThreshold: 500000,
    oldMaxRebate: 12500
  }
};

export default function IncomeTaxCalculatorPage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("basic");

  // State - Basic Details
  const [financialYear, setFinancialYear] = useState<string>("2026-2027");
  const [ageGroup, setAgeGroup] = useState<"general" | "senior" | "super_senior">("general");
  const [isSalaried, setIsSalaried] = useState<boolean>(true);
  const [selectedRegime, setSelectedRegime] = useState<"both" | "new" | "old">("both");

  // State - Income Sources (as per updated screenshot)
  const [salaryIncome, setSalaryIncome] = useState<number>(1200000);
  const [interestIncome, setInterestIncome] = useState<number>(20000);
  const [rentalIncome, setRentalIncome] = useState<number>(0);
  const [digitalAssetsIncome, setDigitalAssetsIncome] = useState<number>(0);
  const [exemptAllowances, setExemptAllowances] = useState<number>(0);
  const [homeLoanSelfOccupied, setHomeLoanSelfOccupied] = useState<number>(0);
  const [homeLoanLetOut, setHomeLoanLetOut] = useState<number>(0);
  const [otherIncome, setOtherIncome] = useState<number>(0);

  // State - Deductions (as per updated screenshot)
  const [deduction80C, setDeduction80C] = useState<number>(150000);
  const [deduction80D, setDeduction80D] = useState<number>(25000);
  const [deduction80EEA, setDeduction80EEA] = useState<number>(0);
  const [npsEmployer80CCD2, setNpsEmployer80CCD2] = useState<number>(0);
  const [deduction80TTA, setDeduction80TTA] = useState<number>(0);
  const [deduction80G, setDeduction80G] = useState<number>(0);
  const [npsEmployee80CCD, setNpsEmployee80CCD] = useState<number>(0);
  const [otherDeductions, setOtherDeductions] = useState<number>(0);

  const [copied, setCopied] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Calculated values
  const [taxData, setTaxData] = useState({
    grossIncome: 0,
    newDeductions: 0,
    newTaxable: 0,
    newTaxBeforeCess: 0,
    newRebate: 0,
    newCess: 0,
    newSurcharge: 0,
    newTotalTax: 0,
    
    oldDeductions: 0,
    oldTaxable: 0,
    oldTaxBeforeCess: 0,
    oldRebate: 0,
    oldCess: 0,
    oldSurcharge: 0,
    oldTotalTax: 0
  });

  const calculateNewRegimeTax = (taxable: number, fy: string) => {
    if (taxable <= 0) return 0;
    
    let tax = 0;
    const rule = taxRules[fy] || taxRules["2026-2027"];
    const slabs = rule.newSlabs;

    let prevLimit = 0;
    for (const slab of slabs) {
      if (taxable > slab.limit) {
        tax += (slab.limit - prevLimit) * slab.rate;
        prevLimit = slab.limit;
      } else {
        tax += (taxable - prevLimit) * slab.rate;
        break;
      }
    }

    return tax;
  };

  const calculateOldRegimeTax = (taxable: number) => {
    if (taxable <= 0) return 0;
    
    let tax = 0;
    
    // Old Regime Slab Rates depend on Age Group
    let limit1 = 250000;
    let limit2 = 500000;
    let limit3 = 1000000;

    if (ageGroup === "senior") {
      limit1 = 300000;
    } else if (ageGroup === "super_senior") {
      limit1 = 500000;
    }

    if (taxable <= limit1) {
      return 0;
    }

    // Slab 1 (5%)
    if (taxable > limit1) {
      const taxableInSlab1 = Math.min(taxable, limit2) - limit1;
      if (taxableInSlab1 > 0) tax += taxableInSlab1 * 0.05;
    }
    // Slab 2 (20%)
    if (taxable > limit2) {
      const taxableInSlab2 = Math.min(taxable, limit3) - limit2;
      if (taxableInSlab2 > 0) tax += taxableInSlab2 * 0.20;
    }
    // Slab 3 (30%)
    if (taxable > limit3) {
      tax += (taxable - limit3) * 0.30;
    }

    return tax;
  };

  useEffect(() => {
    // Gross Income (includes salary, interest, rent, other, digital assets)
    const grossIncome = 
      (salaryIncome || 0) + 
      (interestIncome || 0) + 
      (rentalIncome || 0) + 
      (otherIncome || 0) + 
      (digitalAssetsIncome || 0);

    const rule = taxRules[financialYear] || taxRules["2026-2027"];

    // Base taxable amount excluding VDA (digital assets are taxed at a flat 30%)
    const baseIncomeExclVda = grossIncome - (digitalAssetsIncome || 0);

    // --- NEW REGIME CALCULATION ---
    const newStdDeduction = isSalaried ? rule.newStdDeduction : 0;
    // Employer NPS 80CCD(2) is allowed in new regime as well
    const newDeductions = newStdDeduction + (npsEmployer80CCD2 || 0); 
    const newTaxable = Math.max(0, baseIncomeExclVda - newDeductions);
    
    let newTaxBeforeCess = calculateNewRegimeTax(newTaxable, financialYear);
    
    // VDA tax (flat 30%)
    const newVdaTax = (digitalAssetsIncome || 0) * 0.30;
    newTaxBeforeCess += newVdaTax;
    
    // Rebate Sec 87A (Only on normal tax portion if total taxable income <= threshold)
    let newRebate = 0;
    const totalNewTaxable = newTaxable + (digitalAssetsIncome || 0);
    if (totalNewTaxable <= rule.newRebateThreshold) {
      // Rebate covers normal tax (VDA tax is flat and usually not rebateable)
      newRebate = Math.min(rule.newMaxRebate, calculateNewRegimeTax(newTaxable, financialYear));
    }
    
    const newTaxAfterRebate = Math.max(0, newTaxBeforeCess - newRebate);
    
    // Surcharge
    let newSurcharge = 0;
    if (totalNewTaxable > 5000000) {
      const surchargeRate = totalNewTaxable > 50000000 ? 0.25 : totalNewTaxable > 20000000 ? 0.25 : totalNewTaxable > 10000000 ? 0.15 : totalNewTaxable > 5000000 ? 0.10 : 0;
      newSurcharge = newTaxAfterRebate * surchargeRate;
    }
    
    const newCess = (newTaxAfterRebate + newSurcharge) * 0.04;
    const newTotalTax = newTaxAfterRebate + newSurcharge + newCess;

    // --- OLD REGIME CALCULATION ---
    const oldStdDeduction = isSalaried ? rule.oldStdDeduction : 0;
    
    // Old regime deductions: 
    // Std deduction + exempt allowances + Home Loan self occupied (max 2L) + Home Loan let out + 80C (max 1.5L) + 80D (max 25k/50k) + 80EEA (max 1.5L) + 80CCD(2) + 80TTA (max 10k/50k) + 80G + 80CCD employee (max 50k) + other
    const max80C = Math.min(150000, deduction80C || 0);
    const max80D = Math.min(ageGroup === "senior" ? 50000 : 25000, deduction80D || 0);
    const max80EEA = Math.min(150000, deduction80EEA || 0);
    const maxHomeLoanSelf = Math.min(200000, homeLoanSelfOccupied || 0);
    const max80TTA = Math.min(ageGroup === "senior" ? 50000 : 10000, deduction80TTA || 0);
    const max80CCDEmployee = Math.min(50000, npsEmployee80CCD || 0);

    const oldDeductionsSum = 
      oldStdDeduction +
      (exemptAllowances || 0) +
      maxHomeLoanSelf +
      (homeLoanLetOut || 0) +
      max80C + 
      max80D +
      max80EEA +
      (npsEmployer80CCD2 || 0) +
      max80TTA + 
      (deduction80G || 0) + 
      max80CCDEmployee + 
      (otherDeductions || 0);

    const oldTaxable = Math.max(0, baseIncomeExclVda - oldDeductionsSum);
    let oldTaxBeforeCess = calculateOldRegimeTax(oldTaxable);
    
    // VDA tax (flat 30%)
    const oldVdaTax = (digitalAssetsIncome || 0) * 0.30;
    oldTaxBeforeCess += oldVdaTax;
    
    // Rebate Sec 87A
    let oldRebate = 0;
    const totalOldTaxable = oldTaxable + (digitalAssetsIncome || 0);
    if (totalOldTaxable <= rule.oldRebateThreshold) {
      oldRebate = Math.min(rule.oldMaxRebate, calculateOldRegimeTax(oldTaxable));
    }
    
    const oldTaxAfterRebate = Math.max(0, oldTaxBeforeCess - oldRebate);
    
    // Surcharge
    let oldSurcharge = 0;
    if (totalOldTaxable > 5000000) {
      const surchargeRate = totalOldTaxable > 50000000 ? 0.37 : totalOldTaxable > 20000000 ? 0.25 : totalOldTaxable > 10000000 ? 0.15 : totalOldTaxable > 5000000 ? 0.10 : 0;
      oldSurcharge = oldTaxAfterRebate * surchargeRate;
    }
    
    const oldCess = (oldTaxAfterRebate + oldSurcharge) * 0.04;
    const oldTotalTax = oldTaxAfterRebate + oldSurcharge + oldCess;

    setTaxData({
      grossIncome,
      newDeductions,
      newTaxable: totalNewTaxable,
      newTaxBeforeCess,
      newRebate,
      newCess,
      newSurcharge,
      newTotalTax,
      
      oldDeductions: oldDeductionsSum,
      oldTaxable: totalOldTaxable,
      oldTaxBeforeCess,
      oldRebate,
      oldCess,
      oldSurcharge,
      oldTotalTax
    });
  }, [
    salaryIncome, interestIncome, rentalIncome, digitalAssetsIncome, exemptAllowances, homeLoanSelfOccupied, homeLoanLetOut, otherIncome,
    deduction80C, deduction80D, deduction80EEA, npsEmployer80CCD2, deduction80TTA, deduction80G, npsEmployee80CCD, otherDeductions,
    isSalaried, ageGroup, financialYear
  ]);

  const copyValue = (val: number, fieldName: string) => {
    navigator.clipboard.writeText(val.toFixed(2));
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleCopySummary = () => {
    const comparisonText = `--- Acrozo Income Tax Calculator Summary ---
Financial Year: FY ${financialYear}
Gross Total Income: ₹${taxData.grossIncome.toFixed(2)}
Salaried? ${isSalaried ? "Yes" : "No"}
Age Group: ${ageGroup.replace("_", " ").toUpperCase()}
------------------------------------------
NEW REGIME:
Taxable Income: ₹${taxData.newTaxable.toFixed(2)}
Total Tax Payable: ₹${taxData.newTotalTax.toFixed(2)}

OLD REGIME:
Taxable Income: ₹${taxData.oldTaxable.toFixed(2)}
Total Tax Payable: ₹${taxData.oldTotalTax.toFixed(2)}
------------------------------------------
RECOMMENDED: Use ${taxData.newTotalTax < taxData.oldTotalTax ? "New Regime" : "Old Regime"}
Estimated Tax Saving: ₹${Math.abs(taxData.newTotalTax - taxData.oldTotalTax).toFixed(2)}
------------------------------------------
Generated via Acrozo Tools`;

    navigator.clipboard.writeText(comparisonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setAgeGroup("general");
    setIsSalaried(true);
    setSelectedRegime("both");
    setSalaryIncome(1200000);
    setInterestIncome(20000);
    setRentalIncome(0);
    setDigitalAssetsIncome(0);
    setExemptAllowances(0);
    setHomeLoanSelfOccupied(0);
    setHomeLoanLetOut(0);
    setOtherIncome(0);
    
    setDeduction80C(150000);
    setDeduction80D(25000);
    setDeduction80EEA(0);
    setNpsEmployer80CCD2(0);
    setDeduction80TTA(0);
    setDeduction80G(0);
    setNpsEmployee80CCD(0);
    setOtherDeductions(0);
    
    setActiveTab("basic");
  };

  const rule = taxRules[financialYear] || taxRules["2026-2027"];

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
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Income Tax Calculator - FY {financialYear}</h1>
          <p className="text-muted-foreground mt-2 max-w-lg mx-auto text-sm sm:text-base">
            Compare Old vs New Tax Regime side-by-side. Calculate exact tax slab rates, deductions, and savings instantly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Inputs Section */}
          <div className="md:col-span-7 bg-card border border-card-border rounded-2xl shadow-sm p-4 sm:p-6 space-y-6 flex flex-col justify-between">
            <div>
              {/* Tab Navigation */}
              <div className="flex border-b border-border mb-6">
                {(["basic", "income", "deductions"] as TabType[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                      activeTab === tab
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab === "basic" ? "Basic details" : tab === "income" ? "Income details" : "Deduction"}
                  </button>
                ))}
              </div>

              {/* Tab Content Panels */}
              <div className="space-y-4">
                {activeTab === "basic" && (
                  <div className="space-y-4">
                    {/* Financial Year Selection (2 years back, current, 2 years forward) */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                        Financial Year
                      </label>
                      <select
                        className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm font-medium focus:outline-none"
                        value={financialYear}
                        onChange={(e) => setFinancialYear(e.target.value)}
                      >
                        <option value="2024-2025">FY 2024-2025 (AY 2025-2026)</option>
                        <option value="2025-2026">FY 2025-2026 (AY 2026-2027)</option>
                        <option value="2026-2027">FY 2026-2027 (AY 2027-2028)</option>
                        <option value="2027-2028">FY 2027-2028 (AY 2028-2029)</option>
                        <option value="2028-2029">FY 2028-2029 (AY 2029-2030)</option>
                      </select>
                    </div>

                    {/* Age Group */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                        Age Group
                      </label>
                      <select
                        className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm font-medium focus:outline-none"
                        value={ageGroup}
                        onChange={(e) => setAgeGroup(e.target.value as any)}
                      >
                        <option value="general">Below 60 years (General)</option>
                        <option value="senior">60 - 80 years (Senior Citizen)</option>
                        <option value="super_senior">80 years & above (Super Senior)</option>
                      </select>
                    </div>

                    {/* Salaried Option Toggle */}
                    <div className="flex items-center justify-between p-4 bg-muted/30 border border-border rounded-xl">
                      <div className="space-y-0.5">
                        <span className="text-sm font-bold text-foreground block">
                          {isSalaried ? "Are you a Salaried Employee?" : "Are you a Business Owner / Self-Employed?"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {isSalaried 
                            ? `Applies Standard Deduction (₹${rule.newStdDeduction.toLocaleString("en-IN")} New / ₹${rule.oldStdDeduction.toLocaleString("en-IN")} Old).`
                            : "Standard deduction does not apply to Business Income."}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsSalaried(!isSalaried)}
                        className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 shrink-0 ${
                          isSalaried ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <motion.div
                          layout
                          className="w-4 h-4 bg-white rounded-full shadow"
                          animate={{ x: isSalaried ? 20 : 0 }}
                        />
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === "income" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto pr-1">
                    {/* Left Column */}
                    <div className="space-y-4">
                      {/* Income from Salary / Business */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                          {isSalaried ? "Income from Salary" : "Income from Business"}
                        </label>
                        <div className="relative rounded-xl border border-input">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                          <input
                            type="number"
                            className="w-full pl-8 pr-4 py-2.5 bg-background text-foreground text-sm focus:outline-none"
                            value={salaryIncome === 0 ? "" : salaryIncome}
                            onChange={(e) => setSalaryIncome(Number(e.target.value))}
                          />
                        </div>
                      </div>

                      {/* Income from interest */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                          Income from interest
                        </label>
                        <div className="relative rounded-xl border border-input">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                          <input
                            type="number"
                            className="w-full pl-8 pr-4 py-2.5 bg-background text-foreground text-sm focus:outline-none"
                            value={interestIncome === 0 ? "" : interestIncome}
                            onChange={(e) => setInterestIncome(Number(e.target.value))}
                          />
                        </div>
                      </div>

                      {/* Rental income received */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                          Rental income received
                        </label>
                        <div className="relative rounded-xl border border-input">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                          <input
                            type="number"
                            className="w-full pl-8 pr-4 py-2.5 bg-background text-foreground text-sm focus:outline-none"
                            value={rentalIncome === 0 ? "" : rentalIncome}
                            onChange={(e) => setRentalIncome(Number(e.target.value))}
                          />
                        </div>
                      </div>

                      {/* Income from digital assets */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                          Income from digital assets
                        </label>
                        <div className="relative rounded-xl border border-input">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                          <input
                            type="number"
                            className="w-full pl-8 pr-4 py-2.5 bg-background text-foreground text-sm focus:outline-none"
                            value={digitalAssetsIncome === 0 ? "" : digitalAssetsIncome}
                            onChange={(e) => setDigitalAssetsIncome(Number(e.target.value))}
                            placeholder="Crypto / NFT Flat 30% Tax"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      {/* Exempt allowances */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                          Exempt allowances
                        </label>
                        <div className="relative rounded-xl border border-input">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                          <input
                            type="number"
                            className="w-full pl-8 pr-4 py-2.5 bg-background text-foreground text-sm focus:outline-none"
                            value={exemptAllowances === 0 ? "" : exemptAllowances}
                            onChange={(e) => setExemptAllowances(Number(e.target.value))}
                            placeholder="HRA, LTA etc. (Old Regime only)"
                          />
                        </div>
                      </div>

                      {/* Interest on home loan - Self occupied */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                            Interest on home loan - Self occupied
                          </label>
                          <span className="text-[10px] text-muted-foreground font-bold">Max 2L</span>
                        </div>
                        <div className="relative rounded-xl border border-input">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                          <input
                            type="number"
                            className="w-full pl-8 pr-4 py-2.5 bg-background text-foreground text-sm focus:outline-none"
                            value={homeLoanSelfOccupied === 0 ? "" : homeLoanSelfOccupied}
                            onChange={(e) => setHomeLoanSelfOccupied(Number(e.target.value))}
                          />
                        </div>
                      </div>

                      {/* Interest on Home Loan - Let Out */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                          Interest on Home Loan - Let Out
                        </label>
                        <div className="relative rounded-xl border border-input">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                          <input
                            type="number"
                            className="w-full pl-8 pr-4 py-2.5 bg-background text-foreground text-sm focus:outline-none"
                            value={homeLoanLetOut === 0 ? "" : homeLoanLetOut}
                            onChange={(e) => setHomeLoanLetOut(Number(e.target.value))}
                          />
                        </div>
                      </div>

                      {/* Other income */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                          Other income
                        </label>
                        <div className="relative rounded-xl border border-input">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                          <input
                            type="number"
                            className="w-full pl-8 pr-4 py-2.5 bg-background text-foreground text-sm focus:outline-none"
                            value={otherIncome === 0 ? "" : otherIncome}
                            onChange={(e) => setOtherIncome(Number(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "deductions" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto pr-1">
                    {/* Left Column */}
                    <div className="space-y-4">
                      {/* Basic deductions - 80C */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                            Basic deductions - 80C
                          </label>
                          <span className="text-[10px] text-muted-foreground font-bold">Max 1.5L</span>
                        </div>
                        <div className="relative rounded-xl border border-input">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                          <input
                            type="number"
                            className="w-full pl-8 pr-4 py-2.5 bg-background text-foreground text-sm focus:outline-none"
                            value={deduction80C === 0 ? "" : deduction80C}
                            onChange={(e) => setDeduction80C(Number(e.target.value))}
                            placeholder="LIC, PF, ELSS, School Fees, etc."
                          />
                        </div>
                      </div>

                      {/* Medical insurance - 80D */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                            Medical insurance - 80D
                          </label>
                          <span className="text-[10px] text-muted-foreground font-bold">Max 25k/50k</span>
                        </div>
                        <div className="relative rounded-xl border border-input">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                          <input
                            type="number"
                            className="w-full pl-8 pr-4 py-2.5 bg-background text-foreground text-sm focus:outline-none"
                            value={deduction80D === 0 ? "" : deduction80D}
                            onChange={(e) => setDeduction80D(Number(e.target.value))}
                            placeholder="Self, family and parents"
                          />
                        </div>
                      </div>

                      {/* Interest on housing loan - 80EEA */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                            Interest on housing loan - 80EEA
                          </label>
                          <span className="text-[10px] text-muted-foreground font-bold">Max 1.5L</span>
                        </div>
                        <div className="relative rounded-xl border border-input">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                          <input
                            type="number"
                            className="w-full pl-8 pr-4 py-2.5 bg-background text-foreground text-sm focus:outline-none"
                            value={deduction80EEA === 0 ? "" : deduction80EEA}
                            onChange={(e) => setDeduction80EEA(Number(e.target.value))}
                          />
                        </div>
                      </div>

                      {/* Employer's contribution to NPS - 80CCD(2) */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                          {isSalaried ? "Employer's contribution to NPS - 80CCD(2)" : "Contribution to NPS - 80CCD(2)"}
                        </label>
                        <div className="relative rounded-xl border border-input">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                          <input
                            type="number"
                            className="w-full pl-8 pr-4 py-2.5 bg-background text-foreground text-sm focus:outline-none"
                            value={npsEmployer80CCD2 === 0 ? "" : npsEmployer80CCD2}
                            onChange={(e) => setNpsEmployer80CCD2(Number(e.target.value))}
                            placeholder={isSalaried ? "Up to 10% of salary (Allowed in both)" : "Up to 10% of business income (Allowed in both)"}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      {/* Interest from deposits - 80TTA */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                            Interest from deposits - 80TTA
                          </label>
                          <span className="text-[10px] text-muted-foreground font-bold">Max 10k/50k</span>
                        </div>
                        <div className="relative rounded-xl border border-input">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                          <input
                            type="number"
                            className="w-full pl-8 pr-4 py-2.5 bg-background text-foreground text-sm focus:outline-none"
                            value={deduction80TTA === 0 ? "" : deduction80TTA}
                            onChange={(e) => setDeduction80TTA(Number(e.target.value))}
                            placeholder="Savings account interest"
                          />
                        </div>
                      </div>

                      {/* Donations to charity - 80G */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                          Donations to charity - 80G
                        </label>
                        <div className="relative rounded-xl border border-input">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                          <input
                            type="number"
                            className="w-full pl-8 pr-4 py-2.5 bg-background text-foreground text-sm focus:outline-none"
                            value={deduction80G === 0 ? "" : deduction80G}
                            onChange={(e) => setDeduction80G(Number(e.target.value))}
                          />
                        </div>
                      </div>

                      {/* Employee's contribution to NPS - 80CCD */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                            Employee's contribution to NPS - 80CCD
                          </label>
                          <span className="text-[10px] text-muted-foreground font-bold">Max 50k</span>
                        </div>
                        <div className="relative rounded-xl border border-input">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                          <input
                            type="number"
                            className="w-full pl-8 pr-4 py-2.5 bg-background text-foreground text-sm focus:outline-none"
                            value={npsEmployee80CCD === 0 ? "" : npsEmployee80CCD}
                            onChange={(e) => setNpsEmployee80CCD(Number(e.target.value))}
                            placeholder="Section 80CCD(1B)"
                          />
                        </div>
                      </div>

                      {/* Any other deduction */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                          Any other deduction
                        </label>
                        <div className="relative rounded-xl border border-input">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                          <input
                            type="number"
                            className="w-full pl-8 pr-4 py-2.5 bg-background text-foreground text-sm focus:outline-none"
                            value={otherDeductions === 0 ? "" : otherDeductions}
                            onChange={(e) => setOtherDeductions(Number(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Next buttons */}
            <div className="pt-6 flex justify-between border-t border-border mt-6">
              {activeTab !== "basic" ? (
                <button
                  onClick={() => setActiveTab(activeTab === "deductions" ? "income" : "basic")}
                  className="px-4 py-2 border border-border text-foreground hover:bg-muted rounded-xl transition-all text-xs font-bold uppercase tracking-wider font-semibold"
                >
                  Back
                </button>
              ) : (
                <div />
              )}
              {activeTab !== "deductions" ? (
                <button
                  onClick={() => setActiveTab(activeTab === "basic" ? "income" : "deductions")}
                  className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl transition-all text-xs font-bold uppercase tracking-wider font-semibold flex items-center gap-1"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="text-xs font-bold text-muted-foreground flex items-center gap-1 uppercase tracking-wider">
                  Fill fields & view right panel
                </div>
              )}
            </div>
          </div>

          {/* Results Comparison Section */}
          <div className="md:col-span-5 bg-gradient-to-br from-[#304d8c] to-[#121f3b] text-white rounded-2xl shadow-xl p-5 sm:p-6 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h2 className="text-base font-bold flex items-center gap-1.5">
                  <TrendingUp className="w-5 h-5 text-white shrink-0" /> Tax Liability Summary
                </h2>
                <button
                  onClick={handleReset}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
                  title="Reset Calculator"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Tax Regime Selector Toggle */}
              <div className="flex bg-white/10 p-0.5 rounded-lg border border-white/10 w-full">
                {(["both", "new", "old"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedRegime(r)}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all capitalize ${
                      selectedRegime === r
                        ? "bg-white text-[#121f3b] shadow-sm"
                        : "text-blue-100/70 hover:text-white"
                    }`}
                  >
                    {r === "both" ? "Compare Both" : r === "new" ? "New Regime" : "Old Regime"}
                  </button>
                ))}
              </div>

              <div className="text-center space-y-3 pt-2">
                {selectedRegime === "both" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[11px] text-blue-200 uppercase font-bold tracking-wider">Old Regime</span>
                      <span className="block text-2xl font-extrabold text-white mt-1 tabular-nums">
                        ₹{taxData.oldTotalTax.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-blue-200 uppercase font-bold tracking-wider">New Regime</span>
                      <span className="block text-2xl font-extrabold text-white mt-1 tabular-nums">
                        ₹{taxData.newTotalTax.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                )}
                {selectedRegime === "new" && (
                  <div>
                    <span className="text-[11px] text-blue-200 uppercase font-bold tracking-wider">New Regime Tax Payable</span>
                    <span className="block text-3xl font-extrabold text-white mt-1 tabular-nums">
                      ₹{taxData.newTotalTax.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                    <span className="block text-[10px] text-blue-200/80 mt-1">
                      Old Regime equivalent: ₹{taxData.oldTotalTax.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
                {selectedRegime === "old" && (
                  <div>
                    <span className="text-[11px] text-blue-200 uppercase font-bold tracking-wider">Old Regime Tax Payable</span>
                    <span className="block text-3xl font-extrabold text-white mt-1 tabular-nums">
                      ₹{taxData.oldTotalTax.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                    <span className="block text-[10px] text-blue-200/80 mt-1">
                      New Regime equivalent: ₹{taxData.newTotalTax.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
              </div>

              {/* Dynamic recommendation alert */}
              <div className="p-3 bg-white/10 border border-white/10 rounded-xl mt-4">
                {taxData.newTotalTax === taxData.oldTotalTax ? (
                  <p className="text-xs font-bold text-center text-blue-100">
                    Both Tax Regimes yield the same tax liability.
                  </p>
                ) : (
                  <p className="text-xs font-bold text-center text-blue-100">
                    🎉 You save <span className="text-emerald-300 font-extrabold">₹{Math.abs(taxData.newTotalTax - taxData.oldTotalTax).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span> with the {" "}
                    <span className="underline decoration-[#a5bcff] underline-offset-4">
                      {taxData.newTotalTax < taxData.oldTotalTax ? "New Regime" : "Old Regime"}
                    </span>!
                  </p>
                )}
              </div>

              {/* Detailed Breakdown */}
              <div className="space-y-3 pt-3 border-t border-white/10 text-xs">
                {/* Gross Income */}
                <div className="flex justify-between items-center py-1">
                  <span className="text-blue-100/70">{isSalaried ? "Gross Income" : "Gross Business Income"}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold tabular-nums">₹{taxData.grossIncome.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                    <button
                      onClick={() => copyValue(taxData.grossIncome, "gross")}
                      className="p-0.5 hover:bg-white/10 rounded text-blue-200"
                      title="Copy Gross Income"
                    >
                      {copiedField === "gross" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* Deductions comparison */}
                <div className="flex justify-between items-center py-1">
                  <span className="text-blue-100/70">Total Deductions</span>
                  <span className="font-semibold tabular-nums">
                    {selectedRegime === "both" && `₹${taxData.newDeductions.toLocaleString("en-IN", { maximumFractionDigits: 0 })} / ₹${taxData.oldDeductions.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                    {selectedRegime === "new" && `₹${taxData.newDeductions.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                    {selectedRegime === "old" && `₹${taxData.oldDeductions.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                  </span>
                </div>

                {/* Taxable Income */}
                <div className="flex justify-between items-center py-1">
                  <span className="text-blue-100/70">Taxable Income</span>
                  <span className="font-semibold tabular-nums">
                    {selectedRegime === "both" && `₹${taxData.newTaxable.toLocaleString("en-IN", { maximumFractionDigits: 0 })} / ₹${taxData.oldTaxable.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                    {selectedRegime === "new" && `₹${taxData.newTaxable.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                    {selectedRegime === "old" && `₹${taxData.oldTaxable.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                  </span>
                </div>

                {/* Tax Before Cess */}
                <div className="flex justify-between items-center py-1">
                  <span className="text-blue-100/70">Tax Before Rebate</span>
                  <span className="font-semibold tabular-nums">
                    {selectedRegime === "both" && `₹${taxData.newTaxBeforeCess.toLocaleString("en-IN", { maximumFractionDigits: 0 })} / ₹${taxData.oldTaxBeforeCess.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                    {selectedRegime === "new" && `₹${taxData.newTaxBeforeCess.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                    {selectedRegime === "old" && `₹${taxData.oldTaxBeforeCess.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                  </span>
                </div>

                {/* Rebate 87A */}
                <div className="flex justify-between items-center py-1">
                  <span className="text-blue-100/70">Rebate (Sec 87A)</span>
                  <span className="font-semibold text-emerald-300 tabular-nums">
                    {selectedRegime === "both" && `-₹${taxData.newRebate.toLocaleString("en-IN", { maximumFractionDigits: 0 })} / -₹${taxData.oldRebate.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                    {selectedRegime === "new" && `-₹${taxData.newRebate.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                    {selectedRegime === "old" && `-₹${taxData.oldRebate.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                  </span>
                </div>

                {/* Cess */}
                <div className="flex justify-between items-center py-1">
                  <span className="text-blue-100/70">Cess (4%)</span>
                  <span className="font-semibold tabular-nums">
                    {selectedRegime === "both" && `₹${taxData.newCess.toLocaleString("en-IN", { maximumFractionDigits: 0 })} / ₹${taxData.oldCess.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                    {selectedRegime === "new" && `₹${taxData.newCess.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                    {selectedRegime === "old" && `₹${taxData.oldCess.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-3 space-y-3">
              <button
                onClick={handleCopySummary}
                className="w-full py-3.5 bg-white text-[#121f3b] hover:bg-[#e8eeff] rounded-xl font-extrabold transition-all flex items-center justify-center gap-2 text-sm shadow-md"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-[#415e9b]" /> Copied comparison!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy Regime Comparison
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* slab details guide */}
        <div className="bg-white dark:bg-card border border-card-border rounded-xl p-5 mt-10 shadow-sm">
          <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" /> Income Tax Slab Rates - FY {financialYear}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs text-muted-foreground leading-relaxed">
            {(selectedRegime === "both" || selectedRegime === "new") && (
              <div className={selectedRegime === "new" ? "md:col-span-2" : ""}>
                <h4 className="font-semibold text-foreground mb-2 flex items-center gap-1">
                  <span>🌟</span> New Regime Slab Rates
                </h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-muted text-[10px] font-bold text-foreground border-b border-border">
                        <th className="p-2">Income Tax Slabs (Rs.)</th>
                        <th className="p-2">Income Tax Rates</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rule.newSlabs.map((slab, i, arr) => {
                        let label = "";
                        if (i === 0) {
                          label = `Up to ${slab.limit / 100000} Lakh`;
                        } else if (slab.limit === Infinity) {
                          label = `Above ${arr[i-1].limit / 100000} Lakh`;
                        } else {
                          label = `${arr[i-1].limit / 100000} Lakh to ${slab.limit / 100000} Lakh`;
                        }
                        return (
                          <tr key={i}>
                            <td className="p-2">{label}</td>
                            <td className="p-2">{slab.rate === 0 ? "Nil" : `${slab.rate * 100}%`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground/80">
                  * Zero tax for total taxable income up to **₹{(rule.newRebateThreshold / 100000).toFixed(0)} Lakh** due to Section 87A rebate.
                </p>
              </div>
            )}

            {(selectedRegime === "both" || selectedRegime === "old") && (
              <div className={selectedRegime === "old" ? "md:col-span-2" : ""}>
                <h4 className="font-semibold text-foreground mb-2 flex items-center gap-1">
                  <span>🏛️</span> Old Regime Slab Rates ({ageGroup === "senior" ? "Senior Citizen" : ageGroup === "super_senior" ? "Super Senior" : "General"})
                </h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-muted text-[10px] font-bold text-foreground border-b border-border">
                        <th className="p-2">Income Tax Slabs (Rs.)</th>
                        <th className="p-2">Tax Rates</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ageGroup === "general" && (
                        <>
                          <tr><td className="p-2">Up to 2.5 Lakh</td><td className="p-2">Nil</td></tr>
                          <tr><td className="p-2">2.5 Lakh to 5 Lakh</td><td className="p-2">5%</td></tr>
                          <tr><td className="p-2">5 Lakh to 10 Lakh</td><td className="p-2">20%</td></tr>
                          <tr><td className="p-2">Above 10 Lakh</td><td className="p-2">30%</td></tr>
                        </>
                      )}
                      {ageGroup === "senior" && (
                        <>
                          <tr><td className="p-2">Up to 3 Lakh</td><td className="p-2">Nil</td></tr>
                          <tr><td className="p-2">3 Lakh to 5 Lakh</td><td className="p-2">5%</td></tr>
                          <tr><td className="p-2">5 Lakh to 10 Lakh</td><td className="p-2">20%</td></tr>
                          <tr><td className="p-2">Above 10 Lakh</td><td className="p-2">30%</td></tr>
                        </>
                      )}
                      {ageGroup === "super_senior" && (
                        <>
                          <tr><td className="p-2">Up to 5 Lakh</td><td className="p-2">Nil</td></tr>
                          <tr><td className="p-2">5 Lakh to 10 Lakh</td><td className="p-2">20%</td></tr>
                          <tr><td className="p-2">Above 10 Lakh</td><td className="p-2">30%</td></tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground/80">
                  * Zero tax for total taxable income up to **₹{(rule.oldRebateThreshold / 100000).toFixed(0)} Lakh** due to Section 87A rebate.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
