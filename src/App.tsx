import { useEffect } from "react";
import { BrowserRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
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

function Shell() {
  const { usuario, cargando, salir, config } = useApp();
  useEffect(() => { document.title = `Costeo · ${config?.nombre_negocio || "Administración"}`; }, [config?.nombre_negocio]);
  if (cargando) return <Cargando texto="Abriendo…" />;
  if (!usuario) return <Login />;
  return (
    <div className="shell">
      <aside className="lateral">
        <div className="marca">
          <span className="marca-nombre">Costeo</span>
          <span className="marca-negocio">{config?.nombre_negocio}</span>
        </div>
        <nav aria-label="Secciones">
          <NavLink to="/admin" end>Inicio</NavLink>
          <NavLink to="/admin/recetas">Productos y recetas</NavLink>
          <NavLink to="/admin/ingredientes">Ingredientes</NavLink>
          <NavLink to="/admin/categorias">Categorías</NavLink>
          <NavLink to="/admin/proveedores">Proveedores</NavLink>
          <NavLink to="/admin/negocio">Menú y negocio</NavLink>
          <NavLink to="/admin/ajustes">Ajustes</NavLink>
        </nav>
        <div className="sesion">
          <span>{usuario.nombre || usuario.usuario}</span>
          <button className="link" onClick={salir}>Cerrar sesión</button>
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
        {/* Panel interno de costeo */}
        <Route path="/admin/*" element={<AppProvider><Shell /></AppProvider>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
