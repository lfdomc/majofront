import { useEffect, useState } from "react";
import { api } from "../api";
import { Cargando, Confirmar, ErrorCaja } from "../components";
import { useApp } from "../store";
import type { Proveedor } from "../types";

export default function Proveedores() {
  const { aviso } = useApp();
  const [lista, setLista] = useState<Proveedor[] | null>(null);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState<Partial<Proveedor> | null>(null);
  const [borrar, setBorrar] = useState<Proveedor | null>(null);
  const cargar = () => api<Proveedor[]>("/api/proveedores").then(setLista).catch((e) => setErr(e.message));
  useEffect(() => { cargar(); }, []);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    try {
      const body = { nombre: edit.nombre || "", contacto: edit.contacto || "", notas: edit.notas || "" };
      if (edit.id) await api(`/api/proveedores/${edit.id}`, { method: "PUT", body });
      else await api("/api/proveedores", { body });
      aviso("Proveedor guardado"); setEdit(null); cargar();
    } catch (e: any) { aviso(e.message, "error"); }
  };
  const eliminar = async () => {
    if (!borrar) return;
    try { await api(`/api/proveedores/${borrar.id}`, { method: "DELETE" }); aviso("Proveedor borrado"); cargar(); }
    catch (e: any) { aviso(e.message, "error"); }
    setBorrar(null);
  };

  if (err) return <ErrorCaja msg={err} />;
  if (!lista) return <Cargando />;
  return (
    <>
      <header className="encabezado">
        <div><h1>Proveedores</h1><p className="sub">Dónde compra. Cada presentación de un ingrediente puede tener su proveedor para comparar precios.</p></div>
        <button className="btn btn-primario" onClick={() => setEdit({})}>Nuevo proveedor</button>
      </header>
      {edit && (
        <form className="tarjeta-form" onSubmit={guardar}>
          <label className="campo"><span className="campo-label">Nombre</span><input value={edit.nombre || ""} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} required autoFocus /></label>
          <label className="campo"><span className="campo-label">Contacto</span><input value={edit.contacto || ""} placeholder="Teléfono, WhatsApp, dirección" onChange={(e) => setEdit({ ...edit, contacto: e.target.value })} /></label>
          <label className="campo"><span className="campo-label">Notas</span><input value={edit.notas || ""} onChange={(e) => setEdit({ ...edit, notas: e.target.value })} /></label>
          <div className="fila-botones"><button type="button" className="btn" onClick={() => setEdit(null)}>Cancelar</button><button className="btn btn-primario">Guardar proveedor</button></div>
        </form>
      )}
      <div className="tabla-envoltura">
        <table className="tabla">
          <thead><tr><th>Proveedor</th><th>Contacto</th><th className="n">Precios registrados</th><th /></tr></thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id}>
                <td className="fuerte">{p.nombre}</td>
                <td className="tenue">{p.contacto}</td>
                <td className="n">{p.presentaciones}</td>
                <td className="n acciones"><button className="link" onClick={() => setEdit(p)}>Editar</button> <button className="link peligro" onClick={() => setBorrar(p)}>Borrar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {borrar && <Confirmar texto={`¿Borrar a «${borrar.nombre}»? Sus precios se conservan pero quedan sin proveedor.`} onSi={eliminar} onNo={() => setBorrar(null)} />}
    </>
  );
}
