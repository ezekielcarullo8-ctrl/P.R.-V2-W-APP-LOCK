/* PERSONAL RECORDER — device activation lock
 * Formula deliberately matches the supplied key generator:
 * simpleHash(deviceId + LICENSE_SALT), uppercase 8-character hex.
 * Change LICENSE_SALT only if you also update the private key generator.
 * This is a client-side deterrent, not strong cryptographic protection.
 */
(() => {
  "use strict";

  const LICENSE_SALT = "CHANGE-THIS-TO-YOUR-OWN-SECRET-2026";
  const ACTIVATED_KEY = "app_activated";
  const DEVICE_KEY = "activated_device_id";
  const FALLBACK_DEVICE_KEY = "dev_fallback_device_id";

  function simpleHash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash * 33) ^ str.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16).toUpperCase().padStart(8, "0");
  }

  function generateActivationCode(deviceId) {
    return simpleHash(deviceId + LICENSE_SALT);
  }

  function isAndroidApp() {
    try {
      return !!(
        window.Capacitor && window.Capacitor.getPlatform() === "android"
      );
    } catch (_) {
      return false;
    }
  }

  async function getDeviceId() {
    const plugin = window.Capacitor?.Plugins?.Device;
    if (isAndroidApp() && plugin?.getId) {
      try {
        const info = await plugin.getId();
        if (info?.identifier) return String(info.identifier);
      } catch (error) {
        console.error("Could not read Android device ID:", error);
      }
    }

    // Stable browser ID for local development and testing; activation is not
    // enforced in a regular browser, matching the supplied implementation.
    let id = localStorage.getItem(FALLBACK_DEVICE_KEY);
    if (!id) {
      id =
        "DEV-" +
        (crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2, 14)
        ).toUpperCase();
      localStorage.setItem(FALLBACK_DEVICE_KEY, id);
    }
    return id;
  }

  function showGate(deviceId) {
    const gate = document.getElementById("activationGate");
    const deviceDisplay = document.getElementById("activationDeviceId");
    if (!gate || !deviceDisplay) return;
    deviceDisplay.value = deviceId;
    gate.hidden = false;
    document.body.classList.add("activation-locked");
    document.getElementById("activationCode")?.focus();
  }

  function hideGate() {
    const gate = document.getElementById("activationGate");
    if (gate) gate.hidden = true;
    document.body.classList.remove("activation-locked");
  }

  async function initActivationLock() {
    const gate = document.getElementById("activationGate");
    if (!gate) return;
    // Only enforce purchase activation in the built Android app.
    if (!isAndroidApp()) {
      hideGate();
      return;
    }

    const deviceId = await getDeviceId();
    const validStoredActivation =
      localStorage.getItem(ACTIVATED_KEY) === "true" &&
      localStorage.getItem(DEVICE_KEY) === deviceId;

    if (validStoredActivation) {
      hideGate();
    } else {
      localStorage.removeItem(ACTIVATED_KEY);
      localStorage.removeItem(DEVICE_KEY);
      showGate(deviceId);
    }
  }

  function submitActivation(event) {
    event.preventDefault();
    const deviceId =
      document.getElementById("activationDeviceId")?.value.trim() || "";
    const input = document.getElementById("activationCode");
    const error = document.getElementById("activationError");
    const code = input?.value.trim().toUpperCase() || "";

    if (!code) {
      error.textContent = "Enter the activation code for this device.";
      input?.focus();
      return;
    }
    if (code !== generateActivationCode(deviceId)) {
      error.textContent = "That code is not valid for this device.";
      input.value = "";
      input.focus();
      return;
    }

    localStorage.setItem(ACTIVATED_KEY, "true");
    localStorage.setItem(DEVICE_KEY, deviceId);
    error.textContent = "";
    input.value = "";
    hideGate();
  }

  document.addEventListener("DOMContentLoaded", () => {
    document
      .getElementById("activationForm")
      ?.addEventListener("submit", submitActivation);
    initActivationLock();
  });
})();
