import React, { useState } from "react";
import { Hat } from "../lib/drawChar";

const hats: Hat[] = ["none", "star", "cap", "bow"];

export function CustomizeScreen({ onClose }: { onClose: () => void }) {
  const [selectedHat, setSelectedHat] = useState<Hat>(
    (localStorage.getItem("climber_accessory") as Hat) || "none"
  );

  const handleSave = () => {
    localStorage.setItem("climber_accessory", selectedHat);
    onClose();
  };

  return (
    <div className="p-4 flex flex-col items-center">
      <h2 className="text-xl font-bold mb-4">Customize Your Character</h2>
      <div className="flex gap-4 mb-4">
        {hats.map((h) => (
          <button
            key={h}
            className={`p-2 border rounded-md ${
              h === selectedHat ? "border-blue-500" : "border-gray-300"
            }`}
            onClick={() => setSelectedHat(h)}
          >
            {h === "none" ? "No Hat" : h.charAt(0).toUpperCase() + h.slice(1)}
          </button>
        ))}
      </div>
      <button
        className="bg-blue-500 text-white py-2 px-4 rounded"
        onClick={handleSave}
      >
        Save
      </button>
    </div>
  );
}