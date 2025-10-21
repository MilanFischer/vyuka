// CSV → XLSX widget (client-side). Použití: window.initCsv2Xlsx({ targetId: "csv2xlsx" });
(function(){

  function widgetHTML() {
    return `
<section style="max-width:680px;margin:1rem 0;padding:1rem 1.25rem;border:1px solid #e5e7eb;border-radius:8px;background:#fff;">
  <h3 style="margin:0 0 .75rem 0;color:#34495e;">Převod CSV → Excel (.xlsx)</h3>

  <label style="display:block;margin:.5rem 0 .25rem;">Soubor CSV</label>
  <input id="csvFile" type="file" accept=".csv,text/csv" style="width:%;padding:.5rem;border:1px solid #d1d5db;border-radius:6px;">

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-top:.75rem;">
    <div>
      <label style="display:block;margin-bottom:.25rem;">Oddělovač</label>
      <select id="delimiter" style="width:%;padding:.5rem;border:1px solid #d1d5db;border-radius:6px;">
        <option value="auto" selected>Auto-detekce</option>
        <option value=",">Čárka (,)</option>
        <option value=";">Středník (;)</option>
        <option value="\\t">Tabulátor</option>
        <option value="|">Svislítko (|)</option>
      </select>
    </div>
    <div>
      <label style="display:block;margin-bottom:.25rem;">Kódování</label>
      <select id="encoding" style="width:%;padding:.5rem;border:1px solid #d1d5db;border-radius:6px;">
        <option value="utf-8" selected>UTF-8 (výchozí)</option>
        <option value="windows-1250">Windows-1250 (CZ/SK)</option>
        <option value="iso-8859-2">ISO-8859-2</option>
        <option value="windows-1252">Windows-1252</option>
      </select>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr;gap:.75rem;margin-top:.75rem;">
    <div>
      <label style="display:block;margin-bottom:.25rem;">Název listu</label>
      <input id="sheetName" type="text" value="Data" style="width:%;padding:.5rem;border:1px solid #d1d5db;border-radius:6px;">
    </div>
  </div>

  <button id="convertBtn" style="margin-top:1rem;background-color:#3498db;color:#fff;padding:10px 15px;border:0;border-radius:5px;cursor:pointer;">
    Převést a stáhnout
  </button>
  <div id="status" style="margin-top:.6rem;color:#6b7280;font-size:.95rem;"></div>
</section>`;
  }

  function detectDelimiterQuick(text){
    const first = text.split(/\r?\n/).slice(0, 10).join("\n");
    const counts = {
      ",": (first.match(/,/g)||[]).length,
      ";": (first.match(/;/g)||[]).length,
      "\t": (first.match(/\t/g)||[]).length,
      "|": (first.match(/\|/g)||[]).length,
    };
    return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0] || ",";
  }

  async function readAsText(file, encoding){
    const buf = await file.arrayBuffer();
    const dec = new TextDecoder(encoding || "utf-8", {fatal:false});
    return dec.decode(buf);
  }

  // ---------- ČIŠTĚNÍ A PŘEVODY HODNOT (CZ-friendly) ----------
  function cleanStr(s){
    return String(s).replace(/\u00A0/g, " ").trim();
  }
  function parseMaybeDate(s){
    const t = cleanStr(s);
    const mIso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (mIso) {
      const d = new Date(+mIso[1], +mIso[2]-1, +mIso[3]);
      if (!isNaN(d)) return d;
    }
    const mCz = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (mCz) {
      const d = new Date(+mCz[3], +mCz[2]-1, +mCz[1]);
      if (!isNaN(d)) return d;
    }
    return null;
  }
  function parseMaybeNumber(s){
    let t = cleanStr(s);
    if (t === "") return null;
    t = t.replace(/[\s\u00A0]/g, ""); // tisícové mezery pryč
    const lastComma = t.lastIndexOf(",");
    const lastDot   = t.lastIndexOf(".");
    if (lastComma > -1 && lastDot > -1) {
      if (lastComma > lastDot) { t = t.replace(/\./g, "").replace(",", "."); } // 1.234,56
      else { t = t.replace(/,/g, ""); } // 1,234.56
    } else if (lastComma > -1) { t = t.replace(",", "."); }
    let isPct = false;
    if (/%$/.test(t)) { isPct = true; t = t.replace(/%$/, ""); }
    const num = Number(t);
    if (Number.isFinite(num)) return isPct ? num/ : num;
    return null;
  }
  function looksLikeIdHeader(h){
    if (!h) return false;
    const s = String(h).toLowerCase();
    return /(id|kód|kod|code|wsi|station|stanice)/i.test(s);
  }
  function columnPrefersText(values){
    const withLeadingZero = values.filter(v => typeof v === "string" && /^0\d+/.test(v.trim())).length;
    return withLeadingZero > Math.max(1, values.length * 0.1);
  }
  function coerceMatrixTypes(aoa){
    if (!aoa || !aoa.length) return aoa;
    const header = aoa[0] || [];
    const body = aoa.slice(1);
    const colCount = Math.max(...aoa.map(r => r.length));
    const columns = Array.from({length: colCount}, (_, ci) => body.map(r => r[ci]));
    const forceTextCol = columns.map((colVals, ci) => looksLikeIdHeader(header[ci]) || columnPrefersText(colVals));

    const out = [header.slice()];
    for (const row of body) {
      const newRow = row.map((v, ci) => {
        if (v === null || v === undefined) return v;
        const raw = String(v);
        if (forceTextCol[ci]) return cleanStr(raw);
        const d = parseMaybeDate(raw); if (d) return d;
        const n = parseMaybeNumber(raw); if (n !== null) return n;
        return cleanStr(raw);
      });
      out.push(newRow);
    }
    return out;
  }
  // ------------------------------------------------------------

  // --- BUILD XLSX: SheetJS (pokud je) nebo ExcelJS + FileSaver ---
  async function buildAndDownloadXlsx(data, sheetName, outName){
    // 1) SheetJS (pokud je nahraná)
    const XLSXlib = (typeof window !== 'undefined' && window.XLSX) || (typeof XLSX !== 'undefined' ? XLSX : null);
    if (XLSXlib && XLSXlib.utils && typeof XLSXlib.writeFile === 'function') {
      const ws = XLSXlib.utils.aoa_to_sheet(data);
      const wb = XLSXlib.utils.book_new();
      XLSXlib.utils.book_append_sheet(wb, ws, sheetName);
      XLSXlib.writeFile(wb, outName, { bookType: "xlsx", compression: true });
      return;
    }
    // 2) ExcelJS fallback
    const ExcelJSlib = (typeof window !== 'undefined' && window.ExcelJS) ? window.ExcelJS : null;
    if (!ExcelJSlib) throw new Error("Knihovna XLSX/ExcelJS není k dispozici.");
    const wb = new ExcelJSlib.Workbook();
    const ws = wb.addWorksheet(sheetName);
    for (const row of data) ws.addRow(row);
    const buf = await wb.xlsx.writeBuffer();
    if (typeof saveAs === 'function') {
      saveAs(new Blob([buf], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}), outName);
    } else {
      const blob = new Blob([buf], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = outName;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
    }
  }

  async function mount(el){
    el.innerHTML = widgetHTML();
    const $ = (id) => el.querySelector("#"+id);
    const fileInput   = $("csvFile");
    const delimSelect = $("delimiter");
    const encSelect   = $("encoding");
    const sheetInput  = $("sheetName");
    const statusEl    = $("status");

    let suggestedOutName = "converted.xlsx"; // aktualizujeme po výběru souboru

    // Při výběru souboru nastav výchozí název výstupu = název vstupu + .xlsx
    fileInput.addEventListener("change", () => {
      const f = fileInput.files && fileInput.files[0];
      if (f && f.name) {
        const base = f.name.replace(/\.[^/.]+$/, ""); // bez přípony
        suggestedOutName = base + ".xlsx";
      }
    });

    function setStatus(msg, isError=false){
      statusEl.textContent = msg || "";
      statusEl.style.color = isError ? "#b91c1c" : "#6b7280";
    }

    $("convertBtn").addEventListener("click", async () => {
      setStatus("");
      const file = fileInput.files && fileInput.files[0];
      if(!file){ setStatus("Vyberte prosím CSV soubor.", true); return; }

      const encoding = encSelect.value || "utf-8";
      const sheetName = (sheetInput.value || "Data").slice(0,31);
      const outName = suggestedOutName || "converted.xlsx";

      try{
        setStatus("Načítám soubor…");
        const text = await readAsText(file, encoding);

        let delimiter = delimSelect.value;
        if(delimiter === "auto") delimiter = detectDelimiterQuick(text);
        if(delimiter === "\\t") delimiter = "\t";

        setStatus("Parsuji CSV…");
        const parsed = window.Papa.parse(text, {
          delimiter: (delimSelect.value === "auto" ? "" : delimiter),
          skipEmptyLines: "greedy",
          dynamicTyping: false
        });

        if(parsed.errors && parsed.errors.length){
          const err = parsed.errors.find(e => e.type !== "FieldMismatch") || parsed.errors[0];
          setStatus("Upozornění: " + err.message);
        }

        const data = parsed.data || [];
        if(!data.length){ setStatus("CSV neobsahuje žádné řádky.", true); return; }

        // VŽDY převést čísla a datumy (CZ), zachovat ID/kódy
        const finalData = coerceMatrixTypes(data);

        setStatus("Vytvářím Excel…");
        await buildAndDownloadXlsx(finalData, sheetName, outName);

        setStatus("Hotovo – soubor se stáhne.");
      }catch(err){
        console.error(err);
        setStatus("Chyba při převodu: " + (err && err.message ? err.message : err), true);
      }
    });
  }

  // veřejné API
  window.initCsv2Xlsx = async function initCsv2Xlsx(opts){
    const targetId = (opts && opts.targetId) || "csv2xlsx";
    const el = document.getElementById(targetId);
    if(!el) return console.warn("initCsv2Xlsx: target element not found:", targetId);
    await mount(el);
  };
})();
