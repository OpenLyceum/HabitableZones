/**
 * decompile-flash.ts
 *
 * Extract readable ActionScript (and optionally assets) from the original NAAP
 * Flash sources under `../Baseline/Astronomy/flash-animations/` (sibling Baseline repo), so the ported Habitable Zones sim can be
 * checked against the real implementation.
 *
 * The `.fla` files are old binary (OLE compound) projects that no current tool
 * reads directly — but every one ships a sibling compiled `.swf`, and SWF → AS
 * decompilation is reliable. This script therefore decompiles the SWF (resolving
 * a `.fla` to its sibling `.swf` automatically) using JPEXS Free Flash Decompiler
 * (FFDec), which needs a Java runtime.
 *
 * Run with:
 *   npm run decompile                 # the two HZ simulators → NAAP/decompiled/
 *   npm run decompile -- --all        # all HZ-relevant movies
 *   npm run decompile -- <file|dir>…  # specific .swf/.fla/folder
 *   npm run decompile -- --list       # dry run: show what would be decompiled
 *   npm run decompile -- --setup      # download FFDec into tools/ffdec/ (needs Java)
 *
 * Flags: --all --list --assets --xfl --recursive --out <dir> --setup
 *        --ffdec-version <v> --help
 *
 * One-time prerequisite — a Java runtime and FFDec:
 *   • Java:  sudo apt install default-jre   (Debian/WSL) · brew install temurin (macOS)
 *   • FFDec: `npm run decompile -- --setup`, or set FFDEC_JAR=/path/to/ffdec.jar
 *            (or put `ffdec` on your PATH). Download: https://github.com/jindrapetrik/jpexs-decompiler/releases
 */

import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, parse, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const flashRoot = resolve(repoRoot, "..", "Baseline", "Astronomy", "flash-animations", "flashdev2");

/** Fail fast when the Baseline sibling checkout (or fetch) is missing. */
function ensureFlashRoot(): void {
  if (!existsSync(flashRoot)) {
    fail(
      `NAAP Flash sources not found at:\n  ${flashRoot}\n` +
        `Clone OpenLyceum/Baseline as a sibling of this sim, then:\n` +
        `  (cd ../Baseline && ./scripts/fetch-baselines.sh --only Astronomy/flash-animations)`,
    );
  }
}

/**
 * Latest canonical SWFs whose ActionScript informs the port (used by --all).
 * The two primary simulators (one per screen) come first, followed by the
 * reusable components and concept demos they build on.
 */
const HZ_TARGETS = [
  // The two simulators being ported (primary source of truth, one per screen).
  "stellarHabitableZone/stellarHabitableZone004.swf", // Circumstellar Habitable Zone Simulator
  "milkyWayHabitability/milkyWayHabitability001-B.swf", // Galactic / Milky Way Habitability Simulator
  // Supporting concept demo: the galactic rotation curve behind the GHZ model.
  "milkyWayRotationalVelocity/milkyWayRotationalVelocity005-C.swf",
].map((p) => join(flashRoot, p));

/** The two simulators being ported, decompiled by default when no targets are given. */
const DEFAULT_TARGETS = HZ_TARGETS.slice(0, 2);

const DEFAULT_FFDEC_VERSION = "21.1.0";

