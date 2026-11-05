import { useState } from "react";
import type { Hat } from "../lib/drawChar";
import { CharPreview } from "./CharPreview";
import type { Gender } from "../types";

const hats: Hat[] = ["none", "star", "cap", "bow"];

export function CustomizeScreen({ gender, hat, onSave }: { gender: Gender; hat: Hat; onSave: (hat: Hat) => void }) {
  const [selectedHat, setSelectedHat] = useState<Hat>(hat);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-4"
      style={{ background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)", color: "#fff" }}>
      <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(1.5rem,6vw,2.2rem)" }}>
        Customize Your Character
      </h2>
      <CharPreview gender={gender} hat={selectedHat} style={{ width: 99, height: 135 }} />
      <div className="flex gap-3 flex-wrap justify-center">
        {hats.map((h) => (
          <button
            key={h}
            className={`px-4 py-3 border-2 rounded-xl font-bold ${
              h === selectedHat ? "border-white bg-white/20" : "border-slate-600"
            }`}
            onClick={() => setSelectedHat(h)}
          >
            {h === "none" ? "No Hat" : h.charAt(0).toUpperCase() + h.slice(1)}
          </button>
        ))}
      </div>
      <button
        className="bg-emerald-600 text-white py-3 px-8 rounded-xl font-bold"
        onClick={() => onSave(selectedHat)}
      >
        Save
      </button>
    </div>
  );
}
