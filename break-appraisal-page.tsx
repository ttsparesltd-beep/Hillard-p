"use client";

/**
 * Break Appraisal — Hillard Performance portal page.
 *
 * Drop this in at:  app/break-appraisal/page.tsx
 * Link it from your admin nav (same auth gate as job sheets).
 *
 * Backend (already created in the portal's Supabase project):
 *   - table   public.break_appraisals   (policy: anon+authenticated, like job_sheets)
 *   - bucket  appraisal-photos           (public; uploads use your is_admin() session)
 *
 * It reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (already in your
 * Vercel env). If you have a shared browser client (e.g. @/lib/supabase), swap the
 * createClient line for your import — everything else stays the same.
 */

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const BUCKET = "appraisal-photos";

/* ------------------------------------------------------------------ config */
const DEFAULTS = { feePct: 15, labourRate: 35, stripHours: 12, transport: 150, storage: 50, scrap: 150, target: 2.5 };
const COND: Record<string, number> = { A: 1.0, B: 0.75, C: 0.5, D: 0.25 };
const CONDLABEL: Record<string, string> = { A: "A · mint", B: "B · good", C: "C · usable", D: "D · spares" };
const ENGINE_OPTS = ["180hp 1.8T", "225hp 1.8T", "3.2 V6"];

// TT Mk1 (8N) strip template — real 2yr average sold £ per part.
const TEMPLATE: [string, [string, number][]][] = [
  ["Big-ticket units — verify present, toggle per car", [
    ["Engine 1.8T complete", 450], ["Engine 3.2 V6 complete", 1000],
    ["Gearbox 6-spd manual (02M)", 80], ["Gearbox 3.2 V6 DSG (02E)", 400],
    ["DSG mechatronic (DQ250)", 120], ["Full leather/heated interior set", 150],
    ["Alloy wheels + tyres, RS4/9-spoke set", 350],
  ]],
  ["Drivetrain & engine", [
    ["Power steering rack 1.8T (8N2422855AD)", 140], ["PAS return oil cooling pipe (8N0422885A)", 74],
    ["Gearshift/short shifter lever (8N0711112B)", 70], ["K04 exhaust manifold (06A253033AJ)", 70],
    ["Clutch pedal (8N2721059E)", 37], ["Haldex rear diff filter+oil kit", 40],
    ["Haldex service kit (02D525558A)", 34], ["Rocker cover 1.8T 20V (06A103469S)", 33],
    ["Engine mount bracket O/S (038199207H)", 28], ["Power steering pump (8N0145154A)", 27],
    ["Inlet manifold cover trim (06A119518L)", 27], ["Diverter valve (06A145710N)", 26],
    ["Engine cover trim BAM (06A103724)", 26], ["Injectors x4 BAM (06A906031BC)", 25],
    ["Turbo oil return pipe (06A145735J)", 21], ["Twin rad cooling fans (8N0121205A)", 29],
  ]],
  ["Suspension & brakes", [
    ["Front lower arms/wishbones (8N0407165)", 40], ["Rear trailing arms set", 79],
    ["Front brake calipers 312mm", 63], ["Rear subframe cradle (1J0505235F)", 47],
    ["Front hub & bearing, nut type", 43], ["Front shock absorbers pair (8N0413031K)", 34],
    ["Rear lateral control arms set", 31], ["Brake master cylinder + tank (0204221731)", 17],
  ]],
  ["Wheels & tyres", [
    ["RS4 9-spoke alloys + tyres set (8N0601025S)", 317], ["Wheel centre caps x4 (8D0601165K)", 52],
    ["Spare wheel / space saver", 59],
  ]],
  ["Electronics & sensors", [
    ["Airbag control ECU (8N8909601)", 127], ["Instrument cluster w/ code (8N2920980A)", 105],
    ["BAM ECU, immo off (8N0906018H)", 105], ["Electric fuel pump (8L9919051J)", 57],
    ["ABS pump controller ECU (8N0614517A)", 42], ["Hazard warning switch (8N0941509A)", 45],
    ["Wiper motor linkage assy (8N0955113)", 83], ["Xenon headlight level sensor (4B0907503)", 32],
    ["Wing mirror switch (8N2959551B)", 28], ["Convenience module CCM (8N8962267E)", 40],
    ["Drivers master window switch (8N0959855A)", 23], ["Bose amplifier (8N8035223A)", 19],
    ["Xenon headlight control switch (8N2941531A)", 18], ["Window motor (8N8959801B)", 34],
    ["Heated seat switch button (8N0963563B)", 24],
  ]],
  ["Interior", [
    ["Front seats, leather/heated pair", 150], ["Parcel shelf, coupe", 55],
    ["Roof — convertible hood", 300], ["Roadster roof pump & rams (8N7871611A)", 60],
    ["Roof switches (8N7919719D)", 50], ["Door card, BOSE (8N2867106)", 38],
    ["Dash air vents set of 4 (8N0820901)", 31], ["Gear stick gaiter (8N0711115A)", 29],
    ["Centre console grab handle/knee bars", 26], ["Seat belt buckles, rear pair", 17],
    ["Rear centre console trim (8N0863274)", 16], ["Heater/climate control panel (8N0820043A)", 16],
    ["Leather steering wheel (8N0419091B)", 16], ["Interior door handle trim caps pair (8N0867163)", 13],
    ["Gear knob surround alloy (8N0864281)", 10],
  ]],
  ["Exterior & body", [
    ["Front wing, coloured", 90], ["Rear lights pair, late clear", 87],
    ["Tailgate lower trim (8N8867979)", 80], ["Headlight washer jet (8N0955102)", 38],
    ["Scuttle insert trim (8N2819415B)", 36], ["Front bumper centre lower grille (8N0807683A)", 31],
    ["Battery cover trim (8N0103927B)", 30], ["Battery top fuse box (8N0937550A)", 29],
    ["Undertray fuel tank cover (8N0825214C)", 28], ["Front wiper arms pair", 24],
    ["Washer bottle twin pump (8N0955453A)", 20], ["Fuel flap boot release switches (8N0962101)", 20],
    ["Door lock/latch mechanism, front", 20], ["Chrome fuel filler flap (8N0809905C)", 16],
    ["Number plate lights pair (8N0943021A)", 15],
  ]],
];

