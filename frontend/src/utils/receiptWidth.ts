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
// Largeurs alignées sur la zone imprimable réelle des têtes thermiques POS courantes :
//   80 mm → ~72 mm imprimables (marge 4 mm/côté) ; 58 mm → ~48 mm (marge 5 mm/côté).
const GEOMETRY: Record<ReceiptWidth, { page: string; margin: string; content: string }> = {
  '58': { page: '58mm', margin: '5mm', content: '48mm' },
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
