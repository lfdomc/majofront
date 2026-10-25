/**
 * Cloudflare Pages Function: SEO del menú.
 *
 * - Redirige al dominio principal (SITIO_URL, por ejemplo https://www.dolcemarju.com) para no duplicar páginas.
 * - En "/" (español) y "/en" (inglés) escribe en el HTML: título, descripción, idioma, enlaces hreflang,
 *   Open Graph, datos estructurados (Restaurant + Menu de schema.org), la etiqueta de Google Analytics y
 *   una versión en texto del menú para que Google la lea aunque no ejecute JavaScript.
 * - Sirve /sitemap.xml y /robots.txt, y marca /admin como "no indexar".
 *
 * Variables (Cloudflare Pages → Configuración → Variables):
 *   VITE_MENU_URL  dirección pública del bucket R2 (donde está menu.json)  — ya existe
 *   SITIO_URL      dominio principal, p. ej. https://www.dolcemarju.com    — recomendado
 *   GA_ID          ID de Google Analytics (G-…)                            — opcional
 */

const GA_POR_DEFECTO = "G-FZ2BC18WLC";

const TXT = {
  es: {
    locale: "es_CR", en: "en", menu: "Menú", precios: "Precios en colones",
    titulo: (n, cats, lugar) => `${n} · ${cats}${lugar ? ` en ${lugar}` : ""}`,
    desc: (n, lugar, prods) => `Vea el menú de ${n}${lugar ? ` en ${lugar}, Costa Rica` : ""}: ${prods}. Precios actualizados y pedidos por WhatsApp.`,
    pedir: "Pida por WhatsApp", horario: "Horario", direccion: "Dirección", tel: "Teléfono",
  },
  en: {
    locale: "en_US", en: "in", menu: "Menu", precios: "Prices in Costa Rican colones",
    titulo: (n, cats, lugar) => `${n} · ${cats}${lugar ? ` in ${lugar}, Costa Rica` : ""}`,
    desc: (n, lugar, prods) => `See the ${n} menu${lugar ? ` in ${lugar}, Costa Rica` : ""}: ${prods}. Up-to-date prices and orders on WhatsApp.`,
    pedir: "Order on WhatsApp", horario: "Hours", direccion: "Address", tel: "Phone",
  },
};

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const corta = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…");
const colones = (v) => "₡" + Math.round(v).toLocaleString("es-CR").replace(/\./g, " ");
const slug = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

const localidadDe = (lugar) => (lugar || "").split(",")[0].trim();

function telefonoInternacional(v) {
  const d = String(v || "").replace(/\D/g, "");
  if (!d) return "";
  return d.length === 8 ? `+506${d}` : `+${d}`;
}