/* ------------------------------------------------------------------ types */
type Item = { name: string; val: number | string; cond: string; on: boolean };
type Group = { group: string; collapsed: boolean; items: Item[] };
type Appraisal = {
  id: string | null;
  reg: string; vin: string; make: string; model: string; variant: string;
  engine: string; body: string; year: string; mileage: string; colour: string;
  trans: string; drive: string; runner: string; damage: string; mot: string;
  asking: string; purchase: string;
  parts: Group[]; a: typeof DEFAULTS; photos: string[];
};

/* ------------------------------------------------------------------ helpers */
const gbp = (n: number) => "£" + Math.round(n || 0).toLocaleString("en-GB");
const num = (v: any) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const lineTotal = (it: Item) => (it.on ? num(it.val) * COND[it.cond] : 0);

function buildParts(): Group[] {
  return TEMPLATE.map(([group, items]) => ({
    group, collapsed: false,
    items: items.map(([name, val]) => ({ name, val, cond: "A", on: true })),
  }));
}
function findItem(ap: Appraisal, prefix: string) {
  for (const g of ap.parts) for (const it of g.items) if (it.name.startsWith(prefix)) return it;
  return null;
}
function applyEngine(ap: Appraisal) {
  const is32 = ap.engine === "3.2 V6";
  const e18 = findItem(ap, "Engine 1.8T complete"), e32 = findItem(ap, "Engine 3.2 V6 complete");
  if (e18) { e18.on = !is32; if (!is32) e18.val = ap.engine === "180hp 1.8T" ? 300 : 450; }
  if (e32) e32.on = is32;
  const man = findItem(ap, "Gearbox 6-spd manual"), dsg = findItem(ap, "Gearbox 3.2 V6 DSG"), mech = findItem(ap, "DSG mechatronic");
  if (man) man.on = !is32; if (dsg) dsg.on = is32; if (mech) mech.on = is32;
}
function applyBody(ap: Appraisal) {
  const road = ap.body === "Roadster";
  const ccm = findItem(ap, "Convenience module CCM"); if (ccm) { ccm.on = true; ccm.val = road ? 300 : 40; }
  const roof = findItem(ap, "Roof — convertible hood"), rams = findItem(ap, "Roadster roof pump & rams"), sw = findItem(ap, "Roof switches");
  if (roof) roof.on = road; if (rams) rams.on = road; if (sw) sw.on = road;
}
function freshAppraisal(): Appraisal {
  const ap: Appraisal = {
    id: null, reg: "", vin: "", make: "", model: "", variant: "",
    engine: "225hp 1.8T", body: "Coupe", year: "", mileage: "", colour: "",
    trans: "", drive: "", runner: "", damage: "", mot: "", asking: "", purchase: "",
    parts: buildParts(), a: { ...DEFAULTS }, photos: [],
  };
  applyEngine(ap); applyBody(ap);
  return ap;
}
function financials(ap: Appraisal) {
  let gpv = 0;
  for (const g of ap.parts) for (const it of g.items) gpv += lineTotal(it);
  const a = ap.a;
  const fees = gpv * (num(a.feePct) / 100);
  const labour = num(a.stripHours) * num(a.labourRate);
  const costs = labour + num(a.transport) + num(a.storage);
  const scrap = num(a.scrap);
  const net = gpv - fees - costs + scrap;
  const purchase = num(ap.purchase || ap.asking);
  const margin = net - purchase;
  const ratio = purchase > 0 ? net / purchase : net > 0 ? Infinity : 0;
  const maxBuy = Math.max(0, net / num(a.target));
  const roi = purchase + costs > 0 ? (margin / (purchase + costs)) * 100 : 0;
  let verdict = "ENTER PRICE", cls = "warn", note = "Add the purchase price to get a verdict.";
  if (purchase > 0) {
    if (ratio >= num(a.target)) { verdict = "BUY"; cls = "go"; note = `Recovers ${ratio.toFixed(1)}× the buy price — above your ${a.target}× target.`; }
    else if (ratio >= num(a.target) * 0.8) { verdict = "NEGOTIATE"; cls = "warn"; note = `Close. Get them to ${gbp(maxBuy)} or below to hit target.`; }
    else { verdict = "WALK"; cls = "stop"; note = `Only ${ratio.toFixed(1)}× at this price. Max you should pay is ${gbp(maxBuy)}.`; }
  }
  return { gpv, fees, labour, costs, scrap, net, purchase, margin, ratio, maxBuy, roi, verdict, cls, note };
}

