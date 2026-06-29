import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { 
  IndianRupee, 
  CreditCard, 
  Smartphone, 
  ArrowRight, 
  ArrowLeft, 
  QrCode, 
  Lock, 
  CheckCircle2, 
  ShieldCheck, 
  Landmark, 
  Loader2, 
  Sparkles,
  SmartphoneNfc,
  Check
} from 'lucide-react';
import Header from '@/components/header';

export default function PaymentMockPage() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<null | 'upi' | 'card' | 'netbanking'>(null);
  
  // UPI states
  const [upiSubTab, setUpiSubTab] = useState<'qr' | 'id'>('qr');
  const [upiId, setUpiId] = useState('');
  const [upiIdError, setUpiIdError] = useState('');
  const [upiRequestSent, setUpiRequestSent] = useState(false);
  const [qrCodeExpired, setQrCodeExpired] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes

  // Card states
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [cvvFocused, setCvvFocused] = useState(false);

  // Net banking states
  const [selectedBank, setSelectedBank] = useState('');

  // Initial loading simulation
  useEffect(() => {
    const pendingPurchase = sessionStorage.getItem('pending_purchase');
    if (!pendingPurchase) {
      navigate('/pricing');
      return;
    }
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, [navigate]);

  // QR Code Timer
  useEffect(() => {
    if (selectedMethod !== 'upi' || upiSubTab !== 'qr' || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setQrCodeExpired(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [selectedMethod, upiSubTab, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePayment = async () => {
    setProcessing(true);
    
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get pending purchase data
    const pendingPurchase = sessionStorage.getItem('pending_purchase');
    if (pendingPurchase) {
      const data = JSON.parse(pendingPurchase);
      
      // Update the backend to complete the order
      try {
        const orderId = data.paymentData?.order_id;
        if (orderId) {
          await fetch(`${window.location.origin.replace(':5173', ':8000')}/api/payment/complete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ order_id: parseInt(orderId) })
          });
        }
      } catch (error) {
        console.error('Error completing payment backend callback:', error);
      }

      // Redirect to success page with demo mode
      navigate(`/purchase/success?payment_id=${data.paymentData?.payment_id || 'DEMO_' + Date.now()}&order_id=${data.paymentData?.order_id || 'DEMO'}&demo=1`);
    }
    setProcessing(false);
  };

  const handleUpiRequest = () => {
    if (!upiId.trim() || !upiId.includes('@')) {
      setUpiIdError('Please enter a valid UPI ID (e.g. user@upi)');
      return;
    }
    setUpiIdError('');
    setUpiRequestSent(true);
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 16) value = value.slice(0, 16);
    const formatted = value.match(/.{1,4}/g)?.join(' ') || value;
    setCardNumber(formatted);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    
    if (value.length > 2) {
      setCardExpiry(`${value.slice(0, 2)}/${value.slice(2)}`);
    } else {
      setCardExpiry(value);
    }
  };

  const handleCVVChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 3) {
      setCardCVV(value);
    }
  };

  const getCardBrand = (number: string) => {
    const clean = number.replace(/\s/g, '');
    if (clean.startsWith('4')) return 'visa';
    if (/^5[1-5]/.test(clean)) return 'mastercard';
    if (/^6/.test(clean)) return 'rupay';
    return 'generic';
  };

  const cardBrand = getCardBrand(cardNumber);

  const pendingPurchase = sessionStorage.getItem('pending_purchase');
  const purchaseData = pendingPurchase ? JSON.parse(pendingPurchase) : null;
  const price = purchaseData?.price || '99';

  // Custom CSS for card flip
  const cardStyles = `
    .perspective-1000 {
      perspective: 1000px;
    }
    .transform-style-3d {
      transform-style: preserve-3d;
    }
    .backface-hidden {
      backface-visibility: hidden;
    }
    .rotate-y-180 {
      transform: rotateY(180deg);
    }
  `;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-slate-400 font-medium">Securing connection to gateway...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col text-slate-100">
      <style dangerouslySetInnerHTML={{ __html: cardStyles }} />
      
      <main className="flex-1 flex items-center justify-center p-4 pt-24 pb-12">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden w-full max-w-4xl flex flex-col md:flex-row">
          
          {/* LEFT PANEL: Checkout Details / Forms */}
          <div className="flex-1 p-6 md:p-8 border-b md:border-b-0 md:border-r border-slate-800">
            {/* Back to method selection if inside one */}
            {selectedMethod && (
              <button 
                onClick={() => {
                  setSelectedMethod(null);
                  setUpiRequestSent(false);
                  setCardNumber('');
                  setCardHolder('');
                  setCardExpiry('');
                  setCardCVV('');
                  setSelectedBank('');
                }}
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white mb-6 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Payment Options
              </button>
            )}

            {!selectedMethod ? (
              <div>
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-transparent bg-clip-text flex items-center gap-2">
                    Payment Gateway
                  </h1>
                  <p className="text-slate-400 text-sm mt-1">Select your preferred payment method below.</p>
                </div>

                <div className="space-y-4">
                  {/* UPI Button */}
                  <button
                    onClick={() => setSelectedMethod('upi')}
                    className="w-full group flex items-center justify-between p-4 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 rounded-2xl transition-all duration-300"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-purple-500/10 group-hover:bg-purple-500/20 rounded-xl flex items-center justify-center transition-colors">
                        <Smartphone className="w-6 h-6 text-purple-400" />
                      </div>
                      <div className="text-left">
                        <span className="block font-semibold text-slate-200">UPI / QR Code</span>
                        <span className="block text-xs text-slate-400 mt-0.5">Pay via GPay, Paytm, BHIM, or other UPI apps</span>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                  </button>

                  {/* Card Button */}
                  <button
                    onClick={() => setSelectedMethod('card')}
                    className="w-full group flex items-center justify-between p-4 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 rounded-2xl transition-all duration-300"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-500/10 group-hover:bg-blue-500/20 rounded-xl flex items-center justify-center transition-colors">
                        <CreditCard className="w-6 h-6 text-blue-400" />
                      </div>
                      <div className="text-left">
                        <span className="block font-semibold text-slate-200">Credit / Debit Card</span>
                        <span className="block text-xs text-slate-400 mt-0.5">Visa, Mastercard, RuPay accepted</span>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                  </button>

                  {/* Net Banking Button */}
                  <button
                    onClick={() => setSelectedMethod('netbanking')}
                    className="w-full group flex items-center justify-between p-4 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 rounded-2xl transition-all duration-300"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-orange-500/10 group-hover:bg-orange-500/20 rounded-xl flex items-center justify-center transition-colors">
                        <Landmark className="w-6 h-6 text-orange-400" />
                      </div>
                      <div className="text-left">
                        <span className="block font-semibold text-slate-200">Net Banking</span>
                        <span className="block text-xs text-slate-400 mt-0.5">Select from top Indian banks</span>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                  </button>
                </div>
              </div>
            ) : selectedMethod === 'upi' ? (
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-slate-100">UPI Payment</h2>
                  <p className="text-xs text-slate-400 mt-1">Instant, secure transfer via UPI apps</p>
                </div>

                {/* Sub tabs */}
                <div className="flex border-b border-slate-800 mb-6">
                  <button
                    onClick={() => { setUpiSubTab('qr'); setUpiRequestSent(false); }}
                    className={`flex-1 pb-3 text-sm font-semibold transition-colors ${
                      upiSubTab === 'qr' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Scan QR Code
                  </button>
                  <button
                    onClick={() => setUpiSubTab('id')}
                    className={`flex-1 pb-3 text-sm font-semibold transition-colors ${
                      upiSubTab === 'id' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Enter UPI ID
                  </button>
                </div>

                {upiSubTab === 'qr' ? (
                  <div className="flex flex-col items-center text-center">
                    {qrCodeExpired ? (
                      <div className="py-8 px-4 border border-dashed border-red-500/30 bg-red-500/5 rounded-2xl w-full flex flex-col items-center">
                        <p className="text-sm font-semibold text-red-400">QR Code Expired</p>
                        <p className="text-xs text-slate-400 mt-1 mb-4">The secure payment window has timed out.</p>
                        <button
                          onClick={() => {
                            setTimeLeft(300);
                            setQrCodeExpired(false);
                          }}
                          className="px-4 py-2 rounded-lg text-xs font-semibold text-[#0a1e40] transition-all"
                          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.88), rgba(180,220,255,0.82))", boxShadow: "0 4px 16px rgba(150,200,255,0.28), inset 0 1px 0 rgba(255,255,255,0.6)" }}
                        >
                          Regenerate QR Code
                        </button>
                      </div>
                    ) : (
                      <div className="w-full flex flex-col items-center">
                        <div className="relative p-3 bg-white rounded-2xl shadow-xl mb-4 border border-slate-200">
                          {/* QR Code SVG */}
                          <svg width="160" height="160" viewBox="0 0 100 100" className="text-slate-900">
                            {/* Position Detection Patterns */}
                            <rect x="5" y="5" width="22" height="22" fill="currentColor" rx="1.5" />
                            <rect x="9.5" y="9.5" width="13" height="13" fill="#ffffff" rx="0.5" />
                            <rect x="13" y="13" width="6" height="6" fill="currentColor" rx="0.5" />

                            <rect x="73" y="5" width="22" height="22" fill="currentColor" rx="1.5" />
                            <rect x="77.5" y="9.5" width="13" height="13" fill="#ffffff" rx="0.5" />
                            <rect x="81" y="81" width="6" height="6" rx="0.5" />
                            <rect x="81" y="13" width="6" height="6" fill="currentColor" rx="0.5" />

                            <rect x="5" y="73" width="22" height="22" fill="currentColor" rx="1.5" />
                            <rect x="9.5" y="77.5" width="13" height="13" fill="#ffffff" rx="0.5" />
                            <rect x="13" y="81" width="6" height="6" fill="currentColor" rx="0.5" />

                            <rect x="73" y="73" width="9" height="9" fill="currentColor" rx="0.5" />
                            <rect x="76" y="76" width="3" height="3" fill="#ffffff" />

                            {/* Center Logo */}
                            <rect x="42" y="42" width="16" height="16" fill="#2563eb" rx="2" />
                            <path d="M46 51.5 L50 45 L54 51.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />

                            {/* Random bits */}
                            <rect x="33" y="5" width="5" height="5" fill="currentColor" />
                            <rect x="43" y="5" width="10" height="5" fill="currentColor" />
                            <rect x="63" y="5" width="5" height="5" fill="currentColor" />
                            <rect x="33" y="15" width="15" height="5" fill="currentColor" />
                            <rect x="53" y="10" width="5" height="10" fill="currentColor" />
                            <rect x="38" y="25" width="5" height="5" fill="currentColor" />
                            <rect x="48" y="25" width="15" height="5" fill="currentColor" />
                            <rect x="5" y="33" width="10" height="5" fill="currentColor" />
                            <rect x="23" y="33" width="5" height="10" fill="currentColor" />
                            <rect x="33" y="33" width="15" height="5" fill="currentColor" />
                            <rect x="53" y="33" width="5" height="5" fill="currentColor" />
                            <rect x="63" y="33" width="10" height="5" fill="currentColor" />
                            <rect x="10" y="43" width="5" height="5" fill="currentColor" />
                            <rect x="38" y="43" width="12" height="5" fill="currentColor" />
                            <rect x="63" y="43" width="5" height="10" fill="currentColor" />
                            <rect x="5" y="53" width="5" height="5" fill="currentColor" />
                            <rect x="15" y="53" width="15" height="5" fill="currentColor" />
                            <rect x="33" y="53" width="5" height="5" fill="currentColor" />
                            <rect x="43" y="53" width="10" height="5" fill="currentColor" />
                            <rect x="78" y="53" width="15" height="5" fill="currentColor" />
                            <rect x="33" y="63" width="10" height="5" fill="currentColor" />
                            <rect x="48" y="63" width="5" height="15" fill="currentColor" />
                            <rect x="58" y="63" width="5" height="5" fill="currentColor" />
                            <rect x="33" y="73" width="5" height="10" fill="currentColor" />
                            <rect x="43" y="78" width="5" height="5" fill="currentColor" />
                            <rect x="58" y="73" width="10" height="5" fill="currentColor" />
                            <rect x="83" y="73" width="5" height="15" fill="currentColor" />
                            <rect x="33" y="88" width="15" height="5" fill="currentColor" />
                            <rect x="53" y="83" width="10" height="5" fill="currentColor" />
                            <rect x="68" y="88" width="10" height="5" fill="currentColor" />
                          </svg>

                          <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 hover:opacity-100 transition-opacity rounded-2xl cursor-zoom-in">
                            <span className="bg-slate-900 text-[10px] text-white font-semibold px-2 py-1 rounded">View Larger</span>
                          </div>
                        </div>

                        <p className="text-sm font-semibold text-slate-300 flex items-center gap-1.5 justify-center mb-1">
                          Scan to pay <span className="text-cyan-400 font-bold">₹{price}</span>
                        </p>
                        <p className="text-xs text-slate-400 mb-4 px-6 leading-normal">
                          Open your camera or any UPI app (GPay, Paytm, BHIM) and scan the QR code to make payment.
                        </p>

                        <div className="flex items-center justify-center gap-2 mb-6 bg-slate-800/40 border border-slate-800 rounded-full px-3 py-1.5 text-xs text-slate-300">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                          <span>Waiting for payment... Code expires in </span>
                          <span className="font-mono text-cyan-400 font-semibold">{formatTime(timeLeft)}</span>
                        </div>

                        <button
                          onClick={handlePayment}
                          className="w-full py-3.5 hover: hover: text-white font-bold rounded-xl shadow-lg shadow-emerald-950/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                          <Sparkles className="w-4 h-4 text-emerald-100" />
                          Simulate QR Code Scan & Success
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {!upiRequestSent ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Enter UPI ID
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={upiId}
                              onChange={(e) => {
                                setUpiId(e.target.value);
                                if (upiIdError) setUpiIdError('');
                              }}
                              placeholder="username@okaxis, mobile@ybl, etc."
                              className={`w-full bg-slate-950 border ${
                                upiIdError ? 'border-red-500/50' : 'border-slate-800 focus:border-cyan-500/50'
                              } rounded-xl px-4 py-3.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-colors`}
                            />
                          </div>
                          {upiIdError && (
                            <p className="text-xs text-red-400 mt-1.5">{upiIdError}</p>
                          )}
                        </div>

                        <button
                          onClick={handleUpiRequest}
                          className="w-full py-3.5 rounded-xl font-semibold text-[#0a1e40] transition-all shadow-md"
                          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.88), rgba(180,220,255,0.82))", boxShadow: "0 4px 16px rgba(150,200,255,0.28), inset 0 1px 0 rgba(255,255,255,0.6)" }}
                        >
                          Verify & Send Request
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-6 px-4 border border-dashed border-cyan-500/30 bg-cyan-500/5 rounded-2xl">
                        <div className="w-12 h-12 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                          <SmartphoneNfc className="w-6 h-6 text-cyan-400 animate-pulse" />
                        </div>
                        <p className="text-sm font-semibold text-slate-200">Request sent to {upiId}</p>
                        <p className="text-xs text-slate-400 mt-1.5 mb-6 leading-normal px-4">
                          Please open your UPI app (Google Pay, Paytm, etc.) on your mobile device. You will see a payment notification request of <strong>₹{price}</strong> from Acrozo.
                        </p>
                        
                        <div className="flex flex-col gap-2 max-w-xs mx-auto">
                          <button
                            onClick={handlePayment}
                            className="w-full py-3 rounded-lg text-sm font-bold text-[#0a1e40] transition-all flex items-center justify-center gap-1.5"
                            style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.88), rgba(180,220,255,0.82))", boxShadow: "0 4px 16px rgba(150,200,255,0.28), inset 0 1px 0 rgba(255,255,255,0.6)" }}
                          >
                            <CheckCircle2 className="w-4 h-4" /> Simulate App Approval
                          </button>
                          
                          <button
                            onClick={() => setUpiRequestSent(false)}
                            className="w-full py-2.5 rounded-lg text-xs font-semibold text-blue-200/70 hover:text-white transition-all"
                          >
                            Cancel Request
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : selectedMethod === 'card' ? (
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-slate-100">Card Payment</h2>
                  <p className="text-xs text-slate-400 mt-1">Secure debit/credit card transaction</p>
                </div>

                <div className="space-y-4">
                  {/* Card Number Input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Card Number
                    </label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      placeholder="4000 1234 5678 9010"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/50 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Card Holder Input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Cardholder Name
                    </label>
                    <input
                      type="text"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                      placeholder="JOHN DOE"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/50 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Expiry / CVV inputs side-by-side */}
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={handleExpiryChange}
                        placeholder="MM/YY"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/50 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 text-center focus:outline-none transition-colors"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        CVV
                      </label>
                      <input
                        type="password"
                        value={cardCVV}
                        onChange={handleCVVChange}
                        onFocus={() => setCvvFocused(true)}
                        onBlur={() => setCvvFocused(false)}
                        placeholder="•••"
                        maxLength={3}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/50 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 text-center focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handlePayment}
                    disabled={cardNumber.replace(/\s/g, '').length < 16 || cardCVV.length < 3 || !cardExpiry || !cardHolder}
                    className="w-full mt-2 py-3.5 rounded-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed text-[#0a1e40] shadow-lg transition-all flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.88), rgba(180,220,255,0.82))", boxShadow: "0 4px 16px rgba(150,200,255,0.28), inset 0 1px 0 rgba(255,255,255,0.6)" }}
                  >
                    <Lock className="w-4 h-4 text-cyan-200" />
                    Pay ₹{price} Securely
                  </button>

                  <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 mt-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Your transaction is secured with 256-bit SSL encryption.</span>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-slate-100">Net Banking</h2>
                  <p className="text-xs text-slate-400 mt-1">Direct log-in transfer from your bank account</p>
                </div>

                <div className="space-y-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Popular Banks
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'hdfc', name: 'HDFC Bank', color: 'border-blue-900 hover:bg-blue-950/20' },
                      { id: 'sbi', name: 'State Bank of India', color: 'border-sky-700 hover:bg-sky-950/20' },
                      { id: 'icici', name: 'ICICI Bank', color: 'border-orange-800 hover:bg-orange-950/20' },
                      { id: 'axis', name: 'Axis Bank', color: 'border-rose-900 hover:bg-rose-950/20' }
                    ].map(bank => (
                      <button
                        key={bank.id}
                        onClick={() => setSelectedBank(bank.id)}
                        className={`p-3.5 border rounded-xl font-medium text-xs flex flex-col items-center justify-center gap-1 transition-all ${
                          selectedBank === bank.id 
                            ? 'border-cyan-500 bg-cyan-950/20 text-cyan-400 shadow-md ring-1 ring-cyan-500/50' 
                            : 'border-slate-800 text-slate-300 ' + bank.color
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] ${
                          selectedBank === bank.id ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {bank.id.toUpperCase()}
                        </div>
                        {bank.name}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Or Select Other Bank
                    </label>
                    <select
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/50 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none transition-colors"
                    >
                      <option value="">-- Choose Bank --</option>
                      <option value="kotak">Kotak Mahindra Bank</option>
                      <option value="yes">Yes Bank</option>
                      <option value="pnb">Punjab National Bank</option>
                      <option value="bob">Bank of Baroda</option>
                      <option value="idbi">IDBI Bank</option>
                      <option value="indusind">IndusInd Bank</option>
                    </select>
                  </div>

                  <button
                    onClick={handlePayment}
                    disabled={!selectedBank}
                    className="w-full mt-4 py-3.5 rounded-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed text-[#0a1e40] transition-all flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.88), rgba(180,220,255,0.82))", boxShadow: "0 4px 16px rgba(150,200,255,0.28), inset 0 1px 0 rgba(255,255,255,0.6)" }}
                  >
                    <span>Proceed to Secure Bank Login</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PANEL: Order Summary & Active Card Preview */}
          <div className="w-full md:w-80 bg-slate-900/40 p-6 md:p-8 flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-slate-300 mb-4 pb-2 border-b border-slate-800/80 text-sm">
                Order Summary
              </h3>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Selected Plan</span>
                  <span className="font-semibold text-slate-200">{purchaseData?.plan_name || 'Premium Plan'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Total Credits</span>
                  <span className="font-semibold text-slate-200">{purchaseData?.credits || '100'} Credits</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Duration</span>
                  <span className="font-semibold text-slate-200">{purchaseData?.duration_days || '30'} Days</span>
                </div>
                <div className="border-t border-slate-800/80 pt-3 mt-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-semibold text-slate-300">Amount Due</span>
                    <span className="text-xl font-bold text-cyan-400 flex items-center">
                      <IndianRupee className="w-4 h-4 stroke-[2.5]" />
                      {price}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Interactive Card Display (Visible only when CARD method is selected) */}
              {selectedMethod === 'card' && (
                <div className="mt-8 pt-6 border-t border-slate-800/80">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest text-center mb-4">
                    Live Card Preview
                  </p>
                  
                  {/* Virtual Card Wrapper */}
                  <div className="w-full max-w-[260px] h-40 perspective-1000 mx-auto">
                    <div className={`relative w-full h-full duration-500 transform-style-3d ${
                      cvvFocused ? 'rotate-y-180' : ''
                    }`}>
                      
                      {/* FRONT CARD */}
                      <div className="absolute inset-0 w-full h-full rounded-2xl p-4 backface-hidden flex flex-col justify-between shadow-xl text-white overflow-hidden border border-white/10">
                        {/* Chip & Brand */}
                        <div className="flex justify-between items-start">
                          <div className="w-8 h-5.5 bg-amber-400/90 rounded mt-0.5 flex flex-col justify-between p-0.5 border border-amber-600/30">
                            <div className="h-[1px] w-full bg-slate-800/20"></div>
                            <div className="h-[1px] w-full bg-slate-800/20"></div>
                          </div>
                          
                          {/* Card Network Logos */}
                          <div>
                            {cardBrand === 'visa' && (
                              <span className="text-xs font-black italic tracking-widest text-slate-100">VISA</span>
                            )}
                            {cardBrand === 'mastercard' && (
                              <div className="flex -space-x-1.5">
                                <div className="w-4.5 h-4.5 rounded-full bg-red-500 opacity-90"></div>
                                <div className="w-4.5 h-4.5 rounded-full bg-amber-500 opacity-90"></div>
                              </div>
                            )}
                            {cardBrand === 'rupay' && (
                              <span className="text-[10px] font-extrabold italic tracking-tighter text-white px-1 rounded-sm">RuPay</span>
                            )}
                            {cardBrand === 'generic' && (
                              <CreditCard className="w-4.5 h-4.5 text-white/50" />
                            )}
                          </div>
                        </div>

                        {/* Card Number */}
                        <div className="my-2.5">
                          <p className="text-sm font-mono tracking-widest text-center">
                            {cardNumber || '•••• •••• •••• ••••'}
                          </p>
                        </div>

                        {/* Holder & Expiry */}
                        <div className="flex justify-between items-end">
                          <div className="max-w-[70%]">
                            <p className="text-[7px] uppercase tracking-wider text-slate-300 opacity-70">Card Holder</p>
                            <p className="text-xs font-medium uppercase truncate">
                              {cardHolder || 'JOHN DOE'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[7px] uppercase tracking-wider text-slate-300 opacity-70">Expires</p>
                            <p className="text-xs font-mono font-medium">
                              {cardExpiry || 'MM/YY'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* BACK CARD */}
                      <div className="absolute inset-0 w-full h-full rounded-2xl backface-hidden shadow-xl text-white flex flex-col justify-between py-4 rotate-y-180 border border-white/10">
                        <div className="w-full h-8 bg-slate-950 mt-1"></div>
                        <div className="px-4 flex items-center justify-between">
                          <div className="flex-1 bg-white/10 h-6 rounded px-1.5 flex items-center justify-end">
                            <span className="text-[8px] text-white/40 italic font-mono mr-1">CCV</span>
                          </div>
                          <div className="bg-amber-100 text-slate-900 font-mono text-xs font-bold px-2 py-0.5 rounded ml-2">
                            {cardCVV || '•••'}
                          </div>
                        </div>
                        <div className="px-4 text-[7px] text-white/30 text-center">
                          SECURE DEMO MODE - ZAIS GATEWAY
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom secure/demo warning info */}
            <div className="mt-8 pt-6 border-t border-slate-800/80">
              <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-3 text-center flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase flex items-center justify-center gap-1.5">
                  <Lock className="w-3 h-3 text-cyan-500" /> Demo Payment Gateway
                </span>
                <p className="text-[10px] text-slate-400 leading-normal">
                  No actual money is charged. Use any mock information to proceed.
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Processing overlay */}
      {processing && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 transition-all">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
            <h4 className="text-base font-bold text-white mb-1">Verifying Transaction</h4>
            <p className="text-xs text-slate-400 leading-relaxed px-4">
              Communicating secure tokens and validating payment channels. Do not close or refresh this page.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
