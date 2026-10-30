import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { api, ApiError, getToken, mediaUrl, setToken } from "../api";
import { colones, num } from "../format";
import {
  actualizarCatalogo, catalogoGuardado, cola, nuevoUid, quitarDeCola, registrarVenta, sincronizar,
  type Catalogo, type ItemVenta, type ProductoPos, type VentaLocal, type VentaServidor,
} from "./almacen";
import "./pos.css";

type Vista = "cobrar" | "ventas" | "caja";
type Linea = ItemVenta;
type Caja = { dia: string; ventas: number; efectivo: number; sinpe: number; total: number;
  cierres: { id: number; fondo_inicial: number; efectivo_esperado: number; efectivo_contado: number; diferencia: number; sinpe: number; ventas: number; notas: string; hora: string }[] };

/** Hace instalable la caja en el teléfono (solo en esta pantalla, para que el menú de clientes no ofrezca instalarse). */
function usarModoApp() {
  useEffect(() => {
    const extras: HTMLElement[] = [];
    const meta = (attrs: Record<string, string>, tag = "meta") => {
      const el = document.createElement(tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      document.head.appendChild(el);
      extras.push(el);
    };
    if (!document.querySelector('link[rel="manifest"]')) meta({ rel: "manifest", href: "/manifest-pos.webmanifest" }, "link");
    meta({ name: "apple-mobile-web-app-capable", content: "yes" });
    meta({ name: "apple-mobile-web-app-title", content: "Caja" });
    meta({ rel: "apple-touch-icon", href: "/pos-icono-192.png" }, "link");
    document.title = "Caja · POS";
    if ("serviceWorker" in navigator && location.hostname !== "localhost") {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* sin modo sin conexión */ });
    }
    return () => extras.forEach((e) => e.remove());
  }, []);
}

export default function Pos() {
  usarModoApp();
  const [sesion, setSesion] = useState(!!getToken());
  if (!sesion) return <IngresoPos onListo={() => setSesion(true)} />;
  return <Caja onSalir={() => { setToken(null); setSesion(false); }} />;
}

function IngresoPos({ onListo }: { onListo: () => void }) {
  const [u, setU] = useState("");
  const [c, setC] = useState("");
  const [err, setErr] = useState("");
  const [enviando, setEnviando] = useState(false);
  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true); setErr("");
    try {
      const r = await api<{ token: string }>("/api/auth/ingresar", { body: { usuario: u.trim(), clave: c } });
      setToken(r.token);
      onListo();
    } catch (x: any) { setErr(x.message); } finally { setEnviando(false); }
  };
  return (
    <div className="pos-ingreso">
      <form onSubmit={entrar}>
        <h1>Caja</h1>
        <p>Ingrese con su usuario del sistema.</p>
        <label>Usuario<input value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" required autoCapitalize="none" /></label>
        <label>Contraseña<input type="password" value={c} onChange={(e) => setC(e.target.value)} autoComplete="current-password" required /></label>
        {err && <p className="pos-error">{err}</p>}
        <button className="pos-btn grande" disabled={enviando}>{enviando ? "Ingresando…" : "Ingresar"}</button>
      </form>
    </div>
  );
}

