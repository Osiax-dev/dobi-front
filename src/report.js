import { jsPDF } from 'jspdf';

const FOREST = [16, 47, 43];
const LIME = [213, 240, 106];
const GREY = [110, 125, 120];

/** Rapport PDF des résultats (indicateurs + répartition de chaque question), à partir des données de l'API. */
export function buildReport(data, orgName = '') {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 16;
  let y = 0;

  const header = () => {
    doc.setFillColor(...FOREST); doc.rect(0, 0, W, 24, 'F');
    doc.setFillColor(...LIME); doc.rect(M, 8, 3, 8, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('DOBI', M + 6, 14.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text('Les données ont une histoire.', M + 6, 19);
    y = 36;
  };
  const room = (h) => { if (y + h > 280) { doc.addPage(); header(); } };
  const text = (t, size = 10, bold = false, color = FOREST) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(t), W - 2 * M);
    room(lines.length * size * 0.45 + 2);
    doc.text(lines, M, y);
    y += lines.length * size * 0.45 + 2;
  };

  header();
  text(data.study.title, 18, true);
  if (orgName) text(orgName, 10, false, GREY);
  const f = data.filters || {};
  const filters = [f.from && `du ${f.from}`, f.to && `au ${f.to}`, f.version && 'version filtrée'].filter(Boolean).join(' ');
  text(`Rapport généré le ${new Date().toLocaleDateString('fr-FR')}${filters ? ` — ${filters}` : ''}`, 9, false, GREY);
  y += 3;

  const fmt = (x) => (x ? new Date(x).toLocaleDateString('fr-FR') : '—');
  text(`${data.totals.responses} réponse(s) — première : ${fmt(data.totals.first_response_at)}, dernière : ${fmt(data.totals.last_response_at)}`, 11, true);
  y += 4;

  data.questions.forEach((q, i) => {
    room(28);
    text(`${i + 1}. ${q.label}`, 11, true);
    text(`${q.n} réponse(s)${q.response_rate != null ? ` (${q.response_rate} % des participants)` : ''}`, 9, false, GREY);
    if (q.insufficient_data) { text(`Pas assez de réponses pour afficher le détail (minimum ${data.min_group_size}).`, 9); y += 3; return; }
    if (q.stats) text(`Moyenne ${q.stats.average} — min ${q.stats.min} — max ${q.stats.max}`, 10);
    if (q.distribution) {
      const max = Math.max(...q.distribution.map((d) => d.count), 1);
      const total = q.distribution.reduce((s, d) => s + d.count, 0) || 1;
      q.distribution.forEach((d) => {
        room(7);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...FOREST);
        doc.text(doc.splitTextToSize(String(d.label), 60)[0], M, y + 3.5);
        doc.setFillColor(235, 238, 235); doc.rect(M + 64, y, 80, 5, 'F');
        doc.setFillColor(...FOREST); doc.rect(M + 64, y, Math.max((d.count / max) * 80, d.count ? 0.8 : 0), 5, 'F');
        doc.text(`${d.count} (${Math.round((d.count / total) * 100)} %)`, M + 148, y + 3.5);
        y += 7;
      });
    }
    y += 4;
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GREY);
    doc.text(`DOBI — page ${p}/${pages}`, W / 2, 290, { align: 'center' });
  }
  return doc;
}
