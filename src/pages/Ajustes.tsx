import { useEffect, useState } from "react";
import { api, descargar, mediaUrl, subirArchivo } from "../api";
import { Campo, Confirmar, NumInput, SubirImagen } from "../components";
import { useApp } from "../store";
import type { Config, Negocio, Usuario } from "../types";

export default function Ajustes() {
  const { usuario, config, recargarConfig, aviso } = useApp();
  const [cfg, setCfg] = useState<Config | null>(config);
  const [claves, setClaves] = useState({ actual: "", nueva: "", repetir: "" });
  useEffect(() => setCfg(config), [config]);

  const guardarCfg = async () => {
    try { await api("/api/configuracion", { method: "PUT", body: cfg }); await recargarConfig(); aviso("Ajustes guardados"); }
    catch (e: any) { aviso(e.message, "error"); }
  };
  const cambiarClave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (claves.nueva !== claves.repetir) { aviso("Las contraseñas nuevas no coinciden.", "error"); return; }
    try {
      await api("/api/auth/cambiar-clave", { body: { clave_actual: claves.actual, clave_nueva: claves.nueva } });
      setClaves({ actual: "", nueva: "", repetir: "" }); aviso("Contraseña cambiada");
    } catch (e: any) { aviso(e.message, "error"); }
  };

  return (
    <>
      <header className="encabezado"><div><h1>Ajustes</h1></div></header>
      <div className="ajustes">
        {cfg && (
          <section className="bloque">
            <h2 className="seccion">Precios</h2>
            <div className="rejilla-campos">
              <Campo label="Nombre del negocio"><input value={cfg.nombre_negocio} onChange={(e) => setCfg({ ...cfg, nombre_negocio: e.target.value })} disabled={!usuario?.es_admin} /></Campo>
              <Campo label="Margen objetivo por defecto" ayuda="Ganancia sobre el precio de venta sin IVA">
                <div className="con-sufijo"><NumInput value={cfg.margen_objetivo_pct} onChange={(v) => setCfg({ ...cfg, margen_objetivo_pct: v || 0 })} ariaLabel="Margen" /><span>%</span></div>
              </Campo>
              <Campo label="Redondear precio sugerido a" ayuda="Múltiplos de colones (0 = sin redondeo)">
                <div className="con-prefijo"><span>₡</span><NumInput value={cfg.redondeo} onChange={(v) => setCfg({ ...cfg, redondeo: v || 0 })} ariaLabel="Redondeo" /></div>
              </Campo>
              <Campo label="IVA">
                <div className="con-sufijo"><NumInput value={cfg.iva_pct} onChange={(v) => setCfg({ ...cfg, iva_pct: v || 0 })} ariaLabel="IVA" /><span>%</span></div>
              </Campo>
            </div>
            <label className="check"><input type="checkbox" checked={cfg.aplicar_iva} onChange={(e) => setCfg({ ...cfg, aplicar_iva: e.target.checked })} /> Mis precios de venta incluyen IVA</label>
            {usuario?.es_admin ? <div className="fila-botones izquierda"><button className="btn btn-primario" onClick={guardarCfg}>Guardar ajustes</button></div>
              : <p className="ayuda">Solo un administrador puede cambiar estos ajustes.</p>}
          </section>
        )}

        <section className="bloque">
          <h2 className="seccion">Mi contraseña</h2>
          <form onSubmit={cambiarClave} className="rejilla-campos">
            <Campo label="Contraseña actual"><input type="password" value={claves.actual} onChange={(e) => setClaves({ ...claves, actual: e.target.value })} autoComplete="current-password" required /></Campo>
            <Campo label="Nueva contraseña" ayuda="Mínimo 6 caracteres"><input type="password" minLength={6} value={claves.nueva} onChange={(e) => setClaves({ ...claves, nueva: e.target.value })} autoComplete="new-password" required /></Campo>
            <Campo label="Repetir nueva"><input type="password" value={claves.repetir} onChange={(e) => setClaves({ ...claves, repetir: e.target.value })} autoComplete="new-password" required /></Campo>
            <div className="fila-botones izquierda"><button className="btn">Cambiar contraseña</button></div>
          </form>
        </section>

        <LogoNegocio admin={!!usuario?.es_admin} />

        <WhatsappNegocio admin={!!usuario?.es_admin} />

        <DatosTributarios admin={!!usuario?.es_admin} />

        <Publicacion />

        {usuario?.es_admin && <Usuarios />}

        {usuario?.es_admin && (
          <section className="bloque">
            <h2 className="seccion">Respaldo</h2>
            <p className="ayuda">Descarga una copia completa de la base de datos (ingredientes, recetas, usuarios). Guárdela de vez en cuando.</p>
            <button className="btn" onClick={() => descargar("/api/respaldo").catch((e) => aviso(e.message, "error"))}>Descargar respaldo</button>
          </section>
        )}
      </div>
    </>
  );
}

