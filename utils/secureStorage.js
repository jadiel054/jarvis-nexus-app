/**
 * secureStorage — Defence-in-depth wrapper around localStorage.
 *
 * Provides obfuscated storage for sensitive values (API keys, tokens, PINs).
 * Uses base64 + byte-reversal so secrets are not stored as readable plaintext.
 * This is NOT encryption — it mitigates casual inspection and simple
 * scraping scripts but cannot protect against a determined attacker with
 * full JS execution context.  True encryption would require a user-derived
 * key (e.g. passphrase) which is out of scope for this client-only app.
 *
 * Also exports helpers to redact sensitive keys from log output.
 */

const OBFUSCATION_PREFIX = 'enc1:';

function obfuscate(plaintext) {
  if (!plaintext) return plaintext;
  try {
    const encoded = btoa(unescape(encodeURIComponent(plaintext)));
    const reversed = encoded.split('').reverse().join('');
    return OBFUSCATION_PREFIX + reversed;
  } catch {
    return plaintext;
  }
}

function deobfuscate(stored) {
  if (!stored || !stored.startsWith(OBFUSCATION_PREFIX)) return stored;
  try {
    const reversed = stored.slice(OBFUSCATION_PREFIX.length).split('').reverse().join('');
    return decodeURIComponent(escape(atob(reversed)));
  } catch {
    return stored;
  }
}

// Keys in jarvis_settings that hold secrets
const SENSITIVE_SETTINGS_KEYS = [
  'claude_api_key', 'groq_api_key', 'gemini_api_key',
  'deepseek_api_key', 'qwen_api_key', 'glm_api_key', 'openrouter_api_key',
  'elevenlabs_api_key', 'elevenlabs_design_key',
  'openweather_api_key', 'openrouteservice_api_key',
];

// Keys in jarvis_integrations sub-objects that hold secrets
const SENSITIVE_INTEGRATION_KEYS = ['anon_key', 'token', 'api_key'];

function obfuscateSettingsObj(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = { ...obj };
  for (const key of SENSITIVE_SETTINGS_KEYS) {
    if (out[key] && !out[key].startsWith(OBFUSCATION_PREFIX)) {
      out[key] = obfuscate(out[key]);
    }
  }
  return out;
}

function deobfuscateSettingsObj(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = { ...obj };
  for (const key of SENSITIVE_SETTINGS_KEYS) {
    if (out[key]) {
      out[key] = deobfuscate(out[key]);
    }
  }
  return out;
}

function obfuscateIntegrationsObj(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [section, data] of Object.entries(obj)) {
    if (data && typeof data === 'object') {
      const copy = { ...data };
      for (const key of SENSITIVE_INTEGRATION_KEYS) {
        if (copy[key] && !copy[key].startsWith(OBFUSCATION_PREFIX)) {
          copy[key] = obfuscate(copy[key]);
        }
      }
      out[section] = copy;
    } else {
      out[section] = data;
    }
  }
  return out;
}

function deobfuscateIntegrationsObj(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [section, data] of Object.entries(obj)) {
    if (data && typeof data === 'object') {
      const copy = { ...data };
      for (const key of SENSITIVE_INTEGRATION_KEYS) {
        if (copy[key]) {
          copy[key] = deobfuscate(copy[key]);
        }
      }
      out[section] = copy;
    } else {
      out[section] = data;
    }
  }
  return out;
}

/** Save jarvis_settings with sensitive values obfuscated. */
export function saveSettings(settings) {
  localStorage.setItem('jarvis_settings', JSON.stringify(obfuscateSettingsObj(settings)));
}

/** Load jarvis_settings and deobfuscate sensitive values. */
export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem('jarvis_settings') || '{}');
    return deobfuscateSettingsObj(raw);
  } catch {
    return {};
  }
}

/** Save jarvis_integrations with sensitive values obfuscated. */
export function saveIntegrations(integrations) {
  localStorage.setItem('jarvis_integrations', JSON.stringify(obfuscateIntegrationsObj(integrations)));
}

/** Load jarvis_integrations and deobfuscate sensitive values. */
export function loadIntegrations() {
  try {
    const raw = JSON.parse(localStorage.getItem('jarvis_integrations') || '{}');
    return deobfuscateIntegrationsObj(raw);
  } catch {
    return {};
  }
}

/** Redact a value for safe logging (show only last 4 chars). */
export function redact(value) {
  if (!value || typeof value !== 'string' || value.length < 8) return '***';
  return '***' + value.slice(-4);
}

/**
 * Migrate existing plaintext localStorage data to obfuscated format.
 * Safe to call multiple times — skips already-obfuscated values.
 */
export function migrateToSecureStorage() {
  try {
    const settings = JSON.parse(localStorage.getItem('jarvis_settings') || '{}');
    let settingsMigrated = false;
    for (const key of SENSITIVE_SETTINGS_KEYS) {
      if (settings[key] && !settings[key].startsWith(OBFUSCATION_PREFIX)) {
        settings[key] = obfuscate(settings[key]);
        settingsMigrated = true;
      }
    }
    if (settingsMigrated) {
      localStorage.setItem('jarvis_settings', JSON.stringify(settings));
    }
  } catch {}

  try {
    const integrations = JSON.parse(localStorage.getItem('jarvis_integrations') || '{}');
    let integrationsMigrated = false;
    for (const [, data] of Object.entries(integrations)) {
      if (data && typeof data === 'object') {
        for (const key of SENSITIVE_INTEGRATION_KEYS) {
          if (data[key] && !data[key].startsWith(OBFUSCATION_PREFIX)) {
            data[key] = obfuscate(data[key]);
            integrationsMigrated = true;
          }
        }
      }
    }
    if (integrationsMigrated) {
      localStorage.setItem('jarvis_integrations', JSON.stringify(integrations));
    }
  } catch {}
}
