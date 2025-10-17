import { useMemo, useRef, useState } from "react";
import CharacterLayer, { CharacterLayerHandle } from "./components/CharacterLayer";
import Chat from "./components/Chat";

const App = () => {
  const [useMemory, setUseMemory] = useState(true);
  const [personaStyle, setPersonaStyle] = useState("santai");
  const characterRef = useRef<CharacterLayerHandle | null>(null);

  const personaPrompt = useMemo(() => {
    const personaMap: Record<string, string> = {
      santai:
        "Linda santai: selalu hangat, responsif, dan empatik. Jawab 2-4 kalimat natural tanpa Markdown, beri dukungan atau humor ringan.",
      formal:
        "Linda profesional: kalimat baku singkat, tetap empatik dan jelas. Sajikan 2-4 kalimat terstruktur tanpa Markdown, tawarkan bantuan lanjut.",
      tsundere:
        "Linda tsundere manis: nada menggoda dan sedikit ketus tapi penuh perhatian. Tetap hangat, tunjukkan empati, gunakan 2-4 kalimat natural tanpa Markdown.",
      netral:
        "Linda netral: seimbang, empatik, fokus solusi. Gunakan 2-4 kalimat informatif tanpa Markdown, ajak dialog ringan.",
    };
    return personaMap[personaStyle] ?? personaMap.santai;
  }, [personaStyle]);

  return (
    <div className="app-shell">
      <section className="panel" aria-label="Avatar">
        <h2>Alfan</h2>
        <CharacterLayer ref={characterRef} personaStyle={personaStyle} />
        <label className="toggle">
          <input
            type="checkbox"
            checked={useMemory}
            onChange={(event) => setUseMemory(event.target.checked)}
          />
          Gunakan memori ringan
        </label>
        <button
          type="button"
          className="ghost-button"
          style={{ marginTop: "0.85rem", alignSelf: "flex-start" }}
          onClick={() => characterRef.current?.resetEyes()}
        >
          Kalibrasi Ulang Mata
        </button>
      </section>
      <section className="panel" aria-label="Chat">
        <div className="chat-panel-header">
          <h2>Obrolan</h2>
          <label className="persona-select">
            Gaya bicara
            <select
              value={personaStyle}
              onChange={(event) => setPersonaStyle(event.target.value)}
            >
              <option value="santai">Santai</option>
              <option value="formal">Formal</option>
              <option value="tsundere">Tsundere</option>
              <option value="netral">Netral</option>
            </select>
          </label>
        </div>
        <Chat useMemory={useMemory} persona={personaPrompt} />
      </section>
    </div>
  );
};

export default App;
