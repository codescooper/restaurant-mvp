#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// sync-docs.mjs — régénère les sections « source de vérité » de la documentation
// à partir du code (schéma Prisma, migrations, routes Express, scripts npm).
//
// Usage :
//   node scripts/sync-docs.mjs            # régénère les blocs AUTO:* dans docs/
//   node scripts/sync-docs.mjs --check    # échoue (code 1) si un fichier serait modifié
//
// Aucune dépendance externe (Node >= 18). Chaque section régénérée est délimitée
// dans les fichiers Markdown par :  <!-- AUTO:CLE:START -->  …  <!-- AUTO:CLE:END -->
// Le contenu HORS de ces balises est rédigé à la main et n'est jamais touché.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const exists = (p) => existsSync(join(ROOT, p));

// ── Collecte des données depuis le code ──────────────────────────────────────

/** Modèles Prisma : { name, fields:[{name,type}] }. */
function parsePrismaModels() {
  const src = read('backend/prisma/schema.prisma');
  const models = [];
  const re = /^model\s+(\w+)\s*\{([\s\S]*?)^}/gm;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    const fields = [];
    for (const line of m[2].split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('@@') || t.startsWith('//')) continue;
      const parts = t.split(/\s+/);
      if (parts.length < 2) continue;
      const [fname, ftype] = parts;
      if (!/^\w/.test(fname)) continue;
      fields.push({ name: fname, type: ftype });
    }
    models.push({ name, fields });
  }
  return models;
}

/** Dossiers de migrations Prisma triés (du plus ancien au plus récent). */
function parseMigrations() {
  const dir = 'backend/prisma/migrations';
  if (!exists(dir)) return [];
  return readdirSync(join(ROOT, dir))
    .filter((d) => statSync(join(ROOT, dir, d)).isDirectory())
    .sort()
    .map((d) => {
      const m = d.match(/^(\d{4})(\d{2})(\d{2})\d{6}_(.+)$/);
      const date = m ? `${m[1]}-${m[2]}-${m[3]}` : '—';
      const label = m ? m[4].replace(/_/g, ' ') : d;
      return { dir: d, date, label };
    });
}

/** Groupes de routes montés dans routes/index.ts : { path, scope }. */
function parseRoutes() {
  const src = read('backend/src/routes/index.ts');
  const routes = [];
  const re = /router\.use\(\s*'(\/[^']*)'\s*,?([^)]*)\)/g;
  let m;
  while ((m = re.exec(src))) {
    const path = m[1];
    const rest = m[2] || '';
    let scope = 'public';
    if (/\.\.\.tenant/.test(rest)) scope = 'tenant';
    else if (['/auth'].includes(path)) scope = 'auth';
    else if (['/admin'].includes(path)) scope = 'super-admin';
    routes.push({ path, scope });
  }
  return routes;
}

/** Guides d'aide : { id, title, roles[] } + erreurs de fichiers manquants/vides. */
function parseHelpGuides() {
  const manifestPath = 'frontend/src/help/manifest.ts';
  if (!exists(manifestPath)) return { guides: [], errors: [] };
  const src = read(manifestPath);

  // Carte identifiant importé -> chemin du fichier .md
  const importMap = {};
  const impRe = /import\s+(\w+)\s+from\s+'(\.\/guides\/[^']+\.md)\?raw';/g;
  let im;
  while ((im = impRe.exec(src))) importMap[im[1]] = 'frontend/src/help/' + im[2].slice(2);

  const guides = [];
  const errors = [];
  const entryRe = /id:\s*'([^']+)'[\s\S]*?title:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?roles:\s*(\w+|\[[^\]]*\])[\s\S]*?content:\s*(\w+)\s*[},]/g;
  let e;
  while ((e = entryRe.exec(src))) {
    const id = e[1];
    const title = e[2].replace(/\\'/g, "'");
    const rolesToken = e[3];
    const contentId = e[4];
    let roles;
    if (rolesToken === 'ALL') roles = ['tous'];
    else if (rolesToken === 'GESTION') roles = ['propriétaire', 'administrateur'];
    else roles = (rolesToken.match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1));
    guides.push({ id, title, roles });
    const file = importMap[contentId];
    if (!file) errors.push(`guide ${id} : import '${contentId}' introuvable`);
    else if (!exists(file)) errors.push(`guide ${id} : fichier manquant ${file}`);
    else if (read(file).trim().length === 0) errors.push(`guide ${id} : fichier vide ${file}`);
  }
  return { guides, errors };
}

function renderHelp(guides) {
  const lines = [
    `> ${guides.length} guides disponibles dans le centre d'aide (\`/aide\`).\n`,
    '| Guide | Titre | Rôles |',
    '| --- | --- | --- |',
  ];
  for (const g of guides) lines.push(`| \`${g.id}\` | ${g.title} | ${g.roles.join(', ')} |`);
  return lines.join('\n');
}

/** Scripts npm d'un package.json. */
function pkgScripts(p) {
  if (!exists(p)) return {};
  return JSON.parse(read(p)).scripts || {};
}