/* -------------------------------------------------------- row <-> appraisal */
function rowToAp(r: any): Appraisal {
  const base = freshAppraisal();
  return {
    ...base, id: r.id,
    reg: r.reg ?? "", vin: r.vin ?? "", make: r.make ?? "", model: r.model ?? "", variant: r.variant ?? "",
    engine: r.engine ?? "225hp 1.8T", body: r.body ?? "Coupe", year: r.year ?? "", mileage: r.mileage ?? "",
    colour: r.colour ?? "", trans: r.trans ?? "", drive: r.drive ?? "", runner: r.runner ?? "",
    damage: r.damage ?? "", mot: r.mot ?? "", asking: r.asking != null ? String(r.asking) : "",
    purchase: r.purchase != null ? String(r.purchase) : "",
    parts: r.parts ?? base.parts, a: r.assumptions ?? base.a, photos: r.photos ?? [],
  };
}
function apToRow(ap: Appraisal, f: ReturnType<typeof financials>) {
  return {
    ...(ap.id ? { id: ap.id } : {}),
    reg: ap.reg, vin: ap.vin, make: ap.make, model: ap.model, variant: ap.variant,
    engine: ap.engine, body: ap.body, year: ap.year, mileage: ap.mileage, colour: ap.colour,
    trans: ap.trans, drive: ap.drive, runner: ap.runner, damage: ap.damage, mot: ap.mot,
    asking: num(ap.asking), purchase: num(ap.purchase),
    parts: ap.parts, assumptions: ap.a, photos: ap.photos,
    gross: f.gpv, net_recoverable: f.net, max_buy: f.maxBuy, margin: f.margin, verdict: f.verdict, status: "open",
  };
}

