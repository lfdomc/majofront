import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, getToken, setToken, setUnauthorizedHandler } from "./api";
import type { Config, UnidadInfo, Usuario } from "./types";

type Ctx = {
  usuario: Usuario | null;
  cargando: boolean;
  unidades: UnidadInfo[];
  config: Config | null;
  ingresar: (u: string, c: string) => Promise<void>;
  salir: () => void;
  recargarConfig: () => Promise<void>;
  aviso: (msg: string, tipo?: "ok" | "error") => void;
};

const C = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(C);

export function AppProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [unidades, setUnidades] = useState<UnidadInfo[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: string; id: number } | null>(null);

  const salir = useCallback(() => { setToken(null); setUsuario(null); }, []);
  useEffect(() => setUnauthorizedHandler(() => setUsuario(null)), []);

  const cargarBase = useCallback(async () => {
    const [u, cfg] = await Promise.all([api<UnidadInfo[]>("/api/unidades"), api<Config>("/api/configuracion")]);
    setUnidades(u);
    setConfig(cfg);
  }, []);

  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          setUsuario(await api<Usuario>("/api/auth/yo"));
          await cargarBase();
        } catch (e) {
          // solo cerrar la sesión si el servidor la rechazó; sin internet se conserva
          if (e instanceof ApiError && e.status === 401) setToken(null);
        }
      }
      setCargando(false);
    })();
  }, [cargarBase]);

  const ingresar = async (u: string, c: string) => {
    const r = await api<{ token: string; usuario: Usuario }>("/api/auth/ingresar", { body: { usuario: u, clave: c } });
    setToken(r.token);
    await cargarBase();
    setUsuario(r.usuario);
  };

  const aviso = useCallback((msg: string, tipo: "ok" | "error" = "ok") => {
    const id = Date.now();
    setToast({ msg, tipo, id });
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), tipo === "error" ? 6000 : 2800);
  }, []);

  const recargarConfig = async () => setConfig(await api<Config>("/api/configuracion"));

  return (
    <C.Provider value={{ usuario, cargando, unidades, config, ingresar, salir, recargarConfig, aviso }}>
      {children}
      {toast && <div className={`toast toast-${toast.tipo}`} role="status">{toast.msg}</div>}
    </C.Provider>
  );
}

/** Unidades que se pueden usar con un ingrediente según su unidad base y conversiones definidas. */
export function unidadesCompatibles(unidades: UnidadInfo[], base: string, peso?: number | null, dens?: number | null) {
  const dimBase = unidades.find((u) => u.clave === base)?.dimension || "masa";
  // Todas las conversiones pasan por gramos: una dimensión es alcanzable si tiene enlace con la masa.
  const enlace: Record<string, boolean> = { masa: true, volumen: !!dens, unidad: !!peso };
  const dims = new Set<string>([dimBase]);
  if (enlace[dimBase]) Object.entries(enlace).forEach(([d, ok]) => ok && dims.add(d));
  return unidades.filter((u) => dims.has(u.dimension));
}
