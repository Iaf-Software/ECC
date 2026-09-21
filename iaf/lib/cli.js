'use strict';

const fs = require('fs');
const path = require('path');
const { iafVersion, packageVersion } = require('./paths');
const { fleetStatus, fleetUpdate } = require('./fleet');
const { bootstrapRepo, adaptRepo, updateRepo, classifyExisting } = require('./adapt');
const { previewUpstream, applyUpstream, detectRetirableWorkarounds } = require('./upstream-sync');
const { resolveModel, nextFallbackAfterFailure, classifyModelFailure, buildTelemetry } = require('./model-routing');
const { rewriteCursorHookSource } = require('./hook-compat');
const { orderedDiscoveryPaths, isClaudeFirstViolation } = require('./skill-paths');
const { shouldAllowlist } = require('./secret-scanner-compat');
const { isForbiddenCommand } = require('./git-safety');

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage() {
  return `IAF ECC control plane ${iafVersion()} (official ECC ${packageVersion()})

Usage:
  node iaf/bin/iaf-ecc <command> [options]

Commands:
  version
  help
  fleet-status [--json] [--inventory <path>] [--scan-root <path>]
  fleet-update --repo <id-or-path> [--inventory <path>] [--dry-run|--apply]
  bootstrap --repo <path> [--harness cursor,gemini,...] [--dry-run|--apply] [--hooks auto|on|off]
  adapt --repo <path> [--dry-run|--apply] [--hooks auto|on|off]
  update --repo <path> [--dry-run|--apply]
  inventory --repo <path>
  upstream-preview
  upstream-apply --dry-run|--apply
  doctor --repo <path>
  smoke-model [--json]
  smoke-capability --harness <name>
  retire-check

Safety:
  Never force-push, reset --hard, git clean -fd, or git add -A.
  Never mutate the whole fleet concurrently.
  Never read .env or enable optional MCP credentials.
`;
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift() || 'help';
  const options = { _: [] };
  while (args.length > 0) {
    const arg = args.shift();
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--overlay-only') {
      options.overlayOnly = true;
    } else if (arg === '--repo' || arg === '--harness' || arg === '--harnesses' || arg === '--hooks' || arg === '--profile' || arg === '--inventory') {
      const key = arg === '--inventory' ? 'inventoryPath' : arg.slice(2).replace('harnesses', 'harness');
      options[key] = args.shift();
    } else if (arg === '--scan-root') {
      options.scanRoots = options.scanRoots || [];
      options.scanRoots.push(args.shift());
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      options._.push(arg);
    }
  }
  return { command, options };
}

