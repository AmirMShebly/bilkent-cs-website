/**
 * Keeps the Node.js requirement honest:
 *   - the pinned version in .nvmrc must satisfy package.json "engines";
 *   - package.json and the lockfile must state the same requirement;
 *   - no Node version allowed by "engines" may be rejected by a locked package.
 *
 *   npm run check:engines
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import semver from 'semver';

const ROOT = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { engines: { node: string } };
const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')) as {
  packages: Record<string, { engines?: { node?: string }; optional?: boolean }>;
};
const pinned = readFileSync(join(ROOT, '.nvmrc'), 'utf8').trim();
const declared = pkg.engines.node;
const problems: string[] = [];

if (!semver.valid(pinned)) problems.push(`.nvmrc must pin an exact version, not "${pinned}"`);
else if (!semver.satisfies(pinned, declared)) problems.push(`.nvmrc ${pinned} does not satisfy package.json engines "${declared}"`);
if (lock.packages['']?.engines?.node !== declared) problems.push(`package-lock.json states "${lock.packages['']?.engines?.node}", package.json "${declared}"`);

const required = Object.entries(lock.packages)
  .filter(([name, p]) => name && !p.optional && p.engines?.node)
  .map(([name, p]) => [name.replace(/^.*node_modules\//, ''), p.engines!.node!] as const);

// Every release line from Node 18 to 30, minor versions 0–40: any version the
// declared range admits must satisfy every locked package.
for (let major = 18; major <= 30; major++) {
  for (let minor = 0; minor <= 40; minor++) {
    const version = `${major}.${minor}.0`;
    if (!semver.satisfies(version, declared)) continue;
    const rejecting = required.filter(([, range]) => !semver.satisfies(version, range));
    if (rejecting.length) {
      problems.push(`engines "${declared}" admits Node ${version}, which ${rejecting.map(([n, r]) => `${n} (${r})`).join(', ')} rejects`);
      break;
    }
  }
}

if (problems.length) {
  console.error(`Node.js requirement check FAILED:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`Node.js requirement "${declared}" matches all ${required.length} locked packages; pinned version ${pinned}.`);
