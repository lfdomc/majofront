import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Cargando, ErrorCaja } from "../components";
import { useApp } from "../store";

type Tipo = "producto" | "subreceta" | "ingrediente";
type Cat = { nombre: string; usos: number; en?: string; en_sugerido?: string; color?: string };

const PESTANAS: { tipo: Tipo; titulo: string; cosa: [string, string] }[] = [
  { tipo: "producto", titulo: "Productos", cosa: ["producto", "productos"] },
  { tipo: "subreceta", titulo: "Sub-recetas", cosa: ["sub-receta", "sub-recetas"] },
  { tipo: "ingrediente", titulo: "Ingredientes", cosa: ["ingrediente", "ingredientes"] },
];

export default function Categorias() {
  const { aviso } = useApp();
  const [params, setParams] = useSearchParams();
  const tipo = (params.get("tipo") as Tipo) || "producto";
  const info = PESTANAS.find((p) => p.tipo === tipo)!;
  const [lista, setLista] = useState<Cat[] | null>(null);
  const [err, setErr] = useState("");
  const [nueva, setNueva] = useState("");
  const [editando, setEditando] = useState<{ anterior: string; txt: string } | null>(null);
  const [borrando, setBorrando] = useState<{ cat: Cat; destino: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    setLista(null);
    api<Cat[]>(`/api/categorias/${tipo}`).then(setLista).catch((e) => setErr(e.message));
  }, [tipo]);

  const hacer = async (fn: () => Promise<Cat[]>, msg: string) => {
    setOcupado(true);
    try { setLista(await fn()); aviso(msg); return true; }
    catch (e: any) { aviso(e.message, "error"); return false; }
    finally { setOcupado(false); }
  };

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = nueva.trim();
    if (!n) return;
    if (await hacer(() => api(`/api/categorias/${tipo}`, { method: "POST", body: { nombre: n } }), `Categoría «${n}» creada`)) setNueva("");
  };

  const renombrar = async () => {
    if (!editando) return;
    const nuevo = editando.txt.trim();
    if (!nuevo || nuevo === editando.anterior) { setEditando(null); return; }
    if (await hacer(() => api(`/api/categorias/${tipo}/renombrar`, { method: "PUT", body: { anterior: editando.anterior, nuevo } }),
      `Ahora se llama «${nuevo}»`)) setEditando(null);
  };

  const mover = (i: number, d: -1 | 1) => {
    if (!lista) return;
    const nombres = lista.map((c) => c.nombre);
    [nombres[i], nombres[i + d]] = [nombres[i + d], nombres[i]];
    setLista(nombres.map((n) => lista.find((c) => c.nombre === n)!));
    api<Cat[]>(`/api/categorias/${tipo}/orden`, { method: "PUT", body: { nombres } }).then(setLista)
      .catch((e) => aviso(e.message, "error"));
  };

  const esperaColor = useRef<number>();
  const guardarColor = (nombre: string, color: string) =>
    hacer(() => api(`/api/categorias/${tipo}/color`, { method: "PUT", body: { nombre, color } }), `Color de «${nombre}» guardado`);

  const guardarIngles = (nombre: string, en: string) =>
    hacer(() => api(`/api/categorias/${tipo}/ingles`, { method: "PUT", body: { nombre, en } }),
      en ? `«${nombre}» en inglés: ${en}` : `Se usará la traducción sugerida para «${nombre}»`);

  const borrar = async () => {
    if (!borrando) return;
    const { cat, destino } = borrando;
    const q = new URLSearchParams({ nombre: cat.nombre });
    if (cat.usos) q.set("mover_a", destino);
    if (await hacer(() => api(`/api/categorias/${tipo}?${q}`, { method: "DELETE" }), `Categoría «${cat.nombre}» borrada`)) setBorrando(null);
  };

  if (err) return <ErrorCaja msg={err} />;

  return (
    <>
      <header className="encabezado">
        <div>
          <h1>Categorías</h1>
          <p className="sub">Cree, cambie el nombre, ordene o borre categorías. Al cambiar el nombre se actualizan todos los que la usan.
            {tipo === "producto" && " El orden de aquí es el orden en que salen en el menú de clientes. El nombre en inglés se usa en el menú en inglés; si lo deja vacío se usa el que aparece en gris."}</p>
        </div>
      </header>
      <div className="pestanas" role="tablist">
        {PESTANAS.map((p) => (
          <button key={p.tipo} role="tab" aria-selected={tipo === p.tipo} className={tipo === p.tipo ? "activa" : ""}
                  onClick={() => { setParams({ tipo: p.tipo }); setEditando(null); }}>{p.titulo}</button>
        ))}
      </div>

      <form className="cat-crear" onSubmit={crear}>
        <input value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nombre de la nueva categoría" aria-label="Nueva categoría" maxLength={80} />
        <button className="btn btn-primario" disabled={!nueva.trim() || ocupado}>Crear categoría</button>
      </form>

      {!lista ? <Cargando /> : (
        <div className="tabla-envoltura">
          <table className="tabla cat-tabla">
            <thead>
              <tr><th style={{ width: 84 }}>Orden</th><th>Nombre</th>{tipo === "producto" && <th>Color en la caja</th>}{tipo === "producto" && <th>En inglés</th>}<th className="n">En uso</th><th className="n">Acciones</th></tr>
            </thead>
            <tbody>
              {lista.map((c, i) => (
                <tr key={c.nombre}>
                  <td>
                    <div className="cat-orden">
                      <button className="btn-mini" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir ${c.nombre}`}>▲</button>
                      <button className="btn-mini" onClick={() => mover(i, 1)} disabled={i === lista.length - 1} aria-label={`Bajar ${c.nombre}`}>▼</button>
                    </div>
                  </td>
                  <td>
                    {editando?.anterior === c.nombre ? (
                      <div className="cat-nueva">
                        <input autoFocus value={editando.txt} maxLength={80} aria-label="Nuevo nombre"
                               onChange={(e) => setEditando({ ...editando, txt: e.target.value })}
                               onKeyDown={(e) => { if (e.key === "Enter") renombrar(); if (e.key === "Escape") setEditando(null); }} />
                        <button className="btn btn-primario" onClick={renombrar} disabled={ocupado || !editando.txt.trim()}>Guardar</button>
                        <button className="btn" onClick={() => setEditando(null)}>Cancelar</button>
                      </div>
                    ) : <strong>{c.nombre}</strong>}
                  </td>
                  {tipo === "producto" && (
                    <td>
                      <input type="color" className="cat-color" defaultValue={c.color || "#D94C72"} key={c.nombre + (c.color || "")}
                             aria-label={`Color de ${c.nombre}`}
                             onChange={(e) => {
                               const v = e.target.value;
                               clearTimeout(esperaColor.current);
                               esperaColor.current = window.setTimeout(() => { if (v.toUpperCase() !== (c.color || "").toUpperCase()) guardarColor(c.nombre, v); }, 700);
                             }} />
                    </td>
                  )}
                  {tipo === "producto" && (
                    <td>
                      <input className="cat-en" defaultValue={c.en || ""} key={c.nombre + (c.en || "")} maxLength={80}
                             placeholder={c.en_sugerido || "Nombre en inglés"} aria-label={`${c.nombre} en inglés`}
                             onBlur={(e) => { const v = e.target.value.trim(); if (v !== (c.en || "")) guardarIngles(c.nombre, v); }}
                             onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                    </td>
                  )}
                  <td className="n tenue">{c.usos === 0 ? "Vacía" : `${c.usos} ${c.usos === 1 ? info.cosa[0] : info.cosa[1]}`}</td>
                  <td className="n">
                    {editando?.anterior !== c.nombre && (
                      <div className="cat-acciones">
                        <button className="btn" onClick={() => setEditando({ anterior: c.nombre, txt: c.nombre })}>Cambiar nombre</button>
                        <button className="btn btn-peligro-suave"
                                onClick={() => setBorrando({ cat: c, destino: lista.find((x) => x.nombre !== c.nombre)?.nombre || "" })}>Borrar</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {lista.length === 0 && <tr><td colSpan={tipo === "producto" ? 6 : 4} className="vacio">Todavía no hay categorías.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {borrando && (
        <div className="modal-fondo" onClick={() => setBorrando(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 className="seccion">Borrar «{borrando.cat.nombre}»</h2>
            {borrando.cat.usos === 0 ? (
              <p>La categoría está vacía, se puede borrar sin problema.</p>
            ) : (
              <>
                <p>Tiene {borrando.cat.usos} {borrando.cat.usos === 1 ? info.cosa[0] : info.cosa[1]}. ¿A qué categoría los pasamos?</p>
                <select value={borrando.destino} onChange={(e) => setBorrando({ ...borrando, destino: e.target.value })} aria-label="Pasar a">
                  {lista!.filter((x) => x.nombre !== borrando.cat.nombre).map((x) => <option key={x.nombre}>{x.nombre}</option>)}
                </select>
                {lista!.length < 2 && <p className="error-texto">Primero cree otra categoría para pasarlos.</p>}
              </>
            )}
            <div className="fila-botones">
              <button className="btn" onClick={() => setBorrando(null)} autoFocus>Cancelar</button>
              <button className="btn btn-peligro" onClick={borrar}
                      disabled={ocupado || (borrando.cat.usos > 0 && !borrando.destino)}>Borrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
