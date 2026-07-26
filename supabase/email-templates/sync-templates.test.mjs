import assert from "node:assert/strict";
import test from "node:test";

import {
  compareRemoteConfig,
  loadTemplateBundle,
  main,
} from "./sync-templates.mjs";

const hostedEnv = {
  SUPABASE_ACCESS_TOKEN: "test-access-token-that-must-never-be-printed",
  SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
};

const capture = () => {
  let value = "";
  return {
    stream: { write: (chunk) => { value += String(chunk); } },
    read: () => value,
  };
};

const jsonResponse = (value, status = 200, statusText = "") => new Response(
  JSON.stringify(value),
  {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  },
);

test("default mode creates an offline plan without credentials or fetch", async () => {
  const stdout = capture();
  const stderr = capture();
  let fetchCalls = 0;
  const code = await main([], {
    env: hostedEnv,
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error("network must not be called");
    },
    stdout: stdout.stream,
    stderr: stderr.stream,
  });

  assert.equal(code, 0);
  assert.equal(fetchCalls, 0);
  assert.match(stdout.read(), /plan \(offline\)/);
  assert.match(stdout.read(), /No network request was made/);
  assert.doesNotMatch(stdout.read(), /test-access-token/);
  assert.doesNotMatch(stdout.read(), /<!doctype html>/i);
  const bundle = await loadTemplateBundle();
  assert.doesNotMatch(stdout.read(), new RegExp(bundle.templates[0].subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(stderr.read(), "");
});

test("--check returns zero when every manifest-owned field matches exactly", async () => {
  const bundle = await loadTemplateBundle();
  const stdout = capture();
  const stderr = capture();
  const calls = [];
  const code = await main(["--check"], {
    env: hostedEnv,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse(bundle.desiredConfig);
    },
    stdout: stdout.stream,
    stderr: stderr.stream,
  });

  assert.equal(code, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(
    calls[0].url,
    "https://api.supabase.com/v1/projects/abcdefghijklmnopqrst/config/auth",
  );
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${hostedEnv.SUPABASE_ACCESS_TOKEN}`);
  assert.match(stdout.read(), /match the manifest exactly/);
  assert.doesNotMatch(stdout.read(), /test-access-token/);
  assert.doesNotMatch(stdout.read(), /<!doctype html>/i);
  assert.equal(stderr.read(), "");
});

test("--check reports hashes only and exits one when hosted fields drift", async () => {
  const bundle = await loadTemplateBundle();
  const driftMarker = "REMOTE-BODY-CONTENT-MUST-NOT-BE-PRINTED";
  const remoteConfig = {
    ...bundle.desiredConfig,
    [bundle.templates[0].contentKey]: driftMarker,
  };
  const stdout = capture();
  const stderr = capture();
  const code = await main(["--check"], {
    env: hostedEnv,
    fetchImpl: async () => jsonResponse(remoteConfig),
    stdout: stdout.stream,
    stderr: stderr.stream,
  });

  assert.equal(code, 1);
  assert.match(stdout.read(), /drift detected/i);
  assert.match(stdout.read(), /sha256=/);
  assert.doesNotMatch(stdout.read(), new RegExp(driftMarker));
  assert.doesNotMatch(stdout.read(), /<!doctype html>/i);
  assert.equal(stderr.read(), "");
});

test("--apply patches only desired fields and verifies with a subsequent GET", async () => {
  const bundle = await loadTemplateBundle();
  const stdout = capture();
  const stderr = capture();
  const methods = [];
  const code = await main(["--apply"], {
    env: hostedEnv,
    fetchImpl: async (_url, options) => {
      methods.push(options.method);
      if (options.method === "PATCH") {
        assert.deepEqual(JSON.parse(options.body), bundle.desiredConfig);
        assert.equal(options.headers["Content-Type"], "application/json");
        return jsonResponse({ accepted: true });
      }
      return jsonResponse(bundle.desiredConfig);
    },
    stdout: stdout.stream,
    stderr: stderr.stream,
  });

  assert.equal(code, 0);
  assert.deepEqual(methods, ["PATCH", "GET"]);
  assert.match(stdout.read(), /Apply completed/);
  assert.doesNotMatch(stdout.read(), /test-access-token/);
  assert.doesNotMatch(stdout.read(), /<!doctype html>/i);
  assert.equal(stderr.read(), "");
});

test("--apply exits one when the strict read-back still drifts", async () => {
  const bundle = await loadTemplateBundle();
  const remoteConfig = {
    ...bundle.desiredConfig,
    [bundle.templates[1].subjectKey]: "remote subject",
  };
  const stdout = capture();
  const stderr = capture();
  const code = await main(["--apply"], {
    env: hostedEnv,
    fetchImpl: async (_url, options) => (
      options.method === "PATCH"
        ? jsonResponse({ accepted: true })
        : jsonResponse(remoteConfig)
    ),
    stdout: stdout.stream,
    stderr: stderr.stream,
  });

  assert.equal(code, 1);
  assert.match(stdout.read(), /strict hosted verification failed/i);
  assert.doesNotMatch(stdout.read(), /remote subject/);
  assert.equal(stderr.read(), "");
});

test("HTTP errors are nonzero and never expose token or response content", async () => {
  const responseSecret = "server-response-body-must-not-be-printed";
  const stdout = capture();
  const stderr = capture();
  const code = await main(["--check"], {
    env: hostedEnv,
    fetchImpl: async () => jsonResponse({ message: responseSecret }, 403, "Forbidden"),
    stdout: stdout.stream,
    stderr: stderr.stream,
  });

  assert.equal(code, 2);
  assert.match(stderr.read(), /HTTP 403/);
  assert.doesNotMatch(stderr.read(), /test-access-token/);
  assert.doesNotMatch(stderr.read(), new RegExp(responseSecret));
  assert.equal(stdout.read(), "");
});

test("hosted modes require environment-only credentials before fetch", async () => {
  const stdout = capture();
  const stderr = capture();
  let fetchCalls = 0;
  const code = await main(["--check"], {
    env: {},
    fetchImpl: async () => {
      fetchCalls += 1;
      return jsonResponse({});
    },
    stdout: stdout.stream,
    stderr: stderr.stream,
  });

  assert.equal(code, 2);
  assert.equal(fetchCalls, 0);
  assert.match(stderr.read(), /SUPABASE_ACCESS_TOKEN is required/);
  assert.equal(stdout.read(), "");
});

test("invalid or conflicting CLI modes fail before network access without echoing arguments", async () => {
  const secretArgument = "--token=must-not-be-printed";
  for (const argv of [[secretArgument], ["--check", "--apply"], ["--check", "--check"]]) {
    const stdout = capture();
    const stderr = capture();
    let fetchCalls = 0;
    const code = await main(argv, {
      env: hostedEnv,
      fetchImpl: async () => {
        fetchCalls += 1;
        return jsonResponse({});
      },
      stdout: stdout.stream,
      stderr: stderr.stream,
    });
    assert.equal(code, 2);
    assert.equal(fetchCalls, 0);
    assert.match(stderr.read(), /ERROR:/);
    assert.doesNotMatch(stderr.read(), /must-not-be-printed/);
    assert.equal(stdout.read(), "");
  }
});

test("comparison ignores unrelated Auth config and detects missing managed fields", async () => {
  const bundle = await loadTemplateBundle();
  const complete = compareRemoteConfig(bundle, {
    ...bundle.desiredConfig,
    smtp_host: "unrelated.example",
  });
  assert.equal(complete.matches, true);

  const incomplete = { ...bundle.desiredConfig };
  delete incomplete[bundle.templates[0].subjectKey];
  const result = compareRemoteConfig(bundle, incomplete);
  assert.equal(result.matches, false);
  assert.equal(result.templates[0].remoteSubject.present, false);
});
