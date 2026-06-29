import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { clearToken, getApiUrl } from "@/lib/api";
import { CheckCircle, Home, Download, XCircle, AlertCircle, RefreshCw } from "lucide-react";

export default function PurchaseSuccessPage() {
  const [location, navigate] = useLocation();
  const [purchaseData, setPurchaseData] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [verificationState, setVerificationState] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    // Get purchase data from URL params or session storage
    const urlParams = new URLSearchParams(window.location.search);
    const paymentId = urlParams.get('payment_id');
    const stored = sessionStorage.getItem('pending_purchase');

    const isDemoOrReal = paymentId || urlParams.get('demo');
    if (isDemoOrReal) {
      let data = stored ? JSON.parse(stored) : null;
      // If no stored data but we have order_id, try to get plan info from URL
      if (!data) {
        data = {
          plan_name: urlParams.get('plan') || 'Your Plan',
          credits: parseInt(urlParams.get('credits') || '0'),
          duration_days: parseInt(urlParams.get('duration') || '30'),
          price: parseFloat(urlParams.get('amount') || '0')
        };
      }
      setPurchaseData(data);
      sessionStorage.removeItem('pending_purchase');
      const orderId = urlParams.get('order_id');
      if (orderId) {
        updateUserPlanAfterPayment(orderId as string, data);
      } else {
        setVerificationState('success');
      }
    } else {
      // No payment details found, send to pricing
      navigate('/pricing');
    }

    // Process payment_id to get invoice number (without MT and before last _)
    if (paymentId) {
      let cleanId = paymentId.startsWith("MT_") ? paymentId.substring(3) : paymentId;
      const lastUnderscoreIndex = cleanId.lastIndexOf("_");
      if (lastUnderscoreIndex !== -1) {
        cleanId = cleanId.substring(0, lastUnderscoreIndex);
      }
      setInvoiceNumber(cleanId);
    } else {
      // Fallback timestamp-based invoice number: YYYYMMDDHHMMSS
      const now = new Date();
      const fallbackId = now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');
      setInvoiceNumber(fallbackId);
    }

    // Fetch user profile
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) return;
        const response = await fetch(`${getApiUrl()}/api/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const profileData = await response.json();
          setProfile(profileData);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };
    fetchProfile();
  }, [location, navigate]);

  const updateUserPlanAfterPayment = async (orderId: string, data: any) => {
    setVerificationState('verifying');
    setErrorMessage("");
    try {
      // Call backend to verify order completion and status
      const response = await fetch(`${getApiUrl()}/api/payment/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order_id: parseInt(orderId) }),
      });
      if (response.ok) {
        setVerificationState('success');
      } else {
        const errJson = await response.json().catch(() => ({}));
        const detailMsg = errJson.detail || "Payment verification failed or pending on the secure gateway.";
        console.error(`Payment completion failed with status ${response.status}: ${detailMsg}`);
        setVerificationState('failed');
        setErrorMessage(detailMsg);
      }
    } catch (error) {
      console.error('Error completing payment on backend:', error);
      setVerificationState('failed');
      setErrorMessage("Network error verifying transaction status. Please check your dashboard or try again.");
    }
  };

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  if (verificationState === 'verifying') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-card-border max-w-md w-full rounded-2xl p-8 shadow-lg text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Verifying Payment</h1>
          <p className="text-muted-foreground leading-relaxed text-sm">
            Please wait while we securely confirm your payment status with the payment gateway. Do not close or refresh this page.
          </p>
        </div>
      </div>
    );
  }

  if (verificationState === 'failed') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-card-border max-w-md w-full rounded-2xl p-8 shadow-lg text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/10 rounded-full flex items-center justify-center mb-6">
            <XCircle className="w-8 h-8 text-rose-600 dark:text-rose-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Payment Verification Failed</h1>
          <p className="text-rose-500/90 font-medium text-sm mb-4">
            {errorMessage || "We couldn't confirm your transaction details."}
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed mb-8">
            If money was deducted from your account, please do not worry. Your plan credits will be automatically added once the payment processor updates our server webhook. You can also retry verification or go back to plans.
          </p>

          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={() => {
                const urlParams = new URLSearchParams(window.location.search);
                const orderId = urlParams.get('order_id');
                if (orderId) updateUserPlanAfterPayment(orderId, purchaseData);
              }}
              className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Verification
            </button>
            <button
              onClick={() => navigate('/pricing')}
              className="w-full py-3 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/90 transition-colors"
            >
              View Pricing Plans
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success view (verificationState === 'success')
  return (
    <div>
      {/* Print-only styles: hide everything except invoice section */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #invoice-print-section,
          #invoice-print-section * { visibility: visible !important; }
          #invoice-print-section {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            padding: 24px !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
        }
      `}</style>
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0 print:max-w-full print:w-full">
        <div className="text-center mb-8 print:hidden">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-2">Payment Successful!</h1>
          <p className="text-lg text-muted-foreground mb-6">
            Your {purchaseData?.plan_name} plan has been activated successfully
          </p>
        </div>

        {/* Invoice (Receipt) Container */}
        <div id="invoice-print-section" className="bg-card border border-card-border rounded-xl p-8 shadow-sm mb-8">
          {/* Invoice Header */}
          <div className="flex justify-between items-start border-b border-card-border pb-6 mb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <img
                  src="/logo.png"
                  alt="Acrozo Icon"
                  className="h-10 w-auto object-contain invert animate-pulse"
                />
                <div className="h-7 border-l border-gray-300 mx-1" />
                <img
                  src="/web-logo.png?v=1"
                  alt="Acrozo Logo"
                  className="h-6 w-auto object-contain invert"
                />
              </div>
              <p className="text-[10px] text-muted-foreground tracking-wider uppercase font-semibold mt-1 pl-0.5">
                Advanced Core Reliable Operations · Zero Outages
              </p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-foreground tracking-tight uppercase mb-1">Invoice</h2>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Invoice No: <span className="font-semibold text-foreground font-mono">{invoiceNumber}</span></p>
                <p>Date: <span className="text-foreground">{formattedDate}</span></p>
              </div>
            </div>
          </div>

          {/* Billing Info (Buying Partner) */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Buying Partner (Bill To)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border border-card-border text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Full Name</p>
                <p className="font-medium text-foreground">{profile?.full_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">User ID</p>
                <p className="font-medium text-foreground font-mono">{profile?.id || 'N/A'}</p>
              </div>
              <div className="mt-2 sm:mt-0">
                <p className="text-xs text-muted-foreground mb-0.5">Email Address</p>
                <p className="font-medium text-foreground break-all">{profile?.email || 'N/A'}</p>
              </div>
              <div className="mt-2 sm:mt-0">
                <p className="text-xs text-muted-foreground mb-0.5">Phone Number</p>
                <p className="font-medium text-foreground">{profile?.phone || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Invoice Table */}
          <div className="border border-card-border rounded-lg overflow-hidden mb-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 text-xs font-semibold text-muted-foreground border-b border-card-border">
                  <th className="p-3">Description</th>
                  <th className="p-3 text-center">Duration</th>
                  <th className="p-3 text-center">Credits</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border text-sm text-foreground">
                <tr>
                  <td className="p-3">
                    <p className="font-medium">{purchaseData?.plan_name} Plan Subscription</p>
                    <p className="text-xs text-muted-foreground">Access to premium conversion tools</p>
                  </td>
                  <td className="p-3 text-center">{purchaseData?.duration_days} Days</td>
                  <td className="p-3 text-center">{purchaseData?.credits}</td>
                  <td className="p-3 text-right">₹{purchaseData?.price}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Invoice Summary */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1 text-sm text-right">
              <div className="flex justify-between font-bold text-foreground text-base">
                <span>Total Paid</span>
                <span>₹{purchaseData?.price}</span>
              </div>
              <p className="text-xs text-muted-foreground">Inclusive of all taxes</p>
            </div>
          </div>

          {/* Note */}
          <div className="border-t border-card-border mt-8 pt-4 text-center text-xs text-muted-foreground">
            <p>This is a computer-generated invoice. No signature is required.</p>
            <p className="mt-1 font-medium text-foreground">Thank you for choosing Acrozo!</p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-6 mb-8 print:hidden">
          <h3 className="font-semibold text-foreground mb-3">What's Next?</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Your credits have been added to your account immediately</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>You can start using all features right away</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>A confirmation email has been sent to your registered email</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 print:hidden">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </button>

          <button
            onClick={() => window.print()}
            className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download Receipt
          </button>
        </div>
      </main>
    </div>
  );
}
