import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, mediaUrl, subirArchivo } from "../api";
import { Buscador, Campo, CategoriaSelect, Cargando, Confirmar, ErrorCaja, NumInput, SubirImagen, UnidadSelect, type Opcion } from "../components";
import { colones, colonesUnit, num, pct, unidad } from "../format";
import { unidadesCompatibles, useApp } from "../store";
import type { Calculo, Ingrediente, Item, Receta, ResumenReceta } from "../types";

const VACIA = (tipo: "producto" | "subreceta"): Receta => ({
  nombre: "", tipo, categoria: tipo === "producto" ? "Postres" : "Preparaciones",
  rinde_cantidad: 1, rinde_unidad: tipo === "producto" ? "porcion" : "g", merma_pct: 0,
  margen_objetivo_pct: null, precio_venta: null, precio_competencia: null, notas: "",
  descripcion_menu: "", en_menu: tipo === "producto",
  items: [{ ingrediente_id: null, subreceta_id: null, cantidad: 0, unidad: "g", merma_pct: 0 }],
});

const TONOS = ["#2E6A4C", "#4F8A69", "#77A88A", "#9FC4AC", "#3E7C78", "#6AA39E", "#A4C9C4", "#5C7F4A", "#8BAE76"];

type Produccion = { cantidad: number; unidad: string; costo_total: number; items: {
  ingrediente_id: number; nombre: string; cantidad_base: number; unidad_base: string; costo: number | null;
  presentacion: string | null; proveedor: string | null; comprar: number | null; costo_compra: number | null }[] };

