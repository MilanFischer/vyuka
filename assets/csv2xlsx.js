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

  <label style="display:flex;gap:.5rem;align-items:center;margin-top:.75rem;">
    <input id="coerce" type="checkbox" checked>
    <span>Převést čísla a datumy (CZ, zachovat ID s nulami)</span>
  </label>

  <button id="convertBtn" style="margin-top:1rem;background-color:#3498db;color:#fff;padding:10px 15px;border:0;border-radius:5px;cursor:pointer;">
    Převést a stáhnout
  </button>
  <div id="status" style="margin-top:.6rem;color:#6b7280;font-size:.95rem;"></div>
</section>`;
}
