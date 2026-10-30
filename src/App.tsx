import { useEffect, useState } from "react";
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Cargando } from "./components";
import { AppProvider, useApp } from "./store";
import Login from "./pages/Login";
import Inicio from "./pages/Inicio";
import Recetas from "./pages/Recetas";
import RecetaEditor from "./pages/RecetaEditor";
import Ingredientes from "./pages/Ingredientes";
import IngredienteEditor from "./pages/IngredienteEditor";
import Proveedores from "./pages/Proveedores";
import Ajustes from "./pages/Ajustes";
import MenuPublico from "./pages/MenuPublico";
import Negocio from "./pages/Negocio";
import Categorias from "./pages/Categorias";
import Compras from "./pages/Compras";
import CostosNegocio from "./pages/CostosNegocio";
import Pos from "./pos/Pos";
import Ventas from "./pages/Ventas";

function Shell() {
  const { usuario, cargando, salir, config } = useApp();
  const [abierto, setAbierto] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { document.title = `Costeo · ${config?.nombre_negocio || "Administración"}`; }, [config?.nombre_negocio]);
  useEffect(() => { setAbierto(false); }, [pathname]);
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [abierto]);
  if (cargando) return <Cargando texto="Abriendo…" />;
  if (!usuario) return <Login />;
  return (
    <div className="shell">
      <aside className={"lateral" + (abierto ? " abierto" : "")}>
        <div className="marca">
          <span className="marca-nombre">Costeo</span>
          <span className="marca-negocio">{config?.nombre_negocio}</span>
        </div>
        <button className="hamburguesa" aria-label={abierto ? "Cerrar menú" : "Abrir menú"} aria-expanded={abierto}
                aria-controls="menu-admin" onClick={() => setAbierto(!abierto)}>
          <span /><span /><span />
        </button>
        <div className="velo" onClick={() => setAbierto(false)} aria-hidden="true" />
        <div className="panel-nav" id="menu-admin">
        <nav aria-label="Secciones">
          <NavLink to="/admin" end>Inicio</NavLink>
          <a className="nav-caja" href="/pos">Abrir la caja (POS) ↗</a>
          <NavLink to="/admin/recetas">Productos y recetas</NavLink>
          <NavLink to="/admin/ingredientes">Ingredientes</NavLink>
          <NavLink to="/admin/ventas">Ventas</NavLink>
          <NavLink to="/admin/costos">Costos del negocio</NavLink>
          <NavLink to="/admin/compras">Lista de compras</NavLink>
          <NavLink to="/admin/categorias">Categorías</NavLink>
          <NavLink to="/admin/proveedores">Proveedores</NavLink>
          <NavLink to="/admin/negocio">Menú y negocio</NavLink>
          <NavLink to="/admin/ajustes">Ajustes</NavLink>
        </nav>
        <div className="sesion">
          <span>{usuario.nombre || usuario.usuario}</span>
          <button className="link" onClick={salir}>Cerrar sesión</button>
        </div>
        </div>
      </aside>
      <main className="contenido">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/recetas" element={<Recetas />} />
          <Route path="/recetas/nueva" element={<RecetaEditor />} />
          <Route path="/recetas/:id" element={<RecetaEditor />} />
          <Route path="/ingredientes" element={<Ingredientes />} />
          <Route path="/ingredientes/nuevo" element={<IngredienteEditor />} />
          <Route path="/ingredientes/:id" element={<IngredienteEditor />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/categorias" element={<Categorias />} />
          <Route path="/compras" element={<Compras />} />
          <Route path="/costos" element={<CostosNegocio />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="/negocio" element={<Negocio />} />
          <Route path="*" element={<Navigate to="/admin" />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Página principal: el menú para clientes (no pide usuario) */}
        <Route path="/" element={<MenuPublico />} />
        <Route path="/menu" element={<MenuPublico />} />
        <Route path="/en" element={<MenuPublico key="en" idioma="en" />} />
        {/* Caja (POS): instalable en el teléfono y funciona sin internet */}
        <Route path="/pos/*" element={<Pos />} />
        {/* Panel interno de costeo */}
        <Route path="/admin/*" element={<AppProvider><Shell /></AppProvider>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
