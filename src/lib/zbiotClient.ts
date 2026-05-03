export const getDefaultZbiotApiUrl = () => {
  const v = import.meta.env.VITE_ZBIOT_API_URL;
  return typeof v === "string" && v.trim()
    ? v.trim()
    : "https://api.zbiot.cc/mapi";
};

const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");

const md5Hex = (input: string) => {
  const encoder = new TextEncoder();
  const msg = encoder.encode(input);

  const rotateLeft = (x: number, c: number) => (x << c) | (x >>> (32 - c));
  const add32 = (a: number, b: number) => (a + b) | 0;

  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0;
  }

  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];

  const bitLen = msg.length * 8;
  const withOne = new Uint8Array(msg.length + 1);
  withOne.set(msg);
  withOne[msg.length] = 0x80;

  const padLen = (56 - (withOne.length % 64) + 64) % 64;
  const totalLen = withOne.length + padLen + 8;
  const buf = new Uint8Array(totalLen);
  buf.set(withOne);

  const dv = new DataView(buf.buffer);
  dv.setUint32(totalLen - 8, bitLen >>> 0, true);
  dv.setUint32(totalLen - 4, Math.floor(bitLen / 2 ** 32) >>> 0, true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let offset = 0; offset < buf.length; offset += 64) {
    const M = new Uint32Array(16);
    for (let i = 0; i < 16; i++) {
      M[i] = dv.getUint32(offset + i * 4, true);
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F = 0;
      let g = 0;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }

      const tmp = D;
      D = C;
      C = B;
      const x = add32(add32(add32(A, F), K[i]), M[g]);
      B = add32(B, rotateLeft(x, S[i]));
      A = tmp;
    }

    a0 = add32(a0, A);
    b0 = add32(b0, B);
    c0 = add32(c0, C);
    d0 = add32(d0, D);
  }

  const out =
    toHex(a0) +
    toHex(b0) +
    toHex(c0) +
    toHex(d0);

  const bytes = out.match(/../g)?.map((h) => parseInt(h, 16)) ?? [];
  const reordered = [
    ...bytes.slice(0, 4).reverse(),
    ...bytes.slice(4, 8).reverse(),
    ...bytes.slice(8, 12).reverse(),
    ...bytes.slice(12, 16).reverse(),
  ];
  return reordered.map((b) => b.toString(16).padStart(2, "0")).join("");
};

export type ZbiotCallArgs = {
  apiUrl?: string;
  sid?: string | null;
  module: string;
  func: string;
  params?: Record<string, any>;
};

export type ZbiotResponse = {
  errcode?: number;
  error_message?: string;
  [k: string]: any;
};

export const zbiotCall = async <T extends ZbiotResponse = ZbiotResponse>({
  apiUrl,
  sid,
  module,
  func,
  params,
}: ZbiotCallArgs): Promise<T> => {
  const base = apiUrl ?? getDefaultZbiotApiUrl();
  const url =
    sid && String(sid).trim()
      ? `${base}${base.includes("?") ? "&" : "?"}sid=${encodeURIComponent(String(sid))}`
      : base;

  const body = new URLSearchParams();
  body.set("module", module);
  body.set("func", func);
  body.set("params", JSON.stringify(params ?? {}));

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body,
  });

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error(`ZBIoT response bukan JSON (${res.status})`);
  }

  if (!res.ok) {
    throw new Error(json?.error_message || `ZBIoT HTTP error (${res.status})`);
  }

  if (typeof json?.errcode === "number" && json.errcode !== 0) {
    throw new Error(json?.error_message || `ZBIoT errcode ${json.errcode}`);
  }

  return json as T;
};

export const zbiotPwdMd5 = (plain: string) => md5Hex(plain);

export type ZbiotLastPos = {
  addr?: string;
  lat?: number;
  lon?: number;
  ptype?: string;
  time?: number;
  type?: string;
  wgs?: string;
};

export const parseZbiotLastPos = (input: unknown): ZbiotLastPos | null => {
  if (typeof input !== "string" || !input.trim()) return null;
  try {
    const obj = JSON.parse(input);
    return obj && typeof obj === "object" ? (obj as any) : null;
  } catch {
    return null;
  }
};

export const parseZbiotWgs = (wgs: unknown) => {
  if (typeof wgs !== "string") return null;
  const parts = wgs.split(",").map((s) => s.trim());
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

export const normalizeZbiotLatLon = (latRaw: unknown, lonRaw: unknown) => {
  const latN = typeof latRaw === "number" ? latRaw : Number(latRaw);
  const lonN = typeof lonRaw === "number" ? lonRaw : Number(lonRaw);
  if (!Number.isFinite(latN) || !Number.isFinite(lonN)) return null;

  const lat = Math.abs(latN) > 90 ? latN / 1_000_000 : latN;
  const lng = Math.abs(lonN) > 180 ? lonN / 1_000_000 : lonN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};
