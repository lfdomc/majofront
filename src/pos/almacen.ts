/** Datos del POS guardados en el teléfono, para poder cobrar sin internet.
 *  - catálogo: productos y precios (se actualiza cuando hay conexión)
 *  - cola: ventas hechas que todavía no llegan al servidor (se suben solas)
 */
import { api, ApiError } from "../api";

export type ProductoPos = { id: number; nombre: string; precio: number; en_menu: boolean; foto?: string | null };
export type Catalogo = {
  negocio: { nombre: string; color: string; sinpe: string; sinpe_nombre: string; regimen?: string; contribuyente?: string;
    cedula_tipo?: string; cedula?: string; actividad?: string; direccion?: string; telefono?: string; email?: string; leyenda?: string };
  iva_incluido: boolean; iva_pct: number;
  categorias: { nombre: string; color?: string; productos: ProductoPos[] }[];
  actualizado: string;
};
export type ItemVenta = { receta_id: number; nombre: string; cantidad: number; precio_unitario: number };
export type VentaLocal = {
  uid: string; fecha: string; forma_pago: "efectivo" | "sinpe"; items: ItemVenta[]; recibido: number | null;
  total: number; error?: string;
};
export type VentaServidor = {
  id: number; uid: string; fecha: string; forma_pago: "efectivo" | "sinpe"; total: number; recibido: number | null;
  vuelto: number | null; ganancia_bruta: number; anulada: boolean;
  items: { receta_id: number | null; nombre: string; cantidad: number; precio_unitario: number }[];
};

const K_CATALOGO = "pos-catalogo";
const K_COLA = "pos-cola";

function leer<T>(k: string, def: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : def; } catch { return def; }
}
function escribir(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* almacenamiento lleno o bloqueado */ }
}

export const catalogoGuardado = () => leer<Catalogo | null>(K_CATALOGO, null);
export async function actualizarCatalogo(): Promise<Catalogo> {
  const c = await api<Catalogo>("/api/pos/catalogo");
  escribir(K_CATALOGO, c);
  return c;
}

export const cola = () => leer<VentaLocal[]>(K_COLA, []);
const guardarCola = (l: VentaLocal[]) => escribir(K_COLA, l);

export function nuevoUid() {
  try { return crypto.randomUUID(); } catch { return `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
}

/** Guarda la venta en el teléfono (nunca se pierde) y la intenta subir de una vez. */
export async function registrarVenta(v: VentaLocal) {
  guardarCola([...cola(), v]);
  return sincronizar();
}

let enCurso: Promise<SyncResultado> | null = null;
export type SyncResultado = { subidas: number; pendientes: number; sinConexion: boolean; sesionVencida: boolean };

/** Sube las ventas pendientes. Si no hay internet, quedan guardadas para después. */
export function sincronizar(): Promise<SyncResultado> {
  if (enCurso) return enCurso;
  enCurso = (async () => {
    const pendientes = cola();
    if (!pendientes.length) return { subidas: 0, pendientes: 0, sinConexion: false, sesionVencida: false };
    try {
      const r = await api<{ resultados: { uid: string; ok: boolean; error?: string }[] }>("/api/pos/ventas/lote", {
        method: "POST",
        body: { ventas: pendientes.map(({ uid, fecha, forma_pago, items, recibido }) => ({
          uid, fecha, forma_pago, recibido, items: items.map(({ receta_id, cantidad, precio_unitario }) => ({ receta_id, cantidad, precio_unitario })),
        })) },
      });
      const ok = new Set(r.resultados.filter((x) => x.ok).map((x) => x.uid));
      const errores = new Map(r.resultados.filter((x) => !x.ok).map((x) => [x.uid, x.error || "Error"]));
      // leer de nuevo por si se agregó una venta mientras se subía
      const resto = cola().filter((v) => !ok.has(v.uid)).map((v) => (errores.has(v.uid) ? { ...v, error: errores.get(v.uid) } : v));
      guardarCola(resto);
      return { subidas: ok.size, pendientes: resto.length, sinConexion: false, sesionVencida: false };
    } catch (e) {
      const st = e instanceof ApiError ? e.status : 0;
      return { subidas: 0, pendientes: pendientes.length, sinConexion: st === 0 || st >= 500, sesionVencida: st === 401 };
    }
  })().finally(() => { enCurso = null; });
  return enCurso;
}

export function quitarDeCola(uid: string) {
  guardarCola(cola().filter((v) => v.uid !== uid));
}
