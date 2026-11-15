// Offline localization checks: node tools/test/i18n.cjs (no gateway or packages).
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
// Parse every inline script, not just the dictionary.
for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
  new vm.Script(match[1]);
}
const ctx = { navigator: { language: 'en-US' }, prefs: {}, document: {
  documentElement: {}, querySelectorAll: () => [], getElementById: () => null
} };
vm.createContext(ctx);
vm.runInContext(html.slice(html.indexOf('var I18N='), html.indexOf('// ── Fit 1280x800')), ctx);
const { en, zh } = ctx.I18N;
assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
const holders = s => (s.match(/\{\w+\}/g) || []).sort();
for (const k of Object.keys(en)) {
  assert.equal(typeof zh[k], typeof en[k], k);
  assert.equal(Array.isArray(zh[k]), Array.isArray(en[k]), k);
  const src = Array.isArray(en[k]) ? en[k] : [en[k]];
  const dst = Array.isArray(zh[k]) ? zh[k] : [zh[k]];
  assert.equal(dst.length, src.length, k);
  src.forEach((s, i) => {
    assert.ok(typeof dst[i] === 'string' && dst[i].trim(), k);
    assert.deepEqual(holders(dst[i]), holders(s), k + ' placeholders');
    assert.equal((dst[i].match(/\n/g) || []).length, (s.match(/\n/g) || []).length, k + ' newlines');
  });
}
const locales = {
  zh: 'zh', 'zh-CN': 'zh', 'zh-SG': 'zh', 'zh-Hans': 'zh',
  'zh-Hans-CN': 'zh', 'zh-Hans-HK': 'zh', 'ZH-cn': 'zh',
  'zh-TW': 'en', 'zh-HK': 'en', 'zh-MO': 'en', 'zh-Hant': 'en',
  'zh-Hant-CN': 'en', 'ko-KR': 'ko', 'en-US': 'en', 'fr-FR': 'en', 'ja-JP': 'en'
};
for (const [locale, expected] of Object.entries(locales)) {
  ctx.navigator.language = locale;
  assert.equal(ctx.resolveLang('auto'), expected, locale);
  assert.equal(ctx.resolveLang('zh'), 'zh', locale + ' explicit Chinese');
  assert.equal(ctx.resolveLang('en'), 'en', locale + ' explicit English');
  assert.equal(ctx.resolveLang('ko'), 'ko', locale + ' explicit Korean');
}
ctx.I18N_AI = { zh: { start: 'Old AI translation' }, zt: { start: '開始' }, fr: { start: 'Démarrer' } };
ctx.navigator.language = 'zh-Hant-TW';
assert.equal(ctx.resolveLang('auto'), 'zt');
ctx.navigator.language = 'fr-FR';
assert.equal(ctx.resolveLang('auto'), 'fr');
ctx._lang = 'zh';
assert.equal(ctx.t('start'), '开始');
assert.equal(ctx.I18N_AI.zh.start, 'Old AI translation');
ctx._lang = 'zt';
assert.equal(ctx.t('start'), '開始');
assert.equal(ctx.t('stop'), en.stop);
assert.equal(ctx.t('unknown_test_key'), 'unknown_test_key');
ctx.prefs.lang = 'zh';
ctx.applyI18n();
assert.equal(ctx.document.documentElement.lang, 'zh-Hans');
assert.equal(ctx.document.documentElement.dir, 'ltr');
ctx.prefs.lang = 'zt';
ctx.applyI18n();
assert.equal(ctx.document.documentElement.lang, 'zh-Hant');
// Read the real settings decision and real AI language helper.
vm.runInContext(html.slice(html.indexOf('function trBoxHtml(){'), html.indexOf('function renderTrBox(){')), ctx);
ctx.prefs.lang = 'zh';
assert.equal(ctx.trBoxHtml(), '');
vm.runInContext(html.slice(html.indexOf('var AI_LANG_NAMES='), html.indexOf('function aiKeyFor(')), ctx);
ctx._lang = 'zh';
assert.equal(ctx.aiOutLang(), 'Simplified Chinese');
assert.equal(ctx.aiOutLang('ko'), 'Korean');
assert.equal(ctx.aiOutLang('en'), 'English');
assert.equal(ctx.aiOutLang('zt'), 'Traditional Chinese');
assert.ok(!html.includes("(lang==='ko'?'Korean':'English')"), 'AI prompts must follow the language helper');
console.log(`PASS: ${Object.keys(zh).length} Chinese entries, arrays/placeholders/newlines, ${Object.keys(locales).length} locales, overrides, cached translations, fallback, document language, AI language and script syntax.`);
