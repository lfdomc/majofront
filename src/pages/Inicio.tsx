import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Cargando, ErrorCaja } from "../components";
import { colones, pct } from "../format";
import type { Config, ResumenReceta } from "../types";

type Resumen = { ingredientes: number; recetas: number; productos: ResumenReceta[];
  sin_precio: { id: number; nombre: string }[]; config: Config };

export default function Inicio() {
  const [d, setD] = useState<Resumen | null>(null);
  const [err, setErr] = useState("");
  const [cat, setCat] = useState<string>("");
  const [sinWhatsapp, setSinWhatsapp] = useState(false);
  const nav = useNavigate();
  useEffect(() => { api<Resumen>("/api/resumen").then(setD).catch((e) => setErr(e.message)); }, []);
  useEffect(() => { api<{ whatsapp: string }>("/api/negocio").then((n) => setSinWhatsapp(!n.whatsapp.trim())).catch(() => {}); }, []);

  const cats = useMemo(() => [...new Set((d?.productos || []).map((p) => p.categoria))].sort(), [d]);
  useEffect(() => { if (cats.length && !cat) setCat(cats.includes("Postres") ? "Postres" : cats[0]); }, [cats, cat]);

  if (err) return <ErrorCaja msg={err} />;
  if (!d) return <Cargando />;
  const lista = d.productos.filter((p) => !cat || p.categoria === cat);

  return (
    <>
      <header className="encabezado">
        <div>
          <h1>Productos</h1>
          <p className="sub">Costo por producto y precio, con margen objetivo de {pct(d.config.margen_objetivo_pct)}
            {d.config.aplicar_iva ? ` e IVA ${d.config.iva_pct} %` : " sin IVA"}.</p>
        </div>
        <Link className="btn btn-primario" to="/admin/recetas/nueva?tipo=producto">Nuevo producto</Link>
      </header>

      {sinWhatsapp && (
        <div className="alerta">
          <b>Falta el número de WhatsApp.</b> Sin él, el menú no muestra los botones para pedir.{" "}
          <Link to="/admin/ajustes">Agregarlo en Ajustes</Link>.
        </div>
      )}

      {d.sin_precio.length > 0 && (
        <div className="alerta">
          <b>{d.sin_precio.length} ingredientes no tienen precio</b> y cuentan como cero en las recetas que los usan:{" "}
          {d.sin_precio.slice(0, 8).map((i, n) => (
            <span key={i.id}>{n > 0 && ", "}<Link to={`/admin/ingredientes/${i.id}`}>{i.nombre}</Link></span>
          ))}
          {d.sin_precio.length > 8 && ` y ${d.sin_precio.length - 8} más`}.
        </div>
      )}

      {cats.length > 1 && (
        <div className="pestanas" role="tablist">
          {cats.map((c) => (
            <button key={c} role="tab" aria-selected={c === cat} className={c === cat ? "activa" : ""} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      )}

      <div className="tabla-envoltura">
        <table className="tabla">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="n">Costo por producto</th>
              <th className="n">Precio sugerido</th>
              <th className="n">Precio de venta</th>
              <th className="n">Margen real</th>
              <th className="n">Competencia</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id} className="clic" onClick={() => nav(`/admin/recetas/${p.id}`)}>
                <td>
                  <Link to={`/admin/recetas/${p.id}`} onClick={(e) => e.stopPropagation()}>{p.nombre}</Link>
                  {p.errores.length > 0 && <span className="marca-error" title={p.errores.join("\n")}>revisar</span>}
                </td>
                <td className="n fuerte">{colones(p.costo_por_rinde)}</td>
                <td className="n">{colones(p.precio_sugerido)}</td>
                <td className="n">{p.precio_venta ? colones(p.precio_venta) : <span className="tenue">sin definir</span>}</td>
                <td className="n"><Margen v={p.margen_real_pct} /></td>
                <td className="n">{colones(p.precio_competencia)}</td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan={6} className="vacio">Aún no hay productos. <Link to="/admin/recetas/nueva?tipo=producto">Cree el primero</Link>.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="pie">{d.ingredientes} ingredientes · {d.recetas} recetas en total</p>
    </>
  );
}

export function Margen({ v }: { v: number | null | undefined }) {
  if (v === null || v === undefined) return <span className="tenue">—</span>;
  const cls = v < 40 ? "m-bajo" : v < 60 ? "m-medio" : "m-alto";
  return <span className={`margen ${cls}`}>{pct(v)}</span>;
}
