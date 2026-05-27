// Slugifie un nom en kebab-case ASCII (60 chars max).
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')        // diacritiques combinants
    .toLowerCase()
    .replace(/°/g, 'o ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}