export default function RecetaEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { unidades, config, aviso } = useApp();
  const [r, setR] = useState<Receta | null>(null);
  const [guardada, setGuardada] = useState("");
  const [usadaEn, setUsadaEn] = useState<{ id: number; nombre: string }[]>([]);
  const [ings, setIngs] = useState<Ingrediente[]>([]);
  const [recs, setRecs] = useState<ResumenReceta[]>([]);
  const [calc, setCalc] = useState<Calculo | null>(null);
  const [errCalc, setErrCalc] = useState("");
  const [err, setErr] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const [listas, setListas] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const [arte, setArte] = useState<{ arte: string | null; estilo: string; quitar_fondo: boolean; recortada?: boolean }>({ arte: null, estilo: "auto", quitar_fondo: true });
  const [generando, setGenerando] = useState(false);
  const [logoNegocio, setLogoNegocio] = useState<string | null>("?");
  const [estilos, setEstilos] = useState<{ clave: string; nombre: string }[]>([{ clave: "auto", nombre: "Automático" }]);
  useEffect(() => { api<{ clave: string; nombre: string }[]>("/api/arte/estilos").then(setEstilos).catch(() => {}); }, []);
  useEffect(() => { api<{ logo: string | null; distintivo?: string }>("/api/negocio").then((n) => setLogoNegocio(n.logo || (n.distintivo && n.distintivo !== "logo" ? "otro" : null))).catch(() => {}); }, []);
  const rehacer = async (cuerpo: Record<string, unknown>) => {
    if (!id) return;
    setGenerando(true);
    try {
      const d = await api<{ arte: string | null; estilo_arte: string; quitar_fondo: boolean; recortada: boolean }>(`/api/recetas/${id}/arte`, { body: cuerpo });
      setArte({ arte: d.arte, estilo: d.estilo_arte, quitar_fondo: d.quitar_fondo, recortada: d.recortada });
    } catch (e: any) { aviso(e.message, "error"); } finally { setGenerando(false); }
  };

  useEffect(() => {
    setErr("");
    setR(null);
    Promise.all([api<Ingrediente[]>("/api/ingredientes"), api<ResumenReceta[]>("/api/recetas")]).then(([i, rs]) => {
      setIngs(i); setRecs(rs); setListas(true);
    }).catch((e) => setErr(e.message));
    if (id) {
      api<Receta & { usada_en: { id: number; nombre: string }[]; calculo: Calculo }>(`/api/recetas/${id}`).then((d) => {
        const { usada_en, calculo, ...rest } = d as any;
        const { foto: f, arte: a, estilo_arte: est, quitar_fondo: qf, ...sinFoto } = rest;
        setFoto(f || null);
        setArte({ arte: a || null, estilo: est || "auto", quitar_fondo: qf !== false });
        const limpia: Receta = { ...sinFoto, items: rest.items.map(({ id: _x, ...it }: any) => it) };
        setR(limpia); setGuardada(JSON.stringify(limpia)); setUsadaEn(usada_en); setCalc(calculo);
      }).catch((e) => setErr(e.message));
    } else {
      const v = VACIA((params.get("tipo") as any) || "producto");
      setR(v); setGuardada(JSON.stringify(v)); setUsadaEn([]); setCalc(null); setFoto(null); setArte({ arte: null, estilo: "auto", quitar_fondo: true });
    }
  }, [id]);

  // Cálculo en vivo
  const t = useRef<number>();
  useEffect(() => {
    if (!r) return;
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => {
      api<Calculo>("/api/recetas/calcular", { body: { ...r, nombre: r.nombre || "Borrador", id: id ? Number(id) : null } })
        .then((c) => { setCalc(c); setErrCalc(""); })
        .catch((e) => setErrCalc(e.message));
    }, 250);
  }, [r, id]);

  const ingPorId = useMemo(() => new Map(ings.map((i) => [i.id, i])), [ings]);
  const recPorId = useMemo(() => new Map(recs.map((x) => [x.id, x])), [recs]);
  const opciones: Opcion[] = useMemo(() => [
    ...recs.filter((x) => x.tipo === "subreceta" && String(x.id) !== id)
      .map((x) => ({ key: `r:${x.id}`, label: x.nombre, hint: "sub-receta" })),
    ...ings.map((i) => ({ key: `i:${i.id}`, label: i.nombre, hint: i.costo.error ? "sin precio" : i.categoria })),
  ].sort((a, b) => a.label.localeCompare(b.label, "es")), [ings, recs, id]);

  if (err) return <ErrorCaja msg={err} />;
  if (!r || !config || !listas) return <Cargando />;

  const cambiado = JSON.stringify(r) !== guardada;
  const set = (p: Partial<Receta>) => setR({ ...r, ...p });
  const setItem = (n: number, p: Partial<Item>) => set({ items: r.items.map((it, i) => (i === n ? { ...it, ...p } : it)) });
  const esProducto = r.tipo === "producto";
  const dimRinde = unidades.find((u) => u.clave === r.rinde_unidad)?.dimension;

  const elegir = (n: number, key: string) => {
    const [k, v] = key.split(":");
    const vid = Number(v);
    if (k === "i") {
      const ing = ingPorId.get(vid)!;
      setItem(n, { ingrediente_id: vid, subreceta_id: null, unidad: ing.unidad_base });
    } else {
      const sub = recPorId.get(vid)!;
      const dim = unidades.find((u) => u.clave === sub.rinde_unidad)?.dimension;
      setItem(n, { subreceta_id: vid, ingrediente_id: null, unidad: dim === "masa" ? "g" : dim === "volumen" ? "ml" : "porcion" });
    }
  };

  const unidadesItem = (it: Item) => {
    if (it.ingrediente_id) {
      const ing = ingPorId.get(it.ingrediente_id);
      return ing ? unidadesCompatibles(unidades, ing.unidad_base, ing.peso_unidad_g, ing.densidad_g_ml) : unidades;
    }
    if (it.subreceta_id) {
      const sub = recPorId.get(it.subreceta_id);
      const dim = unidades.find((u) => u.clave === sub?.rinde_unidad)?.dimension;
      return unidades.filter((u) => u.dimension === dim);
    }
    return unidades;
  };

  const guardar = async () => {
    if (!r.nombre.trim()) { aviso("Escriba un nombre para la receta.", "error"); return; }
    setGuardando(true);
    try {
      const cuerpo = { ...r, items: r.items.filter((it) => it.ingrediente_id || it.subreceta_id) };
      const res = id ? await api<{ id: number }>(`/api/recetas/${id}`, { method: "PUT", body: cuerpo })
                     : await api<{ id: number }>("/api/recetas", { body: cuerpo });
      setR(cuerpo); setGuardada(JSON.stringify(cuerpo));
      aviso("Receta guardada");
      if (id && foto) api<{ arte: string | null }>(`/api/recetas/${id}`).then((x) => setArte((a) => ({ ...a, arte: x.arte }))).catch(() => {});
      if (!id) nav(`/admin/recetas/${res.id}`, { replace: true });
    } catch (e: any) { aviso(e.message, "error"); } finally { setGuardando(false); }
  };

  const duplicar = async () => {
    try {
      const res = await api<{ id: number }>(`/api/recetas/${id}/duplicar`, { body: {} });
      aviso("Copia creada"); nav(`/admin/recetas/${res.id}`);
    } catch (e: any) { aviso(e.message, "error"); }
  };

  const eliminar = async () => {
    setBorrar(false);
    try { await api(`/api/recetas/${id}`, { method: "DELETE" }); aviso("Receta borrada"); nav(`/admin/recetas?tipo=${r.tipo}`); }
    catch (e: any) { aviso(e.message, "error"); }
  };

  const p = calc?.precios;
  const costoRinde = calc?.costo_por_rinde ?? null;

  return (
    <>
      <header className="encabezado">
        <div>
          <Link className="volver" to={`/admin/recetas?tipo=${r.tipo}`}>{esProducto ? "Productos" : "Sub-recetas"}</Link>
          <input className="titulo-editable" value={r.nombre} placeholder={esProducto ? "Nombre del producto" : "Nombre de la sub-receta"}
                 onChange={(e) => set({ nombre: e.target.value })} aria-label="Nombre" />
        </div>
        <div className="fila-botones">
          {id && <button className="btn" onClick={duplicar}>Duplicar</button>}
          {id && <button className="btn btn-peligro-suave" onClick={() => setBorrar(true)}>Borrar</button>}
          <button className="btn btn-primario" onClick={guardar} disabled={guardando || (!cambiado && !!id)}>
            {guardando ? "Guardando…" : cambiado || !id ? "Guardar" : "Guardado"}
          </button>
        </div>
      </header>

      <div className="editor">
        <section className="editor-principal">
          <div className="rejilla-campos">
            <Campo label="Tipo">
              <select value={r.tipo} onChange={(e) => set({ tipo: e.target.value as any })}>
                <option value="producto">Producto para vender</option>
                <option value="subreceta">Sub-receta (se usa en otras)</option>
              </select>
            </Campo>
            <Campo label="Categoría">
              <CategoriaSelect value={r.categoria} onChange={(v) => set({ categoria: v })} tipo={r.tipo}
                               opciones={recs.filter((x) => x.tipo === r.tipo).map((x) => x.categoria)} />
            </Campo>
            <Campo label="Rinde" ayuda={esProducto ? "Cuántos productos salen de esta receta" : "Cuánto produce la preparación"}>
              <div className="par">
                <NumInput value={r.rinde_cantidad} onChange={(v) => set({ rinde_cantidad: v || 0 })} ariaLabel="Cantidad que rinde" />
                <UnidadSelect value={r.rinde_unidad} onChange={(v) => set({ rinde_unidad: v })} opciones={unidades} ariaLabel="Unidad de rendimiento" />
              </div>
            </Campo>
            <Campo label="Merma de producción" ayuda="Lo que se pierde al preparar o servir">
              <div className="con-sufijo"><NumInput value={r.merma_pct} onChange={(v) => set({ merma_pct: v || 0 })} ariaLabel="Merma general" /><span>%</span></div>
            </Campo>
          </div>

          <h2 className="seccion">Ingredientes</h2>
          <div className="items">
            <div className="items-cabeza" aria-hidden="true">
              <span>Ingrediente o sub-receta</span><span>Cantidad</span><span>Unidad</span><span>Merma</span>
              <span className="n">Costo unitario</span><span className="n">Costo</span><span />
            </div>
            {r.items.map((it, n) => {
              const f = calc?.items[n];
              const key = it.ingrediente_id ? `i:${it.ingrediente_id}` : it.subreceta_id ? `r:${it.subreceta_id}` : null;
              return (
                <div className={"item" + (f?.error && key ? " con-error" : "")} key={n}>
                  <Buscador opciones={opciones} valor={key} onElegir={(k) => elegir(n, k)} placeholder="Buscar ingrediente…" ariaLabel={`Ingrediente ${n + 1}`} />
                  <NumInput value={it.cantidad} onChange={(v) => setItem(n, { cantidad: v || 0 })} ariaLabel="Cantidad" />
                  <UnidadSelect value={it.unidad} onChange={(v) => setItem(n, { unidad: v })} opciones={unidadesItem(it)} ariaLabel="Unidad" />
                  <div className="con-sufijo"><NumInput value={it.merma_pct} onChange={(v) => setItem(n, { merma_pct: v || 0 })} ariaLabel="Merma del ingrediente" /><span>%</span></div>
                  <span className="n tenue" data-label="Costo unitario">
                    {f?.costo_unitario != null ? `${colonesUnit(f.costo_unitario)}/${unidad(f.unidad_base)}` : ""}
                  </span>
                  <span className="n fuerte" data-label="Costo">
                    {f?.costo != null ? colones(f.costo) : ""}
                    {f?.costo != null && <i className="mini-barra" style={{ width: `${Math.max(2, (f.participacion || 0) * 100)}%` }} />}
                  </span>
                  <button className="quitar" onClick={() => set({ items: r.items.filter((_, i) => i !== n) })} aria-label={`Quitar fila ${n + 1}`}>×</button>
                  {f?.error && key && <div className="item-error">{f.error}{f.error.includes("Falta") && it.ingrediente_id && <> — <Link to={`/admin/ingredientes/${it.ingrediente_id}`}>completar ingrediente</Link></>}</div>}
                </div>
              );
            })}
            <button className="btn btn-agregar" onClick={() => set({ items: [...r.items, { ingrediente_id: null, subreceta_id: null, cantidad: 0, unidad: "g", merma_pct: 0 }] })}>
              Agregar ingrediente
            </button>
          </div>
          <p className="ayuda">¿Falta algo? <Link to="/admin/ingredientes/nuevo">Cree un ingrediente</Link> o una <Link to="/admin/recetas/nueva?tipo=subreceta">sub-receta</Link> y vuelva aquí.</p>

          {esProducto && (
            <>
              <h2 className="seccion">Menú para clientes</h2>
              <div className="menu-producto">
                <SubirImagen url={mediaUrl(foto)} deshabilitado={!id} ayuda={id ? "Foto horizontal, se recorta a 4:3" : "Guarde el producto para subir la foto"}
                  onSubir={async (f) => {
                    try {
                      const d = await subirArchivo<{ foto: string; arte: string | null; recortada: boolean }>(`/api/recetas/${id}/foto`, f);
                      setFoto(d.foto); setArte({ ...arte, arte: d.arte, recortada: d.recortada });
                      aviso(d.recortada ? "Foto guardada y fondo quitado" : "Foto guardada");
                    }
                    catch (e: any) { aviso(e.message, "error"); }
                  }}
                  onQuitar={async () => {
                    try { await api(`/api/recetas/${id}/foto`, { method: "DELETE" }); setFoto(null); setArte({ ...arte, arte: null }); } catch (e: any) { aviso(e.message, "error"); }
                  }} />
                <div>
                  <label className="check" style={{ marginTop: 0 }}><input type="checkbox" checked={r.en_menu} onChange={(e) => set({ en_menu: e.target.checked })} /> Mostrar en el menú</label>
                  <Campo label="Descripción para clientes" ayuda="Qué lleva, en una o dos líneas. Los clientes no ven costos.">
                    <textarea rows={3} maxLength={600} value={r.descripcion_menu} onChange={(e) => set({ descripcion_menu: e.target.value })} />
                  </Campo>
                  {r.en_menu && !r.precio_venta && <p className="ayuda">Sin precio de venta, el producto aparece en el menú sin precio.</p>}
                </div>
              </div>
              {foto && (
                <div className="arte-panel">
                  <div className="arte-vista">
                    {arte.arte ? <img src={mediaUrl(arte.arte)!} alt={`Imagen de ${r.nombre}`} /> : <span>Generando…</span>}
                    {generando && <div className="arte-cargando">Generando…</div>}
                  </div>
                  <div className="arte-controles">
                    <span className="campo-label">Imagen para el menú y redes</span>
                    <p className="ayuda">El sistema la arma sola con la foto, el nombre, el precio y su logo. Se actualiza al cambiar cualquiera de ellos.</p>
                    <div className="estilos" role="radiogroup" aria-label="Estilo de la imagen">
                      {estilos.map(({ clave: k, nombre: label }) => (
                        <button key={k} type="button" role="radio" aria-checked={arte.estilo === k} className={"estilo" + (arte.estilo === k ? " activo" : "")}
                          disabled={generando} onClick={() => rehacer({ estilo: k })}>{label}</button>
                      ))}
                    </div>
                    <label className="check"><input type="checkbox" checked={arte.quitar_fondo} disabled={generando}
                      onChange={(e) => rehacer({ quitar_fondo: e.target.checked })} /> Quitar el fondo de la foto</label>
                    {arte.quitar_fondo && arte.recortada === false && <p className="ayuda">No se encontró un objeto claro para recortar; la foto se muestra como postal. Una foto con el producto centrado y fondo liso funciona mejor.</p>}
                    <div className="fila-botones izquierda">
                      {arte.arte && <a className="btn" href={mediaUrl(arte.arte)!} download={`${r.nombre}.jpg`} target="_blank" rel="noopener">Descargar para redes</a>}
                      <button type="button" className="btn" disabled={generando} onClick={() => rehacer({ recortar_de_nuevo: true })}>Volver a generar</button>
                    </div>
                    {!logoNegocio && <p className="ayuda">Agregue el logo de la empresa en <Link to="/admin/ajustes">Ajustes</Link> para que salga en la imagen.</p>}
                  </div>
                </div>
              )}
            </>
          )}

          <Campo label="Notas internas" ayuda="Solo las ve su equipo">
            <textarea rows={3} value={r.notas} onChange={(e) => set({ notas: e.target.value })} />
          </Campo>

          {usadaEn.length > 0 && (
            <p className="ayuda">Se usa en: {usadaEn.map((x, i) => <span key={x.id}>{i > 0 && ", "}<Link to={`/admin/recetas/${x.id}`}>{x.nombre}</Link></span>)}</p>
          )}
        </section>

        <aside className="panel-precio" aria-live="polite">
          {errCalc && <ErrorCaja msg={errCalc} />}
          <div className="cifra">
            <span className="cifra-label">{esProducto ? "Costo por producto" : `Costo por ${unidad(r.rinde_unidad) || "unidad"}`}</span>
            <span className="cifra-valor">{costoRinde !== null && costoRinde < 50 ? colonesUnit(costoRinde) : colones(costoRinde)}</span>
            <span className="cifra-nota">
              Total {colones(calc?.totales.seleccionado)} por {num(r.rinde_cantidad, 2)} {unidad(r.rinde_unidad, r.rinde_cantidad)}
              {calc && calc.merma_general > 0.5 && <> · incluye {colones(calc.merma_general)} de merma</>}
            </span>
            {calc && Math.abs(calc.totales.mayor - calc.totales.menor) > 1 && (
              <span className="cifra-nota">Entre {colones(calc.totales.menor / r.rinde_cantidad)} y {colones(calc.totales.mayor / r.rinde_cantidad)} según el proveedor</span>
            )}
            {!esProducto && calc?.costo_por_unidad_minima != null && dimRinde !== "unidad" && (
              <span className="cifra-nota">{colonesUnit(calc.costo_por_unidad_minima)} por {calc.unidad_minima}</span>
            )}
          </div>

          {calc && calc.errores.length > 0 && (
            <div className="alerta alerta-compacta">{calc.errores.length === 1 ? "Un ingrediente" : `${calc.errores.length} ingredientes`} sin calcular: revise las filas marcadas.</div>
          )}

          {esProducto && (
            <>
              <BarraPrecio calc={calc} rinde={r.rinde_cantidad} />
              <div className="precio-campos">
                <Campo label="Margen objetivo" ayuda={`Si lo deja vacío se usa ${pct(config.margen_objetivo_pct)}`}>
                  <div className="con-sufijo"><NumInput value={r.margen_objetivo_pct} allowEmpty placeholder={String(config.margen_objetivo_pct)}
                    onChange={(v) => set({ margen_objetivo_pct: v })} ariaLabel="Margen objetivo" /><span>%</span></div>
                </Campo>
                <div className="dato">
                  <span>Precio sugerido{p && p.iva_pct ? " (con IVA)" : ""}</span>
                  <b>{colones(p?.precio_sugerido)}</b>
                  {p?.precio_sugerido != null && (
                    <button className="link" onClick={() => set({ precio_venta: p.precio_sugerido })}>Usar como precio de venta</button>
                  )}
                </div>
                <Campo label={`Precio de venta${config.aplicar_iva ? " (IVA incluido)" : ""}`}>
                  <div className="con-prefijo"><span>₡</span><NumInput value={r.precio_venta} allowEmpty onChange={(v) => set({ precio_venta: v })} ariaLabel="Precio de venta" /></div>
                </Campo>
                {p?.precio_venta ? (
                  <dl className="resultado">
                    <div><dt>Ganancia por producto</dt><dd className={p.ganancia! < 0 ? "negativo" : ""}>{colones(p.ganancia)}</dd></div>
                    <div><dt>Margen real</dt><dd>{pct(p.margen_real_pct)}</dd></div>
                    <div><dt>Costo sobre la venta</dt><dd>{pct(p.costo_sobre_venta_pct)}</dd></div>
                  </dl>
                ) : null}
                <Campo label="Precio de la competencia">
                  <div className="con-prefijo"><span>₡</span><NumInput value={r.precio_competencia} allowEmpty onChange={(v) => set({ precio_competencia: v })} ariaLabel="Precio de la competencia" /></div>
                </Campo>
                {p?.diferencia_competencia != null && (
                  <p className="ayuda">
                    {p.diferencia_competencia > 0 ? `${colones(p.diferencia_competencia)} más caro` : p.diferencia_competencia < 0 ? `${colones(-p.diferencia_competencia)} más barato` : "Mismo precio"} que la competencia
                    {r.precio_venta ? "" : " (con el precio sugerido)"}.
                  </p>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
      {id && <ProduccionPanel id={id} unidadRinde={r.rinde_unidad} cambiado={cambiado} />}
      {borrar && <Confirmar texto={`¿Borrar «${r.nombre}»? Esto no se puede deshacer.`} onSi={eliminar} onNo={() => setBorrar(false)} />}
    </>
  );
}

/** Cómo se reparte el precio: cada ingrediente, la merma, la ganancia y el IVA. */
function BarraPrecio({ calc, rinde }: { calc: Calculo | null; rinde: number }) {
  if (!calc || !calc.costo_por_rinde) return null;
  const p = calc.precios;
  const precio = p.precio_venta || p.precio_sugerido;
  if (!precio) return null;
  const sinIva = p.precio_venta ? p.precio_venta_sin_iva! : p.precio_sugerido! / (1 + p.iva_pct / 100);
  const iva = precio - sinIva;
  const costo = calc.costo_por_rinde;
  const ganancia = sinIva - costo;
  const escala = Math.max(precio, costo + iva);
  const segs = calc.items.filter((f) => f.costo).sort((a, b) => (b.costo || 0) - (a.costo || 0))
    .map((f, i) => ({ nombre: f.nombre || "", v: (f.costo || 0) / rinde, color: TONOS[i % TONOS.length] }));
  if (calc.merma_general > 0) segs.push({ nombre: "Merma de producción", v: calc.merma_general / rinde, color: "#C9B26B" });
  return (
    <figure className="barra-precio">
      <figcaption>
        De cada <b>{colones(precio)}</b>{p.precio_venta ? "" : " sugeridos"}: <b>{colones(costo)}</b> son ingredientes y{" "}
        <b className={ganancia < 0 ? "negativo" : "ganancia"}>{colones(ganancia)}</b> {ganancia < 0 ? "de pérdida" : "quedan de ganancia"}
        {iva > 0.5 && <> ({colones(iva)} de IVA)</>}.
      </figcaption>
      <div className="barra" role="img" aria-label={`Costo ${colones(costo)}, ganancia ${colones(ganancia)}`}>
        {segs.map((s, i) => <span key={i} style={{ width: `${(s.v / escala) * 100}%`, background: s.color }} title={`${s.nombre}: ${colones(s.v)}`} />)}
        {ganancia > 0 && <span className="seg-ganancia" style={{ width: `${(ganancia / escala) * 100}%` }} title={`Ganancia: ${colones(ganancia)}`} />}
        {iva > 0.5 && <span className="seg-iva" style={{ width: `${(iva / escala) * 100}%` }} title={`IVA: ${colones(iva)}`} />}
      </div>
      <ul className="leyenda">
        {segs.slice(0, 5).map((s, i) => <li key={i}><i style={{ background: s.color }} />{s.nombre} <span>{colones(s.v)}</span></li>)}
        {segs.length > 5 && <li className="tenue">y {segs.length - 5} más</li>}
      </ul>
    </figure>
  );
}

function ProduccionPanel({ id, unidadRinde, cambiado }: { id: string; unidadRinde: string; cambiado: boolean }) {
  const [cant, setCant] = useState<number | null>(unidadRinde === "porcion" ? 20 : 1000);
  const [res, setRes] = useState<Produccion | null>(null);
  const [err, setErr] = useState("");
  const calcular = async () => {
    setErr("");
    try { setRes(await api<Produccion>(`/api/recetas/${id}/produccion?cantidad=${cant}`)); }
    catch (e: any) { setErr(e.message); }
  };
  return (
    <section className="produccion">
      <h2 className="seccion">Lista de compras</h2>
      <p className="ayuda">Calcula cuánto comprar de cada ingrediente para producir una cantidad, incluyendo sub-recetas y mermas.{cambiado && " Guarde primero para usar los cambios recientes."}</p>
      <div className="fila-botones izquierda">
        <div className="con-sufijo ancho-corto"><NumInput value={cant} onChange={setCant} ariaLabel="Cantidad a producir" /><span>{unidad(unidadRinde, cant)}</span></div>
        <button className="btn" onClick={calcular} disabled={!cant}>Calcular compras</button>
      </div>
      {err && <ErrorCaja msg={err} />}
      {res && (
        <div className="tabla-envoltura">
          <table className="tabla compacta">
            <thead><tr><th>Ingrediente</th><th className="n">Se necesita</th><th>Comprar</th><th className="n">Costo de lo usado</th></tr></thead>
            <tbody>
              {res.items.map((x) => (
                <tr key={x.ingrediente_id}>
                  <td><Link to={`/admin/ingredientes/${x.ingrediente_id}`}>{x.nombre}</Link></td>
                  <td className="n">{x.cantidad_base >= 1000 && x.unidad_base !== "unidad" ? `${num(x.cantidad_base / 1000, 2)} ${x.unidad_base === "g" ? "kg" : "L"}` : `${num(x.cantidad_base, 1)} ${unidad(x.unidad_base)}`}</td>
                  <td>{x.comprar ? `${x.comprar} × ${x.presentacion}` : <span className="tenue">sin presentación</span>}{x.proveedor && x.proveedor !== "Por definir" && <span className="tenue"> · {x.proveedor}</span>}</td>
                  <td className="n">{colones(x.costo)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={3}>Total para {num(res.cantidad, 2)} {unidad(res.unidad, res.cantidad)}</td><td className="n fuerte">{colones(res.costo_total)}</td></tr></tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
