/*
 * Estilos V3 compartidos por las páginas de /dashboard.
 * Reemplazan los estilos anteriores usando LOS MISMOS nombres de clase,
 * así que la lógica y las tablas de cada página no cambian: solo su aspecto.
 * Usa las variables definidas en app/globals.css (--navy, --line, --muted, etc.).
 */
/*
 * Variables de color y letra (estilo GitHub). Modo claro por defecto y modo
 * oscuro con html[data-tema="oscuro"]. Se repiten aquí (además de app/globals.css)
 * para que el diseño se vea bien aunque globals.css no se haya actualizado.
 */
export const TOKENS_V3 = `
:root {
  --navy: #0969da;
  --navy-2: #0550ae;
  --navy-soft: #ddf4ff;
  --navy-line: #b6e3ff;
  --navy-mid: #54aeff;
  --cream: #f6f8fa;
  --bg: #ffffff;
  --card: #ffffff;
  --fill: #f6f8fa;
  --line: #d1d9e0;
  --line-2: #e3e8ed;
  --line-strong: #c4ccd5;
  --empty: #eff2f5;
  --text: #1f2328;
  --text-2: #31363c;
  --muted: #59636e;
  --muted-2: #818b98;
  --danger: #d1242f;
  --danger-soft: #ffebe9;
  --danger-line: #ffcecb;
  --ok: #1a7f37;
  --ok-soft: #dafbe1;
  --ok-line: #aceebb;
  --warn: #9a6700;
  --warn-soft: #fff8c5;
  --warn-line: #f2df8a;
  --primary: #1f883d;
  --primary-hover: #1c8139;
  --on-primary: #ffffff;
  --bar-bg: #f6f8fa;
  --bar-tx: #1f2328;
  --bar-mu: #59636e;
  --bar-line: #d1d9e0;
  --side-bg: #ffffff;
  --hover: rgba(129,139,152,.12);
  --sel: rgba(129,139,152,.18);
  --row-hover: #f6f8fa;
  --focus: rgba(9,105,218,.25);
  --overlay: rgba(31,35,40,.5);
  --shadow: 0 8px 24px rgba(140,149,159,.25);
  --pix-0: #eff2f5;
  --pix-1: #aceebb;
  --pix-2: #4ac26b;
  --pix-3: #2da44e;
  --pix-4: #116329;
  --serie-2: #0969da;
  --violeta: #8250df;
  --ambar: #bf8700;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --background: var(--bg);
  --foreground: var(--text);
  color-scheme: light;
}
/* Modo oscuro (Configuración → Apariencia) */
html[data-tema="oscuro"] {
  --navy: #4493f8;
  --navy-2: #1f6feb;
  --navy-soft: rgba(56,139,253,.15);
  --navy-line: rgba(56,139,253,.4);
  --navy-mid: #316dca;
  --cream: #151b23;
  --bg: #0d1117;
  --card: #0d1117;
  --fill: #151b23;
  --line: #3d444d;
  --line-2: #262c36;
  --line-strong: #4f5862;
  --empty: #151b23;
  --text: #f0f6fc;
  --text-2: #d1d7e0;
  --muted: #9198a1;
  --muted-2: #656c76;
  --danger: #f85149;
  --danger-soft: rgba(248,81,73,.12);
  --danger-line: rgba(248,81,73,.4);
  --ok: #3fb950;
  --ok-soft: rgba(46,160,67,.15);
  --ok-line: rgba(46,160,67,.4);
  --warn: #d29922;
  --warn-soft: rgba(187,128,9,.15);
  --warn-line: rgba(187,128,9,.4);
  --primary: #238636;
  --primary-hover: #29903b;
  --on-primary: #ffffff;
  --bar-bg: #010409;
  --bar-tx: #f0f6fc;
  --bar-mu: #9198a1;
  --bar-line: #3d444d;
  --side-bg: #0d1117;
  --hover: rgba(101,108,118,.2);
  --sel: rgba(101,108,118,.28);
  --row-hover: #151b23;
  --focus: rgba(31,111,235,.45);
  --overlay: rgba(1,4,9,.65);
  --shadow: 0 8px 24px rgba(1,4,9,.85);
  --pix-0: #151b23;
  --pix-1: #033a16;
  --pix-2: #196c2e;
  --pix-3: #2ea043;
  --pix-4: #56d364;
  --serie-2: #4493f8;
  --violeta: #ab7df8;
  --ambar: #d29922;
  color-scheme: dark;
}
html, body { background: var(--bg); color: var(--text); }
/* Logo: versión clara u oscura según el tema */
.logo-app { position: relative; display: inline-flex; flex: none; }
.logo-app img { width: 100%; height: 100%; }
.logo-app-oscuro { display: none !important; }
html[data-tema="oscuro"] .logo-app-claro { display: none !important; }
html[data-tema="oscuro"] .logo-app-oscuro { display: block !important; }
/* Al imprimir siempre se usa el modo claro (comprobantes y PDF salen igual que siempre) */
@media print {
  html, html[data-tema="oscuro"] {
  --navy: #0969da !important;
  --navy-2: #0550ae !important;
  --navy-soft: #ddf4ff !important;
  --navy-line: #b6e3ff !important;
  --navy-mid: #54aeff !important;
  --cream: #f6f8fa !important;
  --bg: #ffffff !important;
  --card: #ffffff !important;
  --fill: #f6f8fa !important;
  --line: #d1d9e0 !important;
  --line-2: #e3e8ed !important;
  --line-strong: #c4ccd5 !important;
  --empty: #eff2f5 !important;
  --text: #1f2328 !important;
  --text-2: #31363c !important;
  --muted: #59636e !important;
  --muted-2: #818b98 !important;
  --danger: #d1242f !important;
  --danger-soft: #ffebe9 !important;
  --danger-line: #ffcecb !important;
  --ok: #1a7f37 !important;
  --ok-soft: #dafbe1 !important;
  --ok-line: #aceebb !important;
  --warn: #9a6700 !important;
  --warn-soft: #fff8c5 !important;
  --warn-line: #f2df8a !important;
  --primary: #1f883d !important;
  --primary-hover: #1c8139 !important;
  --on-primary: #ffffff !important;
  --bar-bg: #f6f8fa !important;
  --bar-tx: #1f2328 !important;
  --bar-mu: #59636e !important;
  --bar-line: #d1d9e0 !important;
  --side-bg: #ffffff !important;
  --hover: rgba(129,139,152,.12) !important;
  --sel: rgba(129,139,152,.18) !important;
  --row-hover: #f6f8fa !important;
  --focus: rgba(9,105,218,.25) !important;
  --overlay: rgba(31,35,40,.5) !important;
  --shadow: 0 8px 24px rgba(140,149,159,.25) !important;
  --pix-0: #eff2f5 !important;
  --pix-1: #aceebb !important;
  --pix-2: #4ac26b !important;
  --pix-3: #2da44e !important;
  --pix-4: #116329 !important;
  --serie-2: #0969da !important;
  --violeta: #8250df !important;
  --ambar: #bf8700 !important;
    color-scheme: light;
  }
}
`

