"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

interface NavProps {
  userName?: string | null;
  userEmail?: string | null;
}

function YabatechShield() {
  return (
    <svg
      width="32"
      height="38"
      viewBox="0 0 32 38"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
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
  );
}

export function Nav({ userName, userEmail }: NavProps) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  }

  return (
    <header>
      {/* Announcement bar */}
      <div
        style={{
          background: "#0f2d1a",
          height: "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
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
          justifyContent: "space-between",
          padding: "0 24px",
        }}
      >
        {/* Left: branding */}
        <Link
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            textDecoration: "none",
          }}
        >
          <YabatechShield />
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
                fontFamily: "sans-serif",
                fontSize: "10px",
                color: "#c9a84c",
                letterSpacing: "0.06em",
              }}
            >
              Academic Integrity Portal
            </div>
          </div>
        </Link>

        {/* Right: links + user */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <Link
            href="/dashboard"
            style={{
              color:
                pathname === "/dashboard"
                  ? "#ffffff"
                  : "rgba(255,255,255,0.75)",
              fontSize: "13px",
              padding: "8px 16px",
              textDecoration: "none",
              borderBottom:
                pathname === "/dashboard"
                  ? "2px solid #c9a84c"
                  : "2px solid transparent",
              lineHeight: "44px",
            }}
          >
            Dashboard
          </Link>
          <Link
            href="/history"
            style={{
              color:
                pathname === "/history" ? "#ffffff" : "rgba(255,255,255,0.75)",
              fontSize: "13px",
              padding: "8px 16px",
              textDecoration: "none",
              borderBottom:
                pathname === "/history"
                  ? "2px solid #c9a84c"
                  : "2px solid transparent",
              lineHeight: "44px",
            }}
          >
            History
          </Link>

          <div
            style={{
              width: "1px",
              height: "20px",
              background: "rgba(255,255,255,0.2)",
              margin: "0 12px",
            }}
          />

          {/* User info */}
          <div style={{ padding: "0 8px" }}>
            <div
              style={{
                fontSize: "13px",
                color: "white",
                fontWeight: 500,
                lineHeight: 1.2,
              }}
            >
              {userName ?? "User"}
            </div>
            {userEmail && (
              <div
                style={{ fontSize: "10px", color: "#c9a84c", lineHeight: 1.2 }}
              >
                {userEmail}
              </div>
            )}
          </div>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            style={{
              border: "1px solid rgba(255,255,255,0.3)",
              color: "white",
              fontSize: "12px",
              padding: "5px 12px",
              background: "transparent",
              cursor: "pointer",
              borderRadius: "2px",
              marginLeft: "8px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
