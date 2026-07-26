import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Official hosted Auth config endpoint:
// https://supabase.com/docs/guides/auth/auth-email-templates#editing-email-templates
const DEFAULT_MANAGEMENT_API_ORIGIN = "https://api.supabase.com";
const DEFAULT_TIMEOUT_MS = 15_000;
const templateRoot = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(templateRoot, "template-manifest.json");

const usage = `AlphaLab Supabase Auth email-template sync

Usage:
  node supabase/email-templates/sync-templates.mjs
  node supabase/email-templates/sync-templates.mjs --check
  node supabase/email-templates/sync-templates.mjs --apply

Modes:
  default, --plan  Build an offline plan. Never calls the network or writes files.
  --check          GET hosted Auth config and fail with exit 1 when templates drift.
  --apply          PATCH only manifest-owned fields, then GET and strictly verify.

Hosted modes read credentials only from:
  SUPABASE_ACCESS_TOKEN
  SUPABASE_PROJECT_REF
`;

class SafeSyncError extends Error {
  constructor(message) {
    super(message);
    this.name = "SafeSyncError";
  }
}

const normalizeLineEndings = (value) => value.replace(/\r\n?/g, "\n");

const fingerprint = (value) => {
  if (typeof value !== "string") {
    return { present: false, bytes: 0, sha256: "missing" };
  }
  return {
    present: true,
    bytes: Buffer.byteLength(value, "utf8"),
    sha256: createHash("sha256").update(value, "utf8").digest("hex"),
  };
};

const formatFingerprint = (value) => {
  const result = fingerprint(value);
  return result.present
    ? `sha256=${result.sha256} bytes=${result.bytes}`
    : "missing";
};

const assertManifestEntry = (entry, index) => {
  assert.ok(entry && typeof entry === "object" && !Array.isArray(entry), `manifest[${index}] must be an object`);
  for (const key of [
    "dashboardName",
    "managementApiSubjectKey",
    "managementApiContentKey",
    "file",
    "subject",
  ]) {
    assert.equal(typeof entry[key], "string", `manifest[${index}].${key} must be a string`);
    assert.ok(entry[key].length > 0, `manifest[${index}].${key} must not be empty`);
  }
  assert.match(
    entry.managementApiSubjectKey,
    /^mailer_subjects_[a-z0-9_]+$/,
    `manifest[${index}] has an unsafe subject field`,
  );
  assert.match(
    entry.managementApiContentKey,
    /^mailer_templates_[a-z0-9_]+_content$/,
    `manifest[${index}] has an unsafe content field`,
  );
  assert.equal(basename(entry.file), entry.file, `manifest[${index}].file must be a filename`);
  assert.ok(!isAbsolute(entry.file), `manifest[${index}].file must be relative`);
};

export const loadTemplateBundle = async ({
  root = templateRoot,
  manifestFile = manifestPath,
} = {}) => {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  } catch {
    throw new SafeSyncError("Unable to read a valid template manifest.");
  }
  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new SafeSyncError("Template manifest must contain at least one entry.");
  }

  const desiredConfig = {};
  const templates = [];
  const seenFiles = new Set();
  const seenFields = new Set();
  const resolvedRoot = resolve(root);

  for (const [index, entry] of manifest.entries()) {
    try {
      assertManifestEntry(entry, index);
    } catch (error) {
      throw new SafeSyncError(error instanceof Error ? error.message : "Invalid manifest entry.");
    }

    const resolvedFile = resolve(root, entry.file);
    const relativeFile = relative(resolvedRoot, resolvedFile);
    if (relativeFile.startsWith("..") || isAbsolute(relativeFile)) {
      throw new SafeSyncError(`Template file escapes the template directory: ${entry.file}`);
    }
    if (seenFiles.has(entry.file)) {
      throw new SafeSyncError(`Duplicate template file in manifest: ${entry.file}`);
    }
    seenFiles.add(entry.file);

    for (const field of [entry.managementApiSubjectKey, entry.managementApiContentKey]) {
      if (seenFields.has(field)) {
        throw new SafeSyncError(`Duplicate Management API field in manifest: ${field}`);
      }
      seenFields.add(field);
    }

    let body;
    try {
      body = normalizeLineEndings(await readFile(resolvedFile, "utf8"));
    } catch {
      throw new SafeSyncError(`Unable to read template file: ${entry.file}`);
    }

    desiredConfig[entry.managementApiSubjectKey] = entry.subject;
    desiredConfig[entry.managementApiContentKey] = body;
    templates.push({
      dashboardName: entry.dashboardName,
      file: entry.file,
      subjectKey: entry.managementApiSubjectKey,
      contentKey: entry.managementApiContentKey,
      subject: entry.subject,
      body,
    });
  }

  return { templates, desiredConfig };
};

