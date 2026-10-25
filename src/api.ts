const BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
const KEY = "costeo_token";

export function getToken() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function setToken(t: string | null) {
  try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, msg: string) { super(msg); this.status = status; }
}

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn; }

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: opts.method || (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "No hay conexión con el servidor. Revise su internet o intente en un momento.");
  }
  if (res.status === 401 && !path.startsWith("/api/auth/ingresar")) {
    setToken(null);
    onUnauthorized();
  }
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const j = await res.json();
      if (typeof j.detail === "string") msg = j.detail;
      else if (Array.isArray(j.detail)) msg = j.detail.map((d: any) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join(" · ");
    } catch { /* sin cuerpo */ }
    throw new ApiError(res.status, msg);
  }
  return res.json();
}

export async function descargar(path: string, nombre = "descarga", cuerpo?: unknown) {
  const headers: Record<string, string> = { Authorization: `Bearer ${getToken()}` };
  if (cuerpo !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, cuerpo !== undefined ? { method: "POST", headers, body: JSON.stringify(cuerpo) } : { headers });
  if (!res.ok) {
    let msg = "No se pudo descargar el archivo.";
    try { msg = (await res.json()).detail || msg; } catch { /* sin detalle */ }
    throw new ApiError(res.status, msg);
  }
  const blob = await res.blob();
  const name = res.headers.get("content-disposition")?.match(/filename="?([^"]+)"?/)?.[1] || nombre;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** URL completa de una imagen servida por el backend (/media/...). */
export function mediaUrl(ruta: string | null | undefined) {
  if (!ruta) return null;
  return ruta.startsWith("http") ? ruta : BASE + (ruta.startsWith("/") ? ruta : `/media/${ruta}`);
}

/** Sube un archivo (multipart) al backend. */
export async function subirArchivo<T = any>(path: string, archivo: File): Promise<T> {
  const fd = new FormData();
  fd.append("archivo", archivo);
  let res: Response;
  try {
    res = await fetch(BASE + path, { method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
  } catch {
    throw new ApiError(0, "No hay conexión con el servidor.");
  }
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try { const j = await res.json(); if (typeof j.detail === "string") msg = j.detail; } catch { /* */ }
    throw new ApiError(res.status, msg);
  }
  return res.json();
}

/** Imagen protegida (necesita la sesión) como URL local para mostrarla en un <img>. */
export async function imagenPrivada(path: string): Promise<string> {
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new ApiError(res.status, "No se pudo cargar la vista previa.");
  return URL.createObjectURL(await res.blob());
}
