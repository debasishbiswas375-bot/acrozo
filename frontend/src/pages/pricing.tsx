import { useState } from "react";
import { useLocation } from "wouter";
import { clearToken, isAdmin, getApiUrl} from "@/lib/api";
import { usePlanColors } from "@/contexts/plan-colors-context";
import { useGetPublicPlans } from "@/lib/api-client";
import type { Plan } from "@/lib/api-client";
import Notifications from "@/components/notifications";
import AvatarDropdown from "@/components/avatar-dropdown";
import Navigation from "@/components/navigation";
import { IndianRupee, Check, Star, Zap, Shield, Crown } from "lucide-react";

export default function PricingPage() {
  const [location, navigate] = useLocation();
  const { getPlanColor } = usePlanColors();
  const { data: plans, isLoading, error } = useGetPublicPlans();

  // Debug: Log plan loading status
  console.log('Pricing page - Plans loading status:', { isLoading, error, plans: plans?.length });

  const handleLogout = () => {
    clearToken();
    navigate("/");
  };

  const handlePurchasePlan = async (plan: Plan) => {
    // Debug: Check if user is logged in
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    console.log('=== Purchase Debug Start ===');
    console.log('Token exists:', !!token);
    console.log('Token (first 20 chars):', token ? token.substring(0, 20) + '...' : 'none');
    console.log('Plan:', plan);
    console.log('Current URL:', window.location.href);
    
    // Check if user is authenticated
    if (!token) {
      console.log('No token found, redirecting to login');
      alert('Please login to purchase a plan');
      console.log('About to navigate to login...');
      navigate('/login');
      console.log('Navigate to login called');
      return;
    }
    
    console.log('Token found, proceeding with payment...');
    console.log('=== Purchase Debug End ===');
    
    if (plan.price === 0) {
      // Free plan - activate immediately
      try {
        const response = await fetch(`${getApiUrl()}/api/user/plan`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            plan: plan.name,
            credits: plan.credits,
            expires_at: new Date(Date.now() + plan.duration_days * 24 * 60 * 60 * 1000).toISOString()
          })
        });
        
        if (response.ok) {
          alert(`🎉 Successfully activated ${plan.name} plan!\n\nYou now have ${plan.credits} credits.`);
          navigate('/dashboard');
        } else {
          const error = await response.json();
          alert(`❌ Failed to activate plan: ${error.error || 'Unknown error'}`);
        }
      } catch (error) {
        alert(`❌ Error activating plan: ${(error as Error).message}`);
      }
    } else {
      // Paid plan - redirect to PhonePe payment
      const paymentData = {
        plan_id: plan.id,
        plan_name: plan.name,
        price: plan.price,
        credits: plan.credits,
        duration_days: plan.duration_days,
        success_url: `${window.location.origin}/purchase/success`,
        cancel_url: `${window.location.origin}/pricing`
      };
      
      // Generate a demo payment ID
      const mt_id = `MT_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      // Create PhonePe payment order
      try {
        console.log('Creating PhonePe payment order...');
        console.log('Using token:', token.substring(0, 20) + '...');
        const response = await fetch(`${getApiUrl()}/api/payment/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            plan_id: plan.id,
            payment_method: 'phonepe'
          })
        });

        console.log('Payment API response status:', response.status);
        const result = await response.json();
        console.log('Payment API response:', result);
        
        if (response.status === 401) {
          console.log('401 Unauthorized - redirecting to login');
          alert('Please login to purchase a plan');
          window.location.href = '/login';
          return;
        }
        
        if (response.ok && result.payment_url) {
          console.log('Payment successful, redirecting to:', result.payment_url);
          // Store order details for the mock payment page
          sessionStorage.setItem('pending_purchase', JSON.stringify({
            plan_id: plan.id,
            plan_name: plan.name,
            price: plan.price,
            credits: plan.credits,
            duration_days: plan.duration_days,
            paymentData: {
              order_id: result.order_id,
              payment_id: result.payment_url.includes('mock') ? 'DEMO_' + Date.now() : mt_id
            }
          }));
          window.location.href = result.payment_url;
        } else {
          console.log('Payment failed:', result);
          alert(`Payment failed: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Payment creation error:', error);
        alert(`Error processing payment: ${(error as Error).message}`);
      }
    }
  };

  return (
    <div>
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <div className="mb-6">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Choose the perfect plan for your needs. Start free and upgrade as you grow.
            </p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-8 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              <span>No hidden fees</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              <span>24/7 support</span>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        {isLoading ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
              <span className="text-slate-600">Loading amazing plans...</span>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="bg-red-50 border border-red-200 rounded-xl p-8 max-w-md mx-auto">
              <div className="text-red-600 mb-4">
                <div className="text-6xl mb-2">⚠️</div>
                <h3 className="text-xl font-semibold">Unable to Load Plans</h3>
              </div>
              <p className="text-red-700 mb-4">We're having trouble loading our pricing plans. Please try again in a moment.</p>
              <p className="text-sm text-red-600">Error: {error?.message || 'Unknown error'}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : plans && plans.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {plans.filter(plan => plan.name.toLowerCase() !== "free" && plan.name.toLowerCase() !== "unlimited" && plan.price > 0).map((plan, index) => (
              <div 
                key={plan.id} 
                className={`relative bg-white rounded-2xl shadow-lg border-2 transition-all duration-300 hover:shadow-xl hover:scale-105 ${
                  plan.name === "Pro" 
                    ? 'border-indigo-500 ring-4 ring-indigo-100' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Popular Badge */}
                {plan.name === "Pro" && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg">
                      MOST POPULAR
                    </div>
                  </div>
                )}

                {/* Plan Header */}
                <div className="p-8 pb-6">
                  <div className="text-center mb-6">
                    <div className="mb-4">
                      {plan.name === "Free" && <Shield className="w-8 h-8 text-slate-400 mx-auto mb-2" />}
                      {plan.name === "Pro" && <Star className="w-8 h-8 text-indigo-500 mx-auto mb-2" />}
                      {plan.name === "Enterprise" && <Crown className="w-8 h-8 text-purple-500 mx-auto mb-2" />}
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-4xl font-bold text-slate-900">₹{plan.price}</span>
                      {plan.price > 0 && <span className="text-slate-500 text-lg">/month</span>}
                    </div>
                    {plan.price === 0 && (
                      <div className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                        <Zap className="w-3 h-3" />
                        Free Forever
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-4 mb-8">
                    {Array.isArray(plan.features) ? plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-700">{feature}</span>
                      </li>
                    )) : (
                      <li className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-700">Basic features included</span>
                      </li>
                    )}
                  </ul>
                </div>

                {/* CTA Button */}
                <div className="px-8 pb-8 relative z-10">
                  <button 
                    onClick={() => handlePurchasePlan(plan)}
                    className={`w-full px-8 py-5 rounded-xl font-bold text-xl transition-all duration-300 transform hover:scale-105 relative z-20 shadow-xl hover:shadow-2xl border-2 ${
                      plan.price === 0 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 border-green-400' 
                        : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 border-indigo-400'
                    }`}
                  >
                    {plan.price === 0 ? (
                      <span className="flex items-center justify-center gap-3">
                        <Zap className="w-6 h-6" />
                        Get Started Free
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-3">
                        <IndianRupee className="w-6 h-6" />
                        Buy Now
                        <span className="ml-3 bg-white text-slate-900 px-4 py-2 rounded-lg text-lg font-bold shadow-lg">
                          {plan.price}
                        </span>
                      </span>
                    )}
                  </button>
                  
                  {plan.price > 0 && (
                    <p className="text-center text-xs text-slate-500 mt-3">
                      Secure payment checkout
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-slate-600">
              <div className="text-6xl mb-4">No Plans Available</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Plans Available</h3>
              <p className="text-slate-600">Please check back later for available plans.</p>
            </div>
          </div>
        )}
        {/* FAQ Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">Frequently Asked Questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Can I change plans anytime?</h3>
                <p className="text-slate-600">Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">What payment methods do you accept?</h3>
                <p className="text-slate-600">We accept UPI, credit cards, debit cards, and net banking for all payments.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Is there a free trial?</h3>
                <p className="text-slate-600">Yes! Our free plan includes 100 credits per month, perfect for getting started.</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Do credits expire?</h3>
                <p className="text-slate-600">Credits refresh monthly based on your plan. Unused credits don't carry over.</p>
              </div>
            </div>
          </div>
        </div>
      </main>    </div>
  );
}
