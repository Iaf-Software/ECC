'use strict';

const path = require('path');
const { loadPolicy } = require('./paths');

const MODEL_AVAILABILITY_CLASSES = Object.freeze([
  'MODEL_NOT_FOUND',
  'MODEL_NOT_SUPPORTED_BY_HARNESS',
  'MODEL_PROVIDER_DISABLED',
  'MODEL_QUOTA_EXHAUSTED',
  'MODEL_CREDIT_LIMIT',
  'MODEL_SPENDING_LIMIT',
  'MODEL_AUTH_REQUIRED',
  'MODEL_TEMPORARILY_UNAVAILABLE',
  'MODEL_RATE_LIMIT',
  'MODEL_INVOCATION_FAILED_OTHER',
]);

function loadModelPolicy() {
  return loadPolicy('model-routing.json');
}

function isClaudeAlias(model, policy = loadModelPolicy()) {
  const id = String(model || '').trim().toLowerCase();
  if (!id) {
    return false;
  }
  return (policy.claudeAliases || []).some(alias => (
    id === alias || id.startsWith(`${alias}-`) || id.includes(`/${alias}`) || id.includes(`claude-${alias}`)
  ));
}

function classifyModelFailure(errorLike, context = {}) {
  const harness = String(context.harness || '').toLowerCase();
  const preferred = String(context.preferred || context.model || '');
  const message = String(
    (errorLike && (errorLike.message || errorLike.stderr || errorLike.stdout)) || errorLike || ''
  ).toLowerCase();
  const code = String((errorLike && (errorLike.code || errorLike.failureClass)) || '').toUpperCase();

  if (MODEL_AVAILABILITY_CLASSES.includes(code)) {
    return code;
  }

  const nonModelHints = [
    'permission denied',
    'eacces',
    'enoent',
    'test failed',
    'security',
    'invalid repository',
    'tool error',
    'syntaxerror',
    'typeerror',
  ];
  if (nonModelHints.some(hint => message.includes(hint)) && !/model|quota|credit|spending|provider/.test(message)) {
    return 'SPECIALIST_FAILED_FOR_NON_MODEL_REASON';
  }

  if (/spending limit|spend limit|usage limit/.test(message)) {
    return 'MODEL_SPENDING_LIMIT';
  }
  if (/quota/.test(message)) {
    return 'MODEL_QUOTA_EXHAUSTED';
  }
  if (/credit/.test(message)) {
    return 'MODEL_CREDIT_LIMIT';
  }
  if (/unauth|auth required|not authenticated/.test(message)) {
    return 'MODEL_AUTH_REQUIRED';
  }
  if (/rate limit|too many requests/.test(message)) {
    return 'MODEL_RATE_LIMIT';
  }
  if (/temporarily unavailable|service unavailable|timeout/.test(message)) {
    return 'MODEL_TEMPORARILY_UNAVAILABLE';
  }
  if (/disabled|not enabled|other models/.test(message)) {
    return 'MODEL_PROVIDER_DISABLED';
  }
  if (/unknown model|model not found|does not exist/.test(message)) {
    return 'MODEL_NOT_FOUND';
  }
  if (harness && preferred && isClaudeAlias(preferred) && ['codex', 'gemini', 'antigravity', 'cursor'].includes(harness)) {
    if (/not supported|invalid model|unknown model|provider/.test(message) || context.preferredUnsupported === true) {
      return 'MODEL_NOT_SUPPORTED_BY_HARNESS';
    }
  }
  if (/model/.test(message)) {
    return 'MODEL_INVOCATION_FAILED_OTHER';
  }
  return 'SPECIALIST_FAILED_FOR_NON_MODEL_REASON';
}

function isModelAvailabilityFailure(failureClass) {
  return MODEL_AVAILABILITY_CLASSES.includes(failureClass);
}