function Usuarios() {
  const { usuario: yo, aviso } = useApp();
  const [lista, setLista] = useState<Usuario[]>([]);
  const [nuevo, setNuevo] = useState<{ id?: number; usuario: string; nombre: string; clave: string; es_admin: boolean; activo: boolean } | null>(null);
  const [borrar, setBorrar] = useState<Usuario | null>(null);
  const cargar = () => api<Usuario[]>("/api/usuarios").then(setLista).catch(() => {});
  useEffect(() => { cargar(); }, []);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevo) return;
    const body = { ...nuevo, clave: nuevo.clave || null };
    try {
      if (nuevo.id) await api(`/api/usuarios/${nuevo.id}`, { method: "PUT", body });
      else await api("/api/usuarios", { body });
      aviso("Usuario guardado"); setNuevo(null); cargar();
    } catch (e: any) { aviso(e.message, "error"); }
  };

  return (
    <section className="bloque">
      <h2 className="seccion">Usuarios</h2>
      <div className="tabla-envoltura">
        <table className="tabla compacta">
          <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th /></tr></thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id}>
                <td className="fuerte">{u.usuario}{!u.activo && <span className="marca-error">inactivo</span>}</td>
                <td>{u.nombre}</td>
                <td>{u.es_admin ? "Administrador" : "Usuario"}</td>
                <td className="n acciones">
                  <button className="link" onClick={() => setNuevo({ id: u.id, usuario: u.usuario, nombre: u.nombre, clave: "", es_admin: u.es_admin, activo: u.activo })}>Editar</button>{" "}
                  {u.id !== yo?.id && <button className="link peligro" onClick={() => setBorrar(u)}>Borrar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nuevo ? (
        <form className="tarjeta-form" onSubmit={guardar}>
          <div className="rejilla-campos">
            <Campo label="Usuario"><input value={nuevo.usuario} onChange={(e) => setNuevo({ ...nuevo, usuario: e.target.value })} required minLength={3} autoComplete="off" /></Campo>
            <Campo label="Nombre"><input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} /></Campo>
            <Campo label={nuevo.id ? "Nueva contraseña" : "Contraseña"} ayuda={nuevo.id ? "Déjela vacía para no cambiarla" : "Mínimo 6 caracteres"}>
              <input type="password" value={nuevo.clave} onChange={(e) => setNuevo({ ...nuevo, clave: e.target.value })} required={!nuevo.id} minLength={6} autoComplete="new-password" />
            </Campo>
          </div>
          <label className="check"><input type="checkbox" checked={nuevo.es_admin} onChange={(e) => setNuevo({ ...nuevo, es_admin: e.target.checked })} /> Administrador (maneja usuarios, ajustes y respaldos)</label>
          <label className="check"><input type="checkbox" checked={nuevo.activo} onChange={(e) => setNuevo({ ...nuevo, activo: e.target.checked })} /> Activo</label>
          <div className="fila-botones izquierda"><button type="button" className="btn" onClick={() => setNuevo(null)}>Cancelar</button><button className="btn btn-primario">Guardar usuario</button></div>
        </form>
      ) : (
        <button className="btn btn-agregar" onClick={() => setNuevo({ usuario: "", nombre: "", clave: "", es_admin: false, activo: true })}>Agregar usuario</button>
      )}
      {borrar && <Confirmar texto={`¿Borrar el usuario «${borrar.usuario}»?`} onNo={() => setBorrar(null)}
        onSi={async () => { try { await api(`/api/usuarios/${borrar.id}`, { method: "DELETE" }); cargar(); aviso("Usuario borrado"); } catch (e: any) { aviso(e.message, "error"); } setBorrar(null); }} />}
    </section>
  );
}

