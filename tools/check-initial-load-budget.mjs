import { build } from 'vite';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

// Measure emitted production resources without writing dist or running a browser.
const root = fileURLToPath(new URL('../', import.meta.url));
// AI and the share dialog stay statically available to preserve first-open behavior.
// The corrected graph measures about 140 KiB gzip; 160 KiB leaves bounded headroom
// while still rejecting the previous roughly 222 KiB initial graph.
const budgetBytes = 160 * 1024;
process.env.VITE_BASE_PATH ||= '/fengda/';
process.env.VITE_COMMUNITY_API_URL ||= 'https://xingyu-shared-community.aptbook6.chatgpt.site/';
process.env.VITE_COMMUNITY_MODE ||= 'shared';
let report;
await build({
  root,
  logLevel: 'error',
  build: { write: false, reportCompressedSize: false },
  plugins: [{
    name: 'initial-load-budget',
    generateBundle(_, bundle) {
      const entries = Object.values(bundle).filter(item => item.type === 'chunk' && item.isEntry);
      if (entries.length !== 1) throw new Error('Expected one application entry for the initial-load budget.');
      const initial = new Set();
      function visit(file) {
        if (initial.has(file)) return;
        const item = bundle[file];
        if (!item) throw new Error(`Missing emitted initial resource: ${file}`);
        initial.add(file);
        if (item.type === 'chunk') {
          for (const dependency of item.imports) visit(dependency);
          for (const stylesheet of item.viteMetadata?.importedCss || []) visit(stylesheet);
        }
      }
      visit(entries[0].fileName);
      const resources = [...initial].map(file => {
        const item = bundle[file];
        const data = Buffer.from(item.type === 'chunk' ? item.code : item.source);
        return { file, bytes: data.length, gzipBytes: gzipSync(data).length };
      });
      report = { budgetBytes, gzipBytes: resources.reduce((sum, resource) => sum + resource.gzipBytes, 0), resources };
    },
  }],
});
if (!report || !report.resources.some(resource => resource.file.endsWith('.css'))) throw new Error('Initial stylesheet was not measured.');
console.log(JSON.stringify(report, null, 2));
if (report.gzipBytes > budgetBytes) {
  console.error(`Initial JS and CSS exceed the ${budgetBytes}-byte gzip budget.`);
  process.exitCode = 1;
}
