import React, { useState, useRef, useCallback } from 'react';

/**
 * Shared PIN-input logic and UI used by BiometricGate and NewDeviceChallenge.
 */

const EMERGENCY_PIN_KEY = 'jarvis_emergency_pin';
const DEFAULT_PIN = '123456';

export function getStoredPin() {
  return localStorage.getItem(EMERGENCY_PIN_KEY) || DEFAULT_PIN;
}

export function usePinInput({ length = 6, onComplete } = {}) {
  const [pin, setPin] = useState(Array(length).fill(''));
  const refsContainer = useRef([]);
  if (refsContainer.current.length !== length) {
    refsContainer.current = Array(length).fill(null);
  }
  const refs = refsContainer.current;

  const setRef = useCallback(
    (idx) => (el) => {
      refs[idx] = el;
    },
    [refs],
  );

  const handleDigit = useCallback(
    (idx, val) => {
      if (!/^\d?$/.test(val)) return;
      setPin((prev) => {
        const next = [...prev];
        next[idx] = val;
        if (val && idx < length - 1) refs[idx + 1]?.focus();
        if (next.every((d) => d !== '') && idx === length - 1) {
          onComplete?.(next.join(''));
        }
        return next;
      });
    },
    [length, onComplete, refs],
  );

  const handleKeyDown = useCallback(
    (idx, e) => {
      if (e.key === 'Backspace' && !pin[idx] && idx > 0) {
        refs[idx - 1]?.focus();
      }
    },
    [pin, refs],
  );

  const reset = useCallback(() => {
    setPin(Array(length).fill(''));
    refs[0]?.focus();
  }, [length, refs]);

  return { pin, refs, setRef, handleDigit, handleKeyDown, reset };
}

export function PinInputGrid({
  pin,
  refs,
  setRef,
  onDigit,
  onKeyDown,
  accentColor = 'cyan',
}) {
  const colors = {
    cyan: {
      filled: 'rgba(0,255,255,0.5)',
      empty: 'rgba(0,255,255,0.15)',
      text: '#67e8f9',
      glow: 'rgba(0,255,255,0.1)',
    },
    orange: {
      filled: 'rgba(251,146,60,0.6)',
      empty: 'rgba(251,146,60,0.2)',
      text: '#fdba74',
      glow: 'rgba(251,146,60,0.15)',
    },
  };
  const c = colors[accentColor] || colors.cyan;

  return (
    <div className="flex justify-center gap-2">
      {pin.map((digit, i) => (
        <input
          key={i}
          ref={setRef ? setRef(i) : refs[i]}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => onDigit(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          className="w-10 h-12 text-center text-xl font-mono font-bold rounded-xl border transition-all outline-none"
          style={{
            background: '#050a0f',
            borderColor: digit ? c.filled : c.empty,
            color: c.text,
            boxShadow: digit ? `0 0 10px ${c.glow}` : 'none',
          }}
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}
