#!/usr/bin/env node
// Counts test cases by kind, for the sprint report. Unit tests and integration tests are
// reported separately so the unit-test number is real.
//
//   node scripts/count-tests.js                 counts in the current files
//   node scripts/count-tests.js --since <ref>   also shows how many are new since a commit/branch
//                                               (e.g. the last commit of the previous sprint)
//
// Kinds (see backend/TESTING.md):
//   backend unit        backend/test/*.test.js        no database, no network
//   backend integration backend/db-tests/*.spec.js    real MySQL test database and HTTP
//   frontend unit       frontend/src/**/*.test.js     plain functions, no browser
// A test case is a top-level `test("...")` or an `it("...")` call.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const KINDS = [
  { name: "backend unit", match: (f) => /^backend\/test\/[^/]+\.test\.js$/.test(f) },
  { name: "backend integration", match: (f) => /^backend\/db-tests\/[^/]+\.spec\.js$/.test(f) },
  { name: "frontend unit", match: (f) => /^frontend\/src\/.+\.test\.(js|jsx)$/.test(f) },
];
const TEST_CALL = /^\s*(?:test|it)\(\s*["'`]/gm;

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });

function countIn(text) {
  return (text.match(TEST_CALL) || []).length;
}

// { kind: { file: count } } for the working tree, or for a git ref
function collect(ref) {
  const files = ref ? git("ls-tree", "-r", "--name-only", ref).split("\n") : listWorkingFiles();
  const result = Object.fromEntries(KINDS.map((k) => [k.name, {}]));
  for (const file of files) {
    const kind = KINDS.find((k) => k.match(file));
    if (!kind) continue;
    const text = ref ? git("show", `${ref}:${file}`) : fs.readFileSync(path.join(ROOT, file), "utf8");
    result[kind.name][file] = countIn(text);
  }
  return result;
}

function listWorkingFiles() {
  // Tracked files plus new files that are not ignored
  return git("ls-files", "--cached", "--others", "--exclude-standard").split("\n").filter(Boolean);
}

const sum = (byFile) => Object.values(byFile).reduce((a, b) => a + b, 0);

function main() {
  const sinceIndex = process.argv.indexOf("--since");
  const since = sinceIndex !== -1 ? process.argv[sinceIndex + 1] : null;
  if (sinceIndex !== -1 && !since) throw new Error("Usage: count-tests.js --since <commit or branch>");

  const now = collect(null);
  const before = since ? collect(since) : null;

  for (const { name } of KINDS) {
    const files = Object.keys(now[name]).sort();
    console.log(`\n${name}: ${sum(now[name])} tests in ${files.length} files`);
    for (const file of files) {
      const old = before ? before[name][file] ?? 0 : null;
      const delta = before && now[name][file] !== old ? `  (${now[name][file] - old >= 0 ? "+" : ""}${now[name][file] - old})` : "";
      console.log(`  ${String(now[name][file]).padStart(3)}  ${file}${delta}`);
    }
  }

  if (before) {
    console.log(`\nNew since ${since}:`);
    for (const { name } of KINDS) {
      console.log(`  ${name.padEnd(20)} ${sum(now[name]) - sum(before[name])}`);
    }
  }
}

main();