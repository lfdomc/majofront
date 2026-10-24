/** Convierte lo que la persona escribe (usuario, @usuario o enlace) en un enlace válido. */
const limpiar = (v: string) => v.trim().replace(/^@/, "");

export function enlaceRed(red: "instagram" | "facebook" | "tiktok" | "web", valor: string) {
  const v = limpiar(valor);
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (red === "web") return `https://${v}`;
  if (/\.(com|net|org)/i.test(v)) return `https://${v}`;
  if (red === "instagram") return `https://instagram.com/${v}`;
  if (red === "facebook") return `https://facebook.com/${v}`;
  return `https://www.tiktok.com/@${v}`;
}

/** Número de WhatsApp para wa.me: agrega 506 si es un número de 8 dígitos de Costa Rica. */
export function enlaceWhatsapp(numero: string, mensaje?: string) {
  let n = numero.replace(/\D/g, "");
  if (!n) return null;
  if (n.length === 8) n = "506" + n;
  return `https://wa.me/${n}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;
}

export function textoRed(valor: string) {
  const v = limpiar(valor);
  if (/^https?:\/\//i.test(v)) return v.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
  return v.startsWith("@") ? v : `@${v}`;
}