/* Estilos del menú lateral, barra superior y tarjetas (los usa components/AppShell). */
export const SHELL_V3 = `
/* ── Utilidades compartidas ── */
.v3-mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.v3-lbl { font: 500 12px var(--sans); color: var(--muted); }
.v3-card { background: var(--card); border: 1px solid var(--line); border-radius: 6px; }
.v3-card-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--line); background: var(--fill); border-radius: 6px 6px 0 0; }
.v3-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.v3-kpi { background: var(--card); border: 1px solid var(--line); border-radius: 6px; display: flex; flex-direction: column; }
.v3-kpi.navy { box-shadow: none; }
.v3-kpi-body { padding: 14px 14px 12px; flex: 1; display: flex; justify-content: space-between; align-items: flex-end; gap: 10px; }
.v3-kpi-val { margin: 8px 0 0; font: 600 22px var(--mono); letter-spacing: -0.02em; color: var(--text); font-variant-numeric: tabular-nums; }
.v3-kpi.navy .v3-kpi-val { color: var(--text); }
.v3-kpi-unit { font: 400 12px var(--sans); color: var(--muted); letter-spacing: 0; }
.v3-kpi-foot { display: flex; justify-content: space-between; gap: 8px; padding: 8px 14px; border-top: 1px solid var(--line-2); font-size: 12px; color: var(--muted); }
.v3-kpi-foot b { font: 600 12px var(--mono); color: var(--text); }
.v3-ticks { display: flex; align-items: flex-end; gap: 3px; height: 34px; }
.v3-ticks span { width: 3px; border-radius: 1px; background: var(--pix-1); }
.v3-ticks span:last-child { background: var(--pix-3); }
.v3-seg { display: inline-flex; flex-wrap: wrap; padding: 0; border: 1px solid var(--line); border-radius: 6px; background: var(--fill); overflow: hidden; }
.v3-seg > button { height: 28px; padding: 0 12px; border: 0; border-right: 1px solid var(--line); background: transparent; font: 500 12px var(--sans); color: var(--text-2); cursor: pointer; }
.v3-seg > button:last-child { border-right: 0; }
.v3-seg > button:hover { background: var(--hover); }
.v3-seg > button.on { background: var(--card); color: var(--text); font-weight: 600; box-shadow: inset 0 -2px 0 var(--navy); }
.v3-pix { display: flex; gap: 2px; height: 12px; }
.v3-pix span { flex: 1 1 0; border-radius: 2px; background: var(--pix-0); outline: 1px solid rgba(127,127,127,.08); outline-offset: -1px; }
.v3-pix span.on { background: var(--pix-3); }
.v3-pix span.mid { background: var(--pix-1); }
.v3-pix span.alt { background: var(--serie-2); }

.v3-root { min-height: 100vh; background: var(--bg); font-family: var(--sans); color: var(--text); --v3-bar: 56px; --v3-top-alto: 56px; }

/* ───── Barra superior (fija, a todo lo ancho) ───── */
.v3-bar { position: sticky; top: 0; z-index: 50; height: var(--v3-bar); box-sizing: border-box; background: var(--bar-bg); color: var(--bar-tx); border-bottom: 1px solid var(--bar-line); display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 16px; }
.v3-bar-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.v3-org { display: flex; align-items: center; gap: 10px; text-decoration: none; min-width: 0; color: inherit; }
.v3-org-logo { width: 32px; height: 32px; flex: none; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.v3-org-logo img { max-width: 32px; max-height: 32px; object-fit: contain; }
.v3-org-txt { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
.v3-org-txt small { font-size: 11px; color: var(--bar-mu); }
.v3-org-txt strong { font-size: 14px; font-weight: 600; color: var(--bar-tx); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.v3-bar-sep { display: none; }
.v3-crumb { margin: 0; font-size: 14px; color: var(--bar-mu); display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.v3-crumb::before { content: '/'; color: var(--bar-mu); margin-right: 2px; }
.v3-crumb b { color: var(--bar-tx); font-weight: 600; }
.v3-crumb > span[aria-hidden] { color: var(--bar-mu); }
.v3-burger { display: none; width: 32px; height: 32px; flex: none; border: 1px solid var(--bar-line); border-radius: 6px; background: transparent; color: var(--bar-mu); align-items: center; justify-content: center; cursor: pointer; }
.v3-burger:hover { background: var(--hover); color: var(--bar-tx); }
.v3-user { display: flex; align-items: center; gap: 10px; flex: none; }
.v3-user-txt { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.25; }
.v3-user-txt b { font-size: 13px; font-weight: 600; color: var(--bar-tx); white-space: nowrap; }
.v3-user-txt small { font-size: 11px; color: var(--bar-mu); }
.v3-avatar-wrap { position: relative; }
.v3-avatar { display: flex; align-items: center; gap: 4px; height: 36px; padding: 0 4px 0 0; border: 0; border-radius: 999px; background: transparent; color: var(--bar-mu); cursor: pointer; }
.v3-avatar .ico { width: 32px; height: 32px; border-radius: 50%; background: var(--fill); border: 1px solid var(--bar-line); color: var(--bar-tx); display: flex; align-items: center; justify-content: center; }
.v3-avatar:hover .ico, .v3-avatar.open .ico { box-shadow: 0 0 0 3px var(--focus); }
.v3-avatar .chev { transition: transform .15s; }
.v3-avatar.open .chev { transform: rotate(180deg); }
.v3-menu { position: absolute; right: 0; top: 44px; z-index: 60; width: 260px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; color: var(--text); }
.v3-menu-head { display: flex; align-items: center; gap: 10px; padding: 12px; border-bottom: 1px solid var(--line); }
.v3-menu-head .ini { width: 36px; height: 36px; flex: none; border-radius: 50%; background: var(--fill); border: 1px solid var(--line); color: var(--text); display: flex; align-items: center; justify-content: center; }
.v3-menu-head .who { display: flex; flex-direction: column; min-width: 0; line-height: 1.35; }
.v3-menu-head .who b { font-size: 14px; font-weight: 600; color: var(--text); }
.v3-menu-head .who small { font: 400 12px var(--sans); color: var(--muted); }
.v3-menu-list { padding: 6px; }
.v3-menu-item { display: flex; align-items: center; gap: 10px; width: 100%; height: 34px; padding: 0 8px; border: 0; border-radius: 6px; background: transparent; font: 400 14px var(--sans); color: var(--text); cursor: pointer; text-align: left; }
.v3-menu-item svg { color: var(--muted); }
.v3-menu-item:hover { background: var(--hover); }
.v3-menu-item.danger { color: var(--danger); }
.v3-menu-item.danger svg { color: var(--danger); }
.v3-menu-item.danger:hover { background: var(--danger-soft); }
.v3-menu-sep { height: 1px; margin: 6px -6px; background: var(--line); }

/* ───── Menú lateral + contenido ───── */
.v3-app { --v3-gap: 0px; min-height: calc(100vh - var(--v3-bar)); box-sizing: border-box; padding: 0; display: flex; gap: 0; align-items: stretch; }
.v3-side { flex: 0 0 248px; width: 248px; display: flex; flex-direction: column; gap: 12px; padding: 12px 8px; position: sticky; top: var(--v3-bar); align-self: flex-start; height: calc(100vh - var(--v3-bar)); box-sizing: border-box; overflow-y: auto; background: var(--side-bg); border-right: 1px solid var(--line); }
.v3-side-head { display: none; }
.v3-nav { display: flex; flex-direction: column; gap: 8px; }
.v3-nav-group { display: flex; flex-direction: column; gap: 1px; padding-bottom: 8px; border-bottom: 1px solid var(--line-2); }
.v3-nav-group:last-child { border-bottom: 0; }
.v3-nav-title { padding: 6px 8px 4px; font-size: 12px; font-weight: 600; color: var(--muted); }
.v3-nav-item { position: relative; display: flex; align-items: center; gap: 8px; width: 100%; height: 32px; padding: 0 8px; border: 0; border-radius: 6px; background: transparent; font: 400 14px var(--sans); color: var(--text); text-align: left; cursor: pointer; text-decoration: none; }
.v3-nav-item svg { color: var(--muted); flex: none; }
.v3-nav-item:hover { background: var(--hover); }
.v3-nav-item.active { background: var(--sel); font-weight: 600; }
.v3-nav-item.active::before { content: ''; position: absolute; left: -8px; top: 6px; bottom: 6px; width: 4px; border-radius: 6px; background: var(--navy); }
.v3-nav-item.active svg { color: var(--text); }
.v3-nav-item:disabled { cursor: default; opacity: .7; }
.v3-nav-item:disabled:hover { background: transparent; }
.v3-nav-item span.lbl { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.v3-soon { flex: none; padding: 0 6px; border: 1px solid var(--line); border-radius: 999px; font: 500 10px var(--sans); color: var(--muted); }

.v3-main { flex: 1 1 auto; min-width: 0; background: transparent; border: 0; border-radius: 0; display: flex; flex-direction: column; }
.v3-content { flex: 1; min-width: 0; width: 100%; max-width: 1400px; margin: 0 auto; }

.v3-overlay { display: none; }
.v3-export { position: fixed; inset: 0; z-index: 200; background: var(--overlay); display: flex; align-items: center; justify-content: center; padding: 20px; }
.v3-export-card { width: 100%; max-width: 360px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 24px; text-align: center; box-shadow: var(--shadow); }
.v3-export-spin { width: 36px; height: 36px; margin: 0 auto 14px; border: 3px solid var(--line); border-top-color: var(--navy); border-radius: 50%; animation: v3spin .8s linear infinite; }
.v3-export-card b { display: block; font-size: 15px; font-weight: 600; margin-bottom: 6px; }
.v3-export-card span { font: 400 12px var(--mono); color: var(--muted); }
@keyframes v3spin { to { transform: rotate(360deg); } }

@media (max-width: 1100px) {
  .v3-crumb { display: none; }
}
@media (max-width: 900px) {
  .v3-root { --v3-bar: 52px; --v3-top-alto: 52px; }
  .v3-bar { padding: 0 10px; gap: 8px; }
  .v3-org-txt small { display: none; }
  .v3-user-txt { display: none; }
  .v3-avatar .chev { display: none; }
  .v3-side { position: fixed; top: 0; left: 0; bottom: 0; height: auto; z-index: 120; padding: 14px 10px; box-shadow: var(--shadow); transform: translateX(-110%); transition: transform .2s ease; border-radius: 0 12px 12px 0; }
  .v3-side.open { transform: none; }
  .v3-side-head { display: block; font: 600 14px var(--sans); color: var(--text); padding: 4px 8px 6px; }
  .v3-overlay { display: block; position: fixed; inset: 0; z-index: 110; background: var(--overlay); opacity: 0; pointer-events: none; transition: opacity .2s; }
  .v3-overlay.show { opacity: 1; pointer-events: auto; }
  .v3-burger { display: inline-flex; }
}

/* Al imprimir (p. ej. el comprobante de egreso) solo sale el contenido de la página */
@media print {
  .v3-bar, .v3-side, .v3-overlay, .v3-export { display: none !important; }
  .v3-root, .v3-app { display: block; padding: 0; background: #fff; min-height: 0; }
  .v3-main { border: 0; border-radius: 0; }
  .v3-content { max-width: none; }
  body { background: #fff; }
}
`