interface Options {
  targets: string[];
  all: boolean;
  list: boolean;
  assets: boolean;
  xfl: boolean;
  recursive: boolean;
  setup: boolean;
  outDir: string;
  ffdecVersion: string;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    targets: [],
    all: false,
    list: false,
    assets: false,
    xfl: false,
    recursive: false,
    setup: false,
    outDir: join(repoRoot, "NAAP", "decompiled"),
    ffdecVersion: process.env["FFDEC_VERSION"] ?? DEFAULT_FFDEC_VERSION,
  };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i++];
    if (arg === undefined) {
      continue;
    }
    switch (arg) {
      case "--help":
      case "-h":
        printHelp();
        return process.exit(0);
      case "--all":
        opts.all = true;
        break;
      case "--list":
        opts.list = true;
        break;
      case "--assets":
        opts.assets = true;
        break;
      case "--xfl":
        opts.xfl = true;
        break;
      case "--recursive":
        opts.recursive = true;
        break;
      case "--setup":
        opts.setup = true;
        break;
      case "--out":
        opts.outDir = resolve(argv[i++] ?? "");
        break;
      case "--ffdec-version":
        opts.ffdecVersion = argv[i++] ?? opts.ffdecVersion;
        break;
      default:
        if (arg.startsWith("-")) {
          fail(`Unknown flag: ${arg}\nRun with --help for usage.`);
        }
        opts.targets.push(resolve(arg));
    }
  }
  return opts;
}

function printHelp(): void {
  console.log(
    `decompile-flash — extract ActionScript from the NAAP Flash sources

Usage:
  npm run decompile                  Decompile the two HZ simulators → NAAP/decompiled/
  npm run decompile -- --all         Decompile all HZ-relevant movies
  npm run decompile -- <path>…       Decompile specific .swf / .fla / folder(s)

Flags:
  --all              Decompile the curated set of HZ-relevant SWFs
  --list             Dry run — print resolved targets, do not run FFDec
  --assets           Also export images/shapes/sounds/text (not just scripts)
  --xfl              Reconstruct an editable XFL project instead of raw scripts
  --recursive        When a folder is given, recurse into subfolders
  --out <dir>        Output base directory (default: NAAP/decompiled)
  --setup            Download FFDec into tools/ffdec/ (one-time; needs Java)
  --ffdec-version v  FFDec release to fetch with --setup (default ${DEFAULT_FFDEC_VERSION})
  --help, -h         Show this help

Notes:
  • .fla files are old binary projects; the script decompiles their sibling .swf.
  • Output goes to <out>/<movie-name>/scripts/… as readable .as files.
  • FFDec needs Java. Point at an existing install with FFDEC_JAR=/path/to/ffdec.jar
    or put an 'ffdec' launcher on PATH; otherwise run --setup once.`,
  );
}

