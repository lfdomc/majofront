import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { Campo, CategoriaSelect, Cargando, Confirmar, ErrorCaja, NumInput, UnidadSelect } from "../components";
import { colones, colonesUnit, costoPorBase, num, unidad } from "../format";
import { unidadesCompatibles, useApp } from "../store";
import type { Ingrediente, Presentacion, Proveedor } from "../types";

type Borrador = Omit<Ingrediente, "id" | "costo" | "usos" | "recetas">;

const hoy = () => new Date().toISOString().slice(0, 10);
const nuevaPres = (u: string): Presentacion => ({
  proveedor_id: null, descripcion: "", precio: 0, cantidad: 1, unidad: u === "g" ? "kg" : u === "ml" ? "l" : "unidad",
  merma_pct: 0, preferida: false, fecha: hoy(),
});

export default function IngredienteEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const { unidades, aviso } = useApp();
  const [d, setD] = useState<Borrador | null>(null);
  const [guardado, setGuardado] = useState("");
  const [recetas, setRecetas] = useState<{ id: number; nombre: string }[]>([]);
  const [provs, setProvs] = useState<Proveedor[]>([]);
  const [prev, setPrev] = useState<Ingrediente | null>(null);
  const [err, setErr] = useState("");
  const [borrar, setBorrar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cats, setCats] = useState<string[]>([]);

  useEffect(() => {
    api<Proveedor[]>("/api/proveedores").then(setProvs).catch(() => {});
    api<Ingrediente[]>("/api/ingredientes").then((l) => setCats([...new Set(l.map((i) => i.categoria))].sort())).catch(() => {});
    if (id) {
      api<Ingrediente>(`/api/ingredientes/${id}`).then((i) => {
        const b: Borrador = {
          nombre: i.nombre, categoria: i.categoria, unidad_base: i.unidad_base, peso_unidad_g: i.peso_unidad_g,
          densidad_g_ml: i.densidad_g_ml, base_costo: i.base_costo, notas: i.notas,
          presentaciones: i.presentaciones.map((p) => ({ id: p.id, proveedor_id: p.proveedor_id, descripcion: p.descripcion,
            precio: p.precio, cantidad: p.cantidad, unidad: p.unidad, merma_pct: p.merma_pct, preferida: p.preferida, fecha: p.fecha })),
        };
        setD(b); setGuardado(JSON.stringify(b)); setRecetas(i.recetas || []); setPrev(i);
      }).catch((e) => setErr(e.message));
    } else {
      const b: Borrador = { nombre: "", categoria: "General", unidad_base: "g", peso_unidad_g: null, densidad_g_ml: null,
        base_costo: "preferida", notas: "", presentaciones: [{ ...nuevaPres("g"), preferida: true }] };
      setD(b); setGuardado(JSON.stringify(b));
    }
  }, [id]);

  const t = useRef<number>();
  useEffect(() => {
    if (!d) return;
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => {
      api<Ingrediente>("/api/ingredientes/calcular", { body: { ...d, nombre: d.nombre || "x" } }).then(setPrev).catch(() => {});
    }, 200);
  }, [d]);

  if (err) return <ErrorCaja msg={err} />;
  if (!d) return <Cargando />;

  const set = (p: Partial<Borrador>) => setD({ ...d, ...p });
  const setPres = (n: number, p: Partial<Presentacion>) =>
    set({ presentaciones: d.presentaciones.map((x, i) => (i === n ? { ...x, ...p } : p.preferida ? { ...x, preferida: false } : x)) });
  const opcionesUnidad = unidadesCompatibles(unidades, d.unidad_base, d.peso_unidad_g, d.densidad_g_ml);
  const cambiado = JSON.stringify(d) !== guardado;
  const base = d.unidad_base;

  const guardar = async () => {
    if (!d.nombre.trim()) { aviso("Escriba el nombre del ingrediente.", "error"); return; }
    setGuardando(true);
    try {
      const res = id ? await api<{ id: number }>(`/api/ingredientes/${id}`, { method: "PUT", body: d })
                     : await api<{ id: number }>("/api/ingredientes", { body: d });
      setGuardado(JSON.stringify(d));
      aviso("Ingrediente guardado");
      if (!id) nav(`/admin/ingredientes/${res.id}`, { replace: true });
      else api<Ingrediente>(`/api/ingredientes/${id}`).then((i) => {
        // tomar los id nuevos de presentaciones
        const b = { ...d, presentaciones: i.presentaciones.map((p, k) => ({ ...d.presentaciones[k], id: p.id })) };
        setD(b); setGuardado(JSON.stringify(b));
      });
    } catch (e: any) { aviso(e.message, "error"); } finally { setGuardando(false); }
  };

  const eliminar = async () => {
    setBorrar(false);
    try { await api(`/api/ingredientes/${id}`, { method: "DELETE" }); aviso("Ingrediente borrado"); nav("/admin/ingredientes"); }
    catch (e: any) { aviso(e.message, "error"); }
  };

  const c = prev?.costo;

  return (
    <>
      <header className="encabezado">
        <div>
          <Link className="volver" to="/admin/ingredientes">Ingredientes</Link>
          <input className="titulo-editable" value={d.nombre} placeholder="Nombre del ingrediente" onChange={(e) => set({ nombre: e.target.value })} aria-label="Nombre" />
        </div>
        <div className="fila-botones">
          {id && <button className="btn btn-peligro-suave" onClick={() => setBorrar(true)}>Borrar</button>}
          <button className="btn btn-primario" onClick={guardar} disabled={guardando || (!cambiado && !!id)}>
            {guardando ? "Guardando…" : cambiado || !id ? "Guardar" : "Guardado"}
          </button>
        </div>
      </header>

      <div className="editor">
        <section className="editor-principal">
          <div className="rejilla-campos">
            <Campo label="Categoría">
              <CategoriaSelect value={d.categoria} onChange={(v) => set({ categoria: v })} opciones={cats} tipo="ingrediente" />
            </Campo>
            <Campo label="Unidad más pequeña" ayuda="En qué se mide al usarlo en recetas">
              <select value={d.unidad_base} onChange={(e) => set({ unidad_base: e.target.value as any })}>
                <option value="g">Gramos (g)</option>
                <option value="ml">Mililitros (ml)</option>
                <option value="unidad">Unidades</option>
              </select>
            </Campo>
            <Campo label="Peso limpio de 1 unidad" ayuda="Opcional. Ej.: 1 banano = 100 g sin cáscara">
              <div className="con-sufijo"><NumInput value={d.peso_unidad_g} allowEmpty onChange={(v) => set({ peso_unidad_g: v || null })} ariaLabel="Peso por unidad" /><span>g</span></div>
            </Campo>
            <Campo label="Densidad" ayuda="Opcional. Gramos que pesa 1 ml (agua = 1)">
              <div className="con-sufijo"><NumInput value={d.densidad_g_ml} allowEmpty onChange={(v) => set({ densidad_g_ml: v || null })} ariaLabel="Densidad" /><span>g/ml</span></div>
            </Campo>
          </div>

          <h2 className="seccion">Presentaciones de compra</h2>
          <p className="ayuda">Anote cada forma en que lo compra: precio, contenido y cuánto se pierde al limpiarlo (cáscara, semillas, almíbar). Puede escribir la merma en % o el peso limpio que queda.</p>
          <div className="presentaciones">
            {d.presentaciones.map((p, n) => {
              const f = prev?.presentaciones[n];
              const limpio = p.cantidad * (1 - (p.merma_pct || 0) / 100);
              return (
                <div className={"pres" + (p.preferida ? " pres-preferida" : "")} key={n}>
                  <div className="pres-fila">
                    <Campo label="Descripción"><input value={p.descripcion} placeholder="Ej.: Bolsa 1 kg" onChange={(e) => setPres(n, { descripcion: e.target.value })} /></Campo>
                    <Campo label="Proveedor">
                      <select value={p.proveedor_id ?? ""} onChange={(e) => setPres(n, { proveedor_id: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">Sin proveedor</option>
                        {provs.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                      </select>
                    </Campo>
                    <Campo label="Fecha del precio"><input type="date" value={p.fecha || ""} onChange={(e) => setPres(n, { fecha: e.target.value || null })} /></Campo>
                  </div>
                  <div className="pres-fila pres-numeros">
                    <Campo label="Precio">
                      <div className="con-prefijo"><span>₡</span><NumInput value={p.precio} onChange={(v) => setPres(n, { precio: v || 0 })} ariaLabel="Precio" /></div>
                    </Campo>
                    <Campo label="Contenido">
                      <div className="par">
                        <NumInput value={p.cantidad} onChange={(v) => setPres(n, { cantidad: v || 0 })} ariaLabel="Contenido" />
                        <UnidadSelect value={p.unidad} onChange={(v) => setPres(n, { unidad: v })} opciones={opcionesUnidad} ariaLabel="Unidad del contenido" />
                      </div>
                    </Campo>
                    <Campo label="Merma">
                      <div className="con-sufijo"><NumInput value={p.merma_pct} onChange={(v) => setPres(n, { merma_pct: Math.min(v || 0, 99.9) })} ariaLabel="Merma" /><span>%</span></div>
                    </Campo>
                    <Campo label="Queda limpio">
                      <div className="con-sufijo"><NumInput value={Math.round(limpio * 1000) / 1000} ariaLabel="Cantidad limpia"
                        onChange={(v) => { if (v !== null && p.cantidad > 0 && v <= p.cantidad) setPres(n, { merma_pct: Math.round((1 - v / p.cantidad) * 10000) / 100 }); }} />
                        <span>{unidad(p.unidad)}</span></div>
                    </Campo>
                  </div>
                  <div className="pres-pie">
                    <span className={f?.error ? "negativo" : "pres-costo"}>
                      {f?.error ? f.error : f?.costo_unitario != null ? <>Sale a <b>{costoPorBase(f.costo_unitario, base)}</b> aprovechable</> : ""}
                    </span>
                    <label className="check"><input type="radio" name="preferida" checked={p.preferida} onChange={() => setPres(n, { preferida: true })} /> La que uso</label>
                    <button className="link peligro" onClick={() => set({ presentaciones: d.presentaciones.filter((_, i) => i !== n) })}>Quitar</button>
                  </div>
                </div>
              );
            })}
            <button className="btn btn-agregar" onClick={() => set({ presentaciones: [...d.presentaciones, nuevaPres(base)] })}>Agregar presentación</button>
          </div>

          <Campo label="Notas"><textarea rows={3} value={d.notas} onChange={(e) => set({ notas: e.target.value })} /></Campo>
          {recetas.length > 0 && (
            <p className="ayuda">Se usa en: {recetas.map((x, i) => <span key={x.id}>{i > 0 && ", "}<Link to={`/admin/recetas/${x.id}`}>{x.nombre}</Link></span>)}</p>
          )}
        </section>

        <aside className="panel-precio">
          <div className="cifra">
            <span className="cifra-label">Costo que usan las recetas</span>
            <span className="cifra-valor">{c?.seleccionado != null ? colonesUnit(c.seleccionado) : "—"}<small>/{unidad(base)}</small></span>
            {c?.seleccionado != null && base !== "unidad" && <span className="cifra-nota">{colones(c.seleccionado * 1000)} por {base === "g" ? "kilo" : "litro"} limpio</span>}
            {c?.seleccionado != null && d.peso_unidad_g && base === "unidad" && <span className="cifra-nota">{colonesUnit(c.seleccionado / d.peso_unidad_g)} por gramo limpio</span>}
            {c?.error && <span className="cifra-nota negativo">{c.error}</span>}
          </div>
          <Campo label="Cuál precio usar" ayuda="Si hay varias presentaciones">
            <select value={d.base_costo} onChange={(e) => set({ base_costo: e.target.value as any })}>
              <option value="preferida">La que uso (marcada)</option>
              <option value="menor">La más barata</option>
              <option value="promedio">El promedio</option>
              <option value="mayor">La más cara</option>
            </select>
          </Campo>
          {prev && prev.presentaciones.length > 1 && c?.menor != null && (
            <dl className="resultado">
              <div><dt>Más barata</dt><dd>{colonesUnit(c.menor)}/{unidad(base)}</dd></div>
              <div><dt>Promedio</dt><dd>{colonesUnit(c.promedio)}/{unidad(base)}</dd></div>
              <div><dt>Más cara</dt><dd>{colonesUnit(c.mayor)}/{unidad(base)}</dd></div>
            </dl>
          )}
          {prev && (
            <div className="equivalencias">
              <span className="campo-label">Para calcular rápido</span>
              {base === "g" && c?.seleccionado != null && [10, 28.35, 60, 100, 150].map((g) => (
                <div key={g}><span>{g === 28.35 ? "1 oz (28 g)" : `${num(g, 0)} g`}</span><b>{colones(g * c.seleccionado!)}</b></div>
              ))}
              {base === "ml" && c?.seleccionado != null && [15, 29.57, 60, 240].map((m) => (
                <div key={m}><span>{m === 15 ? "1 cda (15 ml)" : m === 29.57 ? "1 oz líq." : m === 240 ? "1 taza" : `${m} ml`}</span><b>{colones(m * c.seleccionado!)}</b></div>
              ))}
              {base === "unidad" && c?.seleccionado != null && [1, 0.5, 12].map((u) => (
                <div key={u}><span>{u === 0.5 ? "½ unidad" : u === 12 ? "1 docena" : "1 unidad"}</span><b>{colones(u * c.seleccionado!)}</b></div>
              ))}
            </div>
          )}
        </aside>
      </div>
      {borrar && <Confirmar texto={`¿Borrar «${d.nombre}»?`} onSi={eliminar} onNo={() => setBorrar(false)} />}
    </>
  );
}
