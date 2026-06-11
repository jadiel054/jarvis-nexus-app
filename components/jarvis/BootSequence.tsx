"use client";
import { useEffect, useState } from "react";

const BOOT_ITEMS = [
  { label: "NEURAL CORE",  pct: 80,  status: "ONLINE" },
  { label: "SECURITY",     pct: 100, status: "SECURED" },
  { label: "MEMORY",       pct: 70,  status: "LOADED" },
  { label: "PERCEPTION",   pct: 85,  status: "ACTIVE" },
  { label: "POWER",        pct: 100, status: "OPTIMAL" },
];

interface BootSequenceProps { onDone: () => void; }

export function BootSequence({ onDone }: BootSequenceProps) {
  const [phase, setPhase] = useState(0);
  const [visibleCards, setVisibleCards] = useState<number[]>([]);
  const [barWidths, setBarWidths] = useState(BOOT_ITEMS.map(() => 0));
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600);
    const t2 = setTimeout(() => setPhase(2), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    if (phase !== 2) return;
    BOOT_ITEMS.forEach((item, i) => {
      setTimeout(() => {
        setVisibleCards(prev => [...prev, i]);
        setTimeout(() => setBarWidths(prev => { const n = [...prev]; n[i] = item.pct; return n; }), 100);
      }, 300 + i * 350);
    });
    const total = 300 + BOOT_ITEMS.length * 350 + 1000;
    setTimeout(() => setLeaving(true), total);
    setTimeout(onDone, total + 500);
  }, [phase, onDone]);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "var(--bg-void)", zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32,
      opacity: leaving ? 0 : 1, transition: "opacity 0.5s ease",
    }}>
      {/* Scan line */}
      {phase >= 1 && (
        <div style={{ position: "fixed", left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, var(--neon-cyan), transparent)", boxShadow: "var(--glow-cyan)", top: -2, animation: "scanline 1.5s ease-in-out forwards", zIndex: 10000 }} />
      )}

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, justifyContent: "center" }}>
        {phase >= 2 && <div className="ldrs-orbit" style={{ width: 36, height: 36 }} />}
        <div style={{ fontFamily: "Orbitron, sans-serif", fontSize: "clamp(28px,5vw,52px)", fontWeight: 900, color: "var(--neon-cyan)", letterSpacing: "0.3em", textShadow: "var(--glow-cyan)", animation: phase === 1 ? "boot-flicker 0.15s ease-in-out 3" : undefined }}>
          J.A.R.V.I.S.
        </div>
        {phase >= 2 && <div className="ldrs-orbit" style={{ width: 36, height: 36 }} />}
      </div>
      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--text-secondary)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
        Just A Rather Very Intelligent System
      </div>

      {/* Status cards */}
      {phase >= 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "min(480px, 90vw)" }}>
          {BOOT_ITEMS.map((item, i) => (
            <div key={i} style={{
              background: "rgba(0,245,255,0.03)", border: "1px solid var(--border-glow)", borderRadius: 8, padding: "12px 16px",
              display: "flex", alignItems: "center", gap: 12,
              opacity: visibleCards.includes(i) ? 1 : 0,
              transform: visibleCards.includes(i) ? "translateX(0)" : "translateX(-20px)",
              transition: "opacity 0.4s ease, transform 0.4s ease",
            }}>
              <span style={{ fontFamily: "Orbitron, sans-serif", fontSize: 10, color: "var(--neon-cyan)", width: 110, flexShrink: 0 }}>{item.label}</span>
              <div style={{ flex: 1, background: "rgba(0,245,255,0.05)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "linear-gradient(90deg, var(--neon-cyan), var(--neon-purple))", borderRadius: 4, width: `${barWidths[i]}%`, transition: "width 0.9s ease", boxShadow: "0 0 8px var(--neon-cyan)" }} />
              </div>
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--neon-green)", width: 64, textAlign: "right" }}>
                {visibleCards.includes(i) ? item.status : "..."}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