function fail(message: string): never {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

// ── FFDec discovery ────────────────────────────────────────────────────────────

interface Ffdec {
  /** argv prefix that runs FFDec, e.g. ["java","-jar",".../ffdec.jar"] or ["ffdec"]. */
  command: string[];
  source: string;
}

function which(bin: string): string | null {
  const res = spawnSync(process.platform === "win32" ? "where" : "which", [bin], {
    encoding: "utf8",
  });
  if (res.status === 0) {
    return res.stdout.split(/\r?\n/)[0]?.trim() || null;
  }
  return null;
}

function hasJava(): boolean {
  return spawnSync("java", ["-version"], { stdio: "ignore" }).status === 0;
}

const localFfdecDir = join(repoRoot, "tools", "ffdec");

/** Locate FFDec via env, PATH, or the local tools/ffdec install. */
function findFfdec(): Ffdec | null {
  const envJar = process.env["FFDEC_JAR"];
  if (envJar && existsSync(envJar)) {
    return { command: javaJar(envJar), source: `FFDEC_JAR=${envJar}` };
  }
  const envLauncher = process.env["FFDEC"];
  if (envLauncher && existsSync(envLauncher)) {
    return { command: [envLauncher], source: `FFDEC=${envLauncher}` };
  }
  const onPath = which("ffdec");
  if (onPath) {
    return { command: [onPath], source: `ffdec on PATH (${onPath})` };
  }
  const localLauncher = join(localFfdecDir, process.platform === "win32" ? "ffdec.bat" : "ffdec.sh");
  if (existsSync(localLauncher)) {
    return { command: [localLauncher], source: relative(repoRoot, localLauncher) };
  }
  const localJar = join(localFfdecDir, "ffdec.jar");
  if (existsSync(localJar)) {
    return { command: javaJar(localJar), source: relative(repoRoot, localJar) };
  }
  return null;
}

function javaJar(jar: string): string[] {
  return ["java", "-Djava.awt.headless=true", "-jar", jar];
}

function ffdecSetupHint(version: string): string {
  return [
    "FFDec was not found. Set it up once with either:",
    `  • npm run decompile -- --setup            (downloads FFDec ${version} into tools/ffdec/)`,
    "  • export FFDEC_JAR=/path/to/ffdec.jar     (point at an existing install)",
    "  • put an `ffdec` launcher on your PATH",
    "FFDec also needs Java:  sudo apt install default-jre  ·  brew install temurin",
  ].join("\n");
}

// ── target resolution ──────────────────────────────────────────────────────────

/** Resolve a .swf (decompiling a .fla means decompiling its sibling .swf). */
function resolveMovie(target: string): string | null {
  if (!existsSync(target)) {
    console.warn(`  ! skipping (not found): ${rel(target)}`);
    return null;
  }
  const ext = parse(target).ext.toLowerCase();
  if (ext === ".swf") {
    return target;
  }
  if (ext === ".fla") {
    const sibling = `${target.slice(0, -4)}.swf`;
    if (existsSync(sibling)) {
      console.log(`  • ${rel(target)} → using sibling SWF ${parse(sibling).base}`);
      return sibling;
    }
    console.warn(`  ! skipping ${rel(target)}: no sibling .swf, and old binary .fla cannot be read directly`);
    return null;
  }
  console.warn(`  ! skipping (not .swf/.fla): ${rel(target)}`);
  return null;
}

/** Expand folders to the .swf files they contain (optionally recursive). */
function collectSwfs(dir: string, recursive: boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) {
        out.push(...collectSwfs(full, recursive));
      }
    } else if (entry.name.toLowerCase().endsWith(".swf")) {
      out.push(full);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function resolveTargets(opts: Options): string[] {
  let requested: string[];
  if (opts.targets.length > 0) {
    requested = [];
    for (const t of opts.targets) {
      if (existsSync(t) && statSync(t).isDirectory()) {
        requested.push(...collectSwfs(t, opts.recursive));
      } else {
        requested.push(t);
      }
    }
  } else if (opts.all) {
    requested = HZ_TARGETS;
  } else {
    requested = DEFAULT_TARGETS;
  }

  const movies: string[] = [];
  for (const t of requested) {
    const swf = resolveMovie(t);
    if (swf && !movies.includes(swf)) {
      movies.push(swf);
    }
  }
  return movies;
}

function rel(p: string): string {
  return relative(repoRoot, p) || p;
}

// ── decompiling ────────────────────────────────────────────────────────────────

function exportTypes(opts: Options): string {
  if (opts.xfl) {
    return "xfl";
  }
  if (opts.assets) {
    return "script,image,shape,morphshape,sound,text,binaryData";
  }
  return "script";
}

function decompile(ffdec: Ffdec, swf: string, opts: Options): boolean {
  const name = parse(swf).name;
  const outDir = join(opts.outDir, name);
  mkdirSync(outDir, { recursive: true });
  const [bin, ...prefix] = ffdec.command;
  if (!bin) {
    return false;
  }
  const args = [...prefix, "-export", exportTypes(opts), outDir, swf];
  console.log(`\n→ ${name}  (${rel(swf)})`);
  console.log(`  ${bin} ${args.join(" ")}`);
  const res = spawnSync(bin, args, { stdio: "inherit" });
  if (res.error) {
    console.error(`  ✖ failed to launch FFDec: ${res.error.message}`);
    return false;
  }
  if (res.status !== 0) {
    console.error(`  ✖ FFDec exited with status ${res.status}`);
    return false;
  }
  console.log(`  ✓ ${rel(outDir)}`);
  return true;
}

// ── --setup: download + extract FFDec (dependency-free) ─────────────────────────

async function setupFfdec(version: string): Promise<void> {
  if (!hasJava()) {
    console.warn(
      "⚠ Java was not detected. FFDec needs a Java runtime to run after download.\n" +
        "  Install it with: sudo apt install default-jre   (or: brew install temurin)\n",
    );
  }
  const url = `https://github.com/jindrapetrik/jpexs-decompiler/releases/download/version${version}/ffdec_${version}.zip`;
  console.log(`Downloading FFDec ${version}…\n  ${url}`);
  let buf: Buffer;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    buf = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    fail(
      `Download failed: ${(err as Error).message}\n` +
        "Download ffdec_<version>.zip manually from\n" +
        "  https://github.com/jindrapetrik/jpexs-decompiler/releases\n" +
        `then unzip it into ${rel(localFfdecDir)}/ (so ${rel(join(localFfdecDir, "ffdec.jar"))} exists),\n` +
        "or set FFDEC_JAR to an existing ffdec.jar.",
    );
  }
  console.log(`Extracting ${(buf.length / 1e6).toFixed(1)} MB → ${rel(localFfdecDir)}/`);
  extractZip(buf, localFfdecDir);
  const launcher = join(localFfdecDir, "ffdec.sh");
  if (existsSync(launcher)) {
    chmodSync(launcher, 0o755);
  }
  const jar = join(localFfdecDir, "ffdec.jar");
  if (!existsSync(jar)) {
    fail(`Extraction finished but ${rel(jar)} is missing — the archive layout was unexpected.`);
  }
  console.log(`\n✓ FFDec ready at ${rel(jar)}\n  Now run:  npm run decompile`);
}

