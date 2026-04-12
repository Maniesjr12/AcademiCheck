"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, UserPlus, AlertCircle } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Registration failed. Please try again.");
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        router.push("/login");
      } else {
        router.push("/dashboard");
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
          Create an account
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", background: "#fef2f2", border: "1px solid #fca5a5", padding: "10px 12px", color: "#991b1b", fontSize: "13px", marginBottom: "16px" }}>
            <AlertCircle style={{ width: "14px", height: "14px", marginTop: "1px", flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" as const, gap: "14px" }}>
          <div>
            <label htmlFor="name" style={{ display: "block", fontSize: "12px", color: "#1a1a1a", marginBottom: "4px" }}>
              Full name
            </label>
            <input
              id="name"
              type="text"
              placeholder="Dr. Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              style={{ width: "100%", border: "1px solid #c8c4b0", padding: "9px 12px", fontSize: "14px", borderRadius: "2px", outline: "none", boxSizing: "border-box" as const }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#1a4d2e"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#c8c4b0"; }}
            />
          </div>

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
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              style={{ width: "100%", border: "1px solid #c8c4b0", padding: "9px 12px", fontSize: "14px", borderRadius: "2px", outline: "none", boxSizing: "border-box" as const }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#1a4d2e"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#c8c4b0"; }}
            />
            <p style={{ fontSize: "11px", color: "#5a5a5a", marginTop: "4px" }}>Must be at least 8 characters.</p>
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
                Creating account...
              </>
            ) : (
              <>
                <UserPlus style={{ width: "14px", height: "14px" }} />
                Register
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: "center" as const, marginTop: "16px", fontSize: "12px", color: "#5a5a5a" }}>
          Already registered?{" "}
          <Link href="/login" style={{ color: "#1a4d2e", textDecoration: "none" }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = "underline"; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = "none"; }}
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
