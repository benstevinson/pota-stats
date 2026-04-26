export const PAGE_CSS = `
*,*:before,*:after{box-sizing:border-box}
body{margin:0 auto;padding:20px 30px;max-width:740px;font-family:Verdana,Geneva,sans-serif;font-size:14px;line-height:1.4;color:#000;background:#fff}
a{color:#00e}
a:visited{color:#551a8b}
.site-header{margin-bottom:2rem}
.site-brand{margin:0;font-size:1.6rem;font-weight:700;line-height:1.2}
.site-brand a{color:inherit;text-decoration:none}
.site-header nav{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:.4rem;font-size:.95em}
.site-header nav a{text-decoration:none}
h1{font-size:1.5rem;line-height:1.25;margin-top:0}
h2{font-size:1.15rem;line-height:1.3;margin-top:2rem}
h3{font-size:1rem;line-height:1.3;margin-top:1.5rem}
.stats-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.75rem;margin-bottom:1.5rem}
.stat-card{background:#f9f9f9;padding:1.25rem .75rem;text-align:center;border:1px solid #eee}
.stat-card[title]{cursor:help}
.stat-value{font-size:2rem;font-weight:700}
.stat-label{font-size:.85em;color:#666;margin-top:.3rem}
.static-summary{border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:1rem 0;margin:1rem 0 1.25rem}
.static-summary h2,.static-summary h3{margin-top:0}
.static-summary p{color:#555;font-size:.9em}
.static-tables{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}
.static-table{width:100%;border-collapse:collapse;font-size:.85em}
.static-table th,.static-table td{padding:.35rem .45rem;border-bottom:1px solid #eee;text-align:left}
.static-table th{color:#666;font-weight:600}
.loading-status{padding:.75rem;background:#f5f5f5;margin-bottom:1rem;font-family:monospace;font-size:.85em}
.loading-dots{animation:blink 1.4s infinite}
@keyframes blink{0%,20%{opacity:1}50%{opacity:0}80%,100%{opacity:1}}
.loading-status.error{background:#fee;color:#c00}
.loading-status.success{background:#efe;color:#060}
.data-timestamp{font-size:.8em;color:#666;margin-bottom:1rem;padding:.4rem 0}
.data-timestamp time{font-weight:500}
.controls{display:flex;flex-wrap:wrap;gap:.75rem;margin-bottom:1rem}
.control-group{display:flex;align-items:center;gap:.4rem}
.control-group label{font-size:.8em;font-weight:600;color:#666}
.control-group select{padding:.4rem;border:1px solid #ccc;font-size:.85em;font-family:inherit;min-width:110px}
.chart-container{position:relative;margin-bottom:1.5rem;padding:.75rem;border:1px solid #eee}
.chart-container h3{margin-top:0;margin-bottom:.75rem;font-size:1rem}
.chart-wrapper{position:relative;height:280px}
.chart-desc{color:#666;font-size:.8em;margin-top:-.4rem;margin-bottom:.75rem}
.table-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem}
.table-header h3{margin:0}
.data-table{width:100%;border-collapse:collapse;margin-top:.5rem;font-size:.85em}
.data-table th,.data-table td{padding:.4rem .5rem;text-align:left;border-bottom:1px solid #eee}
.data-table th{background:#f5f5f5;font-weight:600}
.data-table tr:hover{background:#f9f9f9}
.section-title{font-size:1.15rem;margin-top:1.5rem;margin-bottom:.4rem;padding-top:1rem;border-top:1px solid #eee}
.section-desc{color:#666;margin-bottom:.75rem;font-size:.9em}
.entity-tables{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:.75rem}
.note{font-size:.8em;color:#666;font-style:italic;margin-top:1.5rem;padding:.75rem;background:#f9f9f9}
.toggle-label{display:flex;align-items:center;gap:.4rem;cursor:pointer;font-size:.8em}
.toggle-label input[type="checkbox"]{width:32px;height:18px;appearance:none;background:#ccc;border-radius:9px;position:relative;cursor:pointer;transition:background .2s}
.toggle-label input[type="checkbox"]::before{content:"";position:absolute;width:14px;height:14px;border-radius:50%;background:#fff;top:2px;left:2px;transition:transform .2s}
.toggle-label input[type="checkbox"]:checked{background:#3498db}
.toggle-label input[type="checkbox"]:checked::before{transform:translateX(14px)}
.toggle-text{font-weight:600;color:#666}
.faq-section{margin-top:1.5rem;border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:.75rem 0}
.faq-header{margin:0 0 .25rem;font-size:1.15rem}
.faq-content{padding:0 .75rem .75rem;border-top:1px solid #eee}
.faq-item{padding:.75rem 0;border-bottom:1px solid #eee}
.faq-item:last-child{border-bottom:none;padding-bottom:0}
.faq-item h4{margin:0 0 .4rem;font-size:.95em}
.faq-item p{margin:0 0 .4rem;font-size:.85em;color:#555;line-height:1.5}
.faq-item p:last-child{margin-bottom:0}
.faq-item ul{margin:.4rem 0;padding-left:1.5rem;font-size:.85em;color:#555;line-height:1.5}
.faq-item li{margin-bottom:.2rem}
.site-footer{margin-top:2rem}
.site-footer hr{border:none;border-top:1px solid #ddd}
.site-footer h2{font-size:1rem;margin:1rem 0 .3rem}
.site-footer p{font-size:.9em;margin:0 0 1rem}
.easter-egg{text-align:center;margin:.5rem 0 0}
.easter-egg a,.easter-egg a:visited{font-size:8pt;font-style:italic;color:#666;text-decoration:none}
@media(max-width:480px){
body{padding:14px 20px}
.site-brand{font-size:1.4rem}
.stat-value{font-size:1.6rem}
.chart-wrapper{height:220px}
.entity-tables{grid-template-columns:1fr}
.static-tables{grid-template-columns:1fr}
}
`;
