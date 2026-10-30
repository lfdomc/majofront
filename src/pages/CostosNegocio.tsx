import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Cargando, ErrorCaja, NumInput } from "../components";
import { colones, num, pct } from "../format";
import { useApp } from "../store";

type Costo = {
  id: number; tipo: "fijo" | "variable"; nombre: string; monto: number; frecuencia: string; modo: "porcentaje" | "por_unidad";
  aplica_pct: number; activo: boolean; notas: string; mensual?: number;
};
type FilaProd = {
  id: number; nombre: string; categoria: string; ventas_mes: number | null; precio_venta: number | null; costo: number | null;
  costo_variable: number | null; costo_fijo: number | null; contribucion: number | null; ganancia_real: number | null;
  margen_neto_pct: number | null; precio_equilibrio: number | null; aporte_mes?: number; errores: boolean;
};
type Resumen = {
  fijos_mes: number; variable_pct: number; variable_unidad: number; ventas_mes: number; unidades_mes: number;
  fuente_ventas: "productos" | "general"; fijo_pct: number | null; contribucion_pct: number | null;
  ingredientes_mes: number | null; variables_mes: number | null; ganancia_mes: number | null;
  equilibrio_mes: number | null; equilibrio_dia: number | null; dias_trabajo_mes: number; ventas_estimadas_mes: number;
  iva_incluido: boolean; productos: FilaProd[];
};

const FRECUENCIAS: [string, string][] = [["diaria", "Por día trabajado"], ["semanal", "Semanal"], ["quincenal", "Quincenal"],
  ["mensual", "Mensual"], ["trimestral", "Trimestral"], ["semestral", "Semestral"], ["anual", "Anual"]];

