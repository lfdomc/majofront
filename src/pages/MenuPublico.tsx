import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { api, mediaUrl } from "../api";
import { colones } from "../format";
import { enlaceRed, enlaceWhatsapp, textoRed } from "../social";
import type { MenuPublico as Menu } from "../types";
import "@fontsource/allura/400.css";
import "../menu.css";
import Paisaje from "./Paisaje";
import GorroChef from "./GorroChef";

type Producto = Menu["categorias"][number]["productos"][number];

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
const ENTRA = [0.16, 1, 0.3, 1] as const;

/** Aparición al entrar en pantalla: sube y se aclara. Sin movimiento si la persona lo pidió. */
function Aparece({ children, delay = 0, className, as = "div" }: { children: ReactNode; delay?: number; className?: string; as?: "div" | "li" | "article" }) {
  const reduce = useReducedMotion();
  const M = motion[as];
  if (reduce) return <M className={className}>{children}</M>;
  return (
    <M className={className} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
       viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.6, delay, ease: ENTRA }}>
      {children}
    </M>
  );
}

/** Foto que se descubre como una cortina que sube, con un leve acercamiento. */
function FotoRevelada({ src, alt }: { src: string; alt: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <img src={src} alt={alt} loading="lazy" />;
  return (
    <motion.div className="mp-foto-marco" initial={{ clipPath: "inset(18% 0 0 0 round 0px)" }}
      whileInView={{ clipPath: "inset(0% 0 0 0 round 0px)" }} viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.8, ease: ENTRA }}>
      <motion.img src={src} alt={alt} loading="lazy" initial={{ scale: 1.12 }} whileInView={{ scale: 1 }}
        viewport={{ once: true, amount: 0.3 }} transition={{ duration: 1.1, ease: ENTRA }} />
    </motion.div>
  );
}

