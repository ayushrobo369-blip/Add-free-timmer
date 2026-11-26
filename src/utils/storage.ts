const KEYSTORE_DB = 'cadence_keystore_v1';
const KEYSTORE_STORE = 'keys';
const KEYSTORE_KEY_ID = 'local-aes-key';
const ENCRYPTED_PREFIX = 'enc:v1:';

interface EncryptedPayload {
  iv: string;
  ct: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function isCryptoAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.crypto !== 'undefined' &&
    typeof window.crypto.subtle !== 'undefined' &&
    typeof window.indexedDB !== 'undefined'
  );
}

function openKeystore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KEYSTORE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KEYSTORE_STORE)) {
        db.createObjectStore(KEYSTORE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let cachedKeyPromise: Promise<CryptoKey | null> | null = null;

async function getOrCreateLocalKey(): Promise<CryptoKey | null> {
  if (!isCryptoAvailable()) return null;
  if (cachedKeyPromise) return cachedKeyPromise;

  cachedKeyPromise = (async () => {
    try {
      const db = await openKeystore();
      const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
        const tx = db.transaction(KEYSTORE_STORE, 'readonly');
        const req = tx.objectStore(KEYSTORE_STORE).get(KEYSTORE_KEY_ID);
        req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
        req.onerror = () => reject(req.error);
      });

      if (existing) {
        db.close();
        return existing;
      }

      // Non-extractable AES-GCM key stored in private IndexedDB keystore
      const generated = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(KEYSTORE_STORE, 'readwrite');
        tx.objectStore(KEYSTORE_STORE).put(generated, KEYSTORE_KEY_ID);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      db.close();
      return generated;
    } catch {
      return null;
    }
  })();

  return cachedKeyPromise;
}

export async function saveSecureLocal<T>(key: string, data: T): Promise<void> {
  try {
    const json = JSON.stringify(data);
    const cryptoKey = await getOrCreateLocalKey();
    if (!cryptoKey) {
      localStorage.setItem(key, json);
      return;
    }

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(json);
    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encoded
    );

    const payload: EncryptedPayload = {
      iv: toBase64(iv),
      ct: toBase64(new Uint8Array(cipherBuffer)),
    };

    localStorage.setItem(key, ENCRYPTED_PREFIX + JSON.stringify(payload));
  } catch {
    // Ignore storage quota / private browsing errors gracefully
  }
}

export async function loadSecureLocal<T>(
  key: string,
  validate: (raw: unknown) => T,
  fallback: T
): Promise<T> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;

    if (!raw.startsWith(ENCRYPTED_PREFIX)) {
      const parsed: unknown = JSON.parse(raw);
      return validate(parsed);
    }

    const cryptoKey = await getOrCreateLocalKey();
    if (!cryptoKey) return fallback;

    const payload = JSON.parse(raw.slice(ENCRYPTED_PREFIX.length)) as EncryptedPayload;
    const iv = fromBase64(payload.iv);
    const ct = fromBase64(payload.ct);

    const plainBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      cryptoKey,
      new Uint8Array(ct)
    );
    const json = new TextDecoder().decode(plainBuffer);
    const parsed: unknown = JSON.parse(json);
    return validate(parsed);
  } catch {
    return fallback;
  }
}

export async function wipeAllLocalData(keys: string[]): Promise<void> {
  try {
    for (const k of keys) {
      localStorage.removeItem(k);
    }
    cachedKeyPromise = null;
    if (typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined') {
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(KEYSTORE_DB);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    }
  } catch {
    // Ignore cleanup errors
  }
}