export const BASE_V3 = TOKENS_V3 + `
:where(.page, .page *){margin:0;padding:0;box-sizing:border-box}
.page{min-height:auto;background:transparent;font-family:var(--sans);color:var(--text);display:flex;flex-direction:column}

/* ── Encabezado de página (antes barra azul) ── */
.top-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:20px 20px 0;background:none;position:static;height:auto;box-shadow:none}
.top-left{display:flex;align-items:center;gap:12px;min-width:0}
.back-btn{width:32px;height:32px;flex:none;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--text-2);cursor:pointer}
.back-btn:hover{background:var(--fill);color:var(--navy)}
.back-btn svg{width:16px;height:16px}
.top-title{font-family:var(--sans);font-size:24px;font-weight:600;letter-spacing:0;color:var(--text)}
.top-subtitle{font-size:13px;color:var(--muted);margin-top:4px}
.actions-bar{display:flex;gap:8px;flex-wrap:wrap}
.content{flex:1;width:100%;padding:16px 20px 24px;display:flex;flex-direction:column;gap:14px}

/* ── Pestañas de año y mes ── */
.tabs-años{display:inline-flex;flex-wrap:wrap;gap:0;padding:3px;border-radius:6px;background:var(--fill);border:1px solid var(--line);align-self:flex-start}
.tab-año{height:30px;padding:0 12px;border:0;border-radius:6px;background:transparent;font:500 13px var(--mono);color:var(--muted);cursor:pointer}
.tab-año.active{background:var(--card);color:var(--navy);font-weight:600;box-shadow:0 0 0 1px var(--line)}
.tab-año:hover:not(.active){color:var(--text)}
.tabs-meses-wrap{display:flex;flex-wrap:wrap;gap:0;padding:3px;border-radius:6px;background:var(--fill);align-self:flex-start;max-width:100%;overflow-x:auto;border:1px solid var(--line)}
.tab-mes{height:30px;padding:0 10px;border:0;border-radius:6px;background:transparent;font:500 12px var(--mono);letter-spacing:.02em;color:var(--muted);cursor:pointer;white-space:nowrap}
.tab-mes.active{background:var(--card);color:var(--text);font-weight:600;box-shadow:0 0 0 1px var(--line),inset 0 -2px 0 var(--navy)}
.tab-mes:hover:not(.active){color:var(--text);background:var(--hover)}

/* ── Tarjetas ── */
.card{background:var(--card);border:1px solid var(--line);border-radius:6px;box-shadow:none;overflow:hidden;position:relative}
.card > .card-title, .card > .table-card-head{padding:10px 14px;border-bottom:1px solid var(--line);background:var(--fill);margin:-0px}
.card-title{display:flex;align-items:center;justify-content:flex-start;gap:8px;font:600 14px var(--sans);letter-spacing:0;text-transform:none;color:var(--text)}
.card-title svg{color:var(--muted)}
.card-title .btn-add-tramo,.card-title .v3-soon{margin-left:auto}
.card-header{padding:14px 14px 0;display:flex;align-items:center;justify-content:space-between}
.info-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 16px;border-bottom:1px solid var(--line-2)}
.info-titulo{font:600 14px var(--sans);letter-spacing:0;text-transform:none;color:var(--text)}
.info-total{font-size:13px;color:var(--muted);margin-top:6px}
.info-total strong{font:600 16px var(--mono);color:var(--navy)}

/* ── Botones ── */
.btn,.btn-excel,.btn-pdf,.btn-modificar,.btn-actualizar,.btn-eliminar,.btn-cancelar-sel,.btn-buscar,.btn-add-secondary,.btn-add,.btn-modal-primary,.btn-modal-danger,.btn-modal-ghost,.btn-print,.btn-save,.select-btn,.toggle-btn,.tab{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:32px;padding:0 12px;border:1px solid var(--line);border-radius:6px;background:var(--fill);font:500 13px var(--sans);color:var(--text);cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s;box-shadow:none;transform:none;text-decoration:none}
.btn:hover,.btn-excel:hover,.btn-pdf:hover,.btn-modificar:hover,.btn-actualizar:hover,.btn-cancelar-sel:hover,.btn-add-secondary:hover,.btn-add:hover,.btn-modal-ghost:hover,.select-btn:hover,.toggle-btn:hover,.tab:hover{background:var(--fill);border-color:var(--line-strong);transform:none;box-shadow:none}
.btn:disabled,.btn-excel:disabled,.btn-modificar:disabled,.btn-actualizar:disabled,.btn-eliminar:disabled,.btn-cancelar-sel:disabled,.btn-buscar:disabled{opacity:.5;cursor:not-allowed}
.btn-primary,.btn-buscar,.btn-modal-primary,.btn-save,.btn-excel{background:var(--primary);border-color:rgba(31,35,40,.15);color:var(--on-primary);font-weight:600}
.btn-primary:hover,.btn-buscar:hover,.btn-modal-primary:hover,.btn-save:hover,.btn-excel:hover{background:var(--primary-hover);border-color:rgba(31,35,40,.15);color:var(--on-primary);transform:none;box-shadow:none}
.btn-secondary,.btn-ghost{background:var(--card);color:var(--text);border:1px solid var(--line)}
.btn-ghost:hover,.btn-secondary:hover{background:var(--fill)}
.btn-danger,.btn-eliminar,.btn-modal-danger{background:var(--card);color:var(--danger);border:1px solid var(--danger-line)}
.btn-danger:hover,.btn-eliminar:hover{background:var(--danger-soft)}
.btn-modal-danger{background:var(--danger);border-color:var(--danger);color:#fff}
.btn-modal-danger:hover{filter:brightness(.92)}
.btn-success,.btn-print{background:var(--card);color:var(--ok);border:1px solid var(--ok-line)}
.btn-success:hover,.btn-print:hover{background:var(--ok-soft)}
.btn-sm{height:28px;padding:0 10px;font-size:12px}
.btn-pdf{background:var(--card);color:var(--text)}
.btn-modificar.active,.btn-actualizar.active{background:var(--navy);border-color:var(--navy);color:#fff}
.btn-add-secondary,.btn-add{border-style:dashed;color:var(--navy)}
.btn-danger-sm,.btn-icon-x{width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:1px solid var(--line);border-radius:7px;background:var(--card);color:var(--muted);cursor:pointer;font-size:12px;line-height:1}
.btn-danger-sm:hover,.btn-icon-x:hover{background:var(--danger-soft);border-color:var(--danger-line);color:var(--danger)}
.btn-danger-sm:disabled,.btn-icon-x:disabled{opacity:.35;cursor:not-allowed}
.btn-add-member,.btn-add-row{flex-shrink:0;width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:1px solid var(--line);border-radius:7px;background:var(--card);color:var(--navy);font-size:16px;line-height:1;cursor:pointer}
.btn-add-row{width:22px;height:22px;font-size:13px}
.btn-add-member:hover,.btn-add-row:hover{background:var(--navy-soft);border-color:var(--navy-line)}
.btn-add-tramo{background:none;border:0;padding:2px 0;font:500 12px var(--sans);color:var(--navy);text-decoration:underline;text-underline-offset:2px;cursor:pointer}
.btn-edit-pct{width:24px;height:24px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);background:var(--card);color:var(--navy);border-radius:6px;cursor:pointer}
.btn-edit-pct:hover{background:var(--navy);color:#fff}
.icon-group{display:inline-flex;border:1px solid var(--line);border-radius:6px;overflow:hidden;background:var(--card)}
.icon-group button{display:flex;align-items:center;justify-content:center;width:36px;height:34px;border:0;background:var(--card);color:var(--text-2);cursor:pointer}
.icon-group button:not(:last-child){border-right:1px solid var(--line)}
.icon-group button:hover{background:var(--fill);color:var(--navy)}

/* ── Campos ── */
.filtro-row{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end}
.filtro-row .field{flex:0 1 200px}
.field,.field-wrap{display:flex;flex-direction:column;gap:6px}
.label,.field-label,.modal-field-label{font:500 12px var(--sans);color:var(--muted);letter-spacing:0;text-transform:none}
.input,.field-input,.text-input,.text-input-sm,.nombre-input,.fecha-input,.modal-input,.search-input,.edit-valor-input,.edit-nombre-input,.edit-desc-input,.edit-fecha-input,.tramo-base{height:34px;padding:0 10px;border:1px solid var(--line);border-radius:6px;background:var(--card);font:400 13px var(--sans);color:var(--text);outline:none;transition:border-color .15s,box-shadow .15s;width:auto;min-width:0}
textarea.input{height:auto;min-height:80px;padding:8px 10px;line-height:1.5}
.input.big{height:44px;font:600 20px var(--mono);color:var(--navy)}
.text-input,.text-input-sm,.nombre-input,.field-input,.modal-input,.search-input,.edit-nombre-input,.edit-desc-input{width:100%}
.num-input{width:100%;height:32px;padding:0 8px;border:1px solid var(--line);border-radius:6px;background:var(--card);font:400 13px var(--mono);color:var(--text);text-align:right;outline:none;font-variant-numeric:tabular-nums}
.edit-valor-input{width:110px;text-align:right;font-family:var(--mono)}
.input:focus,.field-input:focus,.text-input:focus,.text-input-sm:focus,.nombre-input:focus,.fecha-input:focus,.modal-input:focus,.search-input:focus,.num-input:focus,.edit-valor-input:focus,.edit-nombre-input:focus,.edit-desc-input:focus,.edit-fecha-input:focus,.tramo-base:focus{border-color:var(--navy);box-shadow:0 0 0 3px var(--focus)}
.input::placeholder,.text-input::placeholder,.num-input::placeholder,.search-input::placeholder,.field-input::placeholder{color:var(--muted-2)}
select.input,select{cursor:pointer}
.text-input-sm-plain{width:100%;height:32px;padding:0 8px;border:1px solid transparent;border-radius:6px;background:transparent;font:500 13px var(--sans);color:var(--text);outline:none}
.text-input-sm-plain:hover{border-color:var(--line);background:var(--card)}
.text-input-sm-plain:focus{border-color:var(--navy);background:var(--card);box-shadow:0 0 0 3px var(--focus)}
.search-wrap{position:relative;flex:0 1 380px;min-width:200px}
.search-wrap svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted);pointer-events:none}
.search-input{padding-left:32px}
.toggle-wrap{display:flex;align-items:center;gap:10px;padding-top:22px}
.toggle{width:38px;height:22px;border-radius:999px;border:0;cursor:pointer;position:relative;flex-shrink:0}
.toggle.on{background:var(--navy)}
.toggle.off{background:var(--line-strong)}
.toggle::after{content:'';position:absolute;top:3px;width:16px;height:16px;background:var(--card);border-radius:50%;transition:left .2s}
.toggle.on::after{left:19px}
.toggle.off::after{left:3px}
.toggle-label{font-size:13px;font-weight:500;color:var(--text)}
.toggle-row,.filtro-tabs,.tabs-row{display:inline-flex;flex-wrap:wrap;gap:0;padding:3px;border-radius:6px;background:var(--fill);border:1px solid var(--line);align-self:flex-start;width:fit-content}
.toggle-btn,.tab,.tab-btn{height:28px;padding:0 12px;border:0;border-radius:6px;background:transparent;font:500 12px var(--sans);color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.toggle-btn:hover,.tab:hover,.tab-btn:hover{background:var(--hover);border-color:transparent}
.toggle-btn.active,.tab.active,.tab-btn.active{background:var(--card);color:var(--text);font-weight:600;box-shadow:0 0 0 1px var(--line);border-color:transparent}
.tab-badge{padding:1px 6px;border-radius:999px;background:var(--line);color:var(--text-2);font:600 11px var(--mono)}
.tab-btn.active .tab-badge{background:var(--navy);color:#fff}
.tramo-row{display:flex;align-items:center;gap:6px}
.tramo-pct{width:58px;flex-shrink:0}
.tramo-base{flex:1;font-size:12px}
.pct-summary{display:flex;align-items:center;gap:8px;cursor:pointer;padding:4px 6px;border-radius:6px}
.pct-summary:hover{background:var(--fill)}
.pct-summary span{font:400 12px var(--mono);color:var(--text-2)}

/* ── Tablas ── */
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13px}
thead tr{background:var(--fill)}
th{padding:9px 12px;font:600 12px var(--sans);letter-spacing:0;text-transform:none;color:var(--muted);border-bottom:1px solid var(--line);white-space:nowrap;background:var(--fill)}
td{padding:9px 12px;border-bottom:1px solid var(--line-2);vertical-align:middle;color:var(--text);font-size:13px}
tbody tr:hover{background:var(--row-hover)}
tfoot td{padding:11px 12px;background:var(--fill);border-top:1px solid var(--line);border-bottom:0;font:600 13px var(--mono);color:var(--text)}
.cc{text-align:center}
.cr,.num{text-align:right;font-variant-numeric:tabular-nums}
.cl{text-align:left}
td.cc,td.cr{font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}
/* Fila principal de cada comprobante: sutil (rayita azul, fondo apenas más claro, negrilla solo donde importa) */
.tr-iglesia td,.tr-principal td{background:var(--fill) !important;font-weight:400;color:var(--text);border-top:1px solid var(--line-2);border-bottom:1px solid var(--line-2)}
.tr-iglesia td:first-child,.tr-principal td:first-child{box-shadow:inset 3px 0 0 var(--navy)}
.tr-principal td:nth-child(2),.tr-principal td.cl,.tr-iglesia td.cl{font-weight:600}
.tr-contra td{color:var(--muted)}
.tr-sep td{height:6px;padding:0;background:transparent;border:0}
.tr-totales td{background:var(--fill);color:var(--text);font:600 13px var(--mono);border-top:1px solid var(--line)}
.tr-ingreso td{background:var(--fill)}
.tr-saldo-ant td{background:var(--fill);color:var(--text-2);font-weight:600;font-style:normal}
.val-ig,.val-ppal{color:var(--text);font-weight:600}
.ecr{color:var(--muted);font-weight:500;font-size:11px}
.val-ing,.ing,.saldo-pos,.val-saldo-pos{color:var(--navy);font-weight:600}
.val-egr,.egr{color:var(--text-2);font-weight:600}
.saldo-neg,.val-saldo-neg{color:var(--danger);font-weight:700}
.td-desc{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default}
.td-desc:hover,.desc-cell:hover{overflow:visible;white-space:normal;position:relative;z-index:10;background:var(--card)}
.desc-cell{max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default}
.valor-editable,.desc-editable{cursor:pointer;border-bottom:1px dashed transparent}
.valor-editable:hover,.desc-editable:hover{border-bottom-color:var(--navy)}
.row-checkbox{width:15px;height:15px;accent-color:var(--navy);cursor:pointer}
.col-header{display:flex;flex-direction:column;align-items:center;gap:2px}
.col-puc{font:600 11px var(--mono);color:var(--navy);text-transform:none;letter-spacing:0}

/* ── Avisos ── */
.alert,.alert-success,.alert-error,.err,.error-msg{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:6px;font-size:13px;margin:0}
.alert-success{background:var(--ok-soft);border:1px solid var(--ok-line);color:var(--ok)}
.alert-error,.err{background:var(--danger-soft);border:1px solid var(--danger-line);color:var(--danger)}
.err{margin:12px 16px}
.edit-banner{margin:12px 16px 0;padding:10px 12px;background:var(--navy-soft);border:1px solid var(--navy-line);color:var(--navy);border-radius:6px;font-size:12px}
.fecha-alerta{display:flex;align-items:center;gap:8px;margin-top:8px;padding:10px 12px;border-radius:6px;background:var(--warn-soft);border:1px solid var(--warn-line);color:var(--warn);font-size:12px}
.empty,.load-wrap,.loading{text-align:center;padding:48px 20px;color:var(--muted);font-size:13px}
.spinner{width:28px;height:28px;border:3px solid var(--line);border-top-color:var(--navy);border-radius:50%;animation:v3spin .8s linear infinite;margin:0 auto 12px}

/* ── Ventanas emergentes ── */
.modal-overlay{position:fixed;inset:0;z-index:300;background:var(--overlay);display:flex;align-items:center;justify-content:center;padding:20px}
.modal-card,.modal-box{width:100%;max-width:400px;background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:12px;padding:20px;box-shadow:var(--shadow)}
.modal-title{display:flex;align-items:center;justify-content:space-between;gap:10px;font:600 16px var(--sans);color:var(--text);margin-bottom:6px}
.modal-sub,.modal-subtitle{font-size:13px;color:var(--muted);margin-bottom:14px}
.modal-input{margin-bottom:10px}
.modal-error{font-size:12px;color:var(--danger);margin:-2px 0 10px}
.modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:6px}
.modal-cancel{margin-top:12px;background:none;border:0;color:var(--muted);font:500 13px var(--sans);cursor:pointer;width:100%;padding:6px}
.modal-cancel:hover{color:var(--text)}
.modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
@media(max-width:480px){.modal-grid{grid-template-columns:1fr}}

/* ── Autocompletar ── */
.autocomplete-dropdown{position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:200;background:var(--card);border:1px solid var(--line);border-radius:6px;box-shadow:var(--shadow);overflow:hidden;text-align:left}
.autocomplete-item{width:100%;display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:8px 10px;border:0;background:none;cursor:pointer;font-family:var(--sans)}
.autocomplete-item:hover{background:var(--fill)}
.autocomplete-nombre{font-size:13px;font-weight:500;color:var(--text)}
.autocomplete-cedula{font:400 11px var(--mono);color:var(--muted)}

/* ── Etiquetas ── */
.badge,.tipo-badge{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:500;border:0}
.badge-active,.tipo-badge{background:var(--navy-soft);color:var(--navy);box-shadow:inset 0 0 0 1px var(--navy-line)}
.badge-inactive{background:var(--fill);color:var(--muted);box-shadow:inset 0 0 0 1px var(--line)}
.badge-dot{width:6px;height:6px;border-radius:50%}
.badge-active .badge-dot{background:var(--navy)}
.badge-inactive .badge-dot{background:var(--muted-2)}
.count-badge{font:400 12px var(--mono);color:var(--muted);white-space:nowrap}
.dist-fijo{font:500 11px var(--mono);color:var(--muted);background:var(--fill);padding:3px 8px;border-radius:999px}

/* ── Tarjetas de resumen (informes) ── */
.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:0}
.summary-card{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:14px;box-shadow:none}
.summary-card.main{background:var(--card);border-color:var(--line);box-shadow:none}
.s-label{font:500 12px var(--sans);letter-spacing:0;text-transform:none;color:var(--muted);margin-bottom:6px}
.s-value{font:600 20px var(--mono);letter-spacing:-.02em;color:var(--text);font-variant-numeric:tabular-nums}
.summary-card.main .s-label{color:var(--muted)}
.summary-card.main .s-value{color:var(--text);font-size:22px}
.s-sub,.s-pct{font-size:12px;color:var(--muted);margin-top:4px}
.var-pos{color:var(--navy)}
.var-neg{color:var(--danger)}
.letras-box,.letras-line{background:var(--fill);border:1px solid var(--line);border-radius:6px;padding:12px 14px;font-size:12px;color:var(--text-2);font-style:normal;margin:0}
.letras-line strong{font:600 13px var(--mono);color:var(--text)}
.chart-wrap{background:var(--card);border-radius:0;padding:14px;overflow-x:auto}
.dist-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;padding:14px}
.dist-card{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:12px}
.dist-concepto{font-size:12px;color:var(--muted);margin-bottom:6px}
.dist-monto{font:600 16px var(--mono);color:var(--text)}
.resumen{display:flex;gap:18px;flex-wrap:wrap;margin-top:6px}
.resumen-item{font-size:13px;color:var(--muted)}
.resumen-item strong{font:600 13px var(--mono)}

/* ── Gráfica de barras V3 (cuadritos) ── */
.v3-hbar{display:flex;flex-direction:column;gap:12px}
.v3-hbar-row{display:flex;align-items:center;gap:12px;font-size:13px}
.v3-hbar-row .n{width:130px;flex:none}
.v3-hbar-row .v{width:100px;flex:none;text-align:right;font:600 13px var(--mono)}
.v3-hbar-row .p{width:56px;flex:none;text-align:right;font:400 12px var(--mono);color:var(--muted)}
.v3-hbar-row .v3-pix{flex:1}

@keyframes v3spin{to{transform:rotate(360deg)}}
@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:768px){.content{padding:14px 12px 20px}.top-bar{padding:16px 12px 0}}
`
