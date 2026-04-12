"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Loader2, LogIn, AlertCircle } from "lucide-react";

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #c8c4b0",
  padding: "9px 12px",
  fontSize: "14px",
  borderRadius: "2px",
  outline: "none",
  boxSizing: "border-box",
  background: "white",
};

export default function HomePage() {
  const router = useRouter();
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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#f7f5f0",
      }}
    >
      {/* Top announcement strip */}
      <div
        style={{
          background: "#0f2d1a",
          height: "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "10px",
            color: "rgba(255,255,255,0.75)",
            letterSpacing: "0.04em",
          }}
        >
          Yaba College of Technology Academic Integrity System
        </span>
        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>
          For authorised use only
        </span>
      </div>

      {/* Main nav bar */}
      <div
        style={{
          background: "#1a4d2e",
          height: "60px",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <svg
            width="32"
            height="38"
            viewBox="0 0 32 38"
            fill="none"
            style={{ display: "block", flexShrink: 0 }}
          >
            <path
              d="M16 2 L30 8 L30 22 Q30 32 16 37 Q2 32 2 22 L2 8 Z"
              fill="white"
              opacity="0.95"
            />
            <path
              d="M16 5 L27 10 L27 22 Q27 30 16 34 Q5 30 5 22 L5 10 Z"
              fill="#1a4d2e"
            />
            <rect x="5" y="17" width="22" height="5" fill="#c9a84c" />
            <path
              d="M12 10 L16 15 L20 10"
              stroke="#c9a84c"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
            <line
              x1="16"
              y1="15"
              x2="16"
              y2="22"
              stroke="#c9a84c"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <div>
            <div
              style={{
                fontFamily: "Georgia, serif",
                fontSize: "18px",
                color: "white",
                fontWeight: 400,
                lineHeight: 1.1,
              }}
            >
              YABATECH
            </div>
            <div
              style={{
                fontSize: "10px",
                color: "#c9a84c",
                letterSpacing: "0.06em",
              }}
            >
              Academic Integrity Portal
            </div>
          </div>
        </div>
      </div>

      {/* Centered content */}
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
        }}
      >
        <div style={{ width: "100%", maxWidth: "400px" }}>
          {/* Crest and title */}
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <svg
              width="48"
              height="56"
              viewBox="0 0 32 38"
              fill="none"
              style={{ marginBottom: "12px" }}
            >
              <path
                d="M16 2 L30 8 L30 22 Q30 32 16 37 Q2 32 2 22 L2 8 Z"
                fill="white"
                stroke="#1a4d2e"
                strokeWidth="1"
              />
              <path
                d="M16 5 L27 10 L27 22 Q27 30 16 34 Q5 30 5 22 L5 10 Z"
                fill="#1a4d2e"
              />
              <rect x="5" y="17" width="22" height="5" fill="#c9a84c" />
              <path
                d="M12 10 L16 15 L20 10"
                stroke="#c9a84c"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
              <line
                x1="16"
                y1="15"
                x2="16"
                y2="22"
                stroke="#c9a84c"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <div
              style={{
                fontFamily: "Georgia, serif",
                fontSize: "22px",
                color: "#1a4d2e",
                marginBottom: "4px",
              }}
            >
              YABATECH
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "#5a5a5a",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: "16px",
              }}
            >
              Academic Integrity Portal
            </div>
            <div
              style={{
                width: "48px",
                height: "2px",
                background: "#c9a84c",
                margin: "0 auto",
              }}
            />
          </div>

          {/* Login card */}
          <div
            style={{
              background: "white",
              border: "1px solid #c8c4b0",
              borderTop: "3px solid #1a4d2e",
              padding: "32px",
              borderRadius: "2px",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#5a5a5a",
                marginBottom: "20px",
              }}
            >
              Sign in to continue
            </div>

            {error && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  background: "#fef2f2",
                  border: "1px solid #fca5a5",
                  padding: "10px 12px",
                  color: "#991b1b",
                  fontSize: "13px",
                  marginBottom: "16px",
                  borderRadius: "2px",
                }}
              >
                <AlertCircle
                  style={{
                    width: "14px",
                    height: "14px",
                    marginTop: "1px",
                    flexShrink: 0,
                  }}
                />
                <span>{error}</span>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div>
                <label
                  htmlFor="email"
                  style={{
                    display: "block",
                    fontSize: "12px",
                    color: "#1a1a1a",
                    marginBottom: "4px",
                  }}
                >
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
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#1a4d2e";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#c8c4b0";
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  style={{
                    display: "block",
                    fontSize: "12px",
                    color: "#1a1a1a",
                    marginBottom: "4px",
                  }}
                >
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
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#1a4d2e";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#c8c4b0";
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: "100%",
                  background: "#1a4d2e",
                  color: "white",
                  padding: "10px",
                  fontSize: "14px",
                  border: "none",
                  borderRadius: "2px",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  opacity: isLoading ? 0.6 : 1,
                  marginTop: "2px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) e.currentTarget.style.background = "#2d6a42";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#1a4d2e";
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2
                      style={{
                        width: "14px",
                        height: "14px",
                        animation: "spin 1s linear infinite",
                      }}
                    />
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

            <p
              style={{
                textAlign: "center",
                fontSize: "12px",
                color: "#5a5a5a",
                marginTop: "16px",
              }}
            >
              New user?{" "}
              <Link
                href="/register"
                style={{ color: "#1a4d2e", textDecoration: "none" }}
              >
                Create an account
              </Link>
            </p>
          </div>

          <p
            style={{
              textAlign: "center",
              fontSize: "11px",
              color: "#5a5a5a",
              marginTop: "16px",
            }}
          >
            Academic Year 2025–2026
          </p>
        </div>
      </main>

      {/* Footer */}
      <div
        style={{
          background: "#0f2d1a",
          height: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>
          &copy; {new Date().getFullYear()} Yaba College of Technology · Yaba,
          Lagos, Nigeria
        </span>
        <div style={{ display: "flex", gap: "16px" }}>
          <Link
            href="#"
            style={{
              fontSize: "10px",
              color: "rgba(255,255,255,0.5)",
              textDecoration: "none",
            }}
          >
            Privacy Policy
          </Link>
          <Link
            href="#"
            style={{
              fontSize: "10px",
              color: "rgba(255,255,255,0.5)",
              textDecoration: "none",
            }}
          >
            Help &amp; Support
          </Link>
        </div>
      </div>
    </div>
  );
}