function Caja({ onSalir }: { onSalir: () => void }) {
  const [cat, setCat] = useState<Catalogo | null>(catalogoGuardado());
  const [vista, setVista] = useState<Vista>("cobrar");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [categoria, setCategoria] = useState("");
  const [buscar, setBuscar] = useState("");
  const [cobrando, setCobrando] = useState(false);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [listo, setListo] = useState<{ total: number; vuelto: number | null; forma: string; venta: VentaLocal } | null>(null);
  const [pendientes, setPendientes] = useState(cola().length);
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const [menu, setMenu] = useState(false);
  const [aviso, setAviso] = useState("");
  const [errCatalogo, setErrCatalogo] = useState("");

  const subir = useCallback(async () => {
    const r = await sincronizar();
    setPendientes(r.pendientes);
    if (r.sinConexion) setEnLinea(false);
    else if (r.subidas || !r.pendientes) setEnLinea(true);
    if (r.sesionVencida) onSalir();
    return r;
  }, [onSalir]);

  const recargarCatalogo = useCallback(async (avisar = false) => {
    try {
      const c = await actualizarCatalogo();
      setCat(c); setErrCatalogo(""); setEnLinea(true);
      if (avisar) setAviso("Productos y precios actualizados");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onSalir();
      else if (!catalogoGuardado()) setErrCatalogo("No hay conexión para descargar los productos la primera vez. Conéctese a internet e intente de nuevo.");
      else setEnLinea(false);
    }
  }, [onSalir]);

  useEffect(() => {
    recargarCatalogo();
    subir();
    const on = () => { setEnLinea(true); subir(); recargarCatalogo(); };
    const off = () => setEnLinea(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const t = setInterval(() => { if (cola().length) subir(); }, 30000);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); clearInterval(t); };
  }, [recargarCatalogo, subir]);

  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(""), 2600); return () => clearTimeout(t); }, [aviso]);

  const total = lineas.reduce((s, l) => s + l.cantidad * l.precio_unitario, 0);
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  const agregar = (p: ProductoPos) => setLineas((ls) => {
    const i = ls.findIndex((l) => l.receta_id === p.id);
    if (i >= 0) return ls.map((l, k) => (k === i ? { ...l, cantidad: l.cantidad + 1 } : l));
    return [...ls, { receta_id: p.id, nombre: p.nombre, cantidad: 1, precio_unitario: p.precio }];
  });
  const cambiar = (id: number, d: number) => setLineas((ls) => ls.flatMap((l) => (l.receta_id !== id ? [l] : l.cantidad + d <= 0 ? [] : [{ ...l, cantidad: l.cantidad + d }])));

  const confirmar = async (forma: "efectivo" | "sinpe", recibido: number | null) => {
    const v: VentaLocal = { uid: nuevoUid(), fecha: new Date().toISOString(), forma_pago: forma, items: lineas, recibido, total };
    setCobrando(false); setCarritoAbierto(false);
    setListo({ total, vuelto: forma === "efectivo" && recibido != null ? Math.max(0, recibido - total) : null, forma, venta: v });
    setLineas([]);
    setPendientes(cola().length + 1);
    await registrarVenta(v).then((r) => { setPendientes(r.pendientes); if (r.sinConexion) setEnLinea(false); else setEnLinea(true); if (r.sesionVencida) onSalir(); });
  };

  const estilo = { "--marca": cat?.negocio.color || "#D94C72" } as CSSProperties;

  if (!cat) {
    return (
      <div className="pos" style={estilo}>
        <div className="pos-vacio">{errCatalogo || "Cargando productos…"}
          {errCatalogo && <button className="pos-btn" onClick={() => recargarCatalogo()}>Intentar de nuevo</button>}</div>
      </div>
    );
  }

  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const visibles = cat.categorias
    .filter((c) => !categoria || c.nombre === categoria)
    .map((c) => ({ ...c, productos: c.productos.filter((p) => !buscar || norm(p.nombre).includes(norm(buscar))) }))
    .filter((c) => c.productos.length);
  const enCarrito = (id: number) => lineas.find((l) => l.receta_id === id)?.cantidad || 0;

  return (
    <div className="pos" style={estilo}>
      <header className="pos-barra">
        <button className="pos-icono" aria-label="Menú" aria-expanded={menu} onClick={() => setMenu(!menu)}>
          <span /><span /><span />
        </button>
        <div className="pos-titulo">
          <strong>{{ cobrar: "Cobrar", ventas: "Ventas de hoy", caja: "Cierre de caja" }[vista]}</strong>
          <small>{cat.negocio.nombre}</small>
        </div>
        <button className={"pos-estado" + (enLinea ? "" : " fuera") + (pendientes ? " pendiente" : "")} onClick={() => subir()}
                title={pendientes ? "Tocar para subir ahora" : undefined}>
          <i aria-hidden="true" />{!enLinea ? "Sin internet" : pendientes ? "Subiendo…" : "En línea"}
          {pendientes > 0 && <b>{pendientes} por subir</b>}
        </button>
      </header>

      {menu && (
        <>
          <div className="pos-velo" onClick={() => setMenu(false)} />
          <nav className="pos-menu" aria-label="Opciones de la caja">
            {(["cobrar", "ventas", "caja"] as Vista[]).map((v) => (
              <button key={v} className={vista === v ? "activa" : ""} onClick={() => { setVista(v); setMenu(false); }}>
                {{ cobrar: "Cobrar", ventas: "Ventas de hoy", caja: "Cierre de caja" }[v]}
              </button>
            ))}
            <hr />
            <button onClick={() => { recargarCatalogo(true); setMenu(false); }}>Actualizar productos y precios</button>
            <a href="/admin">Ir a la administración</a>
            <button onClick={() => { if (!cola().length || confirm("Hay ventas sin subir. Si sale, quedan guardadas en este teléfono. ¿Salir?")) onSalir(); }}>Cerrar sesión</button>
          </nav>
        </>
      )}

      {vista === "cobrar" && (
        <div className="pos-cobrar">
          <section className="pos-catalogo">
            <div className="pos-filtros">
              <input type="search" placeholder="Buscar producto" value={buscar} onChange={(e) => setBuscar(e.target.value)} aria-label="Buscar producto" />
              <div className="pos-chips" role="tablist">
                <button role="tab" aria-selected={!categoria} className={!categoria ? "activa" : ""} onClick={() => setCategoria("")}>Todo</button>
                {cat.categorias.map((c) => (
                  <button key={c.nombre} role="tab" aria-selected={categoria === c.nombre} className={categoria === c.nombre ? "activa" : ""}
                          style={{ "--cat": c.color || "var(--marca)" } as CSSProperties} onClick={() => setCategoria(c.nombre)}>
                    <i aria-hidden="true" />{c.nombre}
                  </button>
                ))}
              </div>
            </div>
            {visibles.length === 0 && <p className="pos-vacio">{buscar ? "No hay productos con ese nombre." : "No hay productos con precio. Póngales precio de venta en la administración."}</p>}
            {/* Todos los productos seguidos (sin huecos); el color dice de qué categoría es */}
            <div className="pos-productos">
              {visibles.flatMap((c) => c.productos.map((p) => {
                const q = enCarrito(p.id);
                return (
                  <button key={p.id} className={"pos-producto" + (q ? " elegido" : "")} onClick={() => agregar(p)}
                          style={{ "--cat": c.color || "var(--marca)" } as CSSProperties} title={`${p.nombre} · ${c.nombre}`}>
                    <span className="pos-producto-foto" aria-hidden="true">
                      {p.foto ? <img src={mediaUrl(p.foto)!} alt="" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        : null}
                      <span className="pos-inicial">{p.nombre.split(/\s+/).filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || p.nombre[0]}</span>
                    </span>
                    <span className="pos-producto-texto">
                      <span className="pos-producto-nombre">{p.nombre}</span>
                      <span className="pos-producto-precio">{colones(p.precio)}</span>
                    </span>
                    {q > 0 && <span className="pos-cantidad" aria-label={`${q} en la venta`}>{num(q, 0)}</span>}
                  </button>
                );
              }))}
            </div>
          </section>

          <aside className={"pos-carrito" + (carritoAbierto ? " abierto" : "")} aria-label="Venta actual">
            <button className="pos-carrito-asa" onClick={() => setCarritoAbierto(!carritoAbierto)} disabled={!lineas.length}>
              <span>{unidades ? `${num(unidades, 0)} ${unidades === 1 ? "producto" : "productos"}` : "Venta vacía"}</span>
              <strong>{colones(total)}</strong>
            </button>
            <div className="pos-lineas">
              {lineas.length === 0 && <p className="pos-vacio">Toque los productos para agregarlos.</p>}
              {lineas.map((l) => (
                <div key={l.receta_id} className="pos-linea">
                  <div><strong>{l.nombre}</strong><small>{colones(l.precio_unitario)} c/u</small></div>
                  <div className="pos-mas-menos">
                    <button aria-label={`Quitar uno de ${l.nombre}`} onClick={() => cambiar(l.receta_id, -1)}>−</button>
                    <span>{num(l.cantidad, 0)}</span>
                    <button aria-label={`Agregar uno de ${l.nombre}`} onClick={() => cambiar(l.receta_id, 1)}>+</button>
                  </div>
                  <b>{colones(l.cantidad * l.precio_unitario)}</b>
                </div>
              ))}
            </div>
            <div className="pos-carrito-pie">
              {lineas.length > 0 && <button className="pos-link" onClick={() => { setLineas([]); setCarritoAbierto(false); }}>Vaciar</button>}
              <button className="pos-btn grande" disabled={!lineas.length} onClick={() => setCobrando(true)}>
                Cobrar {lineas.length > 0 && colones(total)}
              </button>
            </div>
          </aside>
        </div>
      )}

      {vista === "ventas" && <VentasHoy enLinea={enLinea} pendientes={pendientes} onCambio={subir} negocio={cat.negocio} />}
      {vista === "caja" && <CierreCaja enLinea={enLinea} />}

      {cobrando && <Cobro total={total} cat={cat} onCancelar={() => setCobrando(false)} onConfirmar={confirmar} />}
      {listo && <Listo {...listo} negocio={cat.negocio} enLinea={enLinea} onSeguir={() => setListo(null)} />}
      {aviso && <div className="pos-aviso" role="status">{aviso}</div>}
    </div>
  );
}