function enlaceRed(tipo, v) {
  v = String(v || "").trim();
  if (!v) return null;
  if (/^https?:\/\//.test(v)) return v;
  const h = v.replace(/^@/, "");
  return { instagram: `https://www.instagram.com/${h}`, facebook: `https://www.facebook.com/${h}`, tiktok: `https://www.tiktok.com/@${h}` }[tipo] || null;
}

async function leerMenu(env, origen) {
  const base = (env.VITE_MENU_URL || "").replace(/\/$/, "");
  if (!base) return null;
  try {
    const r = await fetch(`${base}/menu.json`, { cf: { cacheTtl: 120, cacheEverything: true } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function datosPagina(menu, idioma, sitio) {
  const T = TXT[idioma];
  const en = idioma === "en";
  const n = menu.negocio || {};
  const nombre = n.nombre || "Menú";
  const lugar = n.lugar || "";
  const cats = (menu.categorias || []).map((c) => ({
    nombre: (en && c.nombre_en) || c.nombre,
    productos: (c.productos || []).map((p) => ({
      ...p, nombre: (en && p.nombre_en) || p.nombre, descripcion: (en && p.descripcion_en) || p.descripcion || "",
      foto: (en && p.foto_en) || p.foto,
    })),
  }));
  const nombresCat = cats.map((c) => c.nombre);
  const bajas = nombresCat.map((c, i) => (i === 0 ? c : c.toLowerCase()));
  const listaCats = bajas.length > 1 ? `${bajas.slice(0, -1).join(", ")} ${en ? "and" : "y"} ${bajas.at(-1)}` : (bajas[0] || T.menu);
  const prods = cats.flatMap((c) => c.productos.map((p) => p.nombre)).slice(0, 6).join(", ");
  let titulo = T.titulo(nombre, listaCats, lugar);
  if (titulo.length > 70) titulo = titulo.replace(/, Costa Rica$/, "");
  titulo = corta(titulo, 70);
  const propia = (en && n.descripcion_en) || (!en && n.descripcion) || "";
  const yaDiceLugar = localidadDe(lugar) && propia.toLowerCase().includes(localidadDe(lugar).toLowerCase());
  const descripcion = corta(propia ? `${propia} ${lugar && !yaDiceLugar ? (en ? `In ${lugar}, Costa Rica.` : `En ${lugar}, Costa Rica.`) : ""}`.trim()
    : T.desc(nombre, lugar, prods), 160);
  const url = `${sitio}${en ? "/en" : "/"}`;
  const imagen = `${sitio}/compartir.jpg`;

  // ---------- datos estructurados (schema.org)
  const [localidad, region] = lugar.split(",").map((s) => s.trim());
  const precios = cats.flatMap((c) => c.productos.map((p) => p.precio)).filter((v) => typeof v === "number" && v > 0);
  const redes = ["instagram", "facebook", "tiktok"].map((k) => enlaceRed(k, n[k])).filter(Boolean);
  const ld = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${sitio}/#negocio`,
    name: nombre,
    description: descripcion,
    url: sitio + "/",
    image: [imagen, ...(n.logo ? [n.logo] : [])],
    ...(n.logo ? { logo: n.logo } : {}),
    ...(telefonoInternacional(n.telefono || n.whatsapp) ? { telephone: telefonoInternacional(n.telefono || n.whatsapp) } : {}),
    ...(n.email ? { email: n.email } : {}),
    address: {
      "@type": "PostalAddress",
      ...(n.direccion ? { streetAddress: n.direccion } : {}),
      ...(localidad ? { addressLocality: localidad } : {}),
      ...(region ? { addressRegion: region } : {}),
      addressCountry: "CR",
    },
    areaServed: lugar ? `${lugar}, Costa Rica` : "Costa Rica",
    servesCuisine: nombresCat,
    ...(precios.length ? { priceRange: `${colones(Math.min(...precios))} – ${colones(Math.max(...precios))}` } : {}),
    currenciesAccepted: "CRC",
    ...(redes.length ? { sameAs: redes } : {}),
    ...(n.mapa && /^https?:/.test(n.mapa) ? { hasMap: n.mapa } : {}),
    acceptsReservations: false,
    hasMenu: {
      "@type": "Menu",
      name: `${nombre} · ${T.menu}`,
      inLanguage: idioma,
      url,
      hasMenuSection: cats.map((c) => ({
        "@type": "MenuSection",
        name: c.nombre,
        hasMenuItem: c.productos.map((p) => ({
          "@type": "MenuItem",
          name: p.nombre,
          ...(p.descripcion ? { description: p.descripcion } : {}),
          ...(p.foto ? { image: p.foto } : {}),
          ...(typeof p.precio === "number" ? { offers: { "@type": "Offer", price: p.precio, priceCurrency: "CRC" } } : {}),
        })),
      })),
    },
  };

  // ---------- menú en texto (lo ve Google y quien no tenga JavaScript; React lo reemplaza al cargar)
  const html = [
    `<div class="seo-previo">`,
    `<h1>${esc(nombre)}</h1>`,
    (en && n.eslogan_en) || n.eslogan ? `<p>${esc((en && n.eslogan_en) || n.eslogan)}</p>` : "",
    lugar ? `<p>${esc(lugar)}, Costa Rica</p>` : "",
    propia ? `<p>${esc(propia)}</p>` : "",
    ...cats.map((c) => `<section id="${slug(c.nombre)}"><h2>${esc(c.nombre)}</h2><ul>${c.productos.map((p) =>
      `<li><strong>${esc(p.nombre)}</strong>${typeof p.precio === "number" ? ` — ${colones(p.precio)}` : ""}${p.descripcion ? `<br>${esc(p.descripcion)}` : ""}</li>`).join("")}</ul></section>`),
    `<footer>`,
    n.direccion ? `<p>${T.direccion}: ${esc(n.direccion)}</p>` : "",
    ((en && n.horario_en) || n.horario) ? `<p>${T.horario}: ${esc((en && n.horario_en) || n.horario)}</p>` : "",
    n.telefono ? `<p>${T.tel}: ${esc(n.telefono)}</p>` : "",
    `<p>${T.precios}. <a href="${en ? "/" : "/en"}" hreflang="${en ? "es" : "en"}">${en ? "Ver en español" : "View in English"}</a></p>`,
    `</footer></div>`,
  ].join("");

  return { titulo, descripcion, url, imagen, ld, html, nombre };
}

function cabecera(d, idioma, sitio, gaId, menu) {
  const T = TXT[idioma];
  const alt = idioma === "en" ? "es_CR" : "en_US";
  return [
    `<meta name="seo-render" content="1">`,
    `<meta name="description" content="${esc(d.descripcion)}">`,
    `<link rel="canonical" href="${d.url}">`,
    `<link rel="alternate" hreflang="es" href="${sitio}/">`,
    `<link rel="alternate" hreflang="en" href="${sitio}/en">`,
    `<link rel="alternate" hreflang="x-default" href="${sitio}/">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(d.nombre)}">`,
    `<meta property="og:locale" content="${T.locale}">`,
    `<meta property="og:locale:alternate" content="${alt}">`,
    `<meta property="og:url" content="${d.url}">`,
    `<meta property="og:title" content="${esc(d.titulo)}">`,
    `<meta property="og:description" content="${esc(d.descripcion)}">`,
    `<meta property="og:image" content="${d.imagen}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="geo.region" content="CR">`,
    menu.negocio?.lugar ? `<meta name="geo.placename" content="${esc(menu.negocio.lugar)}">` : "",
    `<script type="application/ld+json">${JSON.stringify(d.ld).replace(/</g, "\\u003c")}</script>`,
    `<style>.seo-previo{max-width:760px;margin:0 auto;padding:32px 20px;font-family:system-ui,sans-serif;color:#3a2a30;line-height:1.5}.seo-previo h1{font-size:40px;margin:0 0 6px}.seo-previo h2{margin:28px 0 8px}.seo-previo ul{padding-left:18px}</style>`,
    ...etiquetaGA(gaId),
  ].join("");
}

function etiquetaGA(id) {
  if (!id || !/^G-[A-Z0-9]+$/.test(id)) return [];
  return [
    `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`,
    `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');</script>`,
  ];
}

function sitemap(sitio, menu) {
  const fecha = (menu?.publicado || new Date().toISOString()).slice(0, 10);
  const url = (loc) => `<url><loc>${sitio}${loc}</loc><lastmod>${fecha}</lastmod><changefreq>weekly</changefreq><priority>${loc === "/" ? "1.0" : "0.9"}</priority>`
    + `<xhtml:link rel="alternate" hreflang="es" href="${sitio}/"/><xhtml:link rel="alternate" hreflang="en" href="${sitio}/en"/>`
    + `<xhtml:link rel="alternate" hreflang="x-default" href="${sitio}/"/></url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`
    + url("/") + url("/en") + `</urlset>`;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const sitio = (env.SITIO_URL || url.origin).replace(/\/$/, "");
  const ruta = url.pathname.replace(/\/+$/, "") || "/";

  // Un solo dominio para Google (www o sin www, y la dirección de pages.dev, van al principal)
  if (env.SITIO_URL && request.method === "GET" && !url.hostname.includes("localhost")) {
    const principal = new URL(sitio);
    if (url.hostname !== principal.hostname && !url.hostname.endsWith(".pages.dev")) {
      return Response.redirect(`${principal.origin}${url.pathname}${url.search}`, 301);
    }
  }

  if (ruta === "/robots.txt") {
    return new Response(`User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${sitio}/sitemap.xml\n`,
      { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
  }
  if (ruta === "/sitemap.xml") {
    const menu = await leerMenu(env, url.origin);
    return new Response(sitemap(sitio, menu), { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
  }

  const res = await next();
  const tipo = res.headers.get("content-type") || "";
  if (!tipo.includes("text/html")) return res;

  // La administración no se indexa; la dirección de pages.dev tampoco (para no duplicar el sitio)
  if (ruta.startsWith("/admin") || url.hostname.endsWith(".pages.dev")) {
    const r = new Response(res.body, res);
    r.headers.set("X-Robots-Tag", "noindex, nofollow");
    return r;
  }
  if (request.method !== "GET") return res;
  if (!["/", "/en", "/menu"].includes(ruta)) return res;

  const idioma = ruta === "/en" ? "en" : "es";
  const gaId = env.GA_ID || GA_POR_DEFECTO;
  const menu = await leerMenu(env, url.origin);
  if (!menu) {
    // Sin menú publicado: al menos idioma y Analytics
    return new HTMLRewriter()
      .on("html", { element: (e) => e.setAttribute("lang", idioma) })
      .on("head", { element: (e) => e.append(etiquetaGA(gaId).join(""), { html: true }) })
      .transform(res);
  }
  const d = datosPagina(menu, idioma, sitio);
  const salida = new HTMLRewriter()
    .on("html", { element: (e) => e.setAttribute("lang", idioma) })
    .on("title", { element: (e) => e.setInnerContent(d.titulo) })
    .on('meta[name="description"]', { element: (e) => e.remove() })
    .on('meta[property^="og:"]', { element: (e) => e.remove() })
    .on('meta[name^="twitter:"]', { element: (e) => e.remove() })
    .on('link[rel="canonical"]', { element: (e) => e.remove() })
    .on("head", { element: (e) => e.append(cabecera(d, idioma, sitio, gaId, menu), { html: true }) })
    .on("#root", { element: (e) => e.setInnerContent(d.html, { html: true }) })
    .transform(res);
  const r = new Response(salida.body, salida);
  r.headers.set("Content-Language", idioma);
  r.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  return r;
}
