import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { api, descargar, imagenPrivada, mediaUrl, subirArchivo } from "../api";
import { Campo, Cargando, ErrorCaja, SubirImagen } from "../components";
import { colones } from "../format";
import { useApp } from "../store";
import type { Negocio as N, ResumenReceta } from "../types";

export default function Negocio() {
  const { usuario, aviso, recargarConfig } = useApp();
  const [n, setN] = useState<N | null>(null);
  const [guardado, setGuardado] = useState("");
  const [prods, setProds] = useState<ResumenReceta[]>([]);
  const [err, setErr] = useState("");
  const qr = useRef<HTMLCanvasElement>(null);
  const [sitio, setSitio] = useState("");
  // El QR apunta al dominio propio si está en "Sitio web"; si no, a la dirección desde donde se abrió el sistema.
  const urlMenu = /^https?:\/\//.test(sitio) ? sitio.replace(/\/?$/, "/") : `${window.location.origin}/`;
  const admin = !!usuario?.es_admin;

  useEffect(() => {
    api<N>("/api/negocio").then((d) => { setN(d); setSitio(d.sitio_web || ""); setGuardado(JSON.stringify(d)); }).catch((e) => setErr(e.message));
    api<ResumenReceta[]>("/api/recetas").then((l) => setProds(l.filter((r) => r.tipo === "producto"))).catch(() => {});
  }, []);
  useEffect(() => {
    if (qr.current) QRCode.toCanvas(qr.current, urlMenu, { width: 180, margin: 1, color: { dark: "#18261F", light: "#FFFFFF" } });
  }, [n !== null, urlMenu]);

  const enMenu = useMemo(() => prods.filter((p) => p.en_menu), [prods]);
  if (err) return <ErrorCaja msg={err} />;
  if (!n) return <Cargando />;
  const set = (p: Partial<N>) => setN({ ...n, ...p });
  const cambiado = JSON.stringify(n) !== guardado;

  const guardar = async () => {
    try {
      const { logo: _l, ...cuerpo } = n;
      const d = await api<N>("/api/negocio", { method: "PUT", body: cuerpo });
      setN(d); setSitio(d.sitio_web || ""); setGuardado(JSON.stringify(d)); await recargarConfig(); aviso("Datos del negocio guardados");
    } catch (e: any) { aviso(e.message, "error"); }
  };
  const logo = async (f: File) => {
    try { const d = await subirArchivo<N>("/api/negocio/logo", f); setN({ ...n, logo: d.logo }); setGuardado(JSON.stringify({ ...JSON.parse(guardado), logo: d.logo })); aviso("Logo actualizado"); }
    catch (e: any) { aviso(e.message, "error"); }
  };
  const quitarLogo = async () => {
    try { await api("/api/negocio/logo", { method: "DELETE" }); setN({ ...n, logo: null }); setGuardado(JSON.stringify({ ...JSON.parse(guardado), logo: null })); }
    catch (e: any) { aviso(e.message, "error"); }
  };
  const alternar = async (p: ResumenReceta) => {
    try {
      const r = await api<{ en_menu: boolean }>(`/api/recetas/${p.id}/menu`, { method: "PATCH", body: { en_menu: !p.en_menu } });
      setProds(prods.map((x) => (x.id === p.id ? { ...x, en_menu: r.en_menu } : x)));
    } catch (e: any) { aviso(e.message, "error"); }
  };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(urlMenu); aviso("Enlace copiado"); } catch { aviso("No se pudo copiar; selecciónelo a mano.", "error"); }
  };
  const bajarQR = () => {
    const c = document.createElement("canvas");
    QRCode.toCanvas(c, urlMenu, { width: 1024, margin: 2 }, () => {
      const a = document.createElement("a");
      a.href = c.toDataURL("image/png");
      a.download = "qr-menu.png";
      a.click();
    });
  };

  const texto = (k: keyof N, label: string, ayuda?: string, ph?: string) => (
    <Campo label={label} ayuda={ayuda}>
      <input value={(n[k] as string) || ""} placeholder={ph} disabled={!admin} onChange={(e) => set({ [k]: e.target.value } as Partial<N>)} />
    </Campo>
  );

  return (
    <>
      <header className="encabezado">
        <div>
          <h1>Menú y negocio</h1>
          <p className="sub">Lo que ven sus clientes en el menú: logo, datos de contacto, redes y los productos que marque.</p>
        </div>
        <div className="fila-botones">
          <a className="btn" href="/" target="_blank" rel="noopener">Ver menú</a>
          {admin && <button className="btn btn-primario" onClick={guardar} disabled={!cambiado}>{cambiado ? "Guardar" : "Guardado"}</button>}
        </div>
      </header>

      <div className="editor">
        <section className="editor-principal">
          <h2 className="seccion" style={{ marginTop: 0 }}>Identidad</h2>
          <div className="identidad">
            <SubirImagen url={mediaUrl(n.logo)} onSubir={logo} onQuitar={quitarLogo} texto="Subir logo" redonda deshabilitado={!admin}
                         ayuda="Cuadrado o redondo, idealmente PNG" />
            <div className="rejilla-campos">
              {texto("nombre", "Nombre del negocio")}
              {texto("eslogan", "Frase corta", "Aparece bajo el nombre", "Frutas y helados frescos todos los días")}
              {texto("lugar", "Lugar", "Ciudad y provincia, aparece en la portada", "Tilarán, Guanacaste")}
              <Campo label="Color de la marca">
                <div className="color-campo">
                  <input type="color" value={n.color} disabled={!admin} onChange={(e) => set({ color: e.target.value })} aria-label="Color" />
                  <input value={n.color} disabled={!admin} onChange={(e) => set({ color: e.target.value })} aria-label="Código del color" />
                </div>
              </Campo>
            </div>
          </div>
          <Campo label="Presentación" ayuda="Un párrafo corto al inicio del menú">
            <textarea rows={3} value={n.descripcion} disabled={!admin} onChange={(e) => set({ descripcion: e.target.value })} />
          </Campo>

          <details className="ingles" open={!!(n.eslogan_en || n.descripcion_en || n.horario_en)}>
            <summary>Textos en inglés <span className="tenue">(para el menú en inglés en /en y para Google)</span></summary>
            <div className="rejilla-campos">
              {texto("eslogan_en", "Frase corta en inglés", undefined, "Fresh fruit and ice cream every day")}
              {texto("horario_en", "Horario en inglés", undefined, "Monday to Saturday, 10 a.m. to 8 p.m.")}
            </div>
            <Campo label="Presentación en inglés">
              <textarea rows={3} value={n.descripcion_en || ""} disabled={!admin} onChange={(e) => set({ descripcion_en: e.target.value })} />
            </Campo>
          </details>

          <h2 className="seccion">Contacto</h2>
          <div className="rejilla-campos">
            {texto("whatsapp", "WhatsApp", "Para el botón «Pedir por WhatsApp»", "8888-8888")}
            {texto("telefono", "Teléfono", undefined, "2222-2222")}
            {texto("email", "Correo")}
            {texto("horario", "Horario", undefined, "Lunes a sábado, 10 a. m. a 8 p. m.")}
          </div>
          <div className="rejilla-campos" style={{ marginTop: 14 }}>
            {texto("direccion", "Dirección")}
            {texto("mapa", "Enlace de Google Maps o Waze", "Opcional; si no, se busca la dirección")}
          </div>

          <h2 className="seccion">Redes sociales</h2>
          <div className="rejilla-campos">
            {texto("instagram", "Instagram", "Usuario o enlace", "@minegocio")}
            {texto("facebook", "Facebook", "Usuario o enlace")}
            {texto("tiktok", "TikTok", "Usuario o enlace")}
            {texto("sitio_web", "Sitio web")}
          </div>
          <label className="check"><input type="checkbox" checked={n.mostrar_precios} disabled={!admin} onChange={(e) => set({ mostrar_precios: e.target.checked })} /> Mostrar precios en el menú</label>
          {!admin && <p className="ayuda">Solo un administrador puede cambiar estos datos.</p>}

          <h2 className="seccion">Productos en el menú</h2>
          <p className="ayuda">Marque qué se muestra. La foto y la descripción se cambian dentro de cada producto. El precio que ven los clientes es el «precio de venta».</p>
          <div className="tabla-envoltura">
            <table className="tabla compacta">
              <thead><tr><th>En el menú</th><th>Producto</th><th>Categoría</th><th className="n">Precio de venta</th><th>Falta</th></tr></thead>
              <tbody>
                {prods.map((p) => (
                  <tr key={p.id}>
                    <td><label className="interruptor"><input type="checkbox" checked={p.en_menu} onChange={() => alternar(p)} aria-label={`Mostrar ${p.nombre} en el menú`} /><span /></label></td>
                    <td>
                      <div className="prod-mini">
                        {p.foto ? <img src={mediaUrl(p.foto)!} alt="" /> : <i />}
                        <Link to={`/admin/recetas/${p.id}`}>{p.nombre}</Link>
                      </div>
                    </td>
                    <td className="tenue">{p.categoria}</td>
                    <td className="n">{p.precio_venta ? colones(p.precio_venta) : "—"}</td>
                    <td className="tenue">{[!p.foto && "foto", !p.precio_venta && "precio"].filter(Boolean).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="panel-precio">
          <div className="cifra">
            <span className="cifra-label">Menú para clientes</span>
            <span className="cifra-valor">{enMenu.length}<small> productos</small></span>
            <span className="cifra-nota">{enMenu.filter((p) => !p.precio_venta).length > 0 ? `${enMenu.filter((p) => !p.precio_venta).length} sin precio de venta: se muestran sin precio.` : "Todos con precio."}</span>
          </div>
          <Campo label="Enlace del menú">
            <input readOnly value={urlMenu} onFocus={(e) => e.target.select()} />
          </Campo>
          <div className="fila-botones izquierda" style={{ marginTop: 0 }}>
            <button className="btn" onClick={copiar}>Copiar enlace</button>
            <a className="btn" href="/" target="_blank" rel="noopener">Abrir</a>
          </div>
          <div className="qr">
            <canvas ref={qr} aria-label="Código QR del menú" />
            <button className="btn" onClick={bajarQR}>Descargar QR para imprimir</button>
          </div>
        </aside>
      </div>
      <Impresos url={urlMenu} version={guardado} />
    </>
  );
}

type Formato = { clave: string; nombre: string; ancho: number; alto: number; descripcion: string };

/** Diseños listos para imprimir o compartir, con el QR del menú. */
function Impresos({ url, version }: { url: string; version: string }) {
  const { aviso } = useApp();
  const [formatos, setFormatos] = useState<Formato[]>([]);
  const [vistas, setVistas] = useState<Record<string, string>>({});
  const [bajando, setBajando] = useState("");
  useEffect(() => { api<Formato[]>("/api/impresos").then(setFormatos).catch(() => {}); }, []);
  useEffect(() => {
    let vivo = true;
    const creadas: string[] = [];
    setVistas({});
    formatos.forEach((f) => {
      imagenPrivada(`/api/impresos/${f.clave}?tipo=vista&url=${encodeURIComponent(url)}`)
        .then((u) => { creadas.push(u); if (vivo) setVistas((v) => ({ ...v, [f.clave]: u })); }).catch(() => {});
    });
    return () => { vivo = false; creadas.forEach((u) => URL.revokeObjectURL(u)); };
  }, [formatos, url, version]);
  const bajar = async (f: Formato, tipo: "png" | "pdf") => {
    setBajando(f.clave + tipo);
    try { await descargar(`/api/impresos/${f.clave}?tipo=${tipo}&url=${encodeURIComponent(url)}`, `${f.clave}.${tipo}`); }
    catch (e: any) { aviso(e.message, "error"); } finally { setBajando(""); }
  };
  if (!formatos.length) return null;
  return (
    <section className="bloque impresos">
      <h2 className="seccion">Para imprimir y compartir</h2>
      <p className="ayuda">Diseños con el código QR de su menú, su nombre, colores y contactos. Descárguelos en PDF para imprimir
        o en imagen (PNG) para compartir. El QR lleva a <strong>{url}</strong>.</p>
      <div className="impresos-rejilla">
        {formatos.map((f) => (
          <article key={f.clave} className="impreso">
            <div className="impreso-vista">
              {vistas[f.clave] ? <img src={vistas[f.clave]} alt={`Vista previa: ${f.nombre}`} style={{ aspectRatio: `${f.ancho} / ${f.alto}` }} />
                : <div className="impreso-cargando" style={{ aspectRatio: `${f.ancho} / ${f.alto}` }}>Preparando…</div>}
            </div>
            <h3>{f.nombre}</h3>
            <p className="ayuda">{f.descripcion}</p>
            <div className="fila-botones izquierda">
              <button className="btn btn-primario" onClick={() => bajar(f, "pdf")} disabled={!!bajando}>{bajando === f.clave + "pdf" ? "Preparando…" : "PDF"}</button>
              <button className="btn" onClick={() => bajar(f, "png")} disabled={!!bajando}>{bajando === f.clave + "png" ? "Preparando…" : "Imagen PNG"}</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
