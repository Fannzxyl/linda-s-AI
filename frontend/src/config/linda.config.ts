// config dasar Linda
export type LindaConfig = {
  id: "linda";
  dir: string;           // folder aset di /public
  files: {
    neutral: string;
    blink: string;
    wink: string;
    smile: string;
    sad: string;
  };
  blinkMinMs: number;    // interval kedip min–max
  blinkMaxMs: number;
  idleSway: number;      // 0.6..1.6
};

const LINDA: LindaConfig = {
  id: "linda",
  dir: "/linda",
  files: {
    neutral: "/linda/netral.png",
    blink: "/linda/merem.png",
    wink: "/linda/wink.png",
    smile: "/linda/senyum.png",
    sad: "/linda/sedih.png",
  },
  blinkMinMs: 1800,
  blinkMaxMs: 3200,
  idleSway: 1.05,
};

export default LINDA;