/**
 * 孤立页面检测脚本
 *
 * 用法: npm run check:orphan-pages  (需先执行 npm run build)
 *
 * 通过 parse5 解析 build/ 中的 HTML，直接从磁盘模拟爬取。
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = join(ROOT, 'build');
const DOCS = join(ROOT, 'docs');
const SITEMAP = join(BUILD, 'sitemap.xml');

// ── URL normalization ──────────────────────────────────

function normPath(p) {
  try {
    const u = new URL(p, 'http://x');
    let path = decodeURI(u.pathname).replace(/\/+$/, '') || '/';
    if (path.endsWith('/index.html')) path = path.slice(0, -10) || '/';
    return path;
  } catch { return p; }
}

function isInternal(href) {
  if (!href || href.startsWith('#') || href.startsWith('data:')) return false;
  const proto = href.split(':')[0];
  return !['http', 'https', 'mailto', 'tel', 'javascript'].includes(proto);
}

function resolve(href, basePath) {
  try {
    if (href.startsWith('/')) return normPath(href);
    const dir = basePath.replace(/\/[^/]*$/, '') || '';
    const segs = dir.split('/').filter(Boolean);
    for (const s of href.split('/')) {
      if (s === '..') segs.pop();
      else if (s !== '.') segs.push(s);
    }
    return normPath('/' + segs.join('/'));
  } catch { return normPath(href); }
}

// ── collect build pages ────────────────────────────────

function collectBuildPages() {
  const res = new Set();
  function walk(dir, prefix) {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(dir, e.name), prefix + e.name + '/');
      else if (e.name === 'index.html') res.add(prefix || '/');
    }
  }
  walk(BUILD, '/');
  return [...res].map(p => normPath(p + (p === '/' ? '' : '/')));
}

// ── read HTML for a route ──────────────────────────────

function readHtml(route) {
  let p = route;
  if (!p.endsWith('/')) p += '/';
  p += 'index.html';
  // Remove leading /
  const fp = join(BUILD, p.replace(/^\//, ''));
  try { return readFileSync(fp, 'utf8'); } catch { return null; }
}

// ── extract links via parse5 ───────────────────────────

function extractLinks(doc, basePath) {
  const links = new Set();
  function walk(node) {
    if (!node) return;
    if (node.tagName === 'a') {
      for (const attr of node.attrs || []) {
        if (attr.name === 'href') {
          const href = (attr.value || '').trim();
          if (isInternal(href)) links.add(resolve(href, basePath));
        }
      }
    }
    // Walk children even if node has no tagName (e.g. #document)
    if (node.childNodes) for (const c of node.childNodes) walk(c);
  }
  try { walk(parse(doc)); } catch {}
  return links;
}

// ── crawl ──────────────────────────────────────────────

function crawl(roots) {
  const visited = new Set();
  const queue = roots.map(r => normPath(r));
  while (queue.length > 0) {
    const page = queue.shift();
    if (visited.has(page)) continue;
    visited.add(page);
    const html = readHtml(page);
    if (!html) continue;
    for (const link of extractLinks(html, page)) {
      if (visited.has(link) || queue.includes(link)) continue;
      // Only follow links that have an HTML page behind them
      if (readHtml(link)) queue.push(link);
    }
  }
  return visited;
}

// ── sitemap routes ─────────────────────────────────────

function sitemapRoutes() {
  if (!existsSync(SITEMAP)) return null;
  const xml = readFileSync(SITEMAP, 'utf8');
  const re = /<loc>([^<]+)<\/loc>/g;
  const urls = [];
  let m;
  while ((m = re.exec(xml)) !== null) urls.push(m[1]);
  return urls.map(u => normPath(new URL(u).pathname));
}

// ── unlisted docs ──────────────────────────────────────

function findUnlisted() {
  const res = [];
  function scan(dir, pfx) {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) scan(join(dir, e.name), pfx + e.name + '/');
      else if (/\.mdx?$/.test(e.name)) {
        if (/^unlisted:\s*true/m.test(readFileSync(join(dir, e.name), 'utf8')))
          res.push(pfx + e.name);
      }
    }
  }
  scan(join(ROOT, 'blog'), 'blog/');
  scan(DOCS, 'docs/');
  return res;
}

// ── sidebar doc ID parsing ─────────────────────────────

function sidebarDocIds(sidebar) {
  const ids = new Set();
  for (const item of sidebar) {
    if (typeof item === 'string') { ids.add(item); continue; }
    if (!item || typeof item !== 'object') continue;
    if (item.type === 'doc' && item.id) ids.add(item.id);
    if (item.type === 'ref' && item.id) ids.add(item.id);
    if (item.link?.type === 'doc' && item.link.id) ids.add(item.link.id);
    if (item.items) for (const id of sidebarDocIds(item.items)) ids.add(id);
  }
  return ids;
}

/** Convert doc file path to Docusaurus doc ID */
function fileToDocId(filePath) {
  // filePath is relative to docs/ dir: e.g. "development/setup.md"
  let id = filePath.replace(/\\/g, '/').replace(/\.mdx?$/, '');
  if (id.endsWith('/index')) id = id.slice(0, -6);
  return id;
}

