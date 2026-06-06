import React from 'react';

/**
 * Reusable HUD visual elements used across authentication screens,
 * overlays, and the main interface.
 */

export function CornerBrackets({
  size = 8,
  offset = 3,
  color = 'cyan-500/30',
  borderWidth = '',
}) {
  const bw = borderWidth || 'border';
  const positions = [
    `top-${offset} left-${offset} ${bw} border-t ${bw} border-l`,
    `top-${offset} right-${offset} ${bw} border-t ${bw} border-r`,
    `bottom-${offset} left-${offset} ${bw} border-b ${bw} border-l`,
    `bottom-${offset} right-${offset} ${bw} border-b ${bw} border-r`,
  ];
  return (
    <>
      {positions.map((cls, i) => (
        <div
          key={i}
          className={`absolute w-${size} h-${size} border-${color} ${cls}`}
        />
      ))}
    </>
  );
}

export function ScanLine({ opacity = '0.03', color = 'cyan-400' }) {
  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden`}>
      <div
        className={`w-full h-px bg-gradient-to-r from-transparent via-${color}/20 to-transparent animate-scanline`}
        style={{ opacity: Number(opacity) || undefined }}
      />
    </div>
  );
}

export function GridBackground({
  color = '#00ffff',
  opacity = 0.03,
  size = 40,
}) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity,
        backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
      }}
    />
  );
}

export function HudOverlay({ children, orange = false, zIndex = 60 }) {
  const gridColor = orange ? '#f97316' : '#00ffff';
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center p-4`}
      style={{ zIndex }}
    >
      <div
        className={`absolute inset-0 backdrop-blur-md ${
          orange ? 'bg-black/90' : 'bg-black/85'
        }`}
      />
      <GridBackground color={gridColor} opacity={0.03} />
      <div className="relative z-10 w-full max-w-sm animate-fade-in-up">
        {children}
      </div>
    </div>
  );
}
