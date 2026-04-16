// Shared encryption utilities for API key storage
// Uses AES-GCM via Web Crypto API

let cachedEncryptionKey = null;

async function getEncryptionKey() {
  if (cachedEncryptionKey) return cachedEncryptionKey;

  const storedKey = await chrome.storage.local.get("encryptionKey");
  if (storedKey.encryptionKey) {
    cachedEncryptionKey = await crypto.subtle.importKey(
      "jwk",
      storedKey.encryptionKey,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
    return cachedEncryptionKey;
  }

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const keyJWK = await crypto.subtle.exportKey("jwk", key);
  await chrome.storage.local.set({ encryptionKey: keyJWK });
  cachedEncryptionKey = key;
  return key;
}

export async function encryptText(plainText) {
  if (!plainText) return plainText;
  const key = await getEncryptionKey();
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plainText)
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptText(encryptedB64) {
  if (!encryptedB64) return encryptedB64;
  const key = await getEncryptionKey();
  const combined = Uint8Array.from(atob(encryptedB64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}
