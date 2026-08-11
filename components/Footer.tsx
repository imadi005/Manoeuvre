import Image from "next/image";

export default function Footer() {
  return (
    <footer className="relative border-t border-panel-line bg-void px-5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center">
        <div className="relative h-8 w-36">
          <Image src="/logo.png" alt="MANŒUVRE 2026" fill sizes="144px" className="object-contain" />
        </div>
        <p className="font-mono-fx text-[11px] uppercase tracking-widest text-fog-dim">
          Kristu Jayanti Institute of Technology · 21st Edition · 17–24 August 2026
        </p>
        <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim/60">
          System Override — Grid Active
        </p>
      </div>
    </footer>
  );
}
