const entero = new Intl.NumberFormat("es-CR", { maximumFractionDigits: 0 });
const dec = (n: number) => new Intl.NumberFormat("es-CR", { minimumFractionDigits: n, maximumFractionDigits: n });

/** Colones sin decimales: ₡1 250 */
export function colones(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const r = Math.round(v);
  return (r < 0 ? "-" : "") + "₡" + entero.format(Math.abs(r));
}

/** Colones para costos unitarios pequeños: ₡0,656 */
export function colonesUnit(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (v >= 100) return "₡" + entero.format(v);
  if (v >= 10) return "₡" + dec(1).format(v);
  if (v >= 1) return "₡" + dec(2).format(v);
  return "₡" + dec(3).format(v);
}

export function num(v: number | null | undefined, d = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const r = Math.round(v * 10 ** d) / 10 ** d;
  return new Intl.NumberFormat("es-CR", { maximumFractionDigits: d }).format(r);
}

export function pct(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return num(v, 1) + " %";
}

export const UNIDAD_CORTA: Record<string, string> = {
  mg: "mg", g: "g", kg: "kg", oz: "oz", lb: "lb", ml: "ml", l: "L", oz_fl: "oz líq.",
  cdita: "cdita", cda: "cda", taza: "taza", gal: "gal", unidad: "unid.", docena: "doc.", porcion: "porción",
};

export function unidad(u: string | null | undefined, cantidad?: number | null) {
  if (u === "porcion" && cantidad !== undefined && cantidad !== null && cantidad !== 1) return "porciones";
  return u ? UNIDAD_CORTA[u] || u : "";
}

/** Texto de costo por unidad mínima con su equivalente práctico (por kg, por L). */
export function costoPorBase(v: number | null | undefined, base: string) {
  if (v === null || v === undefined) return "—";
  if (base === "g") return `${colonesUnit(v)}/g · ${colones(v * 1000)}/kg`;
  if (base === "ml") return `${colonesUnit(v)}/ml · ${colones(v * 1000)}/L`;
  return `${colonesUnit(v)}/unid.`;
}
