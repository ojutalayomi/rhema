#!/usr/bin/env bun
/**
 * Syncs semver from a git tag (vX.Y.Z) into package.json, tauri.conf.json, and src-tauri/Cargo.toml.
 * Used locally and in CI before `tauri build`.
 *
 * Usage:
 *   bun run scripts/set-version-from-tag.ts --tag v1.2.3
 *   TAG=v1.2.3 bun run scripts/set-version-from-tag.ts
 *
 * CI: GITHUB_REF_NAME is set to the tag name on tag push (e.g. v1.2.3).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const TAG_RE = /^v(?<semver>\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;

function parseArgs(): { tag: string | undefined } {
  const argv = process.argv.slice(2);
  let tag: string | undefined = process.env.TAG?.trim() || undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--tag" && argv[i + 1]) {
      tag = argv[++i];
    }
  }
  if (!tag && process.env.GITHUB_REF_NAME) {
    tag = process.env.GITHUB_REF_NAME.trim();
  }
  return { tag };
}

function semverFromTag(tag: string): string {
  const m = tag.match(TAG_RE);
  if (!m?.groups?.semver) {
    throw new Error(
      `Invalid tag "${tag}". Expected vX.Y.Z or vX.Y.Z-prerelease (e.g. v0.2.0).`,
    );
  }
  return m.groups.semver;
}

function setCargoRootPackageVersion(cargo: string, version: string): string {
  // Root crate is `name = "app"`; match its version line (avoids workspace dep versions).
  // Use a function replacer so semver `0.1.0` does not produce `$10` (group 10) in a replacement string.
  const re = /(name = "app"\r?\nversion = ")([^"]+)(")/;
  const m = cargo.match(re);
  if (!m) {
    throw new Error(
      'Could not find name = "app" / version in src-tauri/Cargo.toml',
    );
  }
  if (m[2] === version) {
    return cargo;
  }
  return cargo.replace(
    re,
    (_full, before: string, _old: string, after: string) =>
      `${before}${version}${after}`,
  );
}

function main(): void {
  const { tag: raw } = parseArgs();
  if (!raw) {
    console.error(
      "Missing tag. Pass --tag vX.Y.Z or set TAG / GITHUB_REF_NAME.",
    );
    process.exit(1);
  }
  const semver = semverFromTag(raw);

  const pkgPath = resolve(ROOT, "package.json");
  const tauriConfPath = resolve(ROOT, "src-tauri/tauri.conf.json");
  const cargoPath = resolve(ROOT, "src-tauri/Cargo.toml");

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
  pkg.version = semver;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");

  const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf8")) as {
    version?: string;
  };
  tauriConf.version = semver;
  writeFileSync(
    tauriConfPath,
    `${JSON.stringify(tauriConf, null, 2)}\n`,
    "utf8",
  );

  const cargo = readFileSync(cargoPath, "utf8");
  writeFileSync(cargoPath, setCargoRootPackageVersion(cargo, semver), "utf8");

  console.log(`Synced version ${semver} from tag ${raw}`);
}

main();
