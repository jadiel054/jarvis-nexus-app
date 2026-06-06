// ── Device & IP fingerprinting + session management ──────────────────────────

const SESSIONS_KEY = 'jarvis_sessions';
const TRUSTED_KEY  = 'jarvis_trusted_devices';

// Generate a stable device fingerprint from browser signals
export function getDeviceId() {
  const existing = localStorage.getItem('jarvis_device_id');
  if (existing) return existing;
  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join('|');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  const id = 'dev_' + Math.abs(hash).toString(36) + Date.now().toString(36);
  localStorage.setItem('jarvis_device_id', id);
  return id;
}

export function getDeviceLabel() {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Mac/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows PC';
  return 'Navegador';
}

// Fetch approximate IP info
export async function getIpInfo() {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const d = await res.json();
      return { ip: d.ip, city: d.city, country: d.country_name, region: d.region };
    }
  } catch (e) {
    console.warn('[DeviceGuard] Failed to fetch IP info:', e.message);
  }
  return { ip: 'desconhecido', city: '—', country: '—', region: '—' };
}

// Trusted device registry
export function getTrustedDevices() {
  try { return JSON.parse(localStorage.getItem(TRUSTED_KEY) || '[]'); } catch { return []; }
}

export function trustDevice(deviceId) {
  const list = getTrustedDevices().filter(d => d.id !== deviceId);
  list.push({ id: deviceId, label: getDeviceLabel(), trustedAt: Date.now() });
  localStorage.setItem(TRUSTED_KEY, JSON.stringify(list));
}

export function isDeviceTrusted(deviceId) {
  return getTrustedDevices().some(d => d.id === deviceId);
}

export function revokeDevice(deviceId) {
  const list = getTrustedDevices().filter(d => d.id !== deviceId);
  localStorage.setItem(TRUSTED_KEY, JSON.stringify(list));
}

// Active sessions
export function getSessions() {
  try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'); } catch { return []; }
}

export function registerSession(deviceId, ipInfo) {
  const sessions = getSessions().filter(s => s.deviceId !== deviceId);
  sessions.push({
    deviceId,
    label: getDeviceLabel(),
    ip: ipInfo.ip,
    location: `${ipInfo.city}, ${ipInfo.country}`,
    startedAt: Date.now(),
    lastSeen: Date.now(),
  });
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function updateSessionLastSeen(deviceId) {
  const sessions = getSessions().map(s =>
    s.deviceId === deviceId ? { ...s, lastSeen: Date.now() } : s
  );
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function revokeSession(deviceId) {
  const sessions = getSessions().filter(s => s.deviceId !== deviceId);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  revokeDevice(deviceId);
}

export function revokeAllSessions() {
  localStorage.setItem(SESSIONS_KEY, '[]');
  localStorage.setItem(TRUSTED_KEY, '[]');
  localStorage.removeItem('jarvis_emergency_pin');
}

// Build email alert body
export function buildAlertEmail(deviceLabel, ipInfo, isFailure = false) {
  const time = new Date().toLocaleString('pt-BR');
  const blockUrl = `${window.location.origin}${window.location.pathname}?jarvis_block=1`;
  return {
    subject: isFailure
      ? '⚠️ J.A.R.V.I.S. — Tentativa de Acesso Inválida Detectada'
      : '🔐 J.A.R.V.I.S. — Novo Dispositivo Detectado',
    body: `
<div style="font-family:monospace;background:#050a0f;color:#67e8f9;padding:32px;border-radius:12px;max-width:480px">
  <h2 style="color:${isFailure ? '#f87171' : '#22d3ee'};margin:0 0 16px">
    ${isFailure ? '⚠️ TENTATIVA INVÁLIDA' : '🔐 NOVO ACESSO DETECTADO'}
  </h2>
  <p style="color:#a5f3fc;margin:0 0 8px"><strong>Horário:</strong> ${time}</p>
  <p style="color:#a5f3fc;margin:0 0 8px"><strong>Dispositivo:</strong> ${deviceLabel}</p>
  <p style="color:#a5f3fc;margin:0 0 8px"><strong>IP:</strong> ${ipInfo.ip}</p>
  <p style="color:#a5f3fc;margin:0 0 24px"><strong>Localização:</strong> ${ipInfo.city}, ${ipInfo.region}, ${ipInfo.country}</p>
  <a href="${blockUrl}" style="display:inline-block;background:#ef4444;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
    🚨 Não fui eu — Bloquear conta agora
  </a>
  <p style="color:#64748b;font-size:11px;margin-top:24px">J.A.R.V.I.S. Security — Stark Legacy v5.0</p>
</div>`,
  };
}