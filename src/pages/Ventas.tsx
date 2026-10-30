import { useEffect, useState } from "react";
import { api } from "../api";
import { Cargando, Descargas, ErrorCaja } from "../components";
import { colones, num, pct } from "../format";

type Periodo = "dia" | "semana" | "mes";
type Resumen = {
  desde: string; hasta: string; periodo: string; ventas: number; unidades: number; total: number; total_sin_iva: number;
  ingredientes: number; variables: number; ganancia_bruta: number; margen_bruto_pct: number | null; fijos_periodo: number;
  ganancia_real: number; fijos_mes: number; ticket_promedio: number | null; equilibrio_mes: number | null;
  por_pago: { forma_pago: string; ventas: number; total: number }[];
  por_producto: { nombre: string; categoria: string; cantidad: number; total: number; ganancia_bruta: number }[];
  por_dia: { dia: string; total: number; ganancia_bruta: number; ventas: number }[];
  por_hora: { hora: number; total: number }[];
};

const hoyCR = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
const fechaLarga = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso + "T12:00:00").toLocaleDateString("es-CR", o);

function moverFecha(iso: string, periodo: Periodo, paso: number) {
  const d = new Date(iso + "T12:00:00");
  if (periodo === "dia") d.setDate(d.getDate() + paso);
  if (periodo === "semana") d.setDate(d.getDate() + 7 * paso);
  if (periodo === "mes") d.setMonth(d.getMonth() + paso, 1);
  return d.toISOString().slice(0, 10);
}

