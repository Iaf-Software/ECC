'use strict';

function rewriteCursorHookSource(source) {
  const original = String(source || '');
  const rewritten = original
    .replace(/require\((['"])\.\.\/\.\.\/scripts\//g, 'require($1../scripts/')
    .replace(/path\.resolve\(__dirname,\s*['"]\.\.['"],\s*['"]\.\.['"]\)/g, "path.resolve(__dirname, '..')");
  return {
    content: rewritten,
    changed: rewritten !== original,
  };
}

function needsCursorHookRewrite(source) {
  const text = String(source || '');
  return /require\((['"])\.\.\/\.\.\/scripts\//.test(text)
    || /path\.resolve\(__dirname,\s*['"]\.\.['"],\s*['"]\.\.['"]\)/.test(text);
}

module.exports = {
  rewriteCursorHookSource,
  needsCursorHookRewrite,
};
