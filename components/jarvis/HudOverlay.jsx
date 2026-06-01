import React from 'react';

export default function HudOverlay() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Scan line */}
      <div className="absolute inset-0 animate-scanline opacity-[0.03]">
        <div className="w-full h-[2px] bg-cyan-400" />
      </div>
      
      {/* Corner brackets */}
      <div className="absolute top-3 left-3 w-8 h-8 border-t border-l border-cyan-500/30" />
      <div className="absolute top-3 right-3 w-8 h-8 border-t border-r border-cyan-500/30" />
      <div className="absolute bottom-3 left-3 w-8 h-8 border-b border-l border-cyan-500/30" />
      <div className="absolute bottom-3 right-3 w-8 h-8 border-b border-r border-cyan-500/30" />
      
      {/* Subtle grid */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />
      
      {/* Rotating HUD ring - top right */}
      <div className="absolute -top-16 -right-16 w-32 h-32 opacity-10">
        <div className="w-full h-full rounded-full border border-cyan-400 animate-hud-rotate" />
        <div className="absolute inset-2 rounded-full border border-dashed border-blue-500 animate-hud-rotate" style={{ animationDirection: 'reverse', animationDuration: '30s' }} />
      </div>
    </div>
  );
}