function allDocFiles() {
  const files = [];
  function walk(dir, prefix) {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(dir, e.name), prefix + e.name + '/');
      else if (/\.mdx?$/.test(e.name)) files.push(prefix + e.name);
    }
  }
  walk(DOCS, '');
  return files;
}

// ── main ───────────────────────────────────────────────

async function main() {
  // Check build exists
  if (!existsSync(join(BUILD, 'index.html'))) {
    console.error('[error] build/ 目录无 index.html。请先运行 npm run build。');
    process.exit(2);
  }

  // 1. Collect all generated routes
  const generated = collectBuildPages();
  const generatedSet = new Set(generated);
  const zhGen = new Set(generated.filter(p => !p.startsWith('/en/')));
  const enGen = new Set(generated.filter(p => p.startsWith('/en/')));

  // 2. Crawl from both entry points SEPARATELY
  const reachZh = crawl([normPath('/')]);
  const reachEn = crawl([normPath('/en/')]);
  const reachAll = new Set([...reachZh, ...reachEn]);

  // 3. Assert reachAll <= generated
  const reachOnly = [...reachAll].filter(p => !generatedSet.has(p));
  if (reachOnly.length > 0) {
    console.error(`[error] 可达页面 > 生成页面：${reachOnly.length} 个页面不在 build 中`);
    for (const p of reachOnly) console.error(`  ${p}`);
    process.exit(2);
  }

  // 4. Allowed unreachable pages
  const allowed = new Map(); // route -> reason
  const autoGenChecks = [
    { re: /^\/updates\/archive\/?$/, reason: '博客归档页（Docusaurus blog 框架自动生成）' },
    { re: /^\/en\/updates\/archive\/?$/, reason: '博客归档页（Docusaurus blog 框架自动生成，英文）' },
    { re: /^\/updates\/authors\/?$/, reason: '博客作者页（无 authors.yml 配置作者资料，无入口）' },
    { re: /^\/en\/updates\/authors\/?$/, reason: '博客作者页（无 authors.yml 配置作者资料，无入口，英文）' },
  ];

  for (const r of generated) {
    for (const { re, reason } of autoGenChecks) {
      if (re.test(r) && !reachAll.has(r)) {
        allowed.set(r, reason);
        break;
      }
    }
  }

  // 5. Compute orphans
  const orphans = [...generatedSet].filter(p => !reachAll.has(p) && !allowed.has(p)).sort();

  // ── sidebar analysis ─────────────────────────────────
  let sidebarStats = null;
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const sidebars = require(join(ROOT, 'sidebars.js')).default;

    const allSids = new Map(); // docId -> { formal: [sidebarNames], ref: [sidebarNames] }
    for (const [sbName, sidebar] of Object.entries(sidebars)) {
      for (const item of sidebar) {
        if (typeof item === 'string') {
          record(allSids, item, sbName, 'formal');
        } else if (item?.type === 'doc' && item.id) {
          record(allSids, item.id, sbName, 'formal');
        } else if (item?.type === 'ref' && item.id) {
          record(allSids, item.id, sbName, 'ref');
        } else if (item?.link?.type === 'doc' && item.link.id) {
          record(allSids, item.link.id, sbName, 'formal');
        }
        if (item?.items) collectNested(allSids, item.items, sbName);
      }
    }

    function collectNested(map, items, sbName) {
      for (const item of items) {
        if (typeof item === 'string') {
          record(map, item, sbName, 'formal');
        } else if (item?.type === 'doc' && item.id) {
          record(map, item.id, sbName, 'formal');
        } else if (item?.type === 'ref' && item.id) {
          record(map, item.id, sbName, 'ref');
        } else if (item?.link?.type === 'doc' && item.link.id) {
          record(map, item.link.id, sbName, 'formal');
        }
        if (item?.items) collectNested(map, item.items, sbName);
      }
    }

    function record(map, docId, sbName, kind) {
      if (!map.has(docId)) map.set(docId, { formal: [], ref: [] });
      const entry = map.get(docId);
      if (kind === 'formal') entry.formal.push(sbName);
      else entry.ref.push(sbName);
    }

    // Helper: check if a file-based doc ID matches a sidebar doc ID
    // A file like `governance-instruments/index.md` → docId `governance-instruments`
    // can be referenced as `governance-instruments` or `governance-instruments/index` in sidebar
    function matchDocId(fileId) {
      if (allSids.has(fileId)) return true;
      // Also check if sidebar has `fileId/index`
      if (allSids.has(fileId + '/index')) return true;
      return false;
    }
    function getSidebars(fileId) {
      return allSids.get(fileId) || allSids.get(fileId + '/index') || null;
    }

    const allDocPaths = allDocFiles();
    const allDocIds = allDocPaths.map(fileToDocId);

    const formalIn = allDocIds.filter(id => {
      const s = getSidebars(id);
      return s && s.formal.length > 0;
    });
    const refOnly = allDocIds.filter(id => {
      const s = getSidebars(id);
      return s && s.formal.length === 0 && s.ref.length > 0;
    });
    const notInSb = allDocIds.filter(id => !matchDocId(id));
    const multiFormal = allDocIds.filter(id => {
      const s = getSidebars(id);
      return s && s.formal.length > 1;
    });

    sidebarStats = { formalIn, refOnly, notInSb, multiFormal, allSids };
  } catch (e) {
    sidebarStats = { error: e.message };
  }

  // 6. Unlisted
  const unlisted = findUnlisted();

  // ── report ────────────────────────────────────────────
  console.log('='.repeat(60));
  console.log('孤立页面审计');
  console.log('='.repeat(60));
  console.log();

  console.log('生成页面:');
  console.log(`  zh-Hans:  ${zhGen.size}`);
  console.log(`  en:       ${enGen.size}`);
  console.log(`  去重合计: ${generatedSet.size}`);
  console.log();

  // Reachable within own locale only (excluding cross-locale links)
  const reachZhOwn = new Set([...reachZh].filter(p => !p.startsWith('/en/')));
  const reachEnOwn = new Set([...reachEn].filter(p => p.startsWith('/en/')));

  console.log('可达页面:');
  console.log(`  zh 入口可达 (zh-Hans 页): ${reachZhOwn.size}`);
  console.log(`  en 入口可达 (en 页):      ${reachEnOwn.size}`);
  console.log(`  去重合计:                 ${reachAll.size}`);
  console.log();

  const zhToEn = [...reachZh].filter(p => p.startsWith('/en/'));
  const enToZh = [...reachEn].filter(p => !p.startsWith('/en/'));
  if (zhToEn.length > 0) console.log(`跨语言链接 (zh→en): ${zhToEn.length} 个`);
  if (enToZh.length > 0) console.log(`跨语言链接 (en→zh): ${enToZh.length} 个`);
  if (zhToEn.length > 0 || enToZh.length > 0) console.log();

  if (allowed.size > 0) {
    console.log('允许无入口页面:');
    for (const [route, reason] of allowed) console.log(`  ${route}  — ${reason}`);
    console.log();
  }

  if (orphans.length > 0) {
    console.log(`意外孤立页面: ${orphans.length}`);
    for (const o of orphans) console.log(`  ${o}`);
    console.log();
  } else {
    console.log('意外孤立页面: 0');
    console.log();
  }

  if (unlisted.length > 0) {
    console.log(`unlisted 文档: ${unlisted.length}`);
    for (const f of unlisted) console.log(`  ${f}`);
    console.log();
  }

  // sidebar stats
  if (sidebarStats && !sidebarStats.error) {
    console.log('--- sidebar 归属 ---');
    const { formalIn, refOnly, notInSb, multiFormal } = sidebarStats;
    console.log(`正式归入 sidebar: ${formalIn.length}`);
    console.log(`仅作为 ref:      ${refOnly.length}`);
    console.log(`未在任何 sidebar: ${notInSb.length}`);
    for (const id of notInSb) console.log(`  ${id}`);
    console.log(`正式归入多个 sidebar: ${multiFormal.length}`);
    for (const id of multiFormal) {
      const s = getSidebars(id);
      if (s) console.log(`  ${id}  →  [${s.formal.join(', ')}]`);
    }
    console.log();
  }

  // Consistency assertion
  if (reachAll.size > generatedSet.size) {
    console.error('[error] 可达 > 生成，退出码 2');
    process.exit(2);
  }

  if (orphans.length > 0) {
    console.log('[result] 存在意外孤立页面，退出码 1');
    process.exit(1);
  }

  console.log('[result] 无意外孤立页面，退出码 0');
}

main().catch(e => { console.error('[error]', e.message); process.exit(2); });
