import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const templateRoot = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(templateRoot, "template-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const supportedVariables = new Set([
  "ConfirmationURL",
  "Token",
  "TokenHash",
  "SiteURL",
  "RedirectTo",
  "Data",
  "Email",
  "NewEmail",
  "OldEmail",
  "Phone",
  "OldPhone",
  "Provider",
  "FactorType",
]);

const voidElements = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

function variablesIn(value) {
  return [...value.matchAll(/{{\s*\.([A-Za-z][A-Za-z0-9]*)\s*}}/g)].map((match) => match[1]);
}

function checkBalancedTags(html, filename) {
  const stack = [];
  const tagPattern = /<\/?([A-Za-z][A-Za-z0-9:-]*)(?:\s[^<>]*?)?>/g;

  for (const match of html.matchAll(tagPattern)) {
    const token = match[0];
    const tag = match[1].toLowerCase();

    if (voidElements.has(tag) || token.endsWith("/>")) {
      continue;
    }

    if (token.startsWith("</")) {
      const openTag = stack.pop();
      assert.equal(openTag, tag, `${filename}: expected </${openTag}> before </${tag}>`);
    } else {
      stack.push(tag);
    }
  }

  assert.deepEqual(stack, [], `${filename}: unclosed HTML tags: ${stack.join(", ")}`);
}

assert.equal(manifest.length, 6, "manifest must contain all six Supabase Auth templates");
assert.equal(
  new Set(manifest.map((entry) => entry.dashboardName)).size,
  manifest.length,
  "dashboard template names must be unique",
);
assert.equal(
  new Set(manifest.map((entry) => entry.file)).size,
  manifest.length,
  "template filenames must be unique",
);

const directoryEntries = await readdir(templateRoot, { withFileTypes: true });
const actualHtmlFiles = directoryEntries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
  .map((entry) => entry.name)
  .sort();
const expectedHtmlFiles = manifest.map((entry) => entry.file).sort();
assert.deepEqual(actualHtmlFiles, expectedHtmlFiles, "manifest and HTML files must match exactly");

for (const template of manifest) {
  const html = await readFile(join(templateRoot, template.file), "utf8");
  const combined = `${template.subject}\n${html}`;
  const usedVariables = [...new Set(variablesIn(combined))].sort();
  const allowedVariables = [...template.allowedVariables].sort();

  assert.match(html, /^<!doctype html>/i, `${template.file}: missing HTML5 doctype`);
  assert.match(html, /<html[^>]+lang="en"[^>]*>/i, `${template.file}: missing document language`);
  assert.match(html, /lang="zh-CN"/, `${template.file}: missing Chinese language annotation`);
  assert.match(html, /<meta[^>]+name="viewport"/i, `${template.file}: missing responsive viewport`);
  assert.match(html, /name="color-scheme"/i, `${template.file}: missing color-scheme metadata`);
  assert.match(html, /prefers-color-scheme:\s*dark/i, `${template.file}: missing dark-mode media rules`);
  assert.match(html, /\[data-ogsc\]/i, `${template.file}: missing Outlook dark-mode fallback`);
  assert.match(html, /@media only screen and \(max-width:\s*620px\)/i, `${template.file}: missing mobile rules`);
  assert.match(html, /class="preheader"/i, `${template.file}: missing hidden preheader`);
  assert.match(html, /role="presentation"/i, `${template.file}: missing presentation table semantics`);
  assert.match(html, /AlphaLab/, `${template.file}: missing AlphaLab wordmark`);
  assert.match(html, /#f2efe7/i, `${template.file}: missing cream canvas color`);
  assert.match(html, /#(?:245ca4|2b5fae)/i, `${template.file}: missing AlphaLab blue`);
  assert.doesNotMatch(html, /<script\b/i, `${template.file}: JavaScript is not allowed`);
  assert.doesNotMatch(html, /javascript\s*:/i, `${template.file}: javascript URLs are not allowed`);
  assert.doesNotMatch(html, /<link\b/i, `${template.file}: external stylesheets are not allowed`);
  assert.doesNotMatch(html, /@import\b/i, `${template.file}: CSS imports are not allowed`);
  assert.doesNotMatch(html, /@font-face\b/i, `${template.file}: external fonts are not allowed`);
  assert.doesNotMatch(
    html,
    /(?:src|background)\s*=\s*["']https?:/i,
    `${template.file}: remote assets are not allowed`,
  );

  const layoutTables = [...html.matchAll(/<table\b[^>]*>/gi)].map((match) => match[0]);
  assert.ok(layoutTables.length >= 4, `${template.file}: expected a table-based email layout`);
  for (const table of layoutTables) {
    assert.match(table, /\brole="presentation"/i, `${template.file}: every layout table needs role="presentation"`);
  }

  assert.equal(
    (combined.match(/{{/g) ?? []).length,
    (combined.match(/}}/g) ?? []).length,
    `${template.file}: unbalanced template braces`,
  );
  assert.deepEqual(
    usedVariables,
    allowedVariables,
    `${template.file}: variables differ from the per-template allowlist`,
  );

  for (const variable of usedVariables) {
    assert.ok(supportedVariables.has(variable), `${template.file}: unsupported variable ${variable}`);
  }

  for (const variable of template.requiredVariables) {
    assert.ok(
      usedVariables.includes(variable),
      `${template.file}: required variable {{ .${variable} }} is missing`,
    );
  }

  const hrefs = [...html.matchAll(/\bhref="([^"]+)"/gi)].map((match) => match[1]);
  if (template.linkTemplate) {
    assert.ok(hrefs.length >= 2, `${template.file}: needs a button and visible fallback URL`);
    assert.ok(
      hrefs.every((href) => href === "{{ .ConfirmationURL }}"),
      `${template.file}: Auth links must use Supabase's complete ConfirmationURL`,
    );
    assert.ok(
      html.includes(">{{ .ConfirmationURL }}</a>"),
      `${template.file}: missing copyable fallback URL`,
    );
  } else {
    assert.deepEqual(hrefs, [], `${template.file}: reauthentication should be code-only`);
    assert.match(html, /aria-label="AlphaLab verification code {{ \.Token }}"/, `${template.file}: OTP needs an accessible label`);
  }

  checkBalancedTags(html, template.file);
  console.log(`✓ ${template.dashboardName}: ${template.file} [${usedVariables.join(", ")}]`);
}

console.log(`Verified ${manifest.length} AlphaLab Supabase Auth email templates.`);