function modelIsUsable(model, context = {}) {
  const available = Array.isArray(context.availableModels) ? context.availableModels : null;
  const id = String(model || '').trim();
  if (!id) {
    return false;
  }
  if (context.forcedUnavailable && context.forcedUnavailable.includes(id)) {
    return false;
  }
  if (id === 'inherit' || id === 'harness-default') {
    return context.inheritUsable !== false;
  }
  if (id === 'cursor-native') {
    if (available === null) {
      return context.inheritUsable !== false;
    }
    return available.length > 0;
  }
  if (available === null) {
    return context.assumePreferredUsable === true;
  }
  const lower = id.toLowerCase();
  return available.some((item) => {
    const value = String(item).toLowerCase();
    return value === lower || value.includes(lower) || lower.includes(value);
  });
}

function nativeFallbacks(harness, policy = loadModelPolicy()) {
  const harnessPolicy = policy.harnesses[harness] || {};
  return Array.isArray(harnessPolicy.nativeFallbackTokens)
    ? harnessPolicy.nativeFallbackTokens.slice()
    : (harnessPolicy.useNativeDefault ? ['harness-default'] : []);
}

function resolveModel(input) {
  const policy = input.policy || loadModelPolicy();
  const harness = String(input.harness || '').toLowerCase();
  const specialist = input.specialist || { role: 'unknown' };
  const preferred = input.preferred || specialist.preferredModel || null;
  const attempted = Array.isArray(input.attempted) ? input.attempted.slice() : [];
  const maxAttempts = Number(input.maxAttempts || policy.maxAttempts || 3);
  const harnessPolicy = policy.harnesses[harness];

  if (!harnessPolicy) {
    return {
      ok: false,
      specialistRole: specialist.role,
      preferred,
      selected: null,
      fallbackUsed: false,
      reason: 'MODEL_NOT_SUPPORTED_BY_HARNESS',
      attempts: attempted.length,
      attempted,
      degraded: true,
    };
  }

  if (harnessPolicy.strategy === 'preserve-upstream') {
    return {
      ok: true,
      specialistRole: specialist.role,
      preferred,
      selected: preferred || 'upstream-default',
      fallbackUsed: false,
      reason: null,
      attempts: 1,
      attempted: attempted.concat(preferred || 'upstream-default'),
      degraded: false,
    };
  }

  if (harnessPolicy.rejectForeignFamilies && preferred && isClaudeAlias(preferred, policy)) {
    const selected = 'harness-default';
    return {
      ok: true,
      specialistRole: specialist.role,
      preferred,
      selected,
      fallbackUsed: true,
      reason: 'MODEL_NOT_SUPPORTED_BY_HARNESS',
      attempts: 1,
      attempted: attempted.concat(selected),
      degraded: false,
    };
  }

  if (harnessPolicy.injectModelIds === false || harnessPolicy.strategy === 'backend-default') {
    return {
      ok: true,
      specialistRole: specialist.role,
      preferred,
      selected: 'harness-default',
      fallbackUsed: Boolean(preferred),
      reason: preferred ? 'MODEL_NOT_SUPPORTED_BY_HARNESS' : null,
      attempts: 1,
      attempted: attempted.concat('harness-default'),
      degraded: false,
    };
  }

  const candidates = [];
  if (preferred) {
    candidates.push(preferred);
  }
  const installDefault = harnessPolicy.installTimeDefaultWhenPreferredUnusable;
  if (installDefault && !candidates.includes(installDefault)) {
    candidates.push(installDefault);
  }
  for (const token of nativeFallbacks(harness, policy)) {
    if (!candidates.includes(token)) {
      candidates.push(token);
    }
  }

  for (const candidate of candidates) {
    if (attempted.includes(candidate)) {
      continue;
    }
    if (attempted.length + 1 > maxAttempts) {
      break;
    }
    if (modelIsUsable(candidate, input)) {
      return {
        ok: true,
        specialistRole: specialist.role,
        preferred,
        selected: candidate,
        fallbackUsed: candidate !== preferred,
        reason: candidate === preferred ? null : (input.failureClass || 'MODEL_NOT_SUPPORTED_BY_HARNESS'),
        attempts: attempted.length + 1,
        attempted: attempted.concat(candidate),
        degraded: false,
      };
    }
  }

  return {
    ok: false,
    specialistRole: specialist.role,
    preferred,
    selected: null,
    fallbackUsed: attempted.length > 0,
    reason: 'MODEL_INVOCATION_FAILED_OTHER',
    attempts: attempted.length,
    attempted,
    degraded: true,
  };
}

