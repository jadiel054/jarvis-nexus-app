import React from 'react';
import { CornerBrackets, ScanLine, GridBackground } from '@/utils/hudElements';

export default function HudOverlay() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Scan line */}
      <ScanLine opacity="0.03" />
      
      {/* Corner brackets */}
      <CornerBrackets size={8} offset={3} color="cyan-500/30" />
      
      {/* Subtle grid */}
      <GridBackground color="rgba(0,255,255,0.1)" opacity={0.02} />
      
      {/* Rotating HUD ring - top right */}
      <div className="absolute -top-16 -right-16 w-32 h-32 opacity-10">
        <div className="w-full h-full rounded-full border border-cyan-400 animate-hud-rotate" />
        <div className="absolute inset-2 rounded-full border border-dashed border-blue-500 animate-hud-rotate" style={{ animationDirection: 'reverse', animationDuration: '30s' }} />
      </div>
    </div>
  );
}