function Cobro({ total, cat, onCancelar, onConfirmar }: {
  total: number; cat: Catalogo; onCancelar: () => void; onConfirmar: (f: "efectivo" | "sinpe", recibido: number | null) => void;
}) {
  const [forma, setForma] = useState<"efectivo" | "sinpe">("efectivo");
  const [recibido, setRecibido] = useState<string>("");
  const entrada = useRef<HTMLInputElement>(null);
  const r = recibido.trim() === "" ? null : Number(recibido.replace(/[^\d]/g, ""));
  const falta = forma === "efectivo" && r != null && r < total;
  const billetes = useMemo(() => {
    const op = [1000, 2000, 5000, 10000, 20000, 50000].filter((b) => b >= total);
    const redondeos = [Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000].filter((b) => b > total);
    return [...new Set([...redondeos, ...op])].sort((a, b) => a - b).slice(0, 4);
  }, [total]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onCancelar(); };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [onCancelar]);
  return (
    <div className="pos-modal-fondo" onClick={onCancelar}>
      <div className="pos-modal" role="dialog" aria-modal="true" aria-label="Cobrar" onClick={(e) => e.stopPropagation()}>
        <p className="pos-total-etiqueta">Total a cobrar</p>
        <p className="pos-total">{colones(total)}</p>
        <div className="pos-formas" role="radiogroup" aria-label="Forma de pago">
          <button role="radio" aria-checked={forma === "efectivo"} className={forma === "efectivo" ? "activa" : ""} onClick={() => setForma("efectivo")}>Efectivo</button>
          <button role="radio" aria-checked={forma === "sinpe"} className={forma === "sinpe" ? "activa" : ""} onClick={() => setForma("sinpe")}>SINPE Móvil</button>
        </div>
        {forma === "efectivo" ? (
          <div className="pos-efectivo">
            <label>¿Con cuánto paga?
              <div className="pos-monto"><span>₡</span>
                <input ref={entrada} inputMode="numeric" placeholder={String(total)} value={recibido}
                       onChange={(e) => setRecibido(e.target.value.replace(/[^\d]/g, ""))} aria-label="Monto recibido" />
              </div>
            </label>
            <div className="pos-billetes">
              <button onClick={() => setRecibido(String(total))}>Exacto</button>
              {billetes.map((b) => <button key={b} onClick={() => setRecibido(String(b))}>{colones(b)}</button>)}
            </div>
            {r != null && !falta && <p className="pos-vuelto">Vuelto: <strong>{colones(r - total)}</strong></p>}
            {falta && <p className="pos-error">Faltan {colones(total - r!)}</p>}
          </div>
        ) : (
          <div className="pos-sinpe">
            {cat.negocio.sinpe ? (
              <p>SINPE Móvil al <strong>{cat.negocio.sinpe}</strong>{cat.negocio.sinpe_nombre && <> a nombre de <strong>{cat.negocio.sinpe_nombre}</strong></>}</p>
            ) : <p>Ponga el número de SINPE Móvil en la administración (Menú y negocio).</p>}
            <p className="pos-nota">Confirme cuando vea el mensaje del banco.</p>
          </div>
        )}
        <div className="pos-modal-botones">
          <button className="pos-btn claro" onClick={onCancelar}>Volver</button>
          <button className="pos-btn grande" disabled={falta} onClick={() => onConfirmar(forma, forma === "efectivo" ? (r ?? total) : null)}>
            {forma === "sinpe" ? "Ya recibí el SINPE" : "Confirmar venta"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Texto del comprobante para WhatsApp (no es factura electrónica). */
type DatosNegocio = Catalogo["negocio"];

/** Cédula con guiones: física 1-1234-0567 · jurídica 3-101-123456. */
export function cedulaLegible(tipo: string | undefined, c: string | undefined) {
  const d = (c || "").replace(/\D/g, "");
  if (tipo === "fisica" && d.length === 9) return `${d[0]}-${d.slice(1, 5)}-${d.slice(5)}`;
  if (tipo === "juridica" && d.length === 10) return `${d[0]}-${d.slice(1, 4)}-${d.slice(4)}`;
  return c || "";
}

export const LEYENDAS: Record<string, string> = {
  simplificado: "Contribuyente del Régimen de Tributación Simplificada. Precios con impuestos incluidos; no se desglosa el IVA.",
  tradicional: "Comprobante interno de venta.",
  ninguno: "",
};

export function textoComprobante(n: DatosNegocio | string, v: { uid: string; fecha: string; forma_pago: string; recibido: number | null; total: number;
  items: { nombre: string; cantidad: number; precio_unitario: number }[]; id?: number }) {
  const f = new Date(v.fecha);
  const fecha = f.toLocaleDateString("es-CR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const hora = f.toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" });
  const numero = v.uid.replace(/-/g, "").slice(0, 6).toUpperCase();  // el mismo antes y después de subirla
  const lineas = v.items.map((i) => `${num(i.cantidad, 0)} × ${i.nombre} — ${colones(i.cantidad * i.precio_unitario)}`);
  const pago = v.forma_pago === "sinpe" ? "SINPE Móvil"
    : `Efectivo${v.recibido != null && v.recibido > v.total ? ` · Recibido ${colones(v.recibido)} · Vuelto ${colones(v.recibido - v.total)}` : ""}`;
  const d: Partial<DatosNegocio> = typeof n === "string" ? { nombre: n } : n;
  const tipoCed = { fisica: "Céd.", juridica: "Céd. jurídica", dimex: "DIMEX", nite: "NITE" }[d.cedula_tipo || "fisica"] || "Céd.";
  const cabecera = [
    `*${d.nombre || "Comprobante"}*`,
    d.contribuyente || d.cedula ? [d.contribuyente, d.cedula ? `${tipoCed} ${cedulaLegible(d.cedula_tipo, d.cedula)}` : ""].filter(Boolean).join(" · ") : "",
    d.regimen === "simplificado" ? "Régimen de Tributación Simplificada" : d.regimen === "tradicional" ? "Régimen Tradicional" : "",
    d.actividad ? `Actividad: ${d.actividad}` : "",
    [d.direccion, d.telefono ? `Tel. ${d.telefono}` : ""].filter(Boolean).join(" · "),
  ].filter(Boolean);
  const leyenda = (d.leyenda || "").trim() || LEYENDAS[d.regimen || "ninguno"] || "";
  return [...cabecera, "", "Comprobante de compra", `${fecha} ${hora} · N.º ${numero}`, "",
    ...lineas, "", `*Total: ${colones(v.total)}*`, `Pago: ${pago}`, "", "¡Gracias por su compra!",
    ...(leyenda ? [`_${leyenda}_`] : []), "_Este comprobante no es una factura electrónica._"].join("\n");
}

function enlaceComprobante(telefono: string, texto: string) {
  let d = telefono.replace(/\D/g, "");
  if (d.length === 8) d = "506" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}

/** Pide el número del cliente y abre WhatsApp con el comprobante listo para enviar. */
function EnviarComprobante({ texto, onUsar }: { texto: string; onUsar?: () => void }) {
  const [tel, setTel] = useState("");
  const valido = tel.replace(/\D/g, "").length >= 8;
  return (
    <div className="pos-comprobante">
      <label>Enviar comprobante por WhatsApp
        <div className="pos-comprobante-fila">
          <input inputMode="tel" placeholder="Número del cliente" value={tel} onFocus={onUsar}
                 onChange={(e) => { setTel(e.target.value.replace(/[^\d+\s-]/g, "")); onUsar?.(); }} aria-label="WhatsApp del cliente" />
          <a className={"pos-btn whatsapp" + (valido ? "" : " inactivo")} aria-disabled={!valido}
             href={valido ? enlaceComprobante(tel, texto) : undefined} target="_blank" rel="noopener"
             onClick={(e) => { if (!valido) e.preventDefault(); onUsar?.(); }}>Enviar</a>
        </div>
      </label>
    </div>
  );
}

function Listo({ total, vuelto, forma, venta, negocio, enLinea, onSeguir }: {
  total: number; vuelto: number | null; forma: string; venta: VentaLocal; negocio: DatosNegocio; enLinea: boolean; onSeguir: () => void;
}) {
  const [quieto, setQuieto] = useState(false);  // si está escribiendo el número, no se cierra solo
  useEffect(() => {
    if (quieto) return;
    const t = setTimeout(onSeguir, vuelto ? 9000 : 4000);
    return () => clearTimeout(t);
  }, [onSeguir, vuelto, quieto]);
  return (
    <div className="pos-modal-fondo">
      <div className="pos-modal pos-listo" role="alertdialog" aria-label="Venta registrada">
        <div className="pos-check" aria-hidden="true">✓</div>
        <p className="pos-total-etiqueta">Venta registrada · {forma === "sinpe" ? "SINPE Móvil" : "Efectivo"}</p>
        <p className="pos-total">{colones(total)}</p>
        {vuelto != null && vuelto > 0 && <p className="pos-vuelto grande">Vuelto: <strong>{colones(vuelto)}</strong></p>}
        {!enLinea && <p className="pos-nota">Sin internet: quedó guardada en el teléfono y se sube sola.</p>}
        <EnviarComprobante texto={textoComprobante(negocio, venta)} onUsar={() => setQuieto(true)} />
        <button className="pos-btn grande" onClick={onSeguir}>Nueva venta</button>
      </div>
    </div>
  );
}

function VentasHoy({ enLinea, pendientes, onCambio, negocio }: { enLinea: boolean; pendientes: number; onCambio: () => void; negocio: DatosNegocio }) {
  const [ventas, setVentas] = useState<VentaServidor[] | null>(null);
  const [comprobante, setComprobante] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const locales = cola();
  const cargar = useCallback(() => {
    api<VentaServidor[]>("/api/pos/ventas").then((v) => { setVentas(v); setErr(""); })
      .catch(() => setErr("Sin conexión: se muestran solo las ventas guardadas en este teléfono."));
  }, []);
  useEffect(() => { cargar(); }, [cargar, pendientes, enLinea]);
  const validas = (ventas || []).filter((v) => !v.anulada);
  const suma = (f?: string) => validas.filter((v) => !f || v.forma_pago === f).reduce((s, v) => s + v.total, 0)
    + locales.filter((v) => !f || v.forma_pago === f).reduce((s, v) => s + v.total, 0);
  const anular = async (v: VentaServidor) => {
    if (!confirm(v.anulada ? "¿Restaurar esta venta?" : `¿Anular la venta de ${colones(v.total)}? No se cuenta en los reportes.`)) return;
    try { await api(`/api/pos/ventas/${v.id}/anular`, { method: "POST", body: { restaurar: v.anulada } }); cargar(); onCambio(); }
    catch (e: any) { alert(e.message); }
  };
  const ganancia = validas.reduce((s, v) => s + v.ganancia_bruta, 0);
  return (
    <div className="pos-pagina">
      <div className="pos-cifras">
        <div><span>Total del día</span><strong>{colones(suma())}</strong></div>
        <div><span>Efectivo</span><strong>{colones(suma("efectivo"))}</strong></div>
        <div><span>SINPE Móvil</span><strong>{colones(suma("sinpe"))}</strong></div>
        <div><span>Ventas</span><strong>{validas.length + locales.length}</strong></div>
        {ventas && <div><span>Ganancia bruta</span><strong>{colones(ganancia)}</strong></div>}
      </div>
      {err && <p className="pos-nota">{err}</p>}
      <ul className="pos-lista">
        {locales.slice().reverse().map((v) => (
          <li key={v.uid} className="pendiente">
            <div><strong>{new Date(v.fecha).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" })}</strong>
              <span>{v.items.map((i) => `${num(i.cantidad, 0)} × ${i.nombre}`).join(", ")}</span>
              <small className={v.error ? "pos-error" : ""}>{v.error ? `No se pudo subir: ${v.error}` : "Por subir"}</small></div>
            <div className="pos-lista-der"><b>{colones(v.total)}</b><small>{v.forma_pago === "sinpe" ? "SINPE" : "Efectivo"}</small>
              <button className="pos-link" onClick={() => setComprobante(textoComprobante(negocio, v))}>Comprobante</button>
              {v.error && <button className="pos-link" onClick={() => { if (confirm("¿Descartar esta venta que no se pudo subir?")) { quitarDeCola(v.uid); onCambio(); } }}>Descartar</button>}</div>
          </li>
        ))}
        {(ventas || []).map((v) => (
          <li key={v.id} className={v.anulada ? "anulada" : ""}>
            <div><strong>{v.fecha.slice(11, 16)}</strong>
              <span>{v.items.map((i) => `${num(i.cantidad, 0)} × ${i.nombre}`).join(", ")}</span>
              {v.anulada && <small>Anulada</small>}</div>
            <div className="pos-lista-der"><b>{colones(v.total)}</b><small>{v.forma_pago === "sinpe" ? "SINPE" : "Efectivo"}</small>
              {!v.anulada && <button className="pos-link" onClick={() => setComprobante(textoComprobante(negocio, { ...v, fecha: v.fecha + "-06:00" }))}>Comprobante</button>}
              {enLinea && <button className="pos-link" onClick={() => anular(v)}>{v.anulada ? "Restaurar" : "Anular"}</button>}</div>
          </li>
        ))}
        {ventas && ventas.length === 0 && locales.length === 0 && <li className="pos-vacio">Todavía no hay ventas hoy.</li>}
      </ul>
      {comprobante && (
        <div className="pos-modal-fondo" onClick={() => setComprobante(null)}>
          <div className="pos-modal" role="dialog" aria-modal="true" aria-label="Comprobante" onClick={(e) => e.stopPropagation()}>
            <pre className="pos-comprobante-vista">{comprobante.replace(/[*_]/g, "")}</pre>
            <EnviarComprobante texto={comprobante} />
            <button className="pos-btn claro" onClick={() => setComprobante(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CierreCaja({ enLinea }: { enLinea: boolean }) {
  const [caja, setCaja] = useState<Caja | null>(null);
  const [fondo, setFondo] = useState("");
  const [contado, setContado] = useState("");
  const [notas, setNotas] = useState("");
  const [err, setErr] = useState("");
  const pend = cola().length;
  const cargar = useCallback(() => { api<Caja>("/api/pos/caja").then(setCaja).catch((e) => setErr(e.message)); }, []);
  useEffect(() => { cargar(); }, [cargar, enLinea]);
  if (!caja) return <div className="pos-pagina"><p className="pos-vacio">{err ? "El cierre de caja necesita internet." : "Cargando…"}</p></div>;
  const n = (s: string) => (s.trim() ? Number(s.replace(/[^\d]/g, "")) : 0);
  const esperado = n(fondo) + caja.efectivo;
  const dif = contado.trim() ? n(contado) - esperado : null;
  const guardar = async () => {
    try { setCaja(await api<Caja>("/api/pos/cierres", { body: { fondo_inicial: n(fondo), efectivo_contado: n(contado), notas } })); setContado(""); setNotas(""); }
    catch (e: any) { setErr(e.message); }
  };
  return (
    <div className="pos-pagina">
      {pend > 0 && <p className="pos-error">Hay {pend} ventas por subir. Espere a que se suban antes de cerrar la caja.</p>}
      <div className="pos-cifras">
        <div><span>Ventas en efectivo</span><strong>{colones(caja.efectivo)}</strong></div>
        <div><span>SINPE Móvil</span><strong>{colones(caja.sinpe)}</strong></div>
        <div><span>Total del día</span><strong>{colones(caja.total)}</strong></div>
        <div><span>Ventas</span><strong>{caja.ventas}</strong></div>
      </div>
      <div className="pos-cierre">
        <label>Fondo con que abrió la caja<div className="pos-monto"><span>₡</span><input inputMode="numeric" value={fondo} placeholder="0" onChange={(e) => setFondo(e.target.value.replace(/[^\d]/g, ""))} /></div></label>
        <p>Efectivo que debería haber: <strong>{colones(esperado)}</strong></p>
        <label>Efectivo contado<div className="pos-monto"><span>₡</span><input inputMode="numeric" value={contado} placeholder="0" onChange={(e) => setContado(e.target.value.replace(/[^\d]/g, ""))} /></div></label>
        {dif != null && <p className={dif === 0 ? "pos-ok" : "pos-error"}>{dif === 0 ? "La caja cuadra." : dif > 0 ? `Sobran ${colones(dif)}` : `Faltan ${colones(-dif)}`}</p>}
        <label>Notas<input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" /></label>
        <button className="pos-btn grande" disabled={!contado.trim()} onClick={guardar}>Guardar cierre</button>
        {err && <p className="pos-error">{err}</p>}
      </div>
      {caja.cierres.length > 0 && (
        <ul className="pos-lista">
          {caja.cierres.map((c) => (
            <li key={c.id}><div><strong>Cierre {c.hora}</strong><span>Esperado {colones(c.efectivo_esperado)} · contado {colones(c.efectivo_contado)}{c.notas && ` · ${c.notas}`}</span></div>
              <div className="pos-lista-der"><b className={c.diferencia === 0 ? "pos-ok" : "pos-error"}>{c.diferencia === 0 ? "Cuadra" : (c.diferencia > 0 ? "+" : "") + colones(c.diferencia)}</b></div></li>
          ))}
        </ul>
      )}
    </div>
  );
}