/** Número de WhatsApp del negocio: alimenta los botones del menú para clientes. */
function WhatsappNegocio({ admin }: { admin: boolean }) {
  const { aviso } = useApp();
  const [neg, setNeg] = useState<Negocio | null>(null);
  const [num, setNum] = useState("");
  useEffect(() => { api<Negocio>("/api/negocio").then((n) => { setNeg(n); setNum(n.whatsapp); }).catch(() => {}); }, []);
  if (!neg) return null;
  const guardar = async () => {
    try {
      const { logo: _l, ...cuerpo } = neg;
      const n = await api<Negocio>("/api/negocio", { method: "PUT", body: { ...cuerpo, whatsapp: num.trim() } });
      setNeg(n); aviso("Número de WhatsApp guardado");
    } catch (e: any) { aviso(e.message, "error"); }
  };
  return (
    <section className="bloque">
      <h2 className="seccion">WhatsApp del negocio</h2>
      <p className="ayuda">Los clientes lo usan desde el menú: el botón verde flotante, «Pedir por WhatsApp» y «Pedir este» en cada producto. Si lo deja vacío, los botones no aparecen.</p>
      <div className="rejilla-campos">
        <Campo label="Número" ayuda="8 dígitos de Costa Rica, o con código de país (+506…)">
          <input value={num} onChange={(e) => setNum(e.target.value)} placeholder="8888-8888" inputMode="tel" disabled={!admin} />
        </Campo>
      </div>
      {admin && <div className="fila-botones izquierda"><button className="btn btn-primario" onClick={guardar} disabled={num === neg.whatsapp}>Guardar número</button></div>}
    </section>
  );
}

/** Logo de la empresa: aparece en el menú y en las imágenes que se generan para cada producto. */
function LogoNegocio({ admin }: { admin: boolean }) {
  const { aviso } = useApp();
  const [logo, setLogo] = useState<string | null>(null);
  const [neg, setNeg] = useState<Negocio | null>(null);
  useEffect(() => { api<Negocio>("/api/negocio").then((n) => { setLogo(n.logo); setNeg(n); }).catch(() => {}); }, []);
  if (!neg) return null;
  const modo = neg.distintivo || "logo";
  const cambiarModo = async (d: "logo" | "gorro" | "ninguno") => {
    try {
      const { logo: _l, ...cuerpo } = neg;
      const n = await api<Negocio>("/api/negocio", { method: "PUT", body: { ...cuerpo, distintivo: d } });
      setNeg(n); aviso("Listo. Actualizando las imágenes de los productos…");
    } catch (e: any) { aviso(e.message, "error"); }
  };
  return (
    <section className="bloque">
      <h2 className="seccion">Logo de la empresa</h2>
      <p className="ayuda">Se pone en el menú y en las imágenes de cada producto. Al cambiarlo, las imágenes se vuelven a generar solas en unos segundos. Funciona mejor un PNG cuadrado o redondo, con fondo transparente o blanco.</p>
      <div className="logo-ajustes">
        <SubirImagen url={mediaUrl(logo)} redonda texto="Subir logo" deshabilitado={!admin}
          onSubir={async (f) => {
            try { const n = await subirArchivo<Negocio>("/api/negocio/logo", f); setLogo(n.logo); aviso("Logo guardado. Actualizando las imágenes de los productos…"); }
            catch (e: any) { aviso(e.message, "error"); }
          }}
          onQuitar={async () => {
            try { await api("/api/negocio/logo", { method: "DELETE" }); setLogo(null); aviso("Logo quitado"); }
            catch (e: any) { aviso(e.message, "error"); }
          }} />
      </div>
      <div className="distintivo" role="radiogroup" aria-label="Qué usar como logo">
        <span className="campo-label">Qué mostrar como logo en el menú y las imágenes</span>
        {([["logo", "Mi logo (la imagen que subí)"], ["gorro", "Gorro de chef sobre el nombre"], ["ninguno", "Sin logo, solo el nombre"]] as const).map(([k, label]) => (
          <label key={k} className="check"><input type="radio" name="distintivo" checked={modo === k} disabled={!admin} onChange={() => cambiarModo(k)} /> {label}</label>
        ))}
      </div>
      {!admin && <p className="ayuda">Solo un administrador puede cambiar el logo.</p>}
    </section>
  );
}