export const compareRemoteConfig = (bundle, remoteConfig) => {
  if (!remoteConfig || typeof remoteConfig !== "object" || Array.isArray(remoteConfig)) {
    throw new SafeSyncError("Management API returned an invalid Auth configuration object.");
  }

  const templates = bundle.templates.map((template) => {
    const remoteSubject = remoteConfig[template.subjectKey];
    const remoteBody = remoteConfig[template.contentKey];
    const subjectMatches = remoteSubject === template.subject;
    const bodyMatches = remoteBody === template.body;
    return {
      dashboardName: template.dashboardName,
      file: template.file,
      subjectKey: template.subjectKey,
      contentKey: template.contentKey,
      subjectMatches,
      bodyMatches,
      expectedSubject: fingerprint(template.subject),
      remoteSubject: fingerprint(remoteSubject),
      expectedBody: fingerprint(template.body),
      remoteBody: fingerprint(remoteBody),
    };
  });

  return {
    matches: templates.every((template) => template.subjectMatches && template.bodyMatches),
    templates,
  };
};

const parseMode = (argv) => {
  const args = new Set(argv);
  if (args.has("--help") || args.has("-h")) return "help";
  const supported = new Set(["--plan", "--check", "--apply"]);
  for (const arg of argv) {
    if (!supported.has(arg)) {
      throw new SafeSyncError("Unknown argument. Use --help to list supported modes.");
    }
  }
  if (args.size !== argv.length) throw new SafeSyncError("Duplicate mode argument.");
  if (args.size > 1) throw new SafeSyncError("Choose exactly one of --plan, --check, or --apply.");
  if (args.has("--check")) return "check";
  if (args.has("--apply")) return "apply";
  return "plan";
};

const readHostedEnvironment = (env) => {
  const accessToken = String(env.SUPABASE_ACCESS_TOKEN ?? "").trim();
  const projectRef = String(env.SUPABASE_PROJECT_REF ?? "").trim();
  if (!accessToken) throw new SafeSyncError("SUPABASE_ACCESS_TOKEN is required for hosted modes.");
  if (!projectRef) throw new SafeSyncError("SUPABASE_PROJECT_REF is required for hosted modes.");
  if (!/^[a-z0-9][a-z0-9-]{5,63}$/.test(projectRef)) {
    throw new SafeSyncError("SUPABASE_PROJECT_REF has an invalid format.");
  }
  return { accessToken, projectRef };
};

const requestAuthConfig = async ({
  method,
  accessToken,
  projectRef,
  fetchImpl,
  desiredConfig,
  apiOrigin,
  timeoutMs,
}) => {
  if (typeof fetchImpl !== "function") {
    throw new SafeSyncError("A Fetch API implementation is required.");
  }

  const endpoint = `${apiOrigin.replace(/\/+$/, "")}/v1/projects/${encodeURIComponent(projectRef)}/config/auth`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(method === "PATCH" ? { "Content-Type": "application/json" } : {}),
      },
      ...(method === "PATCH" ? { body: JSON.stringify(desiredConfig) } : {}),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new SafeSyncError(`${method} Auth configuration request timed out.`);
    }
    throw new SafeSyncError(`${method} Auth configuration request failed before a response was received.`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response || typeof response.ok !== "boolean") {
    throw new SafeSyncError(`${method} Auth configuration request returned an invalid response.`);
  }
  if (!response.ok) {
    const status = Number.isInteger(response.status) ? response.status : "unknown";
    throw new SafeSyncError(`${method} Auth configuration request failed: HTTP ${status}.`);
  }

  if (method === "PATCH") return null;
  try {
    return await response.json();
  } catch {
    throw new SafeSyncError("GET Auth configuration response was not valid JSON.");
  }
};

