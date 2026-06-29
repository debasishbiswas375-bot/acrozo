import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { setToken, getApiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function FacebookCallback() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const state = urlParams.get("state");
      const err = urlParams.get("error");

      if (err) {
        setError(err);
        setLoading(false);
        return;
      }

      if (!code || !state) {
        setError("Missing authorization code or state");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `${getApiUrl()}/api/auth/facebook/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.detail || "Facebook authentication failed");
        }

        setToken(data.token, true);
        localStorage.setItem("username", data.username);
        localStorage.setItem("is_admin", String(data.is_admin));
        if (data.avatar_url) {
          localStorage.setItem("avatar_url", data.avatar_url);
        } else {
          localStorage.removeItem("avatar_url");
        }

        // Invalidate profile cache so AvatarDropdown picks up the new avatar immediately
        await queryClient.invalidateQueries({ queryKey: ["/api/profile"] });

        toast({
          title: data.existing_user ? "Welcome back!" : "Account created!",
          description: data.existing_user
            ? `Welcome, ${data.username}!`
            : `Account created for ${data.username}`,
        });

        navigate("/dashboard");
      } catch (e: any) {
        setError(e.message || "Facebook authentication failed");
        setLoading(false);
      }
    };

    handleCallback();
  }, [navigate, toast, queryClient]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Authentication Failed</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate("/login")}
            className="px-6 py-3 bg-[#1877F2] text-white rounded-lg hover:bg-[#166fe5] transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#1877F2] border-t-transparent mx-auto mb-4"></div>
        <p className="text-gray-600">Completing Facebook sign-in...</p>
      </div>
    </div>
  );
}
