/** Google Analytics 4 para el menú de clientes. La etiqueta la pone la función de Cloudflare en el HTML;
 *  si no está (por ejemplo en desarrollo), se carga aquí con VITE_GA_ID. */
declare global { interface Window { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void } }

export function iniciarAnalitica() {
  if (typeof window === "undefined" || window.gtag) return;
  const id = import.meta.env.VITE_GA_ID as string | undefined;
  if (!id || !/^G-[A-Z0-9]+$/.test(id)) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer!.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", id);
}

/** Evento de Analytics (no hace nada si Analytics no está activo). */
export function evento(nombre: string, datos: Record<string, unknown> = {}) {
  try { window.gtag?.("event", nombre, datos); } catch { /* sin analítica */ }
}
