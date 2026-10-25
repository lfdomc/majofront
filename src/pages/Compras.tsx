import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Cargando, Descargas, ErrorCaja, NumInput } from "../components";
import { colones, num, unidad } from "../format";
import type { ResumenReceta } from "../types";

type Fila = { ingrediente_id: number; nombre: string; cantidad_base: number; unidad_base: string; costo: number | null;
  presentacion: string | null; proveedor: string | null; comprar: number | null; costo_compra: number | null };
type Res = { items: Fila[]; costo_total: number; costo_compra_total: number };

const GUARDADO = "costeo-lista-compras";

function cantidadLegible(q: number, u: string) {
  if (u === "g" && q >= 1000) return `${num(q / 1000, 2)} kg`;
  if (u === "ml" && q >= 1000) return `${num(q / 1000, 2)} L`;
  return `${num(q, q >= 100 ? 0 : 1)} ${unidad(u)}`;
}

/** Lista de compras para varios productos a la vez, agrupada por proveedor. */
export default function Compras() {
  const [recs, setRecs] = useState<ResumenReceta[] | null>(null);
  const [err, setErr] = useState("");
  const [cant, setCant] = useState<Record<number, number | null>>(() => {
    try { return JSON.parse(localStorage.getItem(GUARDADO) || "{}"); } catch { return {}; }
  });
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Res | null>(null);
  const [calcErr, setCalcErr] = useState("");

  useEffect(() => { api<ResumenReceta[]>("/api/recetas").then(setRecs).catch((e) => setErr(e.message)); }, []);
  useEffect(() => { try { localStorage.setItem(GUARDADO, JSON.stringify(cant)); } catch { /* sin almacenamiento */ } }, [cant]);

  const items = useMemo(() => Object.entries(cant).filter(([, v]) => v && v > 0)
    .map(([id, v]) => ({ receta_id: Number(id), cantidad: v as number })), [cant]);

  useEffect(() => {
    if (!items.length) { setRes(null); return; }
    const t = setTimeout(() => {
      api<Res>("/api/compras", { method: "POST", body: { items } }).then((r) => { setRes(r); setCalcErr(""); })
        .catch((e) => setCalcErr(e.message));
    }, 350);
    return () => clearTimeout(t);
  }, [items]);

  const grupos = useMemo(() => {
    const g = new Map<string, Fila[]>();
    (res?.items || []).forEach((f) => { const k = f.proveedor || "Sin proveedor"; g.set(k, [...(g.get(k) || []), f]); });
    return [...g.entries()].sort(([a], [b]) => (a === "Sin proveedor" ? 1 : b === "Sin proveedor" ? -1 : a.localeCompare(b, "es")));
  }, [res]);

  if (err) return <ErrorCaja msg={err} />;
  if (!recs) return <Cargando />;
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const lista = recs.filter((r) => norm(r.nombre).includes(norm(q)))
    .sort((a, b) => (a.tipo !== b.tipo ? (a.tipo === "producto" ? -1 : 1) : a.categoria.localeCompare(b.categoria, "es") || a.nombre.localeCompare(b.nombre, "es")));

  return (
    <>
      <header className="encabezado">
        <div>
          <h1>Lista de compras</h1>
          <p className="sub">Escriba cuánto va a preparar de cada producto. El sistema suma los ingredientes (también los de las sub-recetas y mermas)
            y le dice cuánto comprar, agrupado por proveedor.</p>
        </div>
        <div className="fila-botones">
          {items.length > 0 && <button className="btn" onClick={() => setCant({})}>Empezar de nuevo</button>}
          {items.length > 0 && <Descargas etiqueta="Descargar lista" cuerpo={{ items }} opciones={[{ texto: "Lista de compras", ruta: "/api/reportes/compras" }]} />}
        </div>
      </header>

      <div className="compras">
        <section className="compras-pedido">
          <h2 className="seccion">¿Qué va a preparar?</h2>
          <input type="search" placeholder="Buscar producto o receta" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
          <ul className="compras-lista">
            {lista.map((r) => (
              <li key={r.id} className={cant[r.id] ? "elegido" : ""}>
                <div>
                  <strong>{r.nombre}</strong>
                  <span className="tenue">{r.tipo === "producto" ? r.categoria : "Sub-receta"}</span>
                </div>
                <div className="con-sufijo ancho-corto">
                  <NumInput value={cant[r.id] ?? null} allowEmpty min={0} placeholder="0" ariaLabel={`Cantidad de ${r.nombre}`}
                            onChange={(v) => setCant((c) => ({ ...c, [r.id]: v }))} />
                  <span>{unidad(r.rinde_unidad, cant[r.id] || 2)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="compras-resultado">
          <h2 className="seccion">Qué comprar</h2>
          {calcErr && <p className="error-texto">{calcErr}</p>}
          {!items.length ? <p className="vacio">Escriba una cantidad en al menos un producto para ver la lista.</p> : !res ? <Cargando /> : (
            <>
              <div className="cifras-compras">
                <div><span className="cifra-label">Total a pagar</span><span className="cifra-valor">{colones(res.costo_compra_total)}</span>
                  <span className="cifra-nota">Comprando presentaciones completas</span></div>
                <div><span className="cifra-label">Costo de lo que se usa</span><span className="cifra-valor chica">{colones(res.costo_total)}</span>
                  <span className="cifra-nota">Lo que realmente lleva la producción</span></div>
              </div>
              {grupos.map(([prov, filas]) => (
                <div key={prov} className="tabla-envoltura compras-grupo">
                  <table className="tabla compacta">
                    <caption>{prov} <span className="tenue">· {colones(filas.reduce((s, f) => s + (f.costo_compra || 0), 0))}</span></caption>
                    <thead><tr><th>Ingrediente</th><th className="n">Necesita</th><th>Comprar</th><th className="n">Costo</th></tr></thead>
                    <tbody>
                      {filas.map((f) => (
                        <tr key={f.ingrediente_id}>
                          <td>{f.nombre}</td>
                          <td className="n">{cantidadLegible(f.cantidad_base, f.unidad_base)}</td>
                          <td>{f.comprar ? `${f.comprar} × ${f.presentacion}` : <span className="tenue">sin presentación de compra</span>}</td>
                          <td className="n">{colones(f.costo_compra)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </>
          )}
        </section>
      </div>
    </>
  );
}