function nextFallbackAfterFailure(input) {
  const failureClass = classifyModelFailure(input.error, input);
  if (!isModelAvailabilityFailure(failureClass)) {
    return {
      ok: false,
      retry: false,
      failureClass,
      specialistRole: (input.specialist && input.specialist.role) || input.specialistRole,
      message: 'Non-model failure; refusing to hide it with a model switch',
    };
  }
  const attempted = Array.isArray(input.attempted) ? input.attempted.slice() : [];
  if (input.failedModel && !attempted.includes(input.failedModel)) {
    attempted.push(input.failedModel);
  }
  const resolved = resolveModel({
    ...input,
    attempted,
    failureClass,
    assumePreferredUsable: false,
    forcedUnavailable: (input.forcedUnavailable || []).concat(input.failedModel || []),
  });
  return {
    ...resolved,
    retry: Boolean(resolved.ok && resolved.selected),
    failureClass,
  };
}

function buildTelemetry(result, extra = {}) {
  return {
    specialist: result.specialistRole,
    preferred: result.preferred || extra.preferred || null,
    actual: result.selected,
    harness: extra.harness || null,
    fallback: result.fallbackUsed ? 'YES' : 'NO',
    reason: result.reason,
    attempts: result.attempts,
    result: result.ok ? 'SUCCESS' : 'DEGRADED',
  };
}

function transformCursorAgentFrontmatter(source, context = {}) {
  const policy = context.policy || loadModelPolicy();
  const cursor = policy.harnesses.cursor;
  if (!cursor || cursor.transformGeneratedAgents === false) {
    return { content: source, changed: false, preferred: null };
  }
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return { content: source, changed: false, preferred: null };
  }
  const front = match[1];
  const modelMatch = front.match(/^model:\s*(.+)\s*$/m);
  const preferred = modelMatch ? modelMatch[1].trim() : null;
  if (!preferred) {
    return { content: source, changed: false, preferred: null };
  }
  const keepPreferred = context.cursorUsePreferredModels === true && modelIsUsable(preferred, {
    ...context,
    assumePreferredUsable: true,
  });
  if (keepPreferred) {
    return { content: source, changed: false, preferred };
  }
  const nextModel = cursor.installTimeDefaultWhenPreferredUnusable || 'inherit';
  if (preferred === nextModel || /^inherit$/i.test(preferred)) {
    return { content: source, changed: false, preferred };
  }
  const nextFront = front.replace(/^model:\s*.+$/m, [
    `model: ${nextModel}`,
    `# IAF_UPSTREAM_PREFERRED_MODEL: ${preferred}`,
    `# IAF_PREFERRED_MODEL: ${preferred}`,
    `# IAF_CURSOR_EXECUTION_MODEL_POLICY: ${nextModel}`,
    '# IAF: inherit is Cursor execution compatibility when the preferred Claude alias is not known usable.',
    '# IAF: specialist role is unchanged. Preferred model is recorded, not hard-deleted.',
  ].join('\n'));
  const content = source.replace(match[0], `---\n${nextFront}\n---`);
  return { content, changed: content !== source, preferred, actual: nextModel };
}

module.exports = {
  MODEL_AVAILABILITY_CLASSES,
  loadModelPolicy,
  isClaudeAlias,
  classifyModelFailure,
  isModelAvailabilityFailure,
  modelIsUsable,
  resolveModel,
  nextFallbackAfterFailure,
  buildTelemetry,
  transformCursorAgentFrontmatter,
  pathHint: path,
};