export default function CostosNegocio() {
  const { aviso } = useApp();
  const [costos, setCostos] = useState<Costo[] | null>(null);
  const [res, setRes] = useState<Resumen | null>(null);
  const [err, setErr] = useState("");

  const recargar = useCallback(() => api<Resumen>("/api/costos/resumen").then(setRes).catch((e) => setErr(e.message)), []);
  useEffect(() => {
    api<Costo[]>("/api/costos").then(setCostos).catch((e) => setErr(e.message));
    recargar();
  }, [recargar]);

  const guardar = async (c: Costo) => {
    try {
      const n = await api<Costo>(`/api/costos/${c.id}`, { method: "PUT", body: c });
      setCostos((l) => l!.map((x) => (x.id === c.id ? n : x)));
      recargar();
    } catch (e: any) { aviso(e.message, "error"); }
  };
  const agregar = async (tipo: "fijo" | "variable") => {
    try {
      const n = await api<Costo>("/api/costos", { method: "POST", body: { tipo, nombre: tipo === "fijo" ? "Nuevo costo fijo" : "Nuevo costo variable" } });
      setCostos((l) => [...l!, n]);
    } catch (e: any) { aviso(e.message, "error"); }
  };
  const quitar = async (c: Costo) => {
    try {
      await api(`/api/costos/${c.id}`, { method: "DELETE" });
      setCostos((l) => l!.filter((x) => x.id !== c.id));
      recargar(); aviso(`«${c.nombre}» borrado`);
    } catch (e: any) { aviso(e.message, "error"); }
  };
  const ventaProducto = async (id: number, v: number | null) => {
    try { setRes(await api<Resumen>(`/api/costos/ventas/${id}`, { method: "PUT", body: { ventas_mes: v } })); }
    catch (e: any) { aviso(e.message, "error"); }
  };
  const guardarAjustes = async (ventas: number | null, dias: number | null) => {
    try {
      setRes(await api<Resumen>("/api/costos/ajustes/generales", { method: "PUT", body: { ventas_estimadas_mes: ventas || 0, dias_trabajo_mes: dias || 26 } }));
      setCostos(await api<Costo[]>("/api/costos"));
    } catch (e: any) { aviso(e.message, "error"); }
  };

  if (err) return <ErrorCaja msg={err} />;
  if (!costos || !res) return <Cargando />;
  const fijos = costos.filter((c) => c.tipo === "fijo");
  const variables = costos.filter((c) => c.tipo === "variable");
  const sinVentas = !res.ventas_mes;

  return (
    <>
      <header className="encabezado">
        <div>
          <h1>Costos del negocio</h1>
          <p className="sub">Lo que cuesta tener el negocio abierto, aparte de los ingredientes. Con esto cada producto muestra su
            <strong> ganancia real</strong> y usted sabe cuánto necesita vender al mes para no perder.</p>
        </div>
      </header>

      {/* ---------------- resumen */}
      <section className="costos-resumen">
        <div className="tarjeta-dato">
          <span className="cifra-label">Costos fijos al mes</span>
          <span className="cifra-valor">{colones(res.fijos_mes)}</span>
          <span className="cifra-nota">{res.fijos_mes ? `${colones(res.fijos_mes / res.dias_trabajo_mes)} por día trabajado` : "Llene los montos abajo"}</span>
        </div>
        <div className="tarjeta-dato">
          <span className="cifra-label">Ventas estimadas al mes</span>
          <span className="cifra-valor">{sinVentas ? "—" : colones(res.ventas_mes)}</span>
          <span className="cifra-nota">{sinVentas ? "Póngalas abajo para calcular la ganancia real"
            : res.fuente_ventas === "productos" ? `${num(res.unidades_mes, 0)} productos al mes${res.iva_incluido ? " · sin IVA" : ""}` : "Monto general"}</span>
        </div>
        <div className={"tarjeta-dato" + (res.ganancia_mes == null ? "" : res.ganancia_mes >= 0 ? " positivo" : " negativo")}>
          <span className="cifra-label">Ganancia estimada del mes</span>
          <span className="cifra-valor">{res.ganancia_mes == null ? "—" : colones(res.ganancia_mes)}</span>
          <span className="cifra-nota">{res.ganancia_mes == null ? "Falta saber cuánto vende" : res.ganancia_mes >= 0 ? "Después de pagar todo" : "Las ventas no alcanzan para los costos"}</span>
        </div>
        <div className="tarjeta-dato">
          <span className="cifra-label">Punto de equilibrio</span>
          <span className="cifra-valor">{res.equilibrio_mes == null ? "—" : colones(res.equilibrio_mes)}</span>
          <span className="cifra-nota">{res.equilibrio_mes == null ? "Ventas mínimas al mes para no perder"
            : `Ventas mínimas al mes para no perder · ${colones(res.equilibrio_dia)} por día`}</span>
        </div>
      </section>
      {res.ventas_mes > 0 && res.equilibrio_mes != null && (
        <div className="barra-equilibrio" aria-label="Ventas comparadas con el punto de equilibrio">
          <div className="barra-equilibrio-pista">
            <div className={"barra-equilibrio-relleno" + (res.ventas_mes >= res.equilibrio_mes ? " ok" : "")}
                 style={{ width: `${Math.min(100, (res.ventas_mes / Math.max(res.equilibrio_mes, res.ventas_mes)) * 100)}%` }} />
            <div className="barra-equilibrio-marca" style={{ left: `${Math.min(100, (res.equilibrio_mes / Math.max(res.equilibrio_mes, res.ventas_mes)) * 100)}%` }} />
          </div>
          <p className="ayuda">{res.ventas_mes >= res.equilibrio_mes
            ? `Sus ventas estimadas superan el punto de equilibrio por ${colones(res.ventas_mes - res.equilibrio_mes)} al mes.`
            : `Le faltan ${colones(res.equilibrio_mes - res.ventas_mes)} en ventas al mes para cubrir los costos.`}
            {res.contribucion_pct != null && ` De cada ₡1 000 vendidos quedan ${colones(res.contribucion_pct * 10)} para pagar los costos fijos y ganar.`}</p>
        </div>
      )}

      {/* ---------------- fijos */}
      <section className="bloque">
        <div className="seccion-cabeza">
          <h2 className="seccion">Costos fijos</h2>
          <button className="btn" onClick={() => agregar("fijo")}>+ Agregar costo fijo</button>
        </div>
        <p className="ayuda">Se pagan igual aunque no venda nada. Ponga el monto y cada cuánto lo paga; el sistema lo pasa a mensual.
          Los que deje en ₡0 no cuentan.</p>
        <div className="tabla-envoltura">
          <table className="tabla compacta costos-tabla">
            <thead><tr><th>Costo</th><th className="n">Monto</th><th>Cada cuánto</th><th className="n">Al mes</th><th>Activo</th><th /></tr></thead>
            <tbody>
              {fijos.map((c) => <FilaCosto key={c.id} c={c} onGuardar={guardar} onQuitar={quitar} />)}
            </tbody>
            <tfoot><tr><td colSpan={3}>Total de costos fijos al mes</td><td className="n">{colones(res.fijos_mes)}</td><td colSpan={2} /></tr></tfoot>
          </table>
        </div>
      </section>

      {/* ---------------- variables */}
      <section className="bloque">
        <div className="seccion-cabeza">
          <h2 className="seccion">Costos variables</h2>
          <button className="btn" onClick={() => agregar("variable")}>+ Agregar costo variable</button>
        </div>
        <p className="ayuda">Suben o bajan con cada venta: comisiones (% del precio) o cosas que se gastan por producto (₡ por unidad).
          <strong> «Aplica a»</strong> es la parte de sus ventas a la que le toca ese costo; por ejemplo, si la mitad le pagan con tarjeta, el datáfono aplica al 50 %.
          No ponga aquí lo que ya está en las recetas (como el envase).</p>
        <div className="tabla-envoltura">
          <table className="tabla compacta costos-tabla">
            <thead><tr><th>Costo</th><th>Tipo</th><th className="n">Monto</th><th className="n">Aplica a</th><th>Activo</th><th /></tr></thead>
            <tbody>
              {variables.map((c) => <FilaCosto key={c.id} c={c} onGuardar={guardar} onQuitar={quitar} />)}
            </tbody>
            <tfoot><tr><td colSpan={6}>En promedio, cada venta lleva {pct(res.variable_pct)} del precio
              {res.variable_unidad ? ` más ${colones(res.variable_unidad)} por producto` : ""} en costos variables.</td></tr></tfoot>
          </table>
        </div>
      </section>

      {/* ---------------- ventas */}
      <section className="bloque">
        <h2 className="seccion">¿Cuánto vende al mes?</h2>
        <p className="ayuda">Los costos fijos se reparten entre lo que vende. Lo más exacto es poner cuántas unidades espera vender de cada producto.
          Si no lo sabe todavía, ponga un monto general de ventas al mes.</p>
        <AjustesVentas res={res} onGuardar={guardarAjustes} />
        <div className="tabla-envoltura" style={{ marginTop: 14 }}>
          <table className="tabla compacta costos-prod">
            <thead><tr>
              <th>Producto</th><th className="n">Unidades al mes</th><th className="n">Precio</th><th className="n">Ingredientes</th>
              <th className="n">Variables</th><th className="n">Parte de fijos</th><th className="n">Ganancia real</th>
              <th className="n">Margen neto</th><th className="n">Precio mínimo</th><th className="n">Aporte al mes</th>
            </tr></thead>
            <tbody>
              {res.productos.map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/admin/recetas/${p.id}`}>{p.nombre}</Link>{p.errores && <span className="marca-error">revisar</span>}
                    <span className="tenue costos-cat">{p.categoria}</span></td>
                  <td className="n"><UnidadesMes valor={p.ventas_mes} etiqueta={`Unidades al mes de ${p.nombre}`} onGuardar={(v) => ventaProducto(p.id, v)} /></td>
                  <td className="n">{p.precio_venta ? colones(p.precio_venta) : <span className="tenue" title="Ponga el precio de venta en el producto">sin precio</span>}</td>
                  <td className="n">{colones(p.costo)}</td>
                  <td className="n">{colones(p.costo_variable)}</td>
                  <td className="n">{colones(p.costo_fijo)}</td>
                  <td className={"n fuerte" + (p.ganancia_real != null && p.ganancia_real < 0 ? " m-bajo" : "")}>{colones(p.ganancia_real)}</td>
                  <td className="n">{p.margen_neto_pct == null ? <span className="tenue">—</span> : <span className={p.margen_neto_pct < 0 ? "m-bajo" : p.margen_neto_pct < 15 ? "m-medio" : "m-alto"}>{pct(p.margen_neto_pct)}</span>}</td>
                  <td className="n tenue" title="Precio con el que no gana ni pierde">{p.errores || !p.costo ? "—" : colones(p.precio_equilibrio)}</td>
                  <td className="n">{p.aporte_mes != null ? colones(p.aporte_mes) : <span className="tenue">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ayuda" style={{ marginTop: 10 }}><strong>Ganancia real</strong> = precio{res.iva_incluido ? " sin IVA" : ""} − ingredientes − costos variables − la parte de los costos fijos que le toca.
          <strong> Precio mínimo</strong> = el precio con el que ese producto no gana ni pierde. <strong>Aporte al mes</strong> = lo que deja ese producto para pagar los fijos y ganar.</p>
      </section>
    </>
  );
}

function FilaCosto({ c, onGuardar, onQuitar }: { c: Costo; onGuardar: (c: Costo) => void; onQuitar: (c: Costo) => void }) {
  const [d, setD] = useState(c);
  const [confirmar, setConfirmar] = useState(false);
  useEffect(() => setD(c), [c]);
  const guardarSi = (nuevo: Costo) => { if (JSON.stringify(nuevo) !== JSON.stringify(c)) onGuardar(nuevo); };
  const esPct = d.tipo === "variable" && d.modo === "porcentaje";
  return (
    <tr className={d.activo ? "" : "inactivo"}>
      <td>
        <input className="costo-nombre" value={d.nombre} maxLength={120} aria-label="Nombre del costo"
               onChange={(e) => setD({ ...d, nombre: e.target.value })} onBlur={() => d.nombre.trim() ? guardarSi(d) : setD(c)} />
        {d.notas && <span className="costo-nota">{d.notas}</span>}
      </td>
      {d.tipo === "variable" && (
        <td>
          <select value={d.modo} aria-label="Tipo de costo variable" onChange={(e) => { const n = { ...d, modo: e.target.value as Costo["modo"] }; setD(n); guardarSi(n); }}>
            <option value="porcentaje">% del precio</option>
            <option value="por_unidad">₡ por producto</option>
          </select>
        </td>
      )}
      <td className="n">
        <div className={esPct ? "con-sufijo costo-monto" : "con-prefijo costo-monto"} onBlur={() => guardarSi(d)}>
          {!esPct && <span>₡</span>}
          <NumInput value={d.monto} min={0} ariaLabel={`Monto de ${d.nombre}`} onChange={(v) => setD({ ...d, monto: v ?? 0 })} />
          {esPct && <span>%</span>}
        </div>
      </td>
      {d.tipo === "fijo" ? (
        <>
          <td>
            <select value={d.frecuencia} aria-label="Cada cuánto se paga" onChange={(e) => { const n = { ...d, frecuencia: e.target.value }; setD(n); guardarSi(n); }}>
              {FRECUENCIAS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </td>
          <td className="n">{c.monto ? colones(c.mensual) : <span className="tenue">—</span>}</td>
        </>
      ) : (
        <td className="n">
          <div className="con-sufijo costo-aplica" onBlur={() => guardarSi(d)}>
            <NumInput value={d.aplica_pct} min={0} ariaLabel={`Parte de las ventas a la que aplica ${d.nombre}`}
                      onChange={(v) => setD({ ...d, aplica_pct: Math.min(100, v ?? 0) })} />
            <span>% ventas</span>
          </div>
        </td>
      )}
      <td><input type="checkbox" checked={d.activo} aria-label={`${d.nombre} activo`} onChange={(e) => { const n = { ...d, activo: e.target.checked }; setD(n); guardarSi(n); }} /></td>
      <td className="n">
        {confirmar ? (
          <span className="costo-confirmar">
            <button className="btn-mini-texto peligro" onClick={() => onQuitar(c)}>Borrar</button>
            <button className="btn-mini-texto" onClick={() => setConfirmar(false)}>No</button>
          </span>
        ) : <button className="btn-quitar" aria-label={`Borrar ${c.nombre}`} onClick={() => setConfirmar(true)}>×</button>}
      </td>
    </tr>
  );
}

function UnidadesMes({ valor, etiqueta, onGuardar }: { valor: number | null; etiqueta: string; onGuardar: (v: number | null) => void }) {
  const [txt, setTxt] = useState(valor == null ? "" : String(valor));
  useEffect(() => setTxt(valor == null ? "" : String(valor)), [valor]);
  const listo = () => {
    const t = txt.trim().replace(",", ".");
    const v = t === "" ? null : Number(t);
    if (v !== null && (Number.isNaN(v) || v < 0)) { setTxt(valor == null ? "" : String(valor)); return; }
    if ((v ?? null) !== (valor ?? null)) onGuardar(v);
  };
  return <input className="unidades-mes" inputMode="decimal" value={txt} placeholder="0" aria-label={etiqueta}
                onChange={(e) => setTxt(e.target.value)} onBlur={listo} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />;
}

function AjustesVentas({ res, onGuardar }: { res: Resumen; onGuardar: (ventas: number | null, dias: number | null) => void }) {
  const [ventas, setVentas] = useState<number | null>(res.ventas_estimadas_mes || null);
  const [dias, setDias] = useState<number | null>(res.dias_trabajo_mes);
  const cambiado = (ventas || 0) !== (res.ventas_estimadas_mes || 0) || (dias || 26) !== res.dias_trabajo_mes;
  return (
    <div className="ajustes-ventas">
      <label className="campo">
        <span className="campo-label">Ventas generales al mes{res.iva_incluido ? " (sin IVA)" : ""}</span>
        <div className="con-prefijo"><span>₡</span><NumInput value={ventas} allowEmpty min={0} ariaLabel="Ventas generales al mes" onChange={setVentas} /></div>
        <span className="campo-ayuda">{res.fuente_ventas === "productos" ? "No se usa: ya hay unidades por producto en la tabla." : "Se usa mientras no ponga unidades por producto."}</span>
      </label>
      <label className="campo">
        <span className="campo-label">Días que trabaja al mes</span>
        <NumInput value={dias} min={1} ariaLabel="Días que trabaja al mes" onChange={setDias} />
        <span className="campo-ayuda">Para pasar costos diarios a mensuales y las ventas por día.</span>
      </label>
      {cambiado && <button className="btn btn-primario" onClick={() => onGuardar(ventas, dias)}>Guardar</button>}
    </div>
  );
}
