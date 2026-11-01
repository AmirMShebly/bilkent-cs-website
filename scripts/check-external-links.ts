/**
 * External link audit of the built site: every http(s) link in dist/ is
 * requested once (HEAD, falling back to GET), politely: one request at a time
 * per host, at most six hosts at once, with a timeout. Links are grouped by
 * priority (university, department, faculty pages, academic resources, other)
 * so the important ones are reviewed first.
 *
 *   npm run build && npm run links:external
 *
 * Writes reports/external-links.json and reports/external-links.md. External
 * sites change independently of this project, so the audit does not fail the
 * build; it is run before releases and from time to time.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { load } from 'cheerio';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = process.env.VERIFY_DIST ?? join(ROOT, 'dist');
const REPORTS = process.env.VERIFY_REPORTS ?? join(ROOT, 'reports');
const TIMEOUT_MS = 15_000;
const HOSTS_AT_ONCE = 6;
const PAUSE_MS = 400;
const USER_AGENT = 'Mozilla/5.0 (compatible; BilkentCS-LinkCheck/1.0; static site release audit)';

type Priority = 'university' | 'department' | 'faculty page' | 'academic resource' | 'other';
type Verdict = 'ok' | 'redirected' | 'broken' | 'unreachable' | 'inconclusive';

interface Result {
  url: string;
  priority: Priority;
  pages: string[];
  status?: number;
  finalUrl?: string;
  verdict: Verdict;
  note?: string;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : name.endsWith('.html') ? [full] : [];
  });
}

const ACADEMIC = /(^|\.)(doi\.org|acm\.org|ieee\.org|springer\.com|sciencedirect\.com|elsevier\.com|arxiv\.org|scholar\.google\.[a-z.]+|dblp\.org|nature\.com|wiley\.com|oup\.com|academic\.oup\.com|tubitak\.gov\.tr|tuba\.gov\.tr|yok\.gov\.tr|abet\.org|europa\.eu|erc\.europa\.eu|ncbi\.nlm\.nih\.gov|biorxiv\.org|github\.com|youtube\.com|youtu\.be)$/;

function priorityOf(url: URL): Priority {
  const host = url.hostname.toLowerCase();
  if (/(^|\.)cs\.bilkent\.edu\.tr$/.test(host)) return /^\/~/.test(url.pathname) ? 'faculty page' : 'department';
  if (/(^|\.)bilkent\.edu\.tr$/.test(host)) return 'university';
  if (ACADEMIC.test(host)) return 'academic resource';
  return 'other';
}

// ---------------------------------------------------------------- collect
if (!existsSync(DIST)) {
  console.error('dist/ not found. Run npm run build first.');
  process.exit(1);
}
const links = new Map<string, Set<string>>();
for (const file of walk(DIST)) {
  const $ = load(readFileSync(file, 'utf8'));
  if ($('meta[http-equiv="refresh"]').length) continue;
  const page = `/${relative(DIST, file).split('\\').join('/')}`.replace(/index\.html$/, '');
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') ?? '').trim();
    if (!/^https?:\/\//i.test(href)) return;
    links.set(href, (links.get(href) ?? new Set()).add(page));
  });
}

// ---------------------------------------------------------------- check
async function request(url: string, method: 'HEAD' | 'GET'): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { method, redirect: 'follow', signal: controller.signal, headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/pdf,*/*;q=0.8' } });
  } finally {
    clearTimeout(timer);
  }
}

async function check(url: string): Promise<Pick<Result, 'status' | 'finalUrl' | 'verdict' | 'note'>> {
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      let res = await request(url, 'HEAD');
      // Many servers answer HEAD badly; confirm anything that is not a success with GET.
      if (res.status >= 400 || res.status === 0) {
        res = await request(url, 'GET');
        await res.body?.cancel();
      }
      const finalUrl = res.url && res.url !== url ? res.url : undefined;
      if (res.ok) return { status: res.status, finalUrl, verdict: finalUrl && new URL(finalUrl).href !== new URL(url).href ? 'redirected' : 'ok' };
      if ([404, 410].includes(res.status)) return { status: res.status, finalUrl, verdict: 'broken' };
      if ([401, 403, 405, 429, 999].includes(res.status)) return { status: res.status, finalUrl, verdict: 'inconclusive', note: 'the server refuses automated requests; check in a browser' };
      return { status: res.status, finalUrl, verdict: res.status >= 500 ? 'unreachable' : 'broken' };
    } catch (error) {
      const cause = (error as { cause?: { code?: string; message?: string } }).cause;
      lastError = cause?.code ?? cause?.message ?? (error as Error).message;
      if ((error as Error).name === 'AbortError') lastError = `no answer within ${TIMEOUT_MS / 1000} s`;
    }
  }
  return { verdict: 'unreachable', note: lastError };
}

