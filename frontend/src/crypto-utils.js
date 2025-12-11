const enc = new TextEncoder();
const dec = new TextDecoder();

function toBase64(buf) {
  // buf: ArrayBuffer
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromBase64(str) {
  const bin = atob(str);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

async function generateSalt(length = 16) {
  const s = crypto.getRandomValues(new Uint8Array(length));
  return s.buffer;
}

// Derive AES-GCM 256-bit key from password + salt via PBKDF2
async function deriveKeyFromPassword(password, saltBuffer, iterations = 200000) {
  const passKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations,
      hash: "SHA-256",
    },
    passKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  return key;
}

// Exposed helper: produce derivedKey and salt (base64)
export async function generateKeyFromPassword(password) {
  const salt = await generateSalt(16);
  const key = await deriveKeyFromPassword(password, salt);
  return {
    key,
    salt: toBase64(salt),
  };
}

// encryptText(derivedKeyObj, plaintext) -> base64 envelope: salt|iv|ciphertext
// derivedKeyObj can be either { key, salt } returned from generateKeyFromPassword
// or the raw CryptoKey (rare).
export async function encryptText(derivedKeyObj, plaintext) {
  let key = derivedKeyObj;
  let saltB64 = null;
  if (derivedKeyObj && derivedKeyObj.key) {
    key = derivedKeyObj.key;
    saltB64 = derivedKeyObj.salt;
  }
  if (!key) throw new Error("No key provided to encryptText");

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );

  // envelope: salt?iv?cipher  (base64 parts separated by . )
  // If saltB64 is null (rare), put empty string so parser is stable.
  const parts = [
    saltB64 || "",
    toBase64(iv.buffer),
    toBase64(cipherBuf),
  ];

  return parts.join(".");
}


export async function decryptText(derivedKeyObjOrPassword, envelope) {
  if (!envelope) throw new Error("No ciphertext provided");

  const [saltB64, ivB64, cipherB64] = envelope.split(".");
  if (!ivB64 || !cipherB64) throw new Error("Invalid ciphertext format");

  // Decide whether to derive key or use provided
  let key = null;
  if (derivedKeyObjOrPassword && typeof derivedKeyObjOrPassword === "object" && derivedKeyObjOrPassword.key) {
    key = derivedKeyObjOrPassword.key;
  } else if (typeof derivedKeyObjOrPassword === "string") {
    // password provided — derive using salt inside envelope
    if (!saltB64) throw new Error("Missing salt to derive key from password");
    const saltBuf = fromBase64(saltB64);
    key = await deriveKeyFromPassword(derivedKeyObjOrPassword, saltBuf);
  } else {
    throw new Error("Invalid key/password provided to decryptText");
  }

  const ivBuf = fromBase64(ivB64);
  const cipherBuf = fromBase64(cipherB64);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(ivBuf) },
    key,
    cipherBuf
  );

  return dec.decode(plainBuf);
}
