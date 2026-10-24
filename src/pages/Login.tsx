import { useState } from "react";
import { useApp } from "../store";

export default function Login() {
  const { ingresar } = useApp();
  const [u, setU] = useState("");
  const [c, setC] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      await ingresar(u.trim(), c);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login">
      <div className="login-lado">
        <h1>Cuánto cuesta<br />cada producto</h1>
        <p>Del precio de compra al gramo servido, con la merma incluida.</p>
        <div className="login-ejemplo" aria-hidden="true">
          <div><span>Sandía entera 4 kg</span><b>₡1 600</b></div>
          <div><span>Pulpa limpia 3 200 g</span><b>−20 % merma</b></div>
          <div className="fin"><span>Costo real</span><b>₡0,50 por gramo</b></div>
        </div>
      </div>
      <form className="login-form" onSubmit={enviar}>
        <h2>Ingresar</h2>
        <label className="campo">
          <span className="campo-label">Usuario</span>
          <input value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" autoFocus required />
        </label>
        <label className="campo">
          <span className="campo-label">Contraseña</span>
          <input type="password" value={c} onChange={(e) => setC(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <div className="error-caja" role="alert">{error}</div>}
        <button className="btn btn-primario" disabled={enviando}>{enviando ? "Ingresando…" : "Ingresar"}</button>
      </form>
    </div>
  );
}
