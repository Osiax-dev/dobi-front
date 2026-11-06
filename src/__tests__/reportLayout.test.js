import { describe, expect, it } from 'vitest';
import { addExtra, emptyCustom, moveSection, removeExtra, resolveLayout, setExplanation, toggleHidden, toggleQuestion, updateExtra } from '../reportLayout';

const keys = (c) => resolveLayout(c).map((s) => s.key);

describe('mise en page du rapport', () => {
  it('ordre par défaut et numérotation', () => {
    const l = resolveLayout(emptyCustom());
    expect(l).toHaveLength(11);
    expect(l[0]).toMatchObject({ key: 'cover', number: null });
    expect(l[1].number).toBe(1);
    expect(l[10].number).toBe(10);
  });

  it('déplace une section sans jamais bouger la page de présentation', () => {
    const c = moveSection(emptyCustom(), 'conclusions', -1);
    expect(keys(c).indexOf('conclusions')).toBeLessThan(keys(c).indexOf('analysis'));
    expect(keys(c)[0]).toBe('cover');
    expect(keys(moveSection(emptyCustom(), 'general', -1))[1]).toBe('general'); // déjà en tête
    expect(keys(moveSection(emptyCustom(), 'annexes', 1))).toHaveLength(11);
  });

  it('masque et réaffiche, numérotation sans trou, cover non masquable', () => {
    let c = toggleHidden(emptyCustom(), 'methodology');
    const l = resolveLayout(c);
    expect(l.find((s) => s.key === 'methodology')).toMatchObject({ hidden: true, number: null });
    const numbers = l.filter((s) => s.number).map((s) => s.number);
    expect(numbers).toEqual(Array.from({ length: numbers.length }, (_, i) => i + 1));
    expect(toggleHidden(c, 'cover').hidden).not.toContain('cover');
    c = toggleHidden(c, 'methodology');
    expect(resolveLayout(c).find((s) => s.key === 'methodology').hidden).toBe(false);
  });

  it('ajoute, modifie, déplace et supprime un paragraphe libre', () => {
    let c = addExtra(emptyCustom());
    expect(c.extras[0].id).toBe('x1');
    expect(keys(c).at(-1)).toBe('x1');
    c = updateExtra(c, 'x1', { title: 'Remerciements', body: 'Merci' });
    expect(resolveLayout(c).find((s) => s.key === 'x1').title).toBe('Remerciements');
    c = moveSection(c, 'x1', -1);
    expect(keys(c).indexOf('x1')).toBe(keys(c).length - 2);
    c = removeExtra(c, 'x1');
    expect(keys(c)).toHaveLength(11);
    expect(c.order).not.toContain('x1');
  });

  it('limite à 10 paragraphes libres', () => {
    let c = emptyCustom();
    for (let i = 0; i < 12; i++) c = addExtra(c);
    expect(c.extras).toHaveLength(10);
  });

  it('explications : texte modifié conservé, texte identique ou vide = automatique', () => {
    let c = setExplanation(emptyCustom(), 5, 'Mon texte', 'Auto');
    expect(c.explanations).toEqual({ 5: 'Mon texte' });
    c = setExplanation(c, 5, 'Auto', 'Auto');
    expect(c.explanations).toEqual({});
    c = setExplanation(c, 5, '   ', 'Auto');
    expect(c.explanations).toEqual({});
  });

  it('masque une question du rapport', () => {
    let c = toggleQuestion(emptyCustom(), 7);
    expect(c.hidden_questions).toEqual([7]);
    c = toggleQuestion(c, 7);
    expect(c.hidden_questions).toEqual([]);
  });

  it('accepte une mise en page absente ou venue d’un ancien rapport', () => {
    expect(resolveLayout(null)).toHaveLength(11);
    expect(resolveLayout({ explanations: [] })).toHaveLength(11);
  });
});
