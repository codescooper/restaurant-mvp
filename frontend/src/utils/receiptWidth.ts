// Format papier du ticket thermique (58 ou 80 mm).
//
// La règle CSS `@page` ne peut pas être ciblée par une classe ou un attribut : pour
// changer la taille du papier à la volée, on injecte / met à jour une balise <style>
// dédiée dans <head>. La largeur utile du contenu est exposée via la variable CSS
// `--receipt-width`, lue par `.print-area` dans index.css.
//
// index.css garde un `@page 80mm` par défaut (fallback si ce module n'a pas encore
// tourné) ; la balise injectée, placée après la feuille de styles, l'emporte.

export type ReceiptWidth = '58' | '80';

const STYLE_ID = 'receipt-page-size';

// Marges et largeur utile par format (largeur papier − 2 × marge).
const GEOMETRY: Record<ReceiptWidth, { page: string; margin: string; content: string }> = {
  '58': { page: '58mm', margin: '3mm', content: '52mm' },
  '80': { page: '80mm', margin: '4mm', content: '72mm' },
};

export function applyReceiptWidth(width: ReceiptWidth): void {
  const g = GEOMETRY[width] ?? GEOMETRY['80'];
  document.documentElement.style.setProperty('--receipt-width', g.content);

  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `@media print { @page { size: ${g.page} auto; margin: ${g.margin}; } }`;
}
