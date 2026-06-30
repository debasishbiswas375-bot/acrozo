import { useLocation } from "wouter";
import { useState } from "react";
import { getApiUrl } from "@/lib/api";

export default function Footer() {
  const [, navigate] = useLocation();
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`${getApiUrl()}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: feedback }),
      });
      if (res.ok) {
        setSubmitted(true);
        setFeedback("");
        setTimeout(() => setSubmitted(false), 3000);
      }
    } catch (err) {
      console.error("Error submitting feedback:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer
      className="relative z-10 bg-white dark:bg-gray-dark border-t border-stroke/40 dark:border-stroke-dark/40 pt-8 md:pt-10 lg:pt-12 pb-4 transition-colors duration-300"
    >
      <div className="w-full px-4 lg:px-8">
        <div className="-mx-4 flex flex-wrap">
          
          {/* Brand Info & Socials */}
          <div className="w-full px-4 md:w-1/2 lg:w-4/12 xl:w-5/12 mb-3 lg:mb-4">
            <div className="max-w-[360px]">
              <button
                onClick={() => navigate("/")}
                className="mb-3 inline-flex items-center gap-3 focus:outline-none"
              >
                <img
                  src="/logo.png"
                  alt="Acrozo Icon"
                  className="h-11 w-auto object-contain transition-transform duration-200 hover:scale-[1.02] invert dark:invert-0"
                />
                <img
                  src="/web-logo.png?v=1"
                  alt="Acrozo Logo"
                  className="h-7 w-auto object-contain transition-transform duration-200 hover:scale-[1.02] invert dark:invert-0"
                />
              </button>
              <p className="mb-4 text-sm leading-relaxed text-body-color dark:text-body-color-dark">
                Advanced Core Reliable Operations Zero Outages. Convert your PDFs, generate Tally XML, and manage your accounting workflows smoothly.
              </p>
              
              {/* Social icons */}
              <div className="flex items-center gap-4">
                <a
                  href="#"
                  aria-label="facebook-link"
                  className="text-body-color hover:text-primary-blue dark:text-body-color-dark dark:hover:text-primary-blue transition-colors"
                  onClick={(e) => e.preventDefault()}
                >
                  <svg width="18" height="18" viewBox="0 0 9 18" className="fill-current">
                    <path d="M8.13643 7H6.78036H6.29605V6.43548V4.68548V4.12097H6.78036H7.79741C8.06378 4.12097 8.28172 3.89516 8.28172 3.55645V0.564516C8.28172 0.254032 8.088 0 7.79741 0H6.02968C4.11665 0 2.78479 1.58064 2.78479 3.92339V6.37903V6.94355H2.30048H0.65382C0.314802 6.94355 0 7.25403 0 7.70564V9.7379C0 10.1331 0.266371 10.5 0.65382 10.5H2.25205H2.73636V11.0645V16.7379C2.73636 17.1331 3.00273 17.5 3.39018 17.5H5.66644C5.81174 17.5 5.93281 17.4153 6.02968 17.3024C6.12654 17.1895 6.19919 16.9919 6.19919 16.8226V11.0927V10.5282H6.70771H7.79741C8.11222 10.5282 8.35437 10.3024 8.4028 9.96371V9.93548V9.90726L8.74182 7.95968C8.76604 7.7621 8.74182 7.53629 8.59653 7.31048C8.54809 7.16935 8.33016 7.02823 8.13643 7Z" />
                  </svg>
                </a>
                <a
                  href="#"
                  aria-label="twitter-link"
                  className="text-body-color hover:text-primary-blue dark:text-body-color-dark dark:hover:text-primary-blue transition-colors"
                  onClick={(e) => e.preventDefault()}
                >
                  <svg width="18" height="18" viewBox="0 0 19 14" className="fill-current">
                    <path d="M16.3024 2.26027L17.375 1.0274C17.6855 0.693493 17.7702 0.436644 17.7984 0.308219C16.9516 0.770548 16.1613 0.924658 15.6532 0.924658H15.4556L15.3427 0.821918C14.6653 0.282534 13.8185 0 12.9153 0C10.9395 0 9.3871 1.48973 9.3871 3.21062C9.3871 3.31336 9.3871 3.46747 9.41532 3.57021L9.5 4.0839L8.90726 4.05822C5.29435 3.95548 2.33065 1.13014 1.85081 0.642123C1.06048 1.92637 1.5121 3.15925 1.99194 3.92979L2.95161 5.36815L1.42742 4.5976C1.45565 5.67637 1.90726 6.52397 2.78226 7.14041L3.54435 7.65411L2.78226 7.93665C3.2621 9.24658 4.33468 9.78596 5.125 9.99144L6.16935 10.2483L5.18145 10.8647C3.60081 11.8921 1.625 11.8151 0.75 11.738C2.52823 12.8682 4.64516 13.125 6.1129 13.125C7.21371 13.125 8.03226 13.0223 8.22984 12.9452C16.1331 11.25 16.5 4.82877 16.5 3.54452V3.36473L16.6694 3.26199C17.629 2.44007 18.0242 2.00342 18.25 1.74658C18.1653 1.77226 18.0524 1.82363 17.9395 1.84932L16.3024 2.26027Z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="w-full px-4 sm:w-1/2 md:w-1/2 lg:w-2/12 xl:w-2/12 mb-3 lg:mb-4">
            <h2 className="mb-3 text-sm font-bold text-black dark:text-white">
              Quick Links
            </h2>
            <ul className="space-y-2">
              {[
                { label: "Pricing", path: "/pricing" },
                { label: "PDF Extractor", path: "/pdf-converter" },
                { label: "Sign Up", path: "/signup" },
                { label: "Login", path: "/login" },
              ].map((link) => (
                <li key={link.label}>
                  <button
                    onClick={() => navigate(link.path)}
                    className="text-base text-body-color dark:text-body-color-dark hover:text-primary-blue dark:hover:text-primary-blue transition-colors focus:outline-none"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Account */}
          <div className="w-full px-4 sm:w-1/2 md:w-1/2 lg:w-2/12 xl:w-2/12 mb-3 lg:mb-4">
            <h2 className="mb-3 text-sm font-bold text-black dark:text-white">
              Account
            </h2>
            <ul className="space-y-2">
              {[
                { label: "Dashboard", path: "/dashboard" },
                { label: "Profile", path: "/account" },
                { label: "Help & Support", path: "/help" },
              ].map((link) => (
                <li key={link.label}>
                  <button
                    onClick={() => navigate(link.path)}
                    className="text-base text-body-color dark:text-body-color-dark hover:text-primary-blue dark:hover:text-primary-blue transition-colors focus:outline-none"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Feedback Form */}
          <div className="w-full px-4 md:w-1/2 lg:w-4/12 xl:w-3/12 mb-3 lg:mb-4">
            <h2 className="mb-3 text-sm font-bold text-black dark:text-white">
              Quick Feedback
            </h2>
            <form onSubmit={handleFeedbackSubmit} className="space-y-3">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share your thoughts..."
                rows={2}
                className="w-full rounded-md border border-stroke/60 dark:border-stroke-dark bg-white dark:bg-dark py-3 px-4 text-base text-body-color placeholder-body-color outline-none focus:border-primary-blue dark:focus:border-primary-blue focus-visible:shadow-none transition-all duration-200 resize-none dark:text-white"
              />
              <button
                type="submit"
                disabled={!feedback.trim() || submitted || submitting}
                className="w-full rounded-md bg-primary-blue hover:bg-primary-blue/90 py-3 px-6 text-base font-medium text-white shadow-submit dark:shadow-submit-dark transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Sending..." : submitted ? "✓ Sent" : "Send Feedback"}
              </button>
            </form>
          </div>

        </div>

        {/* Divider */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-stroke dark:via-stroke-dark to-transparent my-2" />
        
        <div className="flex flex-col items-center justify-center gap-1 py-1 mb-1">
          <img
            src="/sponsor-logo.png"
            alt="Uday Mondal - Tax Consultant Advocate"
            className="h-10 w-auto object-contain dark:invert dark:hue-rotate-180"
          />
          <p className="text-sm font-medium text-black dark:text-white text-center">
            Sponsored by Uday Mondal | Tax Consultant Advocate
          </p>
        </div>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-stroke dark:via-stroke-dark to-transparent my-1" />

        {/* Copyright notice */}
        <div className="pt-1 pb-1">
          <p className="text-[11px] text-center text-body-color dark:text-body-color-dark">
            © 2025 Acrozo by Debasish Biswas. All rights reserved.
          </p>
        </div>

      </div>

      {/* Decorative Vector Shapes */}
      <div className="absolute right-0 top-14 z-[-1] pointer-events-none select-none">
        <svg
          width="55"
          height="99"
          viewBox="0 0 55 99"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle opacity="0.8" cx="49.5" cy="49.5" r="49.5" fill="#959CB1" />
          <mask
            id="mask0_94:899"
            style={{ maskType: "alpha" }}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="99"
            height="99"
          >
            <circle opacity="0.8" cx="49.5" cy="49.5" r="49.5" fill="#4A6CF7" />
          </mask>
          <g mask="url(#mask0_94:899)">
            <circle
              opacity="0.8"
              cx="49.5"
              cy="49.5"
              r="49.5"
              fill="url(#paint0_radial_94:899)"
            />
            <g opacity="0.8" filter="url(#filter0_f_94:899)">
              <circle cx="53.8676" cy="26.2061" r="20.3824" fill="white" />
            </g>
          </g>
          <defs>
            <filter
              id="filter0_f_94:899"
              x="12.4852"
              y="-15.1763"
              width="82.7646"
              height="82.7646"
              filterUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
            >
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feBlend
                mode="normal"
                in="SourceGraphic"
                in2="BackgroundImageFix"
                result="shape"
              />
              <feGaussianBlur
                stdDeviation="10.5"
                result="effect1_foregroundBlur_94:899"
              />
            </filter>
            <radialGradient
              id="paint0_radial_94:899"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(49.5 49.5) rotate(90) scale(53.1397)"
            >
              <stop stopOpacity="0.47" />
              <stop offset="1" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      </div>
      
      <div className="absolute bottom-24 left-0 z-[-1] pointer-events-none select-none">
        <svg
          width="79"
          height="94"
          viewBox="0 0 79 94"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            opacity="0.3"
            x="-41"
            y="26.9426"
            width="66.6675"
            height="66.6675"
            transform="rotate(-22.9007 -41 26.9426)"
            fill="url(#paint0_linear_94:889)"
          />
          <rect
            x="-41"
            y="26.9426"
            width="66.6675"
            height="66.6675"
            transform="rotate(-22.9007 -41 26.9426)"
            stroke="url(#paint1_linear_94:889)"
            strokeWidth="0.7"
          />
          <path
            opacity="0.3"
            d="M50.5215 7.42229L20.325 1.14771L46.2077 62.3249L77.1885 68.2073L50.5215 7.42229Z"
            fill="url(#paint2_linear_94:889)"
          />
          <path
            d="M50.5215 7.42229L20.325 1.14771L46.2077 62.3249L76.7963 68.2073L50.5215 7.42229Z"
            stroke="url(#paint3_linear_94:889)"
            strokeWidth="0.7"
          />
          <path
            opacity="0.3"
            d="M17.9721 93.3057L-14.9695 88.2076L46.2077 62.325L77.1885 68.2074L17.9721 93.3057Z"
            fill="url(#paint4_linear_94:889)"
          />
          <path
            d="M17.972 93.3057L-14.1852 88.2076L46.2077 62.325L77.1884 68.2074L17.972 93.3057Z"
            stroke="url(#paint5_linear_94:889)"
            strokeWidth="0.7"
          />
          <defs>
            <linearGradient
              id="paint0_linear_94:889"
              x1="-41"
              y1="21.8445"
              x2="36.9671"
              y2="59.8878"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#4A6CF7" stopOpacity="0.62" />
              <stop offset="1" stopColor="#4A6CF7" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="paint1_linear_94:889"
              x1="25.6675"
              y1="95.9631"
              x2="-42.9608"
              y2="20.668"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#4A6CF7" stopOpacity="0" />
              <stop offset="1" stopColor="#4A6CF7" stopOpacity="0.51" />
            </linearGradient>
            <linearGradient
              id="paint2_linear_94:889"
              x1="20.325"
              y1="-3.98039"
              x2="90.6248"
              y2="25.1062"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#4A6CF7" stopOpacity="0.62" />
              <stop offset="1" stopColor="#4A6CF7" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="paint3_linear_94:889"
              x1="18.3642"
              y1="-1.59742"
              x2="113.9"
              y2="80.6826"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#4A6CF7" stopOpacity="0" />
              <stop offset="1" stopColor="#4A6CF7" stopOpacity="0.51" />
            </linearGradient>
            <linearGradient
              id="paint4_linear_94:889"
              x1="61.1098"
              y1="62.3249"
              x2="-8.82468"
              y2="58.2156"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#4A6CF7" stopOpacity="0.62" />
              <stop offset="1" stopColor="#4A6CF7" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="paint5_linear_94:889"
              x1="65.4236"
              y1="65.0701"
              x2="24.0178"
              y2="41.6598"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#4A6CF7" stopOpacity="0" />
              <stop offset="1" stopColor="#4A6CF7" stopOpacity="0.51" />
            </linearGradient>
          </defs>
        </svg>
      </div>

    </footer>
  );
}