const renderPlan = (bundle) => {
  const lines = [
    "AlphaLab Supabase Auth email-template plan (offline)",
    `Templates: ${bundle.templates.length}; managed fields: ${bundle.templates.length * 2}`,
    "Local HTML line endings are normalized to LF before comparison or apply.",
  ];
  for (const template of bundle.templates) {
    lines.push(
      `- ${template.dashboardName} (${template.file})`,
      `  subject: ${template.subjectKey} ${formatFingerprint(template.subject)}`,
      `  body: ${template.contentKey} ${formatFingerprint(template.body)}`,
    );
  }
  lines.push(
    "No network request was made and no file or hosted configuration was changed.",
    "Use --check for a read-only hosted comparison or --apply for an explicit update.",
  );
  return lines;
};

const renderComparison = (comparison, heading) => {
  const lines = [heading];
  for (const template of comparison.templates) {
    const subjectState = template.subjectMatches ? "match" : "DRIFT";
    const bodyState = template.bodyMatches ? "match" : "DRIFT";
    lines.push(
      `- ${template.dashboardName} (${template.file}) subject=${subjectState} body=${bodyState}`,
    );
    if (!template.subjectMatches) {
      lines.push(
        `  ${template.subjectKey}: expected ${formatFingerprintFromResult(template.expectedSubject)}; remote ${formatFingerprintFromResult(template.remoteSubject)}`,
      );
    }
    if (!template.bodyMatches) {
      lines.push(
        `  ${template.contentKey}: expected ${formatFingerprintFromResult(template.expectedBody)}; remote ${formatFingerprintFromResult(template.remoteBody)}`,
      );
    }
  }
  return lines;
};

const formatFingerprintFromResult = (result) => (
  result.present ? `sha256=${result.sha256} bytes=${result.bytes}` : "missing"
);

export const runSync = async ({
  mode,
  env = process.env,
  fetchImpl = globalThis.fetch,
  apiOrigin = DEFAULT_MANAGEMENT_API_ORIGIN,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  writeLine = (line) => process.stdout.write(`${line}\n`),
} = {}) => {
  const bundle = await loadTemplateBundle();
  if (mode === "plan") {
    for (const line of renderPlan(bundle)) writeLine(line);
    return 0;
  }

  const { accessToken, projectRef } = readHostedEnvironment(env);
  if (mode === "check") {
    const remoteConfig = await requestAuthConfig({
      method: "GET",
      accessToken,
      projectRef,
      fetchImpl,
      apiOrigin,
      timeoutMs,
    });
    const comparison = compareRemoteConfig(bundle, remoteConfig);
    for (const line of renderComparison(
      comparison,
      comparison.matches
        ? "Hosted templates match the manifest exactly."
        : "Hosted template drift detected.",
    )) writeLine(line);
    return comparison.matches ? 0 : 1;
  }

  if (mode !== "apply") throw new SafeSyncError(`Unsupported mode: ${mode}`);
  writeLine(`Applying ${bundle.templates.length * 2} manifest-owned Auth configuration fields.`);
  await requestAuthConfig({
    method: "PATCH",
    accessToken,
    projectRef,
    fetchImpl,
    desiredConfig: bundle.desiredConfig,
    apiOrigin,
    timeoutMs,
  });
  const remoteConfig = await requestAuthConfig({
    method: "GET",
    accessToken,
    projectRef,
    fetchImpl,
    apiOrigin,
    timeoutMs,
  });
  const comparison = compareRemoteConfig(bundle, remoteConfig);
  for (const line of renderComparison(
    comparison,
    comparison.matches
      ? "Apply completed and hosted templates match the manifest exactly."
      : "Apply completed but strict hosted verification failed.",
  )) writeLine(line);
  return comparison.matches ? 0 : 1;
};

export const main = async (
  argv = process.argv.slice(2),
  {
    env = process.env,
    fetchImpl = globalThis.fetch,
    stdout = process.stdout,
    stderr = process.stderr,
    apiOrigin = DEFAULT_MANAGEMENT_API_ORIGIN,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {},
) => {
  try {
    const mode = parseMode(argv);
    if (mode === "help") {
      stdout.write(usage);
      return 0;
    }
    return await runSync({
      mode,
      env,
      fetchImpl,
      apiOrigin,
      timeoutMs,
      writeLine: (line) => stdout.write(`${line}\n`),
    });
  } catch (error) {
    const message = error instanceof SafeSyncError
      ? error.message
      : "Unexpected template synchronization failure.";
    stderr.write(`ERROR: ${message}\n`);
    return 2;
  }
};

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath && pathToFileURL(invokedPath).href === import.meta.url) {
  process.exitCode = await main();
}