type EstadoPublicacion = { activo: boolean; url: string | null; ultima: string | null; error: string | null; imagenes: number };

/** El menú de clientes se publica como archivos en Cloudflare R2, para que se vea aunque el servidor esté dormido. */
function Publicacion() {
  const { aviso } = useApp();
  const [e, setE] = useState<EstadoPublicacion | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  useEffect(() => { api<EstadoPublicacion>("/api/publicacion").then(setE).catch(() => {}); }, []);
  if (!e) return null;
  const publicar = async () => {
    setTrabajando(true);
    try {
      const r = await api<EstadoPublicacion>("/api/publicacion", { method: "POST" });
      setE(r);
      aviso(r.error ? "No se pudo publicar" : "Menú publicado", r.error ? "error" : undefined);
    } catch (x: any) { aviso(x.message, "error"); } finally { setTrabajando(false); }
  };
  const fecha = e.ultima ? new Date(e.ultima).toLocaleString("es-CR", { dateStyle: "medium", timeStyle: "short" }) : null;
  return (
    <section className="bloque">
      <h2 className="seccion">Menú publicado</h2>
      {!e.activo ? (
        <p className="ayuda">La publicación en Cloudflare R2 está apagada: el menú se lee directo de este servidor.
          Para activarla, configure las variables R2_ en Railway.</p>
      ) : (
        <>
          <p className="ayuda">Cada vez que guarda un cambio, el menú para clientes se vuelve a publicar solo en unos segundos.
            Los clientes lo ven aunque este servidor esté apagado.</p>
          <p>{fecha ? <>Última publicación: <strong>{fecha}</strong> · {e.imagenes} {e.imagenes === 1 ? "imagen" : "imágenes"}</> : "Todavía no se ha publicado."}</p>
          {e.error && <p className="error-texto">Último error: {e.error}</p>}
          <div className="fila-botones izquierda">
            <button className="btn" onClick={publicar} disabled={trabajando}>{trabajando ? "Publicando…" : "Publicar ahora"}</button>
          </div>
        </>
      )}
    </section>
  );
}

const LEYENDA_REGIMEN: Record<string, string> = {
  simplificado: "Contribuyente del Régimen de Tributación Simplificada. Precios con impuestos incluidos; no se desglosa el IVA.",
  tradicional: "Comprobante interno de venta.",
  ninguno: "",
};

