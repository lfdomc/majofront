import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

/**
 * Paisaje de Tilarán, Guanacaste: lomas con molinos de viento, la laguna de Arenal
 * y un árbol de guanacaste. Todos los colores salen de --marca (ver menu.css).
 */
function Molino({ x, y, escala = 1, vel = 6, desfase = 0 }: { x: number; y: number; escala?: number; vel?: number; desfase?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${escala})`}>
      <path d="M-3 0 L3 0 L1.6 -118 L-1.6 -118 Z" className="ps-torre" />
      <g transform="translate(0 -120)">
        <g className="ps-rotor" style={{ animationDuration: `${vel}s`, animationDelay: `-${desfase}s` }}>
          {[0, 120, 240].map((a) => (
            <path key={a} transform={`rotate(${a})`} d="M0 0 C 4 -10, 3.5 -40, 0.6 -64 L -0.6 -64 C -2.4 -40, -3 -10, 0 0 Z" className="ps-aspa" />
          ))}
        </g>
        <circle r="4.2" className="ps-cubo" />
      </g>
    </g>
  );
}

export default function Paisaje() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const lejos = useTransform(scrollY, [0, 600], [0, reduce ? 0 : 18]);
  const medio = useTransform(scrollY, [0, 600], [0, reduce ? 0 : 9]);

  return (
    <svg className="ps" viewBox="0 28 1440 212" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      {/* sol de la tarde, bajando detrás de las lomas */}
      <circle cx="1130" cy="118" r="92" className="ps-sol-halo" />
      <circle cx="1130" cy="118" r="54" className="ps-sol" />

      {/* nubes que pasan */}
      <g className="ps-nubes">
        <path d="M120 84 h110 a20 20 0 0 0 -30 -24 a30 30 0 0 0 -56 4 a18 18 0 0 0 -24 20 Z" className="ps-nube" />
        <path d="M700 70 h90 a16 16 0 0 0 -26 -20 a26 26 0 0 0 -46 4 a15 15 0 0 0 -18 16 Z" className="ps-nube" />
      </g>

      {/* lomas lejanas con los molinos (las de Tilarán) */}
      <motion.g style={{ y: lejos }}>
        <path d="M0 150 C 160 120, 300 112, 470 128 S 760 150, 930 122 S 1240 100, 1440 122 L1440 240 L0 240 Z" className="ps-loma-1" />
        <Molino x={250} y={126} escala={0.4} vel={7} desfase={1} />
        <Molino x={350} y={121} escala={0.336} vel={6} desfase={3} />
        <Molino x={590} y={136} escala={0.368} vel={8} desfase={2} />
        <Molino x={880} y={126} escala={0.416} vel={6.5} desfase={4} />
        <Molino x={1010} y={113} escala={0.36} vel={7.5} desfase={0.5} />
        <Molino x={1290} y={109} escala={0.4} vel={6} desfase={2.5} />
      </motion.g>

      {/* laguna de Arenal */}
      <motion.g style={{ y: medio }}>
        <path d="M0 168 C 300 160, 700 166, 1000 160 S 1300 156, 1440 162 L1440 205 L0 205 Z" className="ps-laguna" />
        <g className="ps-brillos">
          <rect x="140" y="174" width="70" height="3" rx="1.5" />
          <rect x="420" y="182" width="46" height="3" rx="1.5" />
          <rect x="760" y="172" width="86" height="3" rx="1.5" />
          <rect x="1120" y="178" width="54" height="3" rx="1.5" />
        </g>
        <path d="M0 192 C 220 176, 420 182, 640 194 S 1000 204, 1180 186 S 1380 178, 1440 182 L1440 240 L0 240 Z" className="ps-loma-2" />
      </motion.g>

      {/* árbol de guanacaste, de copa ancha */}
      <g className="ps-arbol" transform="translate(1180 216) scale(0.55)">
        <path d="M-8 0 L-5 -70 C -30 -78, -60 -80, -80 -86 M 5 -70 L 8 0 M -3 -66 C 10 -82, 40 -88, 70 -92" className="ps-tronco" />
        <path d="M-6 0 L-4 -72 L4 -72 L7 0 Z" className="ps-tronco-relleno" />
        <path d="M-170 -92 C -150 -132, -90 -150, -40 -146 C -10 -168, 50 -166, 80 -146 C 130 -150, 180 -128, 190 -96 C 140 -84, 60 -88, 10 -84 C -50 -82, -120 -80, -170 -92 Z" className="ps-copa" />
      </g>

      {/* pasto del frente */}
      <path d="M0 222 C 240 210, 520 216, 760 222 S 1180 210, 1440 218 L1440 240 L0 240 Z" className="ps-pasto" />
    </svg>
  );
}
