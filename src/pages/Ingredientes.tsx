import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Cargando, ErrorCaja } from "../components";
import { colones, colonesUnit, unidad } from "../format";
import type { Ingrediente } from "../types";

export default function Ingredientes() {
  const [lista, setLista] = useState<Ingrediente[] | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [soloSin, setSoloSin] = useState(false);
  const nav = useNavigate();
  useEffect(() => { api<Ingrediente[]>("/api/ingredientes").then(setLista).catch((e) => setErr(e.message)); }, []);
  const cats = useMemo(() => [...new Set((lista || []).map((i) => i.categoria))].sort(), [lista]);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  if (err) return <ErrorCaja msg={err} />;
  if (!lista) return <Cargando />;
  const f = lista.filter((i) => (!cat || i.categoria === cat) && (!soloSin || i.costo.error) && norm(i.nombre).includes(norm(q)));

  return (
    <>
      <header className="encabezado">
        <div>
          <h1>Ingredientes</h1>
          <p className="sub">Cada ingrediente guarda sus presentaciones de compra. El costo se lleva a la unidad más pequeña, ya descontada la merma.</p>
        </div>
        <Link className="btn btn-primario" to="/admin/ingredientes/nuevo">Nuevo ingrediente</Link>
      </header>
      <div className="filtros">
        <input type="search" placeholder="Buscar ingrediente" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {cats.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={soloSin} onChange={(e) => setSoloSin(e.target.checked)} /> Solo sin precio</label>
      </div>
      <div className="tabla-envoltura">
        <table className="tabla">
          <thead>
            <tr>
              <th>Ingrediente</th>
              <th>Categoría</th>
              <th className="n">Costo por unidad mínima</th>
              <th className="n">Por kg / L</th>
              <th className="n">Presentaciones</th>
              <th className="n">Recetas</th>
            </tr>
          </thead>
          <tbody>
            {f.map((i) => (
              <tr key={i.id} className="clic" onClick={() => nav(`/admin/ingredientes/${i.id}`)}>
                <td><Link to={`/admin/ingredientes/${i.id}`} onClick={(e) => e.stopPropagation()}>{i.nombre}</Link></td>
                <td className="tenue">{i.categoria}</td>
                <td className="n fuerte">
                  {i.costo.error ? <span className="marca-error">sin precio</span> : <>{colonesUnit(i.costo.seleccionado)}<span className="tenue">/{unidad(i.unidad_base)}</span></>}
                </td>
                <td className="n">{!i.costo.error && i.unidad_base !== "unidad" ? colones((i.costo.seleccionado || 0) * 1000) : ""}</td>
                <td className="n">{i.presentaciones.length}</td>
                <td className="n">{i.usos || ""}</td>
              </tr>
            ))}
            {f.length === 0 && <tr><td colSpan={6} className="vacio">Ningún ingrediente coincide.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="pie">{f.length} de {lista.length} ingredientes</p>
    </>
  );
}
