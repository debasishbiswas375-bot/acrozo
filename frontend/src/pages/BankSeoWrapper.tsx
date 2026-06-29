/**
 * BankSeoWrapper.tsx
 *
 * SEO "many doors" wrapper for bank-specific landing pages.
 * Auth gate uses the global AuthModal (openLogin / openSignup)
 * so the user never leaves the page.
 *
 * Drop this file at: frontend/src/pages/BankSeoWrapper.tsx
 */

import { useEffect } from "react";
import { useParams, Redirect } from "wouter";
import { useAuthModal } from "@/contexts/AuthModalContext";
import BankPdfToTally from "@/pages/bank-to-erp";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BankMeta {
  bankName: string;
  shortCode: string;
  pageTitle: string;
  metaDescription: string;
  headline: string;
  subheadline: string;
  features: [string, string, string];
  trustLine: string;
  schemaDescription: string;
}

// ─── Bank Dictionary ──────────────────────────────────────────────────────────

const BANK_DATA: Record<string, BankMeta> = {
  "sbi-to-tally": {
    bankName: "State Bank of India",
    shortCode: "SBI",
    pageTitle: "SBI Bank Statement to Tally XML Converter — Free Online Tool | Acrozo",
    metaDescription: "Convert SBI bank statement PDFs to Tally-ready XML in seconds. Handles multi-branch SBI formats, passbook exports, and corporate net-banking PDFs automatically.",
    headline: "SBI Bank Statement → Tally XML in One Click",
    subheadline: "State Bank of India's PDFs come in at least six layout variants — from YONO exports to corporate net-banking reports. Our parser normalises every SBI format into clean, double-entry Tally vouchers without manual mapping.",
    features: [
      "Multi-branch SBI header detection — works for Home, Savings, Current & NRE accounts",
      "YONO Business and Corporate Banking bulk-export formats parsed natively",
      "Passbook-style columnar layouts auto-detected; no template selection needed",
    ],
    trustLine: "Trusted by CA firms reconciling high-volume SBI corporate accounts every month.",
    schemaDescription: "Automatically converts State Bank of India bank statement PDFs into Tally Prime XML voucher files, handling all major SBI account types and export formats.",
  },
  "hdfc-to-tally": {
    bankName: "HDFC Bank",
    shortCode: "HDFC",
    pageTitle: "HDFC Bank Statement to Tally XML Converter — Free Online Tool | Acrozo",
    metaDescription: "Instantly convert HDFC bank statement PDFs to Tally XML. Supports HDFC retail, salary, and corporate current account formats with UPI narration parsing.",
    headline: "HDFC Bank Statements Converted to Tally XML — Instantly",
    subheadline: "HDFC Bank PDFs pack dense UPI and NEFT narrations that most converters mangle. Acrozo preserves every reference string, maps UPI counterparty names to Tally ledgers, and delivers balanced XML your accountant can import in one go.",
    features: [
      "UPI narration parsing: extracts VPA and counterparty name for intelligent ledger suggestion",
      "HDFC NetBanking and mobile-app PDF formats both supported without format switching",
      "HDFC Corporate Current Account multi-page statements handled with automatic page stitching",
    ],
    trustLine: "Used daily by fintech-savvy bookkeepers to eliminate HDFC reconciliation backlogs.",
    schemaDescription: "Converts HDFC Bank statement PDFs to Tally Prime-compatible XML, with specialised UPI narration parsing and support for retail and corporate account formats.",
  },
  "icici-to-tally": {
    bankName: "ICICI Bank",
    shortCode: "ICICI",
    pageTitle: "ICICI Bank Statement to Tally XML Converter — Free Online Tool | Acrozo",
    metaDescription: "Convert ICICI Bank statement PDFs to Tally XML with full UPI, IMPS, and iMobile export support. Zero manual ledger mapping for clean double-entry vouchers.",
    headline: "Turn ICICI Bank Statements into Tally XML Without the Spreadsheet Headache",
    subheadline: "ICICI's iMobile and iMobile Pay PDFs embed transaction metadata differently from desktop net-banking exports. Acrozo detects the source automatically and structures every credit, debit, and reversal into proper double-entry Tally vouchers.",
    features: [
      "iMobile Pay and iMobile export PDFs detected and parsed without user intervention",
      "ICICI IMPS and RTGS references preserved verbatim in Tally narration fields",
      "ECS mandates and auto-debit entries correctly classified as Journal or Payment vouchers",
    ],
    trustLine: "Preferred by SME accountants who process high-frequency ICICI current account activity.",
    schemaDescription: "Transforms ICICI Bank statement PDFs into Tally Prime XML, supporting iMobile exports, IMPS/RTGS references, and corporate current account layouts.",
  },
  "axis-to-tally": {
    bankName: "Axis Bank",
    shortCode: "Axis",
    pageTitle: "Axis Bank Statement to Tally XML Converter — Free Online Tool | Acrozo",
    metaDescription: "Convert Axis Bank statement PDFs to Tally-ready XML automatically. Supports Axis retail, salary, and business banking PDF formats with smart ledger inference.",
    headline: "Axis Bank PDF → Tally XML: No Pivot Tables, No Manual Entry",
    subheadline: "Axis Bank's Business Banking and Burgundy Private PDFs carry wide narration columns that are easily corrupted when copy-pasted into spreadsheets. Acrozo reads the raw PDF text layer directly, preserving every character before mapping to Tally.",
    features: [
      "Axis Business Banking and Burgundy Private account formats parsed with full narration fidelity",
      "Salary credit bulk entries split into individual employee credit vouchers automatically",
      "Axis Bank FASTag and toll deductions mapped to the correct expense ledger out of the box",
    ],
    trustLine: "Recommended by payroll CAs for cleaning up Axis bulk-salary disbursement entries.",
    schemaDescription: "Converts Axis Bank statement PDFs into Tally Prime XML, preserving long narration strings and supporting Business Banking and Burgundy Private formats.",
  },
  "pnb-to-tally": {
    bankName: "Punjab National Bank",
    shortCode: "PNB",
    pageTitle: "PNB Bank Statement to Tally XML Converter — Free Online Tool | Acrozo",
    metaDescription: "Convert Punjab National Bank (PNB) statement PDFs to Tally XML in seconds. Handles PNB One app exports and CBS-generated account statements without manual cleanup.",
    headline: "PNB Account Statements → Clean Tally XML Without the Copy-Paste Marathon",
    subheadline: "Punjab National Bank's CBS-generated PDFs and PNB One app exports have inconsistent column spacing that defeats generic PDF parsers. Acrozo uses layout-aware OCR to reconstruct every transaction row, even when columns bleed into each other.",
    features: [
      "PNB One and PNB Net Banking PDF exports parsed with column-bleed correction",
      "Government scheme credits (PM-KISAN, MGNREGS) auto-tagged for correct Tally income ledger",
      "Multi-currency NRE/NRO PNB accounts converted with INR-equivalent amounts for Tally import",
    ],
    trustLine: "Widely used by rural branch CAs helping agri-business clients automate PNB reconciliation.",
    schemaDescription: "Converts Punjab National Bank statement PDFs to Tally Prime XML with support for PNB One app exports, CBS layouts, and government-scheme transaction tagging.",
  },
  "kotak-to-tally": {
    bankName: "Kotak Mahindra Bank",
    shortCode: "Kotak",
    pageTitle: "Kotak Mahindra Bank Statement to Tally XML Converter — Free Online Tool | Acrozo",
    metaDescription: "Convert Kotak Mahindra Bank statement PDFs to Tally XML with UPI and 811 account support. Handles Kotak Pro and corporate banking formats automatically.",
    headline: "Kotak Mahindra Bank Statements to Tally XML — Including 811 Zero-Balance Accounts",
    subheadline: "Kotak's 811 digital accounts and Pro Current accounts each use different PDF schemas. Acrozo fingerprints the header section to choose the right parsing path, so you never have to specify which Kotak product your PDF came from.",
    features: [
      "811 zero-balance and Kotak Pro Current account PDF schemas detected automatically",
      "Kotak's dense UPI batch collections split into individual receipt vouchers per counterparty",
      "Kotak Mahindra Bank FD interest credit entries correctly mapped to Interest Received ledger",
    ],
    trustLine: "Favoured by startup founders reconciling high-velocity Kotak Pro current account activity.",
    schemaDescription: "Converts Kotak Mahindra Bank statement PDFs to Tally Prime XML, with auto-detection of 811, Pro, and corporate account formats and UPI batch splitting.",
  },
  "bob-to-tally": {
    bankName: "Bank of Baroda",
    shortCode: "BoB",
    pageTitle: "Bank of Baroda Statement to Tally XML Converter — Free Online Tool | Acrozo",
    metaDescription: "Convert Bank of Baroda (BoB) statement PDFs to Tally XML instantly. Supports BoB World app exports, corporate current accounts, and post-merger Vijaya Bank PDFs.",
    headline: "Bank of Baroda PDF Statements → Tally XML: Vijaya & Dena Merges Handled Too",
    subheadline: "Post-merger Bank of Baroda accounts sometimes carry legacy Vijaya Bank or Dena Bank PDF headers. Acrozo recognises all three header families and maps every transaction to the right Tally voucher type without requiring any re-formatting.",
    features: [
      "Legacy Vijaya Bank and Dena Bank PDF headers identified and processed post-merger",
      "BoB World mobile app export format parsed alongside traditional BoB net-banking PDFs",
      "Baroda KCC (Kisan Credit Card) agricultural credit entries tagged for correct group mapping",
    ],
    trustLine: "Used by cooperative society accountants managing post-merger Bank of Baroda accounts.",
    schemaDescription: "Converts Bank of Baroda statement PDFs to Tally Prime XML, supporting legacy Vijaya/Dena headers, BoB World exports, and agricultural credit tagging.",
  },
  "indusind-to-tally": {
    bankName: "IndusInd Bank",
    shortCode: "IndusInd",
    pageTitle: "IndusInd Bank Statement to Tally XML Converter — Free Online Tool | Acrozo",
    metaDescription: "Convert IndusInd Bank statement PDFs to Tally XML with IndusMobile and corporate net-banking support. Smart OCR handles IndusInd's wide narration columns perfectly.",
    headline: "IndusInd Bank Statement to Tally XML — Narrations Preserved, Ledgers Inferred",
    subheadline: "IndusInd Bank PDFs are known for exceptionally wide narration fields that carry rich counterparty metadata. Acrozo exploits this richness to automatically suggest ledger names from the narration text, slashing post-import cleanup time.",
    features: [
      "IndusMobile and IndusNet PDF exports both handled without format selection",
      "Wide narration fields parsed in full — counterparty names surfaced as Tally ledger suggestions",
      "IndusInd corporate escrow and collection accounts with multi-party credits supported",
    ],
    trustLine: "Chosen by treasury teams who need full narration fidelity in their Tally books.",
    schemaDescription: "Converts IndusInd Bank statement PDFs to Tally Prime XML, leveraging IndusInd's rich narration fields for intelligent ledger inference and full OCR fidelity.",
  },
  "yesbank-to-tally": {
    bankName: "Yes Bank",
    shortCode: "Yes",
    pageTitle: "Yes Bank Statement to Tally XML Converter — Free Online Tool | Acrozo",
    metaDescription: "Convert Yes Bank statement PDFs to Tally XML automatically. Handles Yes Bank retail and YES Business current account formats with UPI and NACH transaction parsing.",
    headline: "Yes Bank PDF Statements to Tally XML — NACH and UPI Entries Correctly Classified",
    subheadline: "Yes Bank is a preferred banking partner for NACH-heavy businesses like lending NBFCs and subscription platforms. Acrozo recognises NACH debit/credit patterns and groups them into logical Journal vouchers, keeping your Tally daybook readable.",
    features: [
      "NACH debit and NACH credit entries detected and mapped to Journal vouchers automatically",
      "YES Business Current and YES Prosperity Savings account PDF formats handled natively",
      "Chargeback and reversal entries auto-matched to their originating debit for clean Tally entry",
    ],
    trustLine: "Relied on by NBFC back-office teams processing daily NACH collections through Yes Bank.",
    schemaDescription: "Converts Yes Bank statement PDFs to Tally Prime XML with NACH debit/credit classification, chargeback matching, and YES Business account format support.",
  },
  "idfcfirst-to-tally": {
    bankName: "IDFC First Bank",
    shortCode: "IDFC",
    pageTitle: "IDFC First Bank Statement to Tally XML Converter — Free Online Tool | Acrozo",
    metaDescription: "Convert IDFC First Bank statement PDFs to Tally XML in one click. Supports IDFC First digital-native account formats with zero-fee transaction tagging and UPI parsing.",
    headline: "IDFC First Bank Statements to Tally XML — Built for Digital-First Businesses",
    subheadline: "IDFC First Bank's digital-native account PDFs often carry zero-fee UPI and IMPS transactions that need to be categorised differently from traditional bank charges. Acrozo identifies these transaction classes and assigns appropriate Tally voucher types automatically.",
    features: [
      "Zero-fee UPI and IMPS transactions correctly classified — no phantom 'Bank Charges' entries",
      "IDFC First digital savings and current account PDFs parsed without requiring format selection",
      "Interest accrual credits on IDFC First high-yield savings accounts mapped to Interest Received",
    ],
    trustLine: "Adopted by digital-first SMEs who bank exclusively with IDFC First and use Tally Prime.",
    schemaDescription: "Converts IDFC First Bank statement PDFs to Tally Prime XML with digital-account-aware classification, zero-fee transaction tagging, and UPI narration parsing.",
  },
  "federal-to-tally": {
    bankName: "Federal Bank",
    shortCode: "Federal",
    pageTitle: "Federal Bank Statement to Tally XML Converter — Free Online Tool | Acrozo",
    metaDescription: "Convert Federal Bank statement PDFs to Tally XML automatically. Handles FedMobile, FedNet, and NRI FCNR/NRE account formats with precise OCR for Kerala-region PDFs.",
    headline: "Federal Bank Statements to Tally XML — NRI and Kerala-Region Formats Supported",
    subheadline: "Federal Bank is the preferred bank for many Kerala-based businesses and NRI account holders, whose PDFs often include FCNR and NRE account entries alongside regular current account transactions. Acrozo converts mixed-account Federal Bank PDFs into clean INR-denominated Tally vouchers.",
    features: [
      "FCNR and NRE Federal Bank account entries converted with INR equivalent for Tally import",
      "FedMobile and FedNet PDF export layouts both recognised automatically",
      "Federal Bank trade finance and LC-related debit entries mapped to correct Tally expense groups",
    ],
    trustLine: "Trusted by Kerala-based chartered accountants handling Federal Bank NRI client portfolios.",
    schemaDescription: "Converts Federal Bank statement PDFs to Tally Prime XML, with NRI account support (FCNR/NRE), FedMobile/FedNet layout detection, and INR-equivalent conversion.",
  },
  "canara-to-tally": {
    bankName: "Canara Bank",
    shortCode: "Canara",
    pageTitle: "Canara Bank Statement to Tally XML Converter — Free Online Tool | Acrozo",
    metaDescription: "Convert Canara Bank statement PDFs to Tally XML seamlessly. Supports post-Syndicate merger PDFs, Canara Mobile app exports, and government salary disbursement formats.",
    headline: "Canara Bank Account Statements → Tally XML: Syndicate Merger PDFs Handled",
    subheadline: "Post-merger Canara Bank accounts may carry legacy Syndicate Bank PDF headers for older statement periods. Acrozo identifies these legacy headers and processes them through the same normalisation pipeline, giving you consistent Tally XML regardless of statement era.",
    features: [
      "Legacy Syndicate Bank PDF headers recognised and normalised post-merger",
      "Government salary and pension disbursement credits auto-tagged for Tally income mapping",
      "Canara Bank MSME loan repayment debits split correctly across principal and interest ledgers",
    ],
    trustLine: "Used by public-sector CA firms managing Canara Bank government salary disbursement accounts.",
    schemaDescription: "Converts Canara Bank statement PDFs to Tally Prime XML, handling post-Syndicate merger headers, government salary formats, and MSME loan entry splitting.",
  },
  "unionbank-to-tally": {
    bankName: "Union Bank of India",
    shortCode: "UBI",
    pageTitle: "Union Bank of India Statement to Tally XML Converter — Free Online Tool | Acrozo",
    metaDescription: "Convert Union Bank of India statement PDFs to Tally XML instantly. Handles post-Andhra Bank and Corporation Bank merger PDFs with consistent double-entry output.",
    headline: "Union Bank of India PDF Statements to Tally XML — Three Legacy Banks, One Clean Output",
    subheadline: "Union Bank of India absorbed both Andhra Bank and Corporation Bank, creating three distinct PDF header families. Acrozo detects all three and channels them through a unified parser, so your Tally import file is consistent regardless of which legacy entity issued the statement.",
    features: [
      "Andhra Bank and Corporation Bank legacy PDF headers detected and parsed post-merger",
      "Union Bank MSME Suvidha and Jan Dhan account formats handled with appropriate voucher classification",
      "Priority-sector lending credits auto-identified for correct income/liability ledger assignment",
    ],
    trustLine: "Preferred by merger-period accountants reconciling multi-entity Union Bank histories.",
    schemaDescription: "Converts Union Bank of India statement PDFs to Tally Prime XML, supporting legacy Andhra Bank and Corporation Bank headers alongside current Union Bank formats.",
  },
  "idbi-to-tally": {
    bankName: "IDBI Bank",
    shortCode: "IDBI",
    pageTitle: "IDBI Bank Statement to Tally XML Converter — Free Online Tool | Acrozo",
    metaDescription: "Convert IDBI Bank statement PDFs to Tally XML in seconds. Supports IDBI GO Mobile+, corporate banking exports, and LIC-linked premium debit transaction parsing.",
    headline: "IDBI Bank Statements to Tally XML — LIC Premium Debits Correctly Classified",
    subheadline: "Following LIC's acquisition of IDBI Bank, many IDBI accounts now carry regular LIC premium auto-debits that generic converters mis-classify as miscellaneous expenses. Acrozo recognises LIC-tagged NACH mandates and maps them to the correct Insurance Premium ledger in Tally.",
    features: [
      "LIC premium NACH mandates detected and mapped to Insurance Premium expense ledger",
      "IDBI GO Mobile+ and IDBI Net Banking PDF export formats parsed without user intervention",
      "IDBI corporate term-loan EMI debits split correctly across principal repayment and interest",
    ],
    trustLine: "Used by LIC-affiliated financial advisors tracking insurance premium payments in Tally.",
    schemaDescription: "Converts IDBI Bank statement PDFs to Tally Prime XML, with LIC premium mandate detection, GO Mobile+ support, and corporate loan EMI splitting.",
  },
  "rbl-to-tally": {
    bankName: "RBL Bank",
    shortCode: "RBL",
    pageTitle: "RBL Bank Statement to Tally XML Converter — Free Online Tool | Acrozo",
    metaDescription: "Convert RBL Bank statement PDFs to Tally XML instantly. Handles RBL Mobank, co-branded credit card settlement, and microfinance partner collection formats.",
    headline: "RBL Bank PDF Statements to Tally XML — Credit Card Settlements Parsed Correctly",
    subheadline: "RBL Bank is a major issuer of co-branded credit cards through partnerships with Bajaj Finance and others. Card settlement credits in RBL current account statements carry unique reference strings that Acrozo extracts and maps to a dedicated 'Credit Card Settlements' ledger in Tally.",
    features: [
      "Co-branded card settlement credits (Bajaj Finance, Zomato) extracted and ledger-mapped correctly",
      "RBL Mobank and RBL Net Banking PDF layouts both parsed without format selection",
      "Microfinance partner bulk disbursement debits grouped into single Journal vouchers for clarity",
    ],
    trustLine: "Adopted by fintech partnership teams managing RBL Bank co-branded card settlements in Tally.",
    schemaDescription: "Converts RBL Bank statement PDFs to Tally Prime XML, with co-branded card settlement extraction, Mobank support, and microfinance disbursement grouping.",
  },
  "central-to-tally": {
    bankName: "Central Bank of India",
    shortCode: "CBI",
    pageTitle: "Central Bank of India Statement to Tally XML Converter — Free Online Tool | Acrozo",
    metaDescription: "Convert Central Bank of India statement PDFs to Tally XML automatically. Handles Cent Mobile app exports, government scheme credits, and priority-sector loan entries.",
    headline: "Central Bank of India Statements to Tally XML — Government Scheme Credits Auto-Tagged",
    subheadline: "Central Bank of India serves a large base of government-scheme beneficiaries and PSU salary accounts. Acrozo recognises PM Awas Yojana, PMSBY, and other scheme-specific credit narrations and assigns them to the correct income ledger, saving hours of post-import reclassification.",
    features: [
      "PM Awas Yojana, PMSBY, and other government scheme credits auto-tagged to income ledgers",
      "Cent Mobile and CBI Net Banking PDF layouts handled without format specification",
      "PSU and government-department salary bulk credits split into individual Receipt vouchers",
    ],
    trustLine: "Trusted by government-sector bookkeepers processing Central Bank scheme disbursements.",
    schemaDescription: "Converts Central Bank of India statement PDFs to Tally Prime XML with government-scheme credit tagging, Cent Mobile support, and PSU salary entry splitting.",
  },
  "indianbank-to-tally": {
    bankName: "Indian Bank",
    shortCode: "IB",
    pageTitle: "Indian Bank Statement to Tally XML Converter — Free Online Tool | Acrozo",
    metaDescription: "Convert Indian Bank statement PDFs to Tally XML seamlessly. Supports post-Allahabad Bank merger PDFs, IndOASIS app exports, and agricultural credit entry parsing.",
    headline: "Indian Bank Statements to Tally XML — Allahabad Bank Legacy PDFs Supported",
    subheadline: "Indian Bank's merger with Allahabad Bank created a new category of legacy PDF headers that most conversion tools do not recognise. Acrozo handles both pre- and post-merger Indian Bank PDFs, giving migrated Allahabad Bank account holders the same clean Tally output.",
    features: [
      "Pre-merger Allahabad Bank PDF headers detected and processed through the same pipeline",
      "IndOASIS mobile app and Indian Bank Net Banking exports parsed with full OCR fidelity",
      "Kisan Credit Card and agricultural loan repayment debits mapped to correct Tally groups",
    ],
    trustLine: "Used by South Indian CA firms reconciling post-merger Allahabad Bank account histories.",
    schemaDescription: "Converts Indian Bank statement PDFs to Tally Prime XML, handling legacy Allahabad Bank headers, IndOASIS app exports, and agricultural credit mapping.",
  },
  "bandhan-to-tally": {
    bankName: "Bandhan Bank",
    shortCode: "Bandhan",
    pageTitle: "Bandhan Bank Statement to Tally XML Converter — Free Online Tool | Acrozo",
    metaDescription: "Convert Bandhan Bank statement PDFs to Tally XML automatically. Handles microfinance joint-liability group repayments, GRUH Finance mortgage debits, and mBandhan app exports.",
    headline: "Bandhan Bank PDF Statements to Tally XML — Microfinance Repayments Correctly Mapped",
    subheadline: "Bandhan Bank's roots in microfinance mean its account statements often contain joint-liability group repayment credits and GRUH Finance home-loan debits that generic converters lump into a single 'Miscellaneous' bucket. Acrozo classifies these entries at source, giving your Tally books proper granularity.",
    features: [
      "Joint-liability group (JLG) microfinance repayment credits mapped to correct income ledgers",
      "GRUH Finance home-loan EMI debits split across principal and interest Tally accounts",
      "mBandhan mobile app and Bandhan Net Banking PDF formats both parsed natively",
    ],
    trustLine: "Relied on by NGO-affiliated accountants handling Bandhan Bank microfinance portfolio entries.",
    schemaDescription: "Converts Bandhan Bank statement PDFs to Tally Prime XML, with JLG microfinance classification, GRUH Finance loan splitting, and mBandhan app format support.",
  },
  "sib-to-tally": {
    bankName: "South Indian Bank",
    shortCode: "SIB",
    pageTitle: "South Indian Bank Statement to Tally XML Converter — Free Online Tool | Acrozo",
    metaDescription: "Convert South Indian Bank (SIB) statement PDFs to Tally XML with clear OCR for Malayalam and English bilingual PDFs. Handles SIB Mirror+ and NRI account formats.",
    headline: "South Indian Bank Statements to Tally XML — Bilingual PDF Layouts Handled",
    subheadline: "South Indian Bank sometimes issues bilingual (Malayalam/English) passbook-style PDFs that confuse standard OCR engines. Acrozo's layout parser ignores non-Latin characters in header regions and extracts only the numerical transaction data, delivering correctly encoded Tally XML every time.",
    features: [
      "Bilingual Malayalam/English PDF headers handled — only transaction data extracted",
      "SIB Mirror+ and SIB net-banking PDF exports parsed without any format toggling",
      "NRI FCNR account credits converted to INR-equivalent amounts for Tally double-entry compliance",
    ],
    trustLine: "The go-to tool for Kerala and Tamil Nadu CAs working with South Indian Bank NRI clients.",
    schemaDescription: "Converts South Indian Bank statement PDFs to Tally Prime XML, with bilingual PDF header handling, SIB Mirror+ support, and NRI FCNR account conversion.",
  },
  "boi-to-tally": {
    bankName: "Bank of India",
    shortCode: "BOI",
    pageTitle: "Bank of India Statement to Tally XML Converter — Free Online Tool | Acrozo",
    metaDescription: "Convert Bank of India (BOI) statement PDFs to Tally XML automatically. Handles Star account formats, BOI Mobile Banking exports, and corporate current account statements.",
    headline: "Bank of India PDF Statements to Tally XML — Star Accounts & Corporate Formats Handled",
    subheadline: "Bank of India's Star series accounts (Star Mitra, Star Mahila, Star Kishan) generate PDFs with non-standard header layouts that trip up generic converters. Acrozo's BOI parser reads past these decorative headers to extract clean transaction rows, mapping government disbursement credits and NEFT/RTGS entries to the correct Tally ledgers automatically.",
    features: [
      "Star series account PDF layouts (Star Mitra, Star Mahila, Star Kishan) parsed natively",
      "Government scheme disbursement credits mapped to correct income ledgers",
      "Corporate current account multi-branch NEFT/RTGS entries classified accurately",
    ],
    trustLine: "Used by accountants handling Bank of India government scheme disbursements and Star account portfolios.",
    schemaDescription: "Converts Bank of India statement PDFs to Tally Prime XML, with Star account format support, government disbursement classification, and corporate NEFT/RTGS entry mapping.",
  },
  "iob-to-tally": {
    bankName: "Indian Overseas Bank",
    shortCode: "IOB",
    pageTitle: "Indian Overseas Bank Statement to Tally XML Converter — Free Online Tool | Acrozo",
    metaDescription: "Convert Indian Overseas Bank (IOB) statement PDFs to Tally XML automatically. Handles IOB net banking exports, NRI account formats, and Tamil Nadu government salary credit entries.",
    headline: "Indian Overseas Bank Statements to Tally XML — NRI & Government Salary Formats Supported",
    subheadline: "Indian Overseas Bank is a go-to for Tamil Nadu government employees and NRI customers, producing statement PDFs with salary batch credits and overseas remittance entries that require careful ledger separation. Acrozo identifies these patterns automatically, splitting salary credits from reimbursement allowances and mapping FCNR remittances to the correct foreign exchange ledgers in Tally.",
    features: [
      "Tamil Nadu government salary batch credits split from allowance reimbursements",
      "NRI FCNR and RFC account remittances mapped to foreign exchange Tally ledgers",
      "IOB net banking and branch-generated PDF formats both supported without toggling",
    ],
    trustLine: "Trusted by Tamil Nadu CAs managing Indian Overseas Bank government salary and NRI remittance accounts.",
    schemaDescription: "Converts Indian Overseas Bank statement PDFs to Tally Prime XML, with Tamil Nadu government salary classification, NRI remittance mapping, and IOB net banking format support.",
  },
};

