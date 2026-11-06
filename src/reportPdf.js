import { jsPDF } from 'jspdf';

const FOREST = [16, 47, 43];
const LIME = [213, 240, 106];
const GREY = [110, 125, 120];
const ALERT = [180, 83, 31];
const W = 210, M = 16, CW = W - 2 * M;

const pct = (v) => (v == null ? '' : ` · ${String(Math.round(v * 10) / 10).replace('.', ',')} %`);

/** PDF du rapport à partir du document composé par le serveur (mêmes sections, même ordre que le Word). */
export function buildReportPdf(document) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 0;

  const header = () => {
    doc.setFillColor(...FOREST); doc.rect(0, 0, W, 16, 'F');
    doc.setFillColor(...LIME); doc.rect(M, 5, 2.5, 6, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('DOBI', M + 5, 10);
    y = 26;
  };
  const room = (h) => { if (y + h > 278) { doc.addPage(); header(); } };
  const font = (size, bold = false, color = FOREST, italic = false) => {
    doc.setFont('helvetica', bold ? (italic ? 'bolditalic' : 'bold') : (italic ? 'italic' : 'normal')); doc.setFontSize(size); doc.setTextColor(...color);
  };
  const para = (text, size = 10, opts = {}) => {
    font(size, opts.bold, opts.color || FOREST, opts.italic);
    const lines = doc.splitTextToSize(String(text), (opts.width || CW) - (opts.indent || 0));
    const lh = size * 0.46;
    lines.forEach((line) => { room(lh + 1); doc.text(line, M + (opts.indent || 0), y); y += lh; });
    y += opts.after ?? 2;
  };

  header();
  const status = document.status === 'final' ? 'Finalisé' : 'Brouillon';

  document.sections.forEach((section) => {
    if (section.number !== null) {
      room(18);
      y += 3;
      para(`${section.number}. ${section.title}`, 15, { bold: true, after: 3 });
    }
    section.blocks.forEach((b) => {
      switch (b.t) {
        case 'title': y += 40; para(b.text, 26, { bold: true, after: 6 }); break;
        case 'h3': room(12); y += 2; para(b.text, 11.5, { bold: true, after: 1 }); break;
        case 'p': para(b.text, 10); break;
        case 'meta': para(b.text, 8.5, { italic: true, color: GREY }); break;
        case 'missing': para(b.text, 10, { bold: true, italic: true, color: ALERT }); break;
        case 'pagebreak': doc.addPage(); header(); break;
        case 'bullets': b.items.forEach((t) => para(`•  ${t}`, 10, { indent: 3, after: 1 })); y += 1; break;
        case 'warn':
          para(b.title, 10, { bold: true, color: ALERT, after: 1 });
          b.items.forEach((t) => para(`•  ${t}`, 10, { indent: 3, after: 1 }));
          y += 2; break;
        case 'kv':
          b.rows.forEach(([label, value]) => {
            const missing = value === null || value === '';
            const lines = doc.splitTextToSize(missing ? 'À compléter' : String(value), CW - 62);
            room(lines.length * 4.6 + 2);
            font(9.5, true); doc.text(String(label), M, y);
            font(9.5, missing, missing ? ALERT : FOREST, missing); doc.text(lines, M + 60, y);
            y += lines.length * 4.6 + 1.5;
          });
          y += 2; break;
        case 'table': {
          const n = b.head.length || 1, cw = CW / n;
          room(10);
          doc.setFillColor(...FOREST); doc.rect(M, y - 4, CW, 6.5, 'F');
          font(9, true, [255, 255, 255]);
          b.head.forEach((h, i) => doc.text(doc.splitTextToSize(String(h), cw - 2)[0], M + i * cw + 1.5, y));
          y += 5;
          b.rows.forEach((row) => {
            const cells = row.map((c) => doc.splitTextToSize(String(c), cw - 3));
            const h = Math.max(...cells.map((c) => c.length)) * 4.3 + 2;
            room(h);
            font(9);
            cells.forEach((c, i) => doc.text(c, M + i * cw + 1.5, y));
            doc.setDrawColor(220, 226, 223); doc.line(M, y + h - 3, M + CW, y + h - 3);
            y += h;
          });
          y += 3; break;
        }
        case 'bars': {
          const max = Math.max(...b.rows.map((r) => r.count), 1);
          b.rows.forEach((r) => {
            room(7);
            font(9);
            doc.text(doc.splitTextToSize(String(r.label), 60)[0], M, y + 3.5);
            doc.setFillColor(235, 238, 235); doc.rect(M + 64, y, 78, 5, 'F');
            doc.setFillColor(...FOREST); doc.rect(M + 64, y, r.count ? Math.max((r.count / max) * 78, 0.8) : 0, 5, 'F');
            font(9); doc.text(`${r.count}${pct(r.percent)}`, M + 146, y + 3.5);
            y += 7;
          });
          y += 2; break;
        }
        case 'series': {
          const h = 34;
          room(h + 14);
          para(b.title, 9.5, { bold: true, after: 1 });
          const rows = b.rows, max = Math.max(...rows.map((r) => r.responses), 1);
          const bw = CW / rows.length;
          doc.setDrawColor(200, 208, 205); doc.line(M, y + h, M + CW, y + h);
          doc.setFillColor(...FOREST);
          rows.forEach((r, i) => { const bh = (r.responses / max) * (h - 4); if (bh > 0) doc.rect(M + i * bw + bw * 0.1, y + h - bh, Math.max(bw * 0.8, 0.3), bh, 'F'); });
          font(8, false, GREY);
          doc.text(String(rows[0].date), M, y + h + 4);
          doc.text(String(rows[rows.length - 1].date), M + CW, y + h + 4, { align: 'right' });
          doc.text(`max. ${max}/jour`, M + CW / 2, y + h + 4, { align: 'center' });
          y += h + 9; break;
        }
        default: break;
      }
    });
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); font(8, false, GREY);
    doc.text(`DOBI — ${document.title} — ${status} — page ${p}/${pages}`.slice(0, 120), W / 2, 290, { align: 'center' });
  }
  return doc;
}