/** Nombre de fichiers correspondant à une extension dans un dossier (récursif). */
function countFiles(dir, ext) {
  if (!exists(dir)) return 0;
  let n = 0;
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (e.isDirectory()) n += countFiles(join(dir, e.name), ext);
    else if (e.name.endsWith(ext)) n++;
  }
  return n;
}

// ── Rendu Markdown des blocs ─────────────────────────────────────────────────

function renderModels(models) {
  const lines = [`> ${models.length} modèles définis dans \`backend/prisma/schema.prisma\`.\n`];
  for (const mdl of models) {
    lines.push(`#### \`${mdl.name}\``, '', '| Champ | Type |', '| --- | --- |');
    for (const f of mdl.fields) lines.push(`| \`${f.name}\` | \`${f.type}\` |`);
    lines.push('');
  }
  return lines.join('\n');
}

function renderMigrations(migs) {
  const lines = [`> ${migs.length} migrations appliquées (ordre chronologique).\n`, '| Date | Migration |', '| --- | --- |'];
  for (const mg of migs) lines.push(`| ${mg.date} | ${mg.label} |`);
  return lines.join('\n');
}

function renderRoutes(routes) {
  const scopeLabel = {
    auth: 'Public (authentification)',
    public: 'Public',
    'super-admin': 'Super-admin',
    tenant: 'Authentifié + multi-tenant',
  };
  const lines = [
    `> ${routes.length} groupes de routes montés sous \`/api\` (voir \`backend/src/routes/index.ts\`).`,
    '> Les routes « multi-tenant » passent par `authenticate → tenantContext → requireActiveRestaurant`.\n',
    '| Préfixe | Portée |',
    '| --- | --- |',
  ];
  for (const r of routes) lines.push(`| \`/api${r.path}\` | ${scopeLabel[r.scope] || r.scope} |`);
  return lines.join('\n');
}

function renderScripts(label, scripts) {
  const lines = [`**${label}**`, '', '| Script | Commande |', '| --- | --- |'];
  for (const [k, v] of Object.entries(scripts)) lines.push(`| \`npm run ${k}\` | \`${v}\` |`);
  return lines.join('\n');
}

// ── Injection dans les fichiers ──────────────────────────────────────────────

function injectBlock(content, key, inner) {
  const re = new RegExp(`(<!-- AUTO:${key}:START -->)[\\s\\S]*?(<!-- AUTO:${key}:END -->)`);
  if (!re.test(content)) throw new Error(`Balise AUTO:${key} introuvable`);
  return content.replace(re, `$1\n${inner}\n$2`);
}

function applyToFile(relPath, blocks) {
  const abs = join(ROOT, relPath);
  let content = readFileSync(abs, 'utf8');
  for (const [key, inner] of blocks) content = injectBlock(content, key, inner);
  const current = readFileSync(abs, 'utf8');
  if (content === current) return false;
  if (CHECK) {
    console.error(`✗ ${relPath} est obsolète (lancez : node scripts/sync-docs.mjs)`);
    return true; // « modifié »
  }
  writeFileSync(abs, content);
  console.log(`✓ ${relPath} régénéré`);
  return true;
}

// ── Exécution ────────────────────────────────────────────────────────────────

const models = parsePrismaModels();
const migrations = parseMigrations();
const routes = parseRoutes();
const backendScripts = pkgScripts('backend/package.json');
const frontendScripts = pkgScripts('frontend/package.json');

const { guides: helpGuides, errors: helpErrors } = parseHelpGuides();
if (helpErrors.length) {
  console.error('✗ Manifeste des guides invalide :');
  for (const er of helpErrors) console.error('  - ' + er);
  process.exit(1);
}

const stats = [
  '| Indicateur | Valeur |',
  '| --- | --- |',
  `| Modèles de données (Prisma) | ${models.length} |`,
  `| Migrations appliquées | ${migrations.length} |`,
  `| Groupes de routes API | ${routes.length} |`,
  `| Contrôleurs backend | ${countFiles('backend/src/controllers', '.controller.ts')} |`,
  `| Services backend | ${countFiles('backend/src/services', '.service.ts')} |`,
  `| Pages frontend (.tsx) | ${countFiles('frontend/src/pages', '.tsx')} |`,
].join('\n');

let changed = false;
changed = applyToFile('docs/MODELE-DONNEES.md', [
  ['MODELS', renderModels(models)],
  ['MIGRATIONS', renderMigrations(migrations)],
]) || changed;
changed = applyToFile('docs/API.md', [
  ['ROUTES', renderRoutes(routes)],
  ['SCRIPTS', `${renderScripts('Backend (`cd backend`)', backendScripts)}\n\n${renderScripts('Frontend (`cd frontend`)', frontendScripts)}`],
]) || changed;
changed = applyToFile('docs/BILAN.md', [['STATS', stats]]) || changed;
changed = applyToFile('docs/FONCTIONNALITES.md', [['HELP', renderHelp(helpGuides)]]) || changed;

if (CHECK && changed) {
  console.error('\nDocumentation obsolète. Régénérez-la puis indexez-la (git add docs/).');
  process.exit(1);
}
if (!changed) console.log('Documentation déjà à jour.');