export default function Ventas() {
  const [periodo, setPeriodo] = useState<Periodo>("dia");
  const [fecha, setFecha] = useState(hoyCR());
  const [r, setR] = useState<Resumen | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setR(null);
    api<Resumen>(`/api/pos/resumen?periodo=${periodo}&fecha=${fecha}`).then(setR).catch((e) => setErr(e.message));
  }, [periodo, fecha]);
  if (err) return <ErrorCaja msg={err} />;

  const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const titulo = !r ? "" : mayus(periodo === "dia" ? fechaLarga(r.desde, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : periodo === "semana" ? `${fechaLarga(r.desde, { day: "numeric", month: "short" })} al ${fechaLarga(r.hasta, { day: "numeric", month: "short", year: "numeric" })}`
    : fechaLarga(r.desde, { month: "long", year: "numeric" }));
  const esActual = !r || (hoyCR() >= r.desde && hoyCR() <= r.hasta);
  const serie = !r ? [] : periodo === "dia"
    ? r.por_hora.filter((h) => h.hora >= 6 && h.hora <= 22).map((h) => ({ etiqueta: `${h.hora}`, valor: h.total, titulo: `${h.hora}:00` }))
    : r.por_dia.map((d) => ({ etiqueta: periodo === "semana" ? fechaLarga(d.dia, { weekday: "short" }) : String(Number(d.dia.slice(8))),
        valor: d.total, titulo: fechaLarga(d.dia, { weekday: "long", day: "numeric", month: "long" }) }));
  const maximo = Math.max(1, ...serie.map((s) => s.valor));

  return (
    <>
      <header className="encabezado">
        <div>
          <h1>Ventas</h1>
          <p className="sub">Lo que se ha cobrado en la caja, con la ganancia real después de ingredientes, costos variables y costos fijos.</p>
        </div>
        <div className="fila-botones">
          <a className="btn" href="/pos">Abrir la caja</a>
          {r && <Descargas etiqueta="Descargar" opciones={[{ texto: `Ventas · ${titulo}`, ruta: `/api/reportes/ventas?desde=${r.desde}&hasta=${r.hasta}` }]} />}
        </div>
      </header>

      <div className="ventas-controles">
        <div className="pestanas" role="tablist">
          {(["dia", "semana", "mes"] as Periodo[]).map((p) => (
            <button key={p} role="tab" aria-selected={periodo === p} className={periodo === p ? "activa" : ""} onClick={() => setPeriodo(p)}>
              {{ dia: "Día", semana: "Semana", mes: "Mes" }[p]}
            </button>
          ))}
        </div>
        <div className="ventas-fecha">
          <button className="btn" aria-label="Anterior" onClick={() => setFecha(moverFecha(fecha, periodo, -1))}>‹</button>
          <strong>{titulo}</strong>
          <button className="btn" aria-label="Siguiente" disabled={esActual} onClick={() => setFecha(moverFecha(fecha, periodo, 1))}>›</button>
          {!esActual && <button className="link" onClick={() => setFecha(hoyCR())}>Volver a hoy</button>}
        </div>
      </div>

      {!r ? <Cargando /> : (
        <>
          <section className="costos-resumen">
            <div className="tarjeta-dato">
              <span className="cifra-label">Ventas</span>
              <span className="cifra-valor">{colones(r.total)}</span>
              <span className="cifra-nota">{r.ventas} {r.ventas === 1 ? "venta" : "ventas"} · {num(r.unidades, 0)} productos{r.ticket_promedio ? ` · promedio ${colones(r.ticket_promedio)}` : ""}</span>
            </div>
            <div className="tarjeta-dato">
              <span className="cifra-label">Ganancia bruta</span>
              <span className="cifra-valor">{colones(r.ganancia_bruta)}</span>
              <span className="cifra-nota">Después de ingredientes y costos variables{r.margen_bruto_pct != null ? ` · ${pct(r.margen_bruto_pct)}` : ""}</span>
            </div>
            <div className="tarjeta-dato">
              <span className="cifra-label">Costos fijos del periodo</span>
              <span className="cifra-valor">{colones(r.fijos_periodo)}</span>
              <span className="cifra-nota">{periodo === "dia" ? "La parte de un día trabajado" : periodo === "semana" ? "La parte de 7 días" : "Todo el mes"}</span>
            </div>
            <div className={"tarjeta-dato " + (r.ganancia_real >= 0 ? "positivo" : "negativo")}>
              <span className="cifra-label">Ganancia real</span>
              <span className="cifra-valor">{colones(r.ganancia_real)}</span>
              <span className="cifra-nota">{r.ganancia_real >= 0 ? "Después de pagar todo" : "Todavía no cubre los costos fijos"}</span>
            </div>
          </section>

          {periodo === "mes" && r.equilibrio_mes != null && (
            <div className="barra-equilibrio">
              <div className="barra-equilibrio-pista">
                <div className={"barra-equilibrio-relleno" + (r.total_sin_iva >= r.equilibrio_mes ? " ok" : "")}
                     style={{ width: `${Math.min(100, (r.total_sin_iva / r.equilibrio_mes) * 100)}%` }} />
              </div>
              <p className="ayuda">{r.total_sin_iva >= r.equilibrio_mes
                ? `Ya pasó el punto de equilibrio del mes (${colones(r.equilibrio_mes)}): desde aquí todo lo que deja cada venta es ganancia.`
                : `Lleva ${pct((r.total_sin_iva / r.equilibrio_mes) * 100)} del punto de equilibrio del mes (${colones(r.equilibrio_mes)}). Faltan ${colones(r.equilibrio_mes - r.total_sin_iva)} en ventas.`}</p>
            </div>
          )}

          {r.ventas === 0 ? <p className="vacio">No hay ventas en este periodo.</p> : (
            <>
              <section className="bloque">
                <h2 className="seccion">{periodo === "dia" ? "Ventas por hora" : "Ventas por día"}</h2>
                <div className="grafico-barras" role="img" aria-label={periodo === "dia" ? "Ventas por hora del día" : "Ventas por día"}>
                  {serie.map((s, i) => (
                    <div key={i} className="barra-col" title={`${s.titulo}: ${colones(s.valor)}`}>
                      <div className="barra-valor">{s.valor > 0 && serie.length <= 16 ? colones(s.valor) : ""}</div>
                      <div className="barra" style={{ height: `${(s.valor / maximo) * 100}%` }} />
                      <div className="barra-etiqueta">{s.etiqueta}</div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="ventas-tablas">
                <section className="bloque">
                  <h2 className="seccion">Productos más vendidos</h2>
                  <div className="tabla-envoltura">
                    <table className="tabla compacta">
                      <thead><tr><th>Producto</th><th className="n">Cantidad</th><th className="n">Ventas</th><th className="n">Ganancia bruta</th></tr></thead>
                      <tbody>
                        {r.por_producto.map((p) => (
                          <tr key={p.nombre}><td>{p.nombre}<span className="sub-dato">{p.categoria}</span></td><td className="n">{num(p.cantidad, 0)}</td>
                            <td className="n">{colones(p.total)}</td><td className="n">{colones(p.ganancia_bruta)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="bloque">
                  <h2 className="seccion">Formas de pago</h2>
                  <div className="tabla-envoltura">
                    <table className="tabla compacta">
                      <thead><tr><th>Forma</th><th className="n">Ventas</th><th className="n">Monto</th></tr></thead>
                      <tbody>
                        {r.por_pago.map((p) => (
                          <tr key={p.forma_pago}><td>{p.forma_pago === "sinpe" ? "SINPE Móvil" : "Efectivo"}</td><td className="n">{p.ventas}</td><td className="n">{colones(p.total)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h2 className="seccion" style={{ marginTop: 22 }}>Cómo se reparte</h2>
                  <dl className="resultado desglose">
                    <div><dt>Ventas{r.total !== r.total_sin_iva ? " sin IVA" : ""}</dt><dd>{colones(r.total_sin_iva)}</dd></div>
                    <div><dt>− Ingredientes</dt><dd>{colones(r.ingredientes)}</dd></div>
                    <div><dt>− Costos variables</dt><dd>{colones(r.variables)}</dd></div>
                    <div><dt>− Costos fijos del periodo</dt><dd>{colones(r.fijos_periodo)}</dd></div>
                    <div className="total"><dt>Ganancia real</dt><dd className={r.ganancia_real < 0 ? "negativo" : "positivo"}>{colones(r.ganancia_real)}</dd></div>
                  </dl>
                </section>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
