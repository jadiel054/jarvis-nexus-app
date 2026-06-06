/**
 * Shared WebAuthn/biometric authentication helper.
 * Used by BiometricGate, BiometricGuard, and SecurityChannels.
 */

export async function attemptWebAuthn({ timeout = 30000 } = {}) {
  if (!window.PublicKeyCredential) {
    return { success: false, reason: 'unsupported' };
  }

  try {
    const available =
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) {
      return { success: false, reason: 'unavailable' };
    }

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout,
        userVerification: 'required',
        rpId: window.location.hostname || 'localhost',
        allowCredentials: [],
      },
    });

    return { success: true };
  } catch {
    return { success: false, reason: 'rejected' };
  }
}