/** Datos del contribuyente que salen en el comprobante de la caja (no se publican en el menú). */
function DatosTributarios({ admin }: { admin: boolean }) {
  const { aviso, config } = useApp();
  const [neg, setNeg] = useState<Negocio | null>(null);
  const [d, setD] = useState<Partial<Negocio>>({});
  const [guardado, setGuardado] = useState("");
  const tomar = (n: Negocio) => {
    const x = { regimen: n.regimen || "simplificado", contribuyente: n.contribuyente || "", cedula_tipo: n.cedula_tipo || "fisica",
      cedula: n.cedula || "", actividad: n.actividad || "", direccion_fiscal: n.direccion_fiscal || "", leyenda_comprobante: n.leyenda_comprobante || "" } as Partial<Negocio>;
    setNeg(n); setD(x); setGuardado(JSON.stringify(x));
  };
  useEffect(() => { api<Negocio>("/api/negocio").then(tomar).catch(() => {}); }, []);
  if (!neg) return null;
  const cambiado = JSON.stringify(d) !== guardado;
  const guardar = async () => {
    try {
      const { logo: _l, ...cuerpo } = neg;
      const n = await api<Negocio>("/api/negocio", { method: "PUT", body: { ...cuerpo, ...d, cedula: (d.cedula || "").replace(/[^\dA-Za-z]/g, "") } });
      tomar(n); aviso("Datos del comprobante guardados");
    } catch (e: any) { aviso(e.message, "error"); }
  };
  const s = (k: keyof Negocio) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value });
  return (
    <section className="bloque">
      <h2 className="seccion">Datos para el comprobante (Hacienda)</h2>
      <p className="ayuda">Salen en el comprobante que la caja envía por WhatsApp. No se muestran en el menú para clientes.
        En el Régimen de Tributación Simplificada no está obligada a emitir factura electrónica y no se desglosa el IVA en las ventas.</p>
      <div className="rejilla-campos">
        <Campo label="Régimen">
          <select value={d.regimen} onChange={s("regimen")} disabled={!admin}>
            <option value="simplificado">Régimen de Tributación Simplificada</option>
            <option value="tradicional">Régimen Tradicional</option>
            <option value="ninguno">No mostrar régimen</option>
          </select>
        </Campo>
        <Campo label="Nombre del contribuyente" ayuda="Como está inscrito en Hacienda">
          <input value={d.contribuyente} onChange={s("contribuyente")} disabled={!admin} placeholder="Nombre completo o razón social" />
        </Campo>
        <Campo label="Tipo de identificación">
          <select value={d.cedula_tipo} onChange={s("cedula_tipo")} disabled={!admin}>
            <option value="fisica">Cédula física</option>
            <option value="juridica">Cédula jurídica</option>
            <option value="dimex">DIMEX</option>
            <option value="nite">NITE</option>
          </select>
        </Campo>
        <Campo label="Número de identificación" ayuda={d.cedula_tipo === "fisica" ? "9 dígitos, ej. 1-1234-0567" : d.cedula_tipo === "juridica" ? "10 dígitos, ej. 3-101-123456" : undefined}>
          <input value={d.cedula} onChange={s("cedula")} disabled={!admin} inputMode="numeric" />
        </Campo>
        <Campo label="Actividad económica" ayuda="Código y nombre, como aparece en Hacienda">
          <input value={d.actividad} onChange={s("actividad")} disabled={!admin} placeholder="Ej.: 5610.1 Restaurantes, sodas, cafeterías" />
        </Campo>
        <Campo label="Dirección para el comprobante" ayuda="Si la deja vacía, se usa la de Menú y negocio">
          <input value={d.direccion_fiscal} onChange={s("direccion_fiscal")} disabled={!admin} />
        </Campo>
      </div>
      <Campo label="Leyenda del comprobante" ayuda={`Si la deja vacía: «${LEYENDA_REGIMEN[d.regimen || "simplificado"] || "sin leyenda"}»`}>
        <textarea rows={2} value={d.leyenda_comprobante} onChange={s("leyenda_comprobante")} disabled={!admin} maxLength={400} />
      </Campo>
      {d.regimen === "simplificado" && config?.aplicar_iva && (
        <p className="error-texto">En Precios está marcado que los precios incluyen IVA y el sistema lo resta para calcular la ganancia.
          En el régimen simplificado no se cobra IVA aparte en las ventas: revise esa opción arriba.</p>
      )}
      {admin && <div className="fila-botones izquierda"><button className="btn btn-primario" onClick={guardar} disabled={!cambiado}>Guardar datos</button></div>}
    </section>
  );
}
