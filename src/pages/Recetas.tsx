import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Cargando, Descargas, ErrorCaja } from "../components";
import { colones, colonesUnit, num, pct, unidad } from "../format";
import type { ResumenReceta } from "../types";
import { Margen } from "./Inicio";

export default function Recetas() {
  const [lista, setLista] = useState<ResumenReceta[] | null>(null);
  const [err, setErr] = useState("");
  const [params, setParams] = useSearchParams();
  const tipo = (params.get("tipo") as "producto" | "subreceta") || "producto";
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const nav = useNavigate();

  useEffect(() => { api<ResumenReceta[]>("/api/recetas").then(setLista).catch((e) => setErr(e.message)); }, []);
  const cats = useMemo(() => [...new Set((lista || []).filter((r) => r.tipo === tipo).map((r) => r.categoria))].sort(), [lista, tipo]);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const filtradas = (lista || []).filter((r) => r.tipo === tipo && (!cat || r.categoria === cat) && norm(r.nombre).includes(norm(q)));

  async function guardar(id: number, cambio: { precio_venta?: number | null; precio_competencia?: number | null }) {
    try {
      const nuevo = await api<ResumenReceta>(`/api/recetas/${id}/precios`, { method: "PATCH", body: cambio });
      setLista((l) => (l || []).map((x) => (x.id === id ? { ...x, ...nuevo } : x)));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (err) return <ErrorCaja msg={err} />;
  if (!lista) return <Cargando />;

  return (
    <>
      <header className="encabezado">
        <div>
          <h1>Productos y recetas</h1>
          <p className="sub">Los productos son lo que vende. Las sub-recetas son preparaciones (salsas, gelatina, bola de helado) que se usan como ingrediente.</p>
        </div>
        <div className="fila-botones">
          <Descargas opciones={tipo === "producto"
            ? [{ texto: "Lista de productos y precios", ruta: "/api/reportes/productos" },
               { texto: "Productos con su receta", ruta: "/api/reportes/recetas-productos" },
               { texto: "Todas las recetas", ruta: "/api/reportes/recetas" }]
            : [{ texto: "Sub-recetas con ingredientes", ruta: "/api/reportes/subrecetas" },
               { texto: "Todas las recetas", ruta: "/api/reportes/recetas" }]} />
          <Link className="btn btn-primario" to={`/admin/recetas/nueva?tipo=${tipo}`}>{tipo === "producto" ? "Nuevo producto" : "Nueva sub-receta"}</Link>
        </div>
      </header>
      <div className="pestanas" role="tablist">
        {(["producto", "subreceta"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tipo === t} className={tipo === t ? "activa" : ""}
                  onClick={() => { setParams({ tipo: t }); setCat(""); }}>
            {t === "producto" ? "Productos" : "Sub-recetas"} <span className="conteo">{lista.filter((r) => r.tipo === t).length}</span>
          </button>
        ))}
      </div>
      <div className="filtros">
        <input type="search" placeholder="Buscar por nombre" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {cats.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="tabla-envoltura">
        <table className={`tabla ${tipo === "producto" ? "tabla-productos" : ""}`}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Categoría</th>
              {tipo !== "producto" && <th className="n">Rinde</th>}
              {tipo !== "producto" && <th className="n">Costo total</th>}
              <th className="n">{tipo === "producto" ? "Costo por producto" : "Costo por unidad"}</th>
              {tipo === "producto" && <>
                <th className="n">Precio de venta</th>
                <th className="n" title="Lo que le queda por cada venta: precio sin IVA menos el costo">Ganancia por venta</th>
                <th className="n">Margen real</th>
                <th className="n">Precio competencia</th>
                <th className="n" title="Su precio comparado con el de la competencia">Cuánto más barato</th>
              </>}
            </tr>
          </thead>
          <tbody>
            {filtradas.map((r) => (
              <tr key={r.id} className="clic" onClick={() => nav(`/admin/recetas/${r.id}`)}>
                <td>
                  <Link to={`/admin/recetas/${r.id}`} onClick={(e) => e.stopPropagation()}>{r.nombre}</Link>
                  {r.errores.length > 0 && <span className="marca-error" title={r.errores.join("\n")}>revisar</span>}
                </td>
                <td className="tenue">{r.categoria}</td>
                {tipo !== "producto" && <td className="n">{num(r.rinde_cantidad, 2)} {unidad(r.rinde_unidad, r.rinde_cantidad)}</td>}
                {tipo !== "producto" && <td className="n">{colones(r.costo_total)}</td>}
                <td className="n fuerte">{r.costo_por_rinde !== null && r.costo_por_rinde < 50 ? colonesUnit(r.costo_por_rinde) : colones(r.costo_por_rinde)}</td>
                {tipo === "producto" && <>
                  <td className="n" onClick={(e) => e.stopPropagation()}>
                    <CeldaPrecio valor={r.precio_venta} etiqueta={`Precio de venta de ${r.nombre}`}
                                 sugerido={r.precio_sugerido} onGuardar={(v) => guardar(r.id, { precio_venta: v })} />
                  </td>
                  <td className="n"><Ganancia v={r.ganancia} /></td>
                  <td className="n"><Margen v={r.margen_real_pct} /></td>
                  <td className="n" onClick={(e) => e.stopPropagation()}>
                    <CeldaPrecio valor={r.precio_competencia} etiqueta={`Precio de la competencia para ${r.nombre}`}
                                 onGuardar={(v) => guardar(r.id, { precio_competencia: v })} />
                  </td>
                  <td className="n"><Diferencia r={r} /></td>
                </>}
              </tr>
            ))}
            {filtradas.length === 0 && <tr><td colSpan={10} className="vacio">No hay recetas con ese filtro.</td></tr>}
          </tbody>
        </table>
      </div>
      {tipo === "producto" && (
        <p className="nota-tabla">Puede escribir el precio de venta y el de la competencia directo en la tabla; se guarda solo al salir del campo o con Enter.
          La ganancia por venta es el precio sin IVA menos el costo. <sup>*</sup> Calculado con el precio sugerido porque el producto no tiene precio de venta.</p>
      )}
    </>
  );
}

/** Precio editable directamente en la lista: se guarda al salir del campo o con Enter. */
function CeldaPrecio({ valor, etiqueta, sugerido, onGuardar }: {
  valor: number | null; etiqueta: string; sugerido?: number | null; onGuardar: (v: number | null) => Promise<void>;
}) {
  const [txt, setTxt] = useState(valor == null ? "" : String(Math.round(valor)));
  const [estado, setEstado] = useState<"" | "guardando" | "listo">("");
  useEffect(() => { setTxt(valor == null ? "" : String(Math.round(valor))); }, [valor]);
  async function confirmar() {
    const limpio = txt.replace(/[₡\s.]/g, "").replace(",", ".");
    const v = limpio === "" ? null : Number(limpio);
    if (v !== null && (Number.isNaN(v) || v < 0)) { setTxt(valor == null ? "" : String(Math.round(valor))); return; }
    if (v === valor || (v !== null && valor !== null && Math.round(v) === Math.round(valor))) return;
    setEstado("guardando");
    await onGuardar(v);
    setEstado("listo");
    setTimeout(() => setEstado(""), 1200);
  }
  return (
    <div className={`celda-precio ${estado}`}>
      <span>₡</span>
      <input inputMode="numeric" value={txt} aria-label={etiqueta}
             placeholder={sugerido ? `${Math.round(sugerido)}` : "—"}
             title={sugerido && valor == null ? `Precio sugerido: ${colones(sugerido)}` : undefined}
             onChange={(e) => setTxt(e.target.value)} onBlur={confirmar}
             onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setTxt(valor == null ? "" : String(Math.round(valor))); } }} />
    </div>
  );
}

function Ganancia({ v }: { v: number | null }) {
  if (v == null) return <span className="tenue">—</span>;
  return <span className={v < 0 ? "m-bajo fuerte" : "fuerte"}>{colones(v)}</span>;
}

function Diferencia({ r }: { r: ResumenReceta }) {
  const d = r.diferencia_competencia;
  if (d == null || !r.precio_competencia) return <span className="tenue">—</span>;
  const p = Math.abs(d) / r.precio_competencia * 100;
  const conSugerido = r.precio_venta == null;
  const nota = conSugerido ? " (con el precio sugerido)" : "";
  if (Math.round(d) === 0) return <span className="tenue" title={"Mismo precio" + nota}>Igual</span>;
  return (
    <span className={d < 0 ? "dif-barato" : "dif-caro"} title={(d < 0 ? "Más barato" : "Más caro") + nota}>
      {d < 0 ? "▼ " : "▲ "}{colones(Math.abs(d))}{conSugerido && <sup>*</sup>}
      <small>{pct(p)} {d < 0 ? "más barato" : "más caro"}</small>
    </span>
  );
}
