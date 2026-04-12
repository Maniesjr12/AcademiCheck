import Link from "next/link";

function YabatechShield({ width = 32, height = 38, style }: { width?: number; height?: number; style?: React.CSSProperties }) {
  return (
    <svg width={width} height={height} viewBox="0 0 32 38" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
      <path d="M16 2 L30 8 L30 22 Q30 32 16 37 Q2 32 2 22 L2 8 Z" fill="white" opacity="0.95"/>
      <path d="M16 5 L27 10 L27 22 Q27 30 16 34 Q5 30 5 22 L5 10 Z" fill="#1a4d2e"/>
      <rect x="5" y="17" width="22" height="5" fill="#c9a84c"/>
      <path d="M12 10 L16 15 L20 10" stroke="#c9a84c" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <line x1="16" y1="15" x2="16" y2="22" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f7f5f0" }}>
      {/* Top announcement strip */}
      <div style={{ background: "#0f2d1a", height: "40px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.8)" }}>Yaba College of Technology</span>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>Lagos, Nigeria · Est. 1947</span>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div style={{ width: "100%", maxWidth: "380px" }}>
          {/* Crest + title */}
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <YabatechShield width={56} height={66} style={{ display: "block", margin: "0 auto" }} />
            <div style={{ fontFamily: "Georgia, serif", fontSize: "26px", color: "#1a4d2e", marginTop: "10px" }}>YABATECH</div>
            <div style={{ fontSize: "12px", color: "#5a5a5a", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: "4px" }}>Academic Integrity Portal</div>
            <div style={{ width: "48px", height: "2px", background: "#c9a84c", margin: "16px auto 0" }} />
          </div>
          {children}
        </div>
      </main>

      {/* Footer strip */}
      <div style={{ background: "#0f2d1a", height: "36px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>
          &copy; {new Date().getFullYear()} Yaba College of Technology · Yaba, Lagos, Nigeria
        </span>
      </div>
    </div>
  );
}