/**
 * Minimal ZIP extractor (deflate + stored) driven by the central directory, so
 * we need no third-party unzip dependency. Sufficient for FFDec's release zip.
 */
function extractZip(buf: Buffer, destDir: string): void {
  const EOCD_SIG = 0x06054b50;
  const CEN_SIG = 0x02014b50;
  // Locate End Of Central Directory (scan backwards; comment is usually empty).
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 0xffff; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    fail("Not a valid ZIP archive (no end-of-central-directory record).");
  }
  const entryCount = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16); // central directory offset

  for (let n = 0; n < entryCount; n++) {
    if (buf.readUInt32LE(p) !== CEN_SIG) {
      fail("Corrupt ZIP central directory.");
    }
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    const outPath = join(destDir, name);
    if (name.endsWith("/")) {
      mkdirSync(outPath, { recursive: true });
      continue;
    }
    // Read the local header to find where the entry's data actually starts.
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    const data = method === 0 ? raw : inflateRawSync(raw);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, data);
  }
}

// ── main ────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.setup) {
    await setupFfdec(opts.ffdecVersion);
    return;
  }

  ensureFlashRoot();

  const movies = resolveTargets(opts);
  if (movies.length === 0) {
    fail("No .swf targets resolved. Check the paths, or run with --help.");
  }

  console.log(`Resolved ${movies.length} movie(s):`);
  for (const m of movies) {
    console.log(`  • ${rel(m)}`);
  }

  if (opts.list) {
    console.log("\n(--list) Dry run — nothing decompiled.");
    return;
  }

  if (!hasJava()) {
    fail(`Java runtime not found.\n${ffdecSetupHint(opts.ffdecVersion)}`);
  }
  const ffdec = findFfdec();
  if (!ffdec) {
    fail(ffdecSetupHint(opts.ffdecVersion));
  }

  console.log(`\nUsing FFDec: ${ffdec.source}`);
  console.log(`Exporting: ${exportTypes(opts)}  →  ${rel(opts.outDir)}/`);

  let ok = 0;
  for (const swf of movies) {
    if (decompile(ffdec, swf, opts)) {
      ok++;
    }
  }
  console.log(`\nDone: ${ok}/${movies.length} decompiled into ${rel(opts.outDir)}/`);
  if (ok < movies.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => fail((err as Error).stack ?? String(err)));