/* image downscale before upload */
function shrink(file: File): Promise<Blob> {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1400; let { width: w, height: h } = img; const s = Math.min(1, max / Math.max(w, h));
      w = Math.round(w * s); h = Math.round(h * s);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob(b => (b ? res(b) : rej(new Error("blob failed"))), "image/jpeg", 0.7);
    };
    img.onerror = rej; img.src = url;
  });
}

/* ------------------------------------------------------------------ UI */
export default function BreakAppraisalPage() {
  const [view, setView] = useState<"list" | "edit">("list");
  const [rows, setRows] = useState<any[]>([]);
  const [ap, setAp] = useState<Appraisal | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadList(); }, []);
  async function loadList() {
    const { data } = await supabase.from("break_appraisals").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  const f = useMemo(() => (ap ? financials(ap) : null), [ap]);

  function edit(mut: (a: Appraisal) => void) {
    setAp(prev => { if (!prev) return prev; const next = structuredClone(prev); mut(next); return next; });
  }
  function newAppraisal() { setAp(freshAppraisal()); setView("edit"); }
  function open(row: any) { setAp(rowToAp(row)); setView("edit"); }

  async function save() {
    if (!ap || !f) return; setBusy(true);
    const row = apToRow(ap, f);
    let saved;
    if (ap.id) saved = await supabase.from("break_appraisals").update(row).eq("id", ap.id).select().single();
    else saved = await supabase.from("break_appraisals").insert(row).select().single();
    setBusy(false);
    if (saved.error) { alert("Save failed: " + saved.error.message); return; }
    if (saved.data?.id && !ap.id) setAp(a => (a ? { ...a, id: saved.data.id } : a));
    loadList();
  }
  async function remove() {
    if (!ap?.id) { setView("list"); return; }
    if (!confirm("Delete this appraisal?")) return;
    await supabase.from("break_appraisals").delete().eq("id", ap.id);
    setView("list"); loadList();
  }
  async function addPhotos(files: FileList | null) {
    if (!files || !ap) return; setBusy(true);
    for (const file of Array.from(files)) {
      if (ap.photos.length >= 12) break;
      try {
        const blob = await shrink(file);
        const path = `${ap.id ?? "draft"}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        edit(a => { a.photos.push(url); });
      } catch (e: any) { alert("Photo upload failed (are you signed in?): " + (e?.message ?? e)); }
    }
    setBusy(false);
  }

  return (
    <div className="ba">
      <style>{CSS}</style>
      <div className="top">
        <div className="brand">HILLARD PERFORMANCE<small>Break Appraisal</small></div>
        <div className="spacer" />
        <button className="tbtn" onClick={() => { setView("list"); loadList(); }}>Saved</button>
        <button className="tbtn primary" onClick={newAppraisal}>+ New appraisal</button>
      </div>

      {view === "list" && (
        <div className="wrap">
          {rows.length === 0 ? (
            <div className="empty"><h2>No appraisals yet</h2><p>Log the plate, tick what's on the car, get a max-buy price.</p></div>
          ) : (
            <div className="listgrid">
              {rows.map(r => {
                const rf = financials(rowToAp(r));
                const chip = { go: "#e7f6ee", warn: "#fbf1dd", stop: "#fbe9e7" }[rf.cls]!;
                const ink = { go: "#1f9d55", warn: "#c9820a", stop: "#c0392b" }[rf.cls]!;
                return (
                  <div key={r.id} className="apcard" onClick={() => open(r)}>
                    <div className="pl">{(r.reg || "— — —").toUpperCase()}</div>
                    <h3>{(r.make || "Unknown") + " " + (r.model || "")}</h3>
                    <div className="meta">{[r.engine, r.body, r.year].filter(Boolean).join(" · ") || "No details"}</div>
                    <div className="row2">
                      <span style={{ background: chip, color: ink, fontWeight: 800, padding: "3px 10px", borderRadius: 20, fontSize: 12 }}>{rf.verdict}</span>
                      <span style={{ fontWeight: 700 }}>Max {gbp(rf.maxBuy)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === "edit" && ap && f && (
        <div className="wrap editor">
          <div className="main">
            <section className="sec">
              <h2>Vehicle</h2>
              <div className="body">
                <div className="plate"><input value={ap.reg} maxLength={9} placeholder="AB12 CDE" onChange={e => edit(a => { a.reg = e.target.value.toUpperCase(); })} /></div>
                <div className="fields">
                  <F l="VIN" span2 v={ap.vin} on={v => edit(a => { a.vin = v.toUpperCase(); })} />
                  <F l="Make" v={ap.make} on={v => edit(a => { a.make = v; })} />
                  <F l="Model" v={ap.model} on={v => edit(a => { a.model = v; })} />
                  <Sel l="Engine" v={ap.engine} opts={ENGINE_OPTS} on={v => edit(a => { a.engine = v; applyEngine(a); })} />
                  <Sel l="Body" v={ap.body} opts={["Coupe", "Roadster"]} on={v => edit(a => { a.body = v; applyBody(a); })} />
                  <F l="Variant / code" v={ap.variant} on={v => edit(a => { a.variant = v; })} />
                  <F l="Year" v={ap.year} on={v => edit(a => { a.year = v; })} />
                  <F l="Mileage" v={ap.mileage} on={v => edit(a => { a.mileage = v; })} />
                  <F l="Colour" v={ap.colour} on={v => edit(a => { a.colour = v; })} />
                  <Sel l="Transmission" v={ap.trans} opts={["Manual", "DSG / auto"]} on={v => edit(a => { a.trans = v; })} />
                  <Sel l="Drivetrain" v={ap.drive} opts={["FWD", "AWD / Quattro"]} on={v => edit(a => { a.drive = v; })} />
                  <Sel l="Runner?" v={ap.runner} opts={["Starts & drives", "Starts, no drive", "Non-runner"]} on={v => edit(a => { a.runner = v; })} />
                  <Sel l="Damage" v={ap.damage} opts={["None", "Cat N", "Cat S", "Cat B", "Mechanical"]} on={v => edit(a => { a.damage = v; })} />
                  <F l="MOT expiry" v={ap.mot} on={v => edit(a => { a.mot = v; })} />
                  <F l="Asking price" v={ap.asking} on={v => edit(a => { a.asking = v; })} />
                </div>
              </div>
            </section>

            <section className="sec">
              <h2>Photos <span className="muted">{ap.photos.length}/12</span></h2>
              <div className="body">
                <div className="photos">
                  {ap.photos.map((src, i) => (
                    <div key={i} className="thumb"><img src={src} alt="" /><button onClick={() => edit(a => { a.photos.splice(i, 1); })}>✕</button></div>
                  ))}
                  {ap.photos.length < 12 && (
                    <label className="addphoto">+ Add<small>photo</small>
                      <input type="file" accept="image/*" multiple hidden onChange={e => addPhotos(e.target.files)} />
                    </label>
                  )}
                </div>
              </div>
            </section>

            <section className="sec">
              <h2>Parts yield <span className="muted">— gross {gbp(f.gpv)}</span></h2>
              <div>
                {ap.parts.map((g, gi) => {
                  const sub = g.items.reduce((s, it) => s + lineTotal(it), 0);
                  return (
                    <div className="grp" key={gi}>
                      <div className={"grphead" + (g.collapsed ? " collapsed" : "")} onClick={() => edit(a => { a.parts[gi].collapsed = !a.parts[gi].collapsed; })}>
                        <span className="caret">▾</span><span className="gname">{g.group}</span><span className="gsub">{gbp(sub)}</span>
                      </div>
                      {!g.collapsed && (
                        <div className="rows">
                          {g.items.map((it, ii) => (
                            <div className={"prow" + (it.on ? "" : " off")} key={ii}>
                              <input type="checkbox" checked={it.on} onChange={e => edit(a => { a.parts[gi].items[ii].on = e.target.checked; })} />
                              <input type="text" value={it.name} onChange={e => edit(a => { a.parts[gi].items[ii].name = e.target.value; })} />
                              <span className="val"><input inputMode="numeric" value={String(it.val)} onChange={e => edit(a => { a.parts[gi].items[ii].val = e.target.value; })} /></span>
                              <select value={it.cond} onChange={e => edit(a => { a.parts[gi].items[ii].cond = e.target.value; })}>
                                {Object.keys(COND).map(c => <option key={c} value={c}>{CONDLABEL[c]}</option>)}
                              </select>
                              <span className="lt">{gbp(lineTotal(it))}</span>
                            </div>
                          ))}
                          <button className="addrow" onClick={() => edit(a => { a.parts[gi].items.push({ name: "", val: 0, cond: "B", on: true }); })}>+ Add part</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="sec">
              <h2>Costs &amp; assumptions</h2>
              <div className="body"><div className="fields">
                <F l="Purchase price" v={ap.purchase} on={v => edit(a => { a.purchase = v; })} />
                <A l="Transport / recovery" v={ap.a.transport} on={v => edit(a => { a.a.transport = num(v); })} />
                <A l="Strip hours" v={ap.a.stripHours} on={v => edit(a => { a.a.stripHours = num(v); })} />
                <A l="Labour £/hr" v={ap.a.labourRate} on={v => edit(a => { a.a.labourRate = num(v); })} />
                <A l="Storage / holding" v={ap.a.storage} on={v => edit(a => { a.a.storage = num(v); })} />
                <A l="Scrap recovered" v={ap.a.scrap} on={v => edit(a => { a.a.scrap = num(v); })} />
                <A l="Selling fees %" v={ap.a.feePct} on={v => edit(a => { a.a.feePct = num(v); })} />
                <A l="Target return ×" v={ap.a.target} on={v => edit(a => { a.a.target = num(v); })} />
              </div></div>
            </section>
          </div>

          <div className="side">
            <div className={"verdict " + f.cls}>
              <div className="tag">Verdict</div><div className="big">{f.verdict}</div>
              <div className="maxbuy"><div className="lab">Pay no more than</div><div className="amt">{gbp(f.maxBuy)}</div></div>
              <div className="note">{f.note}</div>
            </div>
            <div className="breakdown">
              <Ln k="Gross parts value" v={gbp(f.gpv)} />
              <Ln k={`Selling fees (${ap.a.feePct}%)`} v={"−" + gbp(f.fees)} neg />
              <Ln k={`Strip labour (${ap.a.stripHours}h)`} v={"−" + gbp(f.labour)} neg />
              <Ln k="Transport + storage" v={"−" + gbp(num(ap.a.transport) + num(ap.a.storage))} neg />
              <Ln k="Scrap recovered" v={"+" + gbp(f.scrap)} pos />
              <Ln k="Net recoverable" v={gbp(f.net)} bold />
              <Ln k="Purchase price" v={"−" + gbp(f.purchase)} neg />
              <Ln k="Margin" v={gbp(f.margin)} total color={f.margin >= 0 ? "#1f9d55" : "#c0392b"} />
              <Ln k="Return on outlay" v={isFinite(f.roi) ? Math.round(f.roi) + "%" : "—"} />
            </div>
            <div className="sidebtns">
              <button className="save" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save appraisal"}</button>
              <button onClick={() => window.print()}>Print / PDF</button>
              <button className="del" onClick={remove}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* small field helpers */
function F({ l, v, on, span2 }: { l: string; v: string; on: (v: string) => void; span2?: boolean }) {
  return <div className={"f" + (span2 ? " col2" : "")}><label>{l}</label><input value={v} onChange={e => on(e.target.value)} /></div>;
}
function A({ l, v, on }: { l: string; v: number | string; on: (v: string) => void }) {
  return <div className="f"><label>{l}</label><input inputMode="numeric" value={String(v)} onChange={e => on(e.target.value)} /></div>;
}
function Sel({ l, v, opts, on }: { l: string; v: string; opts: string[]; on: (v: string) => void }) {
  return <div className="f"><label>{l}</label><select value={v} onChange={e => on(e.target.value)}><option value="">—</option>{opts.map(o => <option key={o} value={o}>{o}</option>)}</select></div>;
}
function Ln({ k, v, neg, pos, bold, total, color }: { k: string; v: string; neg?: boolean; pos?: boolean; bold?: boolean; total?: boolean; color?: string }) {
  return <div className={"ln" + (total ? " total" : "")}><span>{bold ? <b>{k}</b> : k}</span><span style={{ color: color ?? (neg ? "#c0392b" : pos ? "#1f9d55" : undefined), fontWeight: bold || total ? 800 : undefined }}>{v}</span></div>;
}

/* scoped styles */
const CSS = `
.ba{--ink:#12151a;--paper:#f4f5f3;--go:#1f9d55;--warn:#c9820a;--stop:#c0392b;--accent:#0e5bd8;
  font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:var(--ink);background:var(--paper);min-height:100vh}
.ba *{box-sizing:border-box}
.ba .top{position:sticky;top:0;z-index:30;background:var(--ink);color:#eef1f5;display:flex;align-items:center;gap:14px;padding:12px 18px;border-bottom:3px solid #ffd400}
.ba .brand{font-weight:800;letter-spacing:.5px}.ba .brand small{display:block;font-weight:500;color:#9aa3af;letter-spacing:.14em;font-size:10px;text-transform:uppercase}
.ba .spacer{flex:1}.ba .muted{color:#6b7280;font-weight:500;text-transform:none;letter-spacing:0}
.ba .tbtn{background:#262b34;color:#eef1f5;border:1px solid #333a45;border-radius:8px;padding:8px 12px;font-weight:600;cursor:pointer}
.ba .tbtn.primary{background:#ffd400;color:#111;border-color:#ffd400}
.ba .wrap{max-width:1180px;margin:0 auto;padding:18px}
.ba .listgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.ba .apcard{background:#fff;border:1px solid #e3e5e2;border-radius:12px;padding:14px;cursor:pointer}
.ba .apcard:hover{box-shadow:0 6px 16px rgba(0,0,0,.08)}
.ba .apcard h3{margin:6px 0 2px;font-size:15px}.ba .apcard .meta{color:#6b7280;font-size:12px}
.ba .apcard .row2{display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-variant-numeric:tabular-nums}
.ba .pl{display:inline-flex;background:#ffd400;color:#0a0a0a;border:1.5px solid #0a0a0a;border-radius:5px;padding:3px 8px;font-weight:800;letter-spacing:.05em;font-size:15px}
.ba .empty{text-align:center;color:#6b7280;padding:60px 20px}.ba .empty h2{color:var(--ink)}
.ba .editor{display:grid;grid-template-columns:1fr 320px;gap:18px;align-items:start}
@media(max-width:900px){.ba .editor{grid-template-columns:1fr}}
.ba .sec{background:#fff;border:1px solid #e3e5e2;border-radius:12px;margin-bottom:16px;overflow:hidden}
.ba .sec>h2{margin:0;padding:12px 16px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#374151;background:#f0f1ee;border-bottom:1px solid #e3e5e2}
.ba .sec .body{padding:16px}
.ba .plate{display:inline-flex;background:#ffd400;border:2px solid #0a0a0a;border-radius:8px;padding:6px 12px;margin-bottom:14px}
.ba .plate input{background:transparent;border:0;font-weight:800;font-size:26px;letter-spacing:.06em;width:160px;text-transform:uppercase;outline:none}
.ba .fields{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
@media(max-width:700px){.ba .fields{grid-template-columns:repeat(2,1fr)}}
.ba .f{display:flex;flex-direction:column;gap:4px}.ba .f.col2{grid-column:span 2}
.ba .f label{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;font-weight:600}
.ba .f input,.ba .f select{padding:8px 10px;border:1px solid #d6d9d4;border-radius:8px;background:#fff}
.ba .photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px}
.ba .thumb{position:relative;aspect-ratio:4/3;border-radius:8px;overflow:hidden;border:1px solid #d6d9d4;background:#eee}
.ba .thumb img{width:100%;height:100%;object-fit:cover}
.ba .thumb button{position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;border:0;background:rgba(0,0,0,.6);color:#fff;cursor:pointer}
.ba .addphoto{aspect-ratio:4/3;border:2px dashed #c3c7c1;border-radius:8px;background:#fafbf9;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#6b7280;font-weight:600;cursor:pointer}
.ba .grp{border-top:1px solid #eceded}.ba .grp:first-child{border-top:0}
.ba .grphead{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;background:#fbfbfa;user-select:none}
.ba .grphead .caret{color:#6b7280;transition:transform .12s}.ba .grphead.collapsed .caret{transform:rotate(-90deg)}
.ba .grphead .gname{font-weight:700;flex:1}.ba .grphead .gsub{font-variant-numeric:tabular-nums;font-weight:600;color:#374151}
.ba .rows{padding:2px 8px 10px}
.ba .prow{display:grid;grid-template-columns:26px 1fr 96px 120px 84px;gap:8px;align-items:center;padding:4px 8px}
@media(max-width:640px){.ba .prow{grid-template-columns:24px 1fr 80px}}
.ba .prow input[type=text]{border:0;border-bottom:1px solid transparent;background:transparent;padding:4px 2px}
.ba .prow input[type=text]:focus{border-bottom-color:var(--accent);outline:none}
.ba .prow .val{position:relative}.ba .prow .val input{width:100%;text-align:right;border:1px solid #e0e2de;border-radius:6px;padding:5px 8px 5px 18px;font-variant-numeric:tabular-nums}
.ba .prow .val:before{content:"£";position:absolute;left:7px;top:50%;transform:translateY(-50%);color:#6b7280;font-size:12px}
.ba .prow select{border:1px solid #e0e2de;border-radius:6px;padding:5px 6px;background:#fff}
.ba .prow .lt{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.ba .prow.off{opacity:.4}.ba .prow.off .lt{text-decoration:line-through}
.ba .addrow{margin:4px 8px 0;background:none;border:1px dashed #c9ccc6;border-radius:6px;color:#6b7280;padding:6px;font-weight:600;width:calc(100% - 16px);cursor:pointer}
.ba .side{position:sticky;top:76px}
.ba .verdict{border-radius:14px;padding:18px;color:#fff;box-shadow:0 4px 18px rgba(0,0,0,.12)}
.ba .verdict.go{background:linear-gradient(160deg,#1f9d55,#178048)}
.ba .verdict.warn{background:linear-gradient(160deg,#d18e12,#b3760a)}
.ba .verdict.stop{background:linear-gradient(160deg,#d0453a,#a8382e)}
.ba .verdict .tag{font-size:12px;letter-spacing:.16em;text-transform:uppercase;opacity:.85;font-weight:700}
.ba .verdict .big{font-size:30px;font-weight:800;margin-top:2px}
.ba .verdict .maxbuy{margin-top:14px;background:rgba(255,255,255,.16);border-radius:10px;padding:12px 14px}
.ba .verdict .maxbuy .lab{font-size:11px;letter-spacing:.1em;text-transform:uppercase;opacity:.85;font-weight:600}
.ba .verdict .maxbuy .amt{font-size:30px;font-weight:800;font-variant-numeric:tabular-nums}
.ba .verdict .note{font-size:12px;margin-top:8px;opacity:.92;line-height:1.35}
.ba .breakdown{background:#fff;border:1px solid #e3e5e2;border-radius:12px;margin-top:14px;padding:14px 16px}
.ba .breakdown .ln{display:flex;justify-content:space-between;padding:5px 0;font-variant-numeric:tabular-nums;border-bottom:1px dashed #edeeec}
.ba .breakdown .ln:last-child{border-bottom:0}
.ba .breakdown .ln.total{border-top:2px solid #111;margin-top:4px;padding-top:8px;border-bottom:0}
.ba .sidebtns{display:grid;gap:8px;margin-top:14px}
.ba .sidebtns button{padding:10px;border-radius:9px;border:1px solid #d6d9d4;background:#fff;font-weight:700;cursor:pointer}
.ba .sidebtns .save{background:var(--ink);color:#fff;border-color:var(--ink)}
.ba .sidebtns .del{color:var(--stop);border-color:#eecac5}
@media print{.ba .top,.ba .sidebtns,.ba .addphoto,.ba .addrow{display:none!important}}
`;