export const VALID_BANK_SLUGS = new Set(Object.keys(BANK_DATA));

// ─── Head tag helpers ─────────────────────────────────────────────────────────

function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) { el = document.createElement("meta"); el.name = name; document.head.appendChild(el); }
  el.content = content;
}

function setOgMeta(property: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute("property", property); document.head.appendChild(el); }
  el.content = content;
}

function injectJsonLd(meta: BankMeta, slug: string) {
  const id = `jsonld-bank-${slug}`;
  document.getElementById(id)?.remove();
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `${meta.bankName} to Tally XML Converter`,
    operatingSystem: "Web",
    applicationCategory: "FinanceApplication",
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
    description: meta.schemaDescription,
    url: `https://www.acrozo.eu.cc/${slug}`,
    provider: { "@type": "Organization", name: "Acrozo", url: "https://acrozo.eu.cc" },
    featureList: meta.features.join("; "),
    keywords: `${meta.bankName}, Tally XML, bank statement converter, PDF to Tally, ${meta.shortCode} to Tally`,
  };
  const script = document.createElement("script");
  script.id = id; script.type = "application/ld+json";
  script.textContent = JSON.stringify(schema, null, 2);
  document.head.appendChild(script);
}

// ─── CheckIcon ────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BankSeoWrapper() {
  const params = useParams<{ bankSlug: string }>();
  const slug = params.bankSlug ?? "";
  const meta = BANK_DATA[slug];
  const { openLogin, openSignup } = useAuthModal();

  useEffect(() => {
    if (!meta) return;
    const prevTitle = document.title;
    document.title = meta.pageTitle;
    setMeta("description", meta.metaDescription);
    setMeta("robots", "index, follow");

    let canonical = document.querySelector<HTMLLinkElement>("link[rel='canonical']");
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = `https://www.acrozo.eu.cc/${slug}`;

    setOgMeta("og:title", meta.pageTitle);
    setOgMeta("og:description", meta.metaDescription);
    setOgMeta("og:url", `https://www.acrozo.eu.cc/${slug}`);
    setOgMeta("og:type", "website");
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", meta.pageTitle);
    setMeta("twitter:description", meta.metaDescription);

    injectJsonLd(meta, slug);
    return () => {
      document.title = prevTitle;
      document.getElementById(`jsonld-bank-${slug}`)?.remove();
    };
  }, [slug, meta]);

  if (!meta) return <Redirect to="/not-found" />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">

      {/* SEO Hero */}
      <div className="max-w-4xl mx-auto px-4 pt-10 pb-6 text-center">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 mb-5">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          Free · No signup required · Instant download
        </span>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
          {meta.headline}
        </h1>
        <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto mb-7">
          {meta.subheadline}
        </p>

        <ul className="inline-flex flex-col sm:flex-row sm:flex-wrap gap-3 text-left mx-auto max-w-3xl mb-4">
          {meta.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 shadow-sm sm:flex-1">
              <CheckIcon /><span>{f}</span>
            </li>
          ))}
        </ul>

        <p className="text-xs text-slate-400 italic mt-2">{meta.trustLine}</p>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        <div className="border-t border-dashed border-slate-200 my-2" />
      </div>

      {/* Tool — always visible; auth modal fires only when user clicks Process */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <BankPdfToTally onAuthRequired={openSignup} />
      </div>

      {/* Below-fold SEO */}
      <div className="max-w-3xl mx-auto px-4 pb-16 mt-4">
        <div className="border-t border-slate-100 pt-10">
          <h2 className="text-xl font-bold text-slate-800 mb-3">
            How to convert your {meta.bankName} statement to Tally XML
          </h2>
          <ol className="space-y-3 text-sm text-slate-600 list-none">
            {[
              `Download your ${meta.bankName} account statement as a PDF from ${meta.shortCode} Net Banking or the mobile app.`,
              "Upload the PDF using the tool above — no account creation required.",
              "Review the auto-detected transactions and adjust any ledger mappings if needed.",
              "Click Download XML and import the file directly into Tally Prime or Tally ERP 9 via the XML import utility.",
            ].map((step, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

    </div>
  );
}
