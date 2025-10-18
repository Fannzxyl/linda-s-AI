import React, { useEffect, useMemo, useState } from "react";

type Fact = { id: number; key: string; value: string; updated_at?: string };
type Pin  = { id: number; text: string; updated_at?: string };
type Summary = { id?: number; text: string; range_start?: string; range_end?: string };

async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (res.headers.get("content-type")?.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  // @ts-ignore
  return undefined;
}

export default function MemoryPanel({
  apiBase = "/api/memory",
}: {
  apiBase?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const [k, setK] = useState("");
  const [v, setV] = useState("");
  const [pinText, setPinText] = useState("");

  const factsUrl   = useMemo(() => `${apiBase}/facts`, [apiBase]);
  const pinsUrl    = useMemo(() => `${apiBase}/pins`, [apiBase]);
  const summaryUrl = useMemo(() => `${apiBase}/summary`, [apiBase]);

  async function refreshAll() {
    setLoading(true);
    try {
      const [f, p, s] = await Promise.all([
        api<Fact[]>(factsUrl),
        api<Pin[]>(pinsUrl),
        api<Summary | null>(summaryUrl).catch(() => null),
      ]);
      setFacts(Array.isArray(f) ? f : []);
      setPins(Array.isArray(p) ? p : []);
      setSummary(s ?? null);
    } catch {
      // biarkan panel tetap jalan meski endpoint belum ada
    } finally {
      setLoading(false);
    }
  }

  async function addFact() {
    const key = k.trim(); const value = v.trim();
    if (!key || !value) return;
    try {
      await api(factsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      setK(""); setV("");
      refreshAll();
    } catch {}
  }

  async function delFact(id: number) {
    try {
      await api(`${factsUrl}/${id}`, { method: "DELETE" });
      refreshAll();
    } catch {}
  }

  async function addPin() {
    const text = pinText.trim();
    if (!text) return;
    try {
      await api(pinsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      setPinText("");
      refreshAll();
    } catch {}
  }

  async function delPin(id: number) {
    try {
      await api(`${pinsUrl}/${id}`, { method: "DELETE" });
      refreshAll();
    } catch {}
  }

  useEffect(() => { refreshAll(); }, []);

  return (
    <div className="control" aria-label="Memory Panel">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="label">Memory</span>
        <button className="pill" onClick={refreshAll} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Summary */}
      <div style={{
        background:"rgba(15,23,42,.6)",
        border:"1px solid rgba(148,163,184,.2)",
        borderRadius:12, padding:12
      }}>
        <div style={{fontSize:".85rem", color:"#cbd5f5", marginBottom:6}}>Ringkasan</div>
        <div style={{fontSize:".92rem", lineHeight:1.6, color:"#e5eaf3"}}>
          {summary?.text || "– belum ada ringkasan –"}
        </div>
      </div>

      {/* Facts */}
      <div>
        <div className="label" style={{marginTop:6}}>Fakta (key:value)</div>
        <div className="row" style={{gap:8}}>
          <input className="select" placeholder="key" value={k} onChange={e=>setK(e.target.value)} />
          <input className="select" placeholder="value" value={v} onChange={e=>setV(e.target.value)} />
          <button className="pill" onClick={addFact}>Add</button>
        </div>
        <div className="col" style={{marginTop:8, gap:8}}>
          {facts.length === 0 && <div style={{color:"#9aa4b2", fontSize:".9rem"}}>Belum ada fakta.</div>}
          {facts.map(f=>(
            <div key={f.id} className="row" style={{
              justifyContent:"space-between",
              background:"rgba(15,23,42,.6)",
              border:"1px solid rgba(148,163,184,.2)",
              borderRadius:12, padding:"8px 10px"
            }}>
              <div style={{fontSize:".92rem"}}><b>{f.key}</b>: {f.value}</div>
              <button className="pill" onClick={()=>delFact(f.id)}>Hapus</button>
            </div>
          ))}
        </div>
      </div>

      {/* Pins */}
      <div>
        <div className="label" style={{marginTop:6}}>Pins</div>
        <div className="row" style={{gap:8}}>
          <input className="select" placeholder="tulis catatan penting…" value={pinText} onChange={e=>setPinText(e.target.value)} />
          <button className="pill" onClick={addPin}>Pin</button>
        </div>
        <div className="col" style={{marginTop:8, gap:8}}>
          {pins.length === 0 && <div style={{color:"#9aa4b2", fontSize:".9rem"}}>Belum ada pin.</div>}
          {pins.map(p=>(
            <div key={p.id} className="row" style={{
              justifyContent:"space-between",
              background:"rgba(15,23,42,.6)",
              border:"1px solid rgba(148,163,184,.2)",
              borderRadius:12, padding:"8px 10px"
            }}>
              <div style={{fontSize:".92rem"}}>{p.text}</div>
              <button className="pill" onClick={()=>delPin(p.id)}>Unpin</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}