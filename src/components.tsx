import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, descargar } from "./api";
import { unidad } from "./format";
import type { UnidadInfo } from "./types";

/** Campo numérico que acepta coma o punto y no salta mientras se escribe. */
export function NumInput({ value, onChange, min, step, placeholder, ariaLabel, className, allowEmpty, id }: {
  value: number | null | undefined; onChange: (v: number | null) => void; min?: number; step?: number;
  placeholder?: string; ariaLabel?: string; className?: string; allowEmpty?: boolean; id?: string;
}) {
  const [txt, setTxt] = useState(value === null || value === undefined ? "" : String(value));
  const ultimo = useRef(value);
  useEffect(() => {
    if (value !== ultimo.current) {
      setTxt(value === null || value === undefined ? "" : String(value));
      ultimo.current = value;
    }
  }, [value]);
  return (
    <input
      id={id}
      className={"num " + (className || "")}
      inputMode="decimal"
      value={txt}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => {
        const t = e.target.value.replace(",", ".");
        setTxt(e.target.value);
        if (t.trim() === "") { ultimo.current = allowEmpty ? null : 0; onChange(allowEmpty ? null : 0); return; }
        const n = Number(t);
        if (!Number.isNaN(n) && (min === undefined || n >= min)) { ultimo.current = n; onChange(n); }
      }}
      step={step}
    />
  );
}

export function UnidadSelect({ value, onChange, opciones, ariaLabel }: {
  value: string; onChange: (v: string) => void; opciones: UnidadInfo[]; ariaLabel?: string;
}) {
  const grupos: Record<string, string> = { masa: "Peso", volumen: "Volumen", unidad: "Unidades" };
  const dims = [...new Set(opciones.map((o) => o.dimension))];
  const tiene = opciones.some((o) => o.clave === value);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel}>
      {!tiene && <option value={value}>{unidad(value)}</option>}
      {dims.map((d) => (
        <optgroup key={d} label={grupos[d]}>
          {opciones.filter((o) => o.dimension === d).map((o) => (
            <option key={o.clave} value={o.clave} title={o.nombre}>{unidad(o.clave)}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export type Opcion = { key: string; label: string; hint?: string; grupo?: string };

/** Buscador con lista desplegable (para elegir ingredientes o sub-recetas). */
export function Buscador({ opciones, valor, onElegir, placeholder, ariaLabel }: {
  opciones: Opcion[]; valor: string | null; onElegir: (key: string) => void; placeholder?: string; ariaLabel?: string;
}) {
  const actual = opciones.find((o) => o.key === valor);
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const lista = useMemo(() => {
    const nq = norm(q.trim());
    if (!nq) return opciones.slice(0, 60);
    const rango = (o: Opcion) => { const l = norm(o.label); return l === nq ? 0 : l.startsWith(nq) ? 1 : l.split(/\s+/).some((w) => w.startsWith(nq)) ? 2 : 3; };
    return opciones.filter((o) => norm(o.label).includes(nq)).sort((a, b) => rango(a) - rango(b)).slice(0, 60);
  }, [q, opciones]);
  useEffect(() => {
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);
  const elegir = (o: Opcion) => { onElegir(o.key); setQ(""); setAbierto(false); };
  return (
    <div className="buscador" ref={caja}>
      <input
        aria-label={ariaLabel}
        value={abierto ? q : actual?.label || ""}
        placeholder={actual ? actual.label : placeholder}
        onFocus={() => { setAbierto(true); setActivo(0); }}
        onChange={(e) => { setQ(e.target.value); setAbierto(true); setActivo(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActivo((a) => Math.min(a + 1, lista.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter" && lista[activo]) { e.preventDefault(); elegir(lista[activo]); }
          if (e.key === "Escape") setAbierto(false);
        }}
        role="combobox"
        aria-expanded={abierto}
      />
      {abierto && (
        <ul className="buscador-lista" role="listbox">
          {lista.length === 0 && <li className="vacio">Nada coincide con «{q}»</li>}
          {lista.map((o, i) => (
            <li key={o.key} role="option" aria-selected={i === activo} className={i === activo ? "activo" : ""}
                onMouseDown={(e) => { e.preventDefault(); elegir(o); }} onMouseEnter={() => setActivo(i)}>
              <span>{o.label}</span>
              {o.hint && <small>{o.hint}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Campo({ label, children, ayuda, htmlFor }: { label: string; children: ReactNode; ayuda?: string; htmlFor?: string }) {
  return (
    <label className="campo" htmlFor={htmlFor}>
      <span className="campo-label">{label}</span>
      {children}
      {ayuda && <span className="campo-ayuda">{ayuda}</span>}
    </label>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return <div className="cargando" aria-live="polite">{texto}</div>;
}

export function ErrorCaja({ msg }: { msg: string }) {
  return <div className="error-caja" role="alert">{msg}</div>;
}

export function Confirmar({ texto, onSi, onNo, si = "Borrar" }: { texto: string; onSi: () => void; onNo: () => void; si?: string }) {
  return (
    <div className="modal-fondo" onClick={onNo}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <p>{texto}</p>
        <div className="fila-botones">
          <button className="btn" onClick={onNo} autoFocus>Cancelar</button>
          <button className="btn btn-peligro" onClick={onSi}>{si}</button>
        </div>
      </div>
    </div>
  );
}

/** Subir, cambiar o quitar una imagen. */
export function SubirImagen({ url, onSubir, onQuitar, texto = "Subir foto", redonda, deshabilitado, ayuda }: {
  url: string | null; onSubir: (f: File) => Promise<void>; onQuitar: () => Promise<void>; texto?: string;
  redonda?: boolean; deshabilitado?: boolean; ayuda?: string;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const elegir = async (f?: File) => {
    if (!f) return;
    setSubiendo(true);
    try { await onSubir(f); } finally { setSubiendo(false); if (input.current) input.current.value = ""; }
  };
  return (
    <div className={"subir-imagen" + (redonda ? " redonda" : "")}>
      <div className="subir-vista">
        {url ? <img src={url} alt="" /> : <span>{deshabilitado ? "Guarde primero" : "Sin imagen"}</span>}
      </div>
      <div className="subir-acciones">
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => elegir(e.target.files?.[0])} />
        <button type="button" className="btn" disabled={subiendo || deshabilitado} onClick={() => input.current?.click()}>
          {subiendo ? "Subiendo…" : url ? "Cambiar" : texto}
        </button>
        {url && <button type="button" className="link peligro" onClick={onQuitar}>Quitar</button>}
        {ayuda && <span className="campo-ayuda">{ayuda}</span>}
      </div>
    </div>
  );
}

/** Categoría: se elige de una lista; la última opción permite escribir una nueva. */
export function CategoriaSelect({ value, opciones, onChange, tipo }: {
  value: string; opciones: string[]; onChange: (v: string) => void; tipo?: "producto" | "subreceta" | "ingrediente";
}) {
  const [guardadas, setGuardadas] = useState<string[]>([]);
  useEffect(() => {
    if (!tipo) return;
    api<{ nombre: string }[]>(`/api/categorias/${tipo}`).then((l) => setGuardadas(l.map((x) => x.nombre))).catch(() => {});
  }, [tipo]);
  const extra = [...opciones, value].map((x) => (x || "").trim()).filter((x) => x && !guardadas.includes(x))
    .sort((a, b) => a.localeCompare(b, "es"));
  const lista = [...new Set([...guardadas, ...extra])];
  const [nueva, setNueva] = useState(false);
  const [txt, setTxt] = useState("");
  if (nueva) {
    const listo = () => { const t = txt.trim(); if (t) onChange(t); setNueva(false); setTxt(""); };
    return (
      <div className="cat-nueva">
        <input autoFocus value={txt} placeholder="Nombre de la categoría" aria-label="Nueva categoría"
               onChange={(e) => setTxt(e.target.value)}
               onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); listo(); } if (e.key === "Escape") setNueva(false); }} />
        <button type="button" className="btn btn-primario" onClick={listo} disabled={!txt.trim()}>Usar</button>
        <button type="button" className="btn" onClick={() => setNueva(false)}>Cancelar</button>
      </div>
    );
  }
  return (
    <select value={value} onChange={(e) => (e.target.value === "__nueva__" ? setNueva(true) : onChange(e.target.value))}>
      {lista.map((c) => <option key={c} value={c}>{c}</option>)}
      <option value="__nueva__">+ Nueva categoría…</option>
    </select>
  );
}

/** Botón "Descargar" con opciones de PDF y Excel. */
export function Descargas({ opciones, cuerpo, etiqueta = "Descargar" }: {
  opciones: { texto: string; ruta: string }[]; cuerpo?: unknown; etiqueta?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [bajando, setBajando] = useState("");
  const [error, setError] = useState("");
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", fuera); document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", tecla); };
  }, [abierto]);
  const bajar = async (ruta: string, formato: "pdf" | "xlsx") => {
    setBajando(ruta + formato); setError("");
    try { await descargar(`${ruta}${ruta.includes("?") ? "&" : "?"}formato=${formato}`, `reporte.${formato}`, cuerpo); setAbierto(false); }
    catch (e: any) { setError(e.message); } finally { setBajando(""); }
  };
  return (
    <div className="descargas" ref={caja}>
      <button className="btn" aria-expanded={abierto} aria-haspopup="menu" onClick={() => setAbierto(!abierto)}>
        {etiqueta} <span aria-hidden="true">▾</span>
      </button>
      {abierto && (
        <div className="descargas-menu" role="menu">
          {opciones.map((o) => (
            <div key={o.ruta} className="descargas-fila">
              <span>{o.texto}</span>
              <div>
                <button role="menuitem" className="btn-mini-texto" disabled={!!bajando} onClick={() => bajar(o.ruta, "pdf")}>
                  {bajando === o.ruta + "pdf" ? "…" : "PDF"}</button>
                <button role="menuitem" className="btn-mini-texto" disabled={!!bajando} onClick={() => bajar(o.ruta, "xlsx")}>
                  {bajando === o.ruta + "xlsx" ? "…" : "Excel"}</button>
              </div>
            </div>
          ))}
          {error && <p className="error-texto">{error}</p>}
        </div>
      )}
    </div>
  );
}
