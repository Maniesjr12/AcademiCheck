"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, LogIn, AlertCircle } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password. Please try again.");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: "380px" }}>
      <div style={{ background: "white", border: "1px solid #c8c4b0", borderTop: "3px solid #1a4d2e", padding: "28px 32px", borderRadius: "2px" }}>
        <div style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#5a5a5a", marginBottom: "20px" }}>
          Sign in to continue
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", background: "#fef2f2", border: "1px solid #fca5a5", padding: "10px 12px", color: "#991b1b", fontSize: "13px", marginBottom: "16px" }}>
            <AlertCircle style={{ width: "14px", height: "14px", marginTop: "1px", flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" as const, gap: "14px" }}>
          <div>
            <label htmlFor="email" style={{ display: "block", fontSize: "12px", color: "#1a1a1a", marginBottom: "4px" }}>
              Email address
            </label>
            <input
              id="email"
              type="email"
              placeholder="staff@yabatech.edu.ng"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{ width: "100%", border: "1px solid #c8c4b0", padding: "9px 12px", fontSize: "14px", borderRadius: "2px", outline: "none", boxSizing: "border-box" as const }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#1a4d2e"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#c8c4b0"; }}
            />
          </div>

          <div>
            <label htmlFor="password" style={{ display: "block", fontSize: "12px", color: "#1a1a1a", marginBottom: "4px" }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{ width: "100%", border: "1px solid #c8c4b0", padding: "9px 12px", fontSize: "14px", borderRadius: "2px", outline: "none", boxSizing: "border-box" as const }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#1a4d2e"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#c8c4b0"; }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{ width: "100%", background: "#1a4d2e", color: "white", padding: "10px", fontSize: "14px", borderRadius: "2px", border: "none", cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.6 : 1, marginTop: "6px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
            onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.background = "#2d6a42"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#1a4d2e"; }}
          >
            {isLoading ? (
              <>
                <Loader2 style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />
                Signing in...
              </>
            ) : (
              <>
                <LogIn style={{ width: "14px", height: "14px" }} />
                Sign In
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: "center" as const, marginTop: "16px", fontSize: "12px", color: "#5a5a5a" }}>
          New user?{" "}
          <Link href="/register" style={{ color: "#1a4d2e", textDecoration: "none" }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = "underline"; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = "none"; }}
          >
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
