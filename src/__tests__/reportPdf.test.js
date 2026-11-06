import { describe, expect, it } from 'vitest';
import { buildReportPdf } from '../reportPdf';

const doc = {
  title: 'Rapport test', status: 'final',
  sections: [
    { key: 'cover', title: 'Page de présentation', number: null, blocks: [{ t: 'title', text: 'Rapport test' }, { t: 'meta', text: 'Généré le 5 novembre 2026' }, { t: 'pagebreak' }] },
    { key: 'general', title: 'Informations générales', number: 1, blocks: [{ t: 'kv', rows: [['Titre', 'Enquête'], ['Zone', null]] }] },
    { key: 'context', title: 'Contexte', number: 2, blocks: [{ t: 'missing', text: 'À compléter' }] },
    { key: 'results', title: 'Résultats', number: 3, blocks: [
      { t: 'h3', text: '1. Question ?' }, { t: 'bars', rows: [{ label: 'Oui', count: 2, percent: 66.7 }, { label: 'Non', count: 0, percent: 0 }] },
      { t: 'table', head: ['Réponse', 'Licence'], rows: [['Oui', '1 (100 %)']] },
      { t: 'series', title: 'Évolution', rows: [{ date: '2026-10-01', responses: 2 }, { date: '2026-10-02', responses: 0 }] },
      { t: 'warn', title: 'Vigilance', items: ['Échantillon réduit'] }, { t: 'bullets', items: ['a', 'b'] }, { t: 'p', text: 'Texte' },
    ] },
  ],
};

describe('export PDF du rapport', () => {
  it('génère un PDF avec tous les types de blocs', () => {
    const pdf = buildReportPdf(doc);
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    expect(pdf.output('arraybuffer').byteLength).toBeGreaterThan(2000);
  });

  it('passe à la page suivante quand le contenu est long', () => {
    const long = { ...doc, sections: [{ key: 'x', title: 'Long', number: 1, blocks: Array.from({ length: 120 }, (_, i) => ({ t: 'p', text: `Paragraphe ${i} `.repeat(20) })) }] };
    expect(buildReportPdf(long).getNumberOfPages()).toBeGreaterThan(3);
  });

  it('supporte un document sans aucun résultat', () => {
    expect(() => buildReportPdf({ title: 'Vide', status: 'draft', sections: [] })).not.toThrow();
  });
});
