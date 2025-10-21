// Minimal CSV → XLSX widget that can be mounted anywhere.
(function(){
  // load a script from CDN if not present
  function loadScriptOnce(src){
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some(s => s.src === src)) return resolve();
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve; s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }

  // ensure dependencies
  async function ensureLibs() {
    const needsPapa = (typeof window.Papa === "undefined");
    const needsXLSX = (typeof window.XLSX === "undefined");
    if (needsPapa) await loadScriptOnce("https://unpkg.com/papaparse@5.4.1/papaparse.min.js");
    if (needsXLSX) await loadScriptOnce("https://unpkg.com/xlsx@0.20.2/dist/xlsx.full.min.js");
  }

  function widgetHTML() {
    return `
<section style="max-width:680px;margin:1rem 0;padding:1rem 1.25rem;border:1px solid #e5e7eb;border-radius:8px;background:#fff;">
  <h3 style="margin:0 0 .75rem 0;color:#34495e;">Převod CSV → Excel (.xlsx)</h3>

  <label style="display:block;margin:.5rem 0 .25rem;">Soubor CSV</label>
  <input id="csvFile" type="file" accept=".csv,text/csv" style="width:100%;padding:.5rem;border:1px solid #d1d5db;border-radius:6px;">

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-top:.75rem;">
    <div>
      <label style="display:block;margin-bottom:.25rem;">Oddělovač</label>
      <select id="delimiter" style="width:100%;padding:.5rem;border:1px solid #d1d5db;border-radius:6px;">
        <option value="auto" selected>Auto-detekce</option>
        <option value=",">Čárka (,)</option>
        <option value=";">Středník (;)</option>
        <option value="\\t">Tabulátor</option>
        <option value="|">Svislítko (|)</option>
      </select>
    </div>
    <div>
      <label style="display:block;margin-bottom:.25rem;">Kódování</label>
      <select id="encoding" style="width:100%;padding:.5rem;border:1px solid #d1d5db;border-radius:6px;">
        <option value="utf-8" selected>UTF-8 (výchozí)</option>
        <option value="windows-1250">Windows-1250 (CZ/SK)</option>
        <option value="iso-8859-2">ISO-8859-2</option>
        <option value="windows-1252">Windows-1252</option>
      </select>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-top:.75rem;">
    <div>
      <label style="display:block;margin-bottom:.25rem;">Název listu</label>
      <input id="sheetName" type="text" value="Data" style="width:100%;padding:.5rem;border:1px solid #d1d5db;border-radius:6px;">
    </div>
    <div>
      <label style="display:block;margin-bottom:.25rem;">Výstupní soubor</label>
      <input id="outName" type="text" value="converted.xlsx" style="width:100%;padding:.5rem;border:1px solid #d1d5db;border-radius:6px;">
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

  async function mount(el){
    el.innerHTML = widgetHTML();
    const $ = (id) => el.querySelector("#"+id);
    const fileInput   = $("csvFile");
    const delimSelect = $("delimiter");
    const encSelect   = $("encoding");
    const sheetInput  = $("sheetName");
    const outInput    = $("outName");
    const statusEl    = $("status");

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
      let outName = outInput.value || "converted.xlsx";
      if(!outName.toLowerCase().endsWith(".xlsx")) outName += ".xlsx";

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

        setStatus("Vytvářím Excel…");
        const ws = window.XLSX.utils.aoa_to_sheet(data);
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
        window.XLSX.writeFile(wb, outName, { bookType: "xlsx", compression: true });

        setStatus("Hotovo – soubor se stáhne.");
      }catch(err){
        console.error(err);
        setStatus("Chyba při převodu: " + (err && err.message ? err.message : err), true);
      }
    });
  }

  // public API
  window.initCsv2Xlsx = async function initCsv2Xlsx(opts){
    const targetId = (opts && opts.targetId) || "csv2xlsx";
    const el = document.getElementById(targetId);
    if(!el) return console.warn("initCsv2Xlsx: target element not found:", targetId);
    await ensureLibs();
    await mount(el);
  };
})();