/** Titular de portada: cada palabra sube desde una ranura. */
function TituloCinetico({ texto }: { texto: string }) {
  const reduce = useReducedMotion();
  const palabras = texto.split(" ");
  return (
    <h1 aria-label={texto}>
      {palabras.map((p, i) => (
        <span key={i} aria-hidden="true" className="mp-ranura">
          <motion.span className="mp-palabra" initial={reduce ? false : { y: "108%" }} animate={{ y: "0%" }}
            transition={{ duration: 0.8, delay: 0.15 + i * 0.07, ease: ENTRA }}>
            {p}{i < palabras.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

export default function MenuPublico() {
  const [m, setM] = useState<Menu | null>(null);
  const [err, setErr] = useState("");
  const [activa, setActiva] = useState("");
  const [abierto, setAbierto] = useState(false);
  const botonMenu = useRef<HTMLButtonElement>(null);

  // Menú de hamburguesa (celular): cerrar con Escape y bloquear el fondo mientras está abierto
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("keydown", tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", tecla); document.body.style.overflow = antes; botonMenu.current?.focus(); };
  }, [abierto]);
  const chips = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    // Primero el menú publicado en Cloudflare R2 (no despierta al servidor); si no está, se pide al servidor.
    const publicado = (import.meta.env.VITE_MENU_URL || "").replace(/\/$/, "");
    const cargar = publicado
      ? fetch(`${publicado}/menu.json`, { cache: "no-cache" })
          .then((r) => (r.ok ? (r.json() as Promise<Menu>) : Promise.reject()))
          .catch(() => api<Menu>("/api/publico/menu"))
      : api<Menu>("/api/publico/menu");
    cargar.then((d) => {
      setM(d);
      setActiva(d.categorias[0]?.nombre || "");
      document.title = `${d.negocio.nombre || "Menú"} · Menú`;
    }).catch(() => setErr("No pudimos cargar el menú. Intente de nuevo en un momento."));
  }, []);


  // Categoría visible mientras se desplaza
  useEffect(() => {
    if (!m) return;
    const obs = new IntersectionObserver((entradas) => {
      const vis = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActiva(vis.target.getAttribute("data-cat") || "");
    }, { rootMargin: "-90px 0px -55% 0px" });
    document.querySelectorAll("[data-cat]").forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [m]);

  useEffect(() => {
    const el = chips.current?.querySelector<HTMLElement>(`[data-chip="${slug(activa)}"]`);
    const cont = chips.current;
    if (el && cont) cont.scrollTo({ left: el.offsetLeft - cont.clientWidth / 2 + el.clientWidth / 2, behavior: reduce ? "auto" : "smooth" });
  }, [activa, reduce]);

  if (err) return <div className="mp-estado">{err}</div>;
  if (!m) return <div className="mp-estado" aria-live="polite"><span className="mp-cargando" />Cargando menú…</div>;

  const n = m.negocio;
  const modo = n.distintivo || "logo";
  const saludo = `¡Hola! Quiero consultarle sobre ${n.nombre || "su menú"}`;
  const wa = enlaceWhatsapp(n.whatsapp, saludo);
  const tel = n.telefono.replace(/[^\d+]/g, "");
  const estilo = { "--marca": /^#[0-9a-f]{6}$/i.test(n.color) ? n.color : "#D94C72" } as CSSProperties;
  const redes = ([["instagram", "Instagram"], ["facebook", "Facebook"], ["tiktok", "TikTok"]] as const)
    .filter(([k]) => n[k]).map(([k, label]) => ({ label, url: enlaceRed(k, n[k])!, texto: textoRed(n[k]) }));
  const web = n.sitio_web ? enlaceRed("web", n.sitio_web) : null;
  const mapa = n.mapa ? (n.mapa.startsWith("http") ? n.mapa : null)
    : n.direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(n.direccion)}` : null;
  const pedir = (p: Producto) => enlaceWhatsapp(n.whatsapp, `¡Hola! Quiero pedir: ${p.nombre}`)!;
  const irA = (c: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(slug(c))?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="mp" style={estilo}>
        <header className="mp-hero">
          <Paisaje />
          <div className={"mp-hero-in" + (modo === "logo" ? "" : " sin-logo")}>
            {modo === "logo" && (
              <motion.div className="mp-logo-caja" initial={reduce ? false : { scale: 0.6, opacity: 0, rotate: -12 }} animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 160, damping: 16, delay: 0.05 }}>
                {n.logo ? <img className="mp-logo" src={mediaUrl(n.logo)!} alt={`Logo de ${n.nombre}`} />
                  : <div className="mp-logo mp-logo-letra" aria-hidden="true">{(n.nombre || "M").slice(0, 1)}</div>}
              </motion.div>
            )}
            <div className="mp-hero-texto">
              {n.lugar && (
                <motion.p className="mp-lugar" initial={reduce ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.1, ease: ENTRA }}>
                  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>
                  {n.lugar}
                </motion.p>
              )}
              {modo === "gorro" ? (
                <div className="mp-nombre-gorro">
                  <motion.span className="mp-gorro" initial={reduce ? false : { y: -40, rotate: -30, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 140, damping: 12, delay: 0.7 }}>
                    <GorroChef />
                  </motion.span>
                  <TituloCinetico texto={n.nombre || "Nuestro menú"} />
                </div>
              ) : <TituloCinetico texto={n.nombre || "Nuestro menú"} />}
              <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4, ease: ENTRA }}>
                {n.eslogan && <p className="mp-eslogan">{n.eslogan}</p>}
                {n.horario && <p className="mp-horario">{n.horario}</p>}
              </motion.div>
            </div>
            <motion.div className="mp-acciones" initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55, ease: ENTRA }}>
              {m.categorias.length > 0 && <motion.a whileTap={{ scale: 0.96 }} className="mp-btn mp-btn-lleno" href={`#${slug(m.categorias[0].nombre)}`} onClick={irA(m.categorias[0].nombre)}>Ver el menú</motion.a>}
              {tel && <motion.a whileTap={{ scale: 0.96 }} className="mp-btn" href={`tel:${tel}`}>Llamar</motion.a>}
            </motion.div>
          </div>
          <button ref={botonMenu} type="button" className="mp-hamburguesa" aria-label="Abrir menú" aria-expanded={abierto} aria-controls="mp-panel"
            onClick={() => setAbierto(true)}>
            <span /><span /><span />
          </button>
        </header>

        {m.categorias.length > 1 && (
          <nav className="mp-chips" ref={chips} aria-label="Categorías">
            {m.categorias.map((c) => {
              const on = c.nombre === activa;
              return (
                <a key={c.nombre} data-chip={slug(c.nombre)} href={`#${slug(c.nombre)}`} onClick={irA(c.nombre)}
                   className={on ? "activa" : ""} aria-current={on ? "true" : undefined}>
                  {on && <motion.span layoutId="chip-activo" className="mp-chip-fondo" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                  <span className="mp-chip-texto">{c.nombre}</span>
                </a>
              );
            })}
          </nav>
        )}

        <main className="mp-cuerpo">
          {n.descripcion && <Aparece><p className="mp-intro">{n.descripcion}</p></Aparece>}
          {m.categorias.length === 0 && <p className="mp-vacio">Pronto publicaremos nuestro menú.</p>}
          {m.categorias.map((c) => {
            const conFoto = c.productos.filter((p) => p.foto);
            const sinFoto = c.productos.filter((p) => !p.foto);
            return (
              <section key={c.nombre} id={slug(c.nombre)} data-cat={c.nombre} className="mp-cat">
                <div className="mp-cat-cabeza">
                  <h2>{c.nombre}</h2>
                  <span className="mp-cat-conteo">{c.productos.length} {c.productos.length === 1 ? "opción" : "opciones"}</span>
                </div>

                {conFoto.length > 0 && (
                  <div className="mp-galeria">
                    {conFoto.map((p, i) => (
                      <Aparece as="article" key={p.id} delay={Math.min(i * 0.07, 0.28)}
                               className={"mp-tarjeta" + (p.es_arte ? " es-arte" : "")}>
                        <FotoRevelada src={mediaUrl(p.foto)!} alt={p.es_arte ? "" : p.nombre} />
                        <div className="mp-tarjeta-texto">
                          {p.es_arte ? (
                            /* el nombre y el precio ya van dentro de la imagen: aquí solo para lectores de pantalla */
                            <h3 className="mp-oculto">{p.nombre}{p.precio != null ? `, ${colones(p.precio)}` : ""}</h3>
                          ) : (
                            <div className="mp-fila-titulo">
                              <h3>{p.nombre}</h3>
                              {p.precio != null && <span className="mp-precio">{colones(p.precio)}</span>}
                            </div>
                          )}
                          {p.descripcion && <p>{p.descripcion}</p>}
                          {wa && <motion.a whileTap={{ scale: 0.96 }} className="mp-pedir" href={pedir(p)} target="_blank" rel="noopener">Pedir este</motion.a>}
                        </div>
                      </Aparece>
                    ))}
                  </div>
                )}

                {sinFoto.length > 0 && (
                  <ul className="mp-carta">
                    {sinFoto.map((p, i) => (
                      <Aparece as="li" key={p.id} delay={Math.min(i * 0.05, 0.25)}>
                        <div className="mp-linea">
                          <h3>{p.nombre}</h3>
                          {p.precio != null && <><span className="mp-puntos" aria-hidden="true" /><span className="mp-precio-linea">{colones(p.precio)}</span></>}
                        </div>
                        {p.descripcion && <p>{p.descripcion}</p>}
                        {wa && <a className="mp-pedir" href={pedir(p)} target="_blank" rel="noopener">Pedir este</a>}
                      </Aparece>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </main>

        {wa && (
          <motion.a className="mp-flotante" href={wa!} target="_blank" rel="noopener"
            aria-label={`Escribir por WhatsApp al ${n.whatsapp}`} layout
            initial={reduce ? false : { y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 260, damping: 24, delay: reduce ? 0 : 0.9 }}>
            <motion.svg layout="position" viewBox="0 0 24 24" aria-hidden="true" width="32" height="32"><path fill="currentColor" d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3zm0 16.2a7.2 7.2 0 0 1-3.7-1l-.3-.2-2.7.7.7-2.6-.2-.3A7.2 7.2 0 1 1 12 19.2zm4-5.4c-.2-.1-1.3-.7-1.5-.7-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a5.9 5.9 0 0 1-2.9-2.6c-.2-.4.2-.4.6-1.2.1-.1 0-.3 0-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.4a.8.8 0 0 0-.6.3 2.4 2.4 0 0 0-.8 1.8 4.2 4.2 0 0 0 .9 2.2 9.6 9.6 0 0 0 3.7 3.3c1.4.6 1.9.6 2.6.5.4-.1 1.3-.5 1.5-1s.2-.9.1-1z"/></motion.svg>
          </motion.a>
        )}

        <AnimatePresence>
          {abierto && (
            <>
              <motion.div key="velo" className="mp-velo" onClick={() => setAbierto(false)}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
              <motion.nav key="panel" id="mp-panel" className="mp-panel" role="dialog" aria-modal="true" aria-label="Menú"
                initial={reduce ? { opacity: 0 } : { x: "100%" }} animate={reduce ? { opacity: 1 } : { x: 0 }} exit={reduce ? { opacity: 0 } : { x: "100%" }}
                transition={{ type: "spring", stiffness: 320, damping: 34 }}>
                <div className="mp-panel-cabeza">
                  <span className="mp-panel-nombre">{n.nombre}</span>
                  <button type="button" className="mp-cerrar" aria-label="Cerrar menú" onClick={() => setAbierto(false)} autoFocus>×</button>
                </div>
                {m.categorias.length > 0 && (
                  <div className="mp-panel-grupo">
                    <span className="mp-panel-titulo">Ver el menú</span>
                    {m.categorias.map((c) => (
                      <a key={c.nombre} href={`#${slug(c.nombre)}`} onClick={(e) => { setAbierto(false); irA(c.nombre)(e); }}>
                        {c.nombre}<small>{c.productos.length}</small>
                      </a>
                    ))}
                  </div>
                )}
                {(tel || mapa || n.email) && <div className="mp-panel-grupo">
                  <span className="mp-panel-titulo">Contacto</span>
                  {tel && <a href={`tel:${tel}`}>Llamar<small>{n.telefono}</small></a>}
                  {mapa && <a href={mapa} target="_blank" rel="noopener">Cómo llegar<small>{n.lugar || "Mapa"}</small></a>}
                  {n.email && <a href={`mailto:${n.email}`}>Correo<small>{n.email}</small></a>}
                </div>}
                {redes.length > 0 && (
                  <div className="mp-panel-grupo">
                    <span className="mp-panel-titulo">Redes</span>
                    {redes.map((r) => <a key={r.label} href={r.url} target="_blank" rel="noopener">{r.label}<small>{r.texto}</small></a>)}
                  </div>
                )}
                {n.horario && <p className="mp-panel-horario">{n.horario}</p>}
              </motion.nav>
            </>
          )}
        </AnimatePresence>

        <footer className="mp-pie">
          <div className="mp-pie-in">
            <Aparece><h2>Visítenos</h2></Aparece>
            <dl>
              {n.direccion && <div><dt>Dirección</dt><dd>{n.direccion}{mapa && <><br /><a href={mapa} target="_blank" rel="noopener">Ver en el mapa</a></>}</dd></div>}
              {n.horario && <div><dt>Horario</dt><dd>{n.horario}</dd></div>}
              {n.telefono && <div><dt>Teléfono</dt><dd><a href={`tel:${tel}`}>{n.telefono}</a></dd></div>}
              {n.whatsapp && <div><dt>WhatsApp</dt><dd><a href={wa!} target="_blank" rel="noopener">{n.whatsapp}</a></dd></div>}
              {n.email && <div><dt>Correo</dt><dd><a href={`mailto:${n.email}`}>{n.email}</a></dd></div>}
              {web && <div><dt>Sitio web</dt><dd><a href={web} target="_blank" rel="noopener">{textoRed(n.sitio_web).replace(/^@/, "")}</a></dd></div>}
            </dl>
            {redes.length > 0 && (
              <ul className="mp-redes" aria-label="Redes sociales">
                {redes.map((r) => <li key={r.label}><a href={r.url} target="_blank" rel="noopener"><b>{r.label}</b><span>{r.texto}</span></a></li>)}
              </ul>
            )}
            <p className="mp-despedida" aria-hidden="true">{n.nombre}</p>
            <p className="mp-legal">Precios en colones. <a className="mp-admin" href="/admin">Administración</a> <span className="mp-version">· versión 24-oct</span></p>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
