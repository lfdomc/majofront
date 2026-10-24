/** Gorro de chef en trazo (inspirado en el logo de Dolce Marju). Toma el color del texto. */
export default function GorroChef({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 100" aria-hidden="true" focusable="false">
      <g transform="rotate(-16 60 60)" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M31 70 C 15 67, 7 54, 15 45 C 21 38, 32 40, 35 48 C 31 31, 46 15, 64 17 C 71 6, 93 6, 99 21 C 113 25, 113 45, 101 53 C 99 61, 95 66, 91 70" />
        <path d="M29 70 L93 70 L90 85 Q 60 89 31 85 Z" />
        <path d="M53 63 C 51 53, 55 45, 61 41" />
        <path d="M67 64 C 67 54, 71 47, 77 43" />
        <path d="M81 64 C 83 57, 87 51, 92 49" />
      </g>
    </svg>
  );
}