function parseHarnesses(value) {
  if (!value) {
    return undefined;
  }
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function main(argv = process.argv.slice(2)) {
  const { command, options } = parseArgs(argv);
  switch (command) {
    case 'help':
    case '-h':
    case '--help':
      process.stdout.write(usage());
      return 0;
    case 'version':
      printJson({ iaf: iafVersion(), ecc: packageVersion() });
      return 0;
    case 'fleet-status': {
      const rows = fleetStatus({
        inventoryPath: options.inventoryPath,
        scanRoots: options.scanRoots,
      });
      if (options.json) {
        printJson(rows);
      } else {
        for (const row of rows) {
          process.stdout.write(`${row.PROJECT}\t${row.PATH}\t${row.BRANCH || '-'}\t${row.HEAD || '-'}\t${row.DIRTY || '-'}\t${row.CURSOR}\t${row.IAF_ECC_VERSION || '-'}\t${row.ACTION_REQUIRED}\n`);
        }
      }
      return 0;
    }
    case 'fleet-update':
      if (!options.repo) {
        throw new Error('fleet-update requires --repo <id>');
      }
      printJson(fleetUpdate({
        repo: options.repo,
        inventoryPath: options.inventoryPath,
        dryRun: !options.apply,
        apply: Boolean(options.apply),
      }));
      return 0;
    case 'bootstrap':
      printJson(bootstrapRepo({
        repo: options.repo,
        dryRun: !options.apply,
        harnesses: parseHarnesses(options.harness),
        hooks: options.hooks,
        profile: options.profile,
        overlayOnly: Boolean(options.overlayOnly),
      }));
      return 0;
    case 'adapt':
      printJson(adaptRepo({
        repo: options.repo,
        dryRun: !options.apply,
        harnesses: parseHarnesses(options.harness),
        hooks: options.hooks,
        profile: options.profile,
        overlayOnly: Boolean(options.overlayOnly),
        allowDirty: true,
      }));
      return 0;
    case 'update':
      printJson(updateRepo({
        repo: options.repo,
        dryRun: !options.apply,
        harnesses: parseHarnesses(options.harness),
        hooks: options.hooks,
        profile: options.profile,
        overlayOnly: Boolean(options.overlayOnly),
      }));
      return 0;
    case 'inventory':
      printJson(classifyExisting(options.repo));
      return 0;
    case 'upstream-preview':
      printJson(previewUpstream());
      return 0;
    case 'upstream-apply':
      printJson(applyUpstream({ dryRun: !options.apply, apply: Boolean(options.apply) }));
      return 0;
    case 'doctor':
      printJson({
        inventory: classifyExisting(options.repo),
        iafState: fs.existsSync(path.join(options.repo, '.iaf-ecc-state.json')),
      });
      return 0;
    case 'smoke-model': {
      const cases = [
        resolveModel({ harness: 'cursor', specialist: { role: 'architect', preferredModel: 'sonnet' }, preferred: 'sonnet', availableModels: ['sonnet'] }),
        resolveModel({ harness: 'cursor', specialist: { role: 'architect', preferredModel: 'sonnet' }, preferred: 'sonnet', availableModels: ['grok'], inheritUsable: true }),
        nextFallbackAfterFailure({
          harness: 'cursor',
          specialist: { role: 'security-reviewer' },
          preferred: 'sonnet',
          failedModel: 'sonnet',
          error: { message: 'spending limit on Other Models' },
          inheritUsable: true,
        }),
        resolveModel({ harness: 'cursor', specialist: { role: 'architect' }, preferred: 'sonnet', inheritUsable: false, availableModels: [] }),
        resolveModel({ harness: 'codex', specialist: { role: 'architect' }, preferred: 'sonnet' }),
        resolveModel({ harness: 'gemini', specialist: { role: 'architect' }, preferred: 'sonnet' }),
        resolveModel({ harness: 'antigravity', specialist: { role: 'architect' }, preferred: 'sonnet' }),
        resolveModel({ harness: 'claude', specialist: { role: 'architect' }, preferred: 'sonnet' }),
      ];
      printJson(cases.map(item => buildTelemetry(item)));
      return cases.every(item => item.ok || item.degraded) ? 0 : 1;
    }
    case 'smoke-capability': {
      const harness = options.harness || 'cursor';
      printJson({
        harness,
        discovery: orderedDiscoveryPaths(harness),
        claudeFirstViolationExample: isClaudeFirstViolation('.claude/skills/security-review/SKILL.md', harness),
      });
      return 0;
    }
    case 'retire-check':
      printJson(detectRetirableWorkarounds());
      return 0;
    case 'rewrite-hook-demo': {
      const sample = "const x = require('../../scripts/lib/shell-split');\npath.resolve(__dirname, '..', '..');\n";
      printJson(rewriteCursorHookSource(sample));
      return 0;
    }
    case 'classify-secret':
      printJson(shouldAllowlist(options._[0], options._[1]));
      return 0;
    case 'safety-check':
      printJson({ forbidden: isForbiddenCommand(options._.join(' ')) });
      return 0;
    default:
      throw new Error(`Unknown command: ${command}\n${usage()}`);
  }
}

module.exports = { main, parseArgs, usage };

if (require.main === module) {
  try {
    const code = main();
    process.exitCode = code;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = error.code === 'IAF_FLEET_SERIAL_REQUIRED' ? 2 : 1;
  }
}
