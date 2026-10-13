// Minimal Web Push sender (no dependency): RFC 8291 payload encryption (aes128gcm) and RFC 8292 VAPID.
// Keys are created once and kept in Netlify Blobs (store "push", key "vapid"): nothing to configure by hand.
import crypto from "node:crypto";

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const unb64u = (s) => Buffer.from(String(s), "base64url");

export function newVapidKeys() {
  const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return privateKey.export({ format: "jwk" }); // { kty, crv, d, x, y }
}

export function vapidPublic(jwk) {
  return b64u(Buffer.concat([Buffer.from([4]), unb64u(jwk.x), unb64u(jwk.y)]));
}

function vapidJwt(jwk, audience, subject) {
  const head = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const body = b64u(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const key = crypto.createPrivateKey({ key: jwk, format: "jwk" });
  const sig = crypto.sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${b64u(sig)}`;
}

// Encrypts `payload` for one subscription (keys.p256dh, keys.auth). Returns the request body.
export function encrypt(payload, keys, { salt = crypto.randomBytes(16), ecdh = null } = {}) {
  const uaPublic = unb64u(keys.p256dh), authSecret = unb64u(keys.auth);
  const as = ecdh || crypto.createECDH("prime256v1");
  if (!ecdh) as.generateKeys();
  const asPublic = as.getPublicKey();
  const shared = as.computeSecret(uaPublic);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ct = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, ct]);
}

// Sends one notification. Returns the push service HTTP status (201 = accepted, 404/410 = subscription gone).
export async function sendPush(sub, data, jwk, subject = "https://aci-log.netlify.app") {
  const url = new URL(sub.endpoint);
  const jwt = vapidJwt(jwk, url.origin, subject);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapidPublic(jwk)}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "3600",
      Urgency: "high",
    },
    body: encrypt(JSON.stringify(data), sub.keys),
    signal: AbortSignal.timeout(15000),
  });
  return res.status;
}

export async function vapidKeys(store) {
  let jwk = await store.get("vapid", { type: "json" });
  if (!jwk) { jwk = newVapidKeys(); await store.setJSON("vapid", jwk); }
  return jwk;
}