const byHost = new Map<string, string[]>();
for (const url of links.keys()) {
  let host = 'invalid';
  try {
    host = new URL(url).hostname;
  } catch {
    /* recorded below */
  }
  byHost.set(host, [...(byHost.get(host) ?? []), url]);
}

const results: Result[] = [];
const hosts = [...byHost.keys()];
let next = 0;
let done = 0;
await Promise.all(
  Array.from({ length: HOSTS_AT_ONCE }, async () => {
    while (next < hosts.length) {
      const host = hosts[next++]!;
      for (const url of byHost.get(host)!) {
        let parsed: URL | undefined;
        try {
          parsed = new URL(url);
        } catch {
          results.push({ url, priority: 'other', pages: [...links.get(url)!], verdict: 'broken', note: 'not a valid URL' });
          continue;
        }
        const outcome = await check(url);
        results.push({ url, priority: priorityOf(parsed), pages: [...links.get(url)!].sort(), ...outcome });
        if (++done % 50 === 0) console.log(`${done}/${links.size} checked`);
        await new Promise((r) => setTimeout(r, PAUSE_MS));
      }
    }
  }),
);

// ---------------------------------------------------------------- report
const ORDER: Priority[] = ['university', 'department', 'faculty page', 'academic resource', 'other'];
const VERDICTS: Verdict[] = ['ok', 'redirected', 'broken', 'unreachable', 'inconclusive'];
results.sort((a, b) => ORDER.indexOf(a.priority) - ORDER.indexOf(b.priority) || a.url.localeCompare(b.url));
const count = (p: Priority, v: Verdict) => results.filter((r) => r.priority === p && r.verdict === v).length;
const code = (s: string) => `\`${s.replace(/\|/g, '\\|')}\``;
const row = (r: Result) => `| ${code(r.url)} | ${r.status ?? '–'} | ${r.finalUrl ? code(r.finalUrl) : ''}${r.note ? ` ${r.note}` : ''} | ${r.pages.slice(0, 3).map(code).join(', ')}${r.pages.length > 3 ? ` +${r.pages.length - 3}` : ''} |`;
const section = (title: string, list: Result[]) =>
  list.length ? [`### ${title} (${list.length})`, '', '| URL | HTTP | Details | Linked from |', '|---|---:|---|---|', ...list.map(row), ''] : [];

const md = [
  '# External link audit',
  '',
  `Generated by \`npm run links:external\` on ${new Date().toISOString().slice(0, 10)}: ${results.length} distinct external URLs in the built site, each requested once (HEAD, then GET), one request at a time per host. External sites change independently of this project; repeat the audit before each release.`,
  '',
  '| Priority | OK | Redirected | Broken (404/410) | Unreachable | Inconclusive |',
  '|---|---:|---:|---:|---:|---:|',
  ...ORDER.map((p) => `| ${p} | ${VERDICTS.map((v) => count(p, v)).join(' | ')} |`),
  '',
  '- **Broken:** the server says the page does not exist. Fix or remove the link in WordPress.',
  '- **Unreachable:** no answer, DNS failure, TLS error or a server error. Often a retired personal page or server.',
  '- **Redirected:** works, but through a redirect; the final address is shown.',
  '- **Inconclusive:** the site refuses automated requests (401/403/405/429); check by hand.',
  '',
  ...ORDER.flatMap((p) => {
    const list = results.filter((r) => r.priority === p && r.verdict !== 'ok');
    return list.length ? [`## ${p[0]!.toUpperCase()}${p.slice(1)} links`, '', ...section('Broken', list.filter((r) => r.verdict === 'broken')), ...section('Unreachable', list.filter((r) => r.verdict === 'unreachable')), ...section('Inconclusive', list.filter((r) => r.verdict === 'inconclusive')), ...section('Redirected', list.filter((r) => r.verdict === 'redirected'))] : [];
  }),
].join('\n');

mkdirSync(REPORTS, { recursive: true });
writeFileSync(join(REPORTS, 'external-links.json'), `${JSON.stringify(results, null, 2)}\n`);
writeFileSync(join(REPORTS, 'external-links.md'), `${md}\n`);
console.log(`${results.length} external URLs: ${VERDICTS.map((v) => `${results.filter((r) => r.verdict === v).length} ${v}`).join(', ')} → reports/external-links.md`);
