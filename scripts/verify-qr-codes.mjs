#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT_PATH = path.join(ROOT, ".lakebed", "artifacts", "qr-verification-app.json");
const CANONICAL_GUEST_ORIGIN = "https://bribe.lakebed.app";
const DEFAULT_LOCAL_ORIGIN = "http://localhost:3000";
const QUIET_ZONE = 4;
const FORMAT_DIVISOR = 0x537;
const FORMAT_MASK = 0x5412;
const EC_LEVEL_M = 0;

const QR_SPECS = [
  { version: 1, dataCodewords: 16, errorCodewords: 10, dataBlocks: [16] },
  { version: 2, dataCodewords: 28, errorCodewords: 16, dataBlocks: [28] },
  { version: 3, dataCodewords: 44, errorCodewords: 26, dataBlocks: [44] },
  { version: 4, dataCodewords: 64, errorCodewords: 36, dataBlocks: [32, 32] },
  { version: 5, dataCodewords: 86, errorCodewords: 48, dataBlocks: [43, 43] },
];

const ALIGNMENT_POSITIONS = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
};

const VISUAL_VARIANTS = [
  { name: "default-rounded", options: {} },
  { name: "classic-square", options: { dotStyle: "square", cornerStyle: "square" } },
  { name: "dot-modules", options: { dotStyle: "dots", cornerStyle: "rounded" } },
  { name: "soft-blocks", options: { dotStyle: "classy", cornerStyle: "extra-rounded" } },
];

const cli = parseArgs(process.argv.slice(2));
const qrRuntime = loadCompiledQrRuntime();
const cases = buildCases(cli);
const failures = [];

for (const testCase of cases) {
  const validation = qrRuntime.validateQrValue(testCase.value);
  if (!validation.ok) {
    failures.push(`${testCase.name}: validateQrValue rejected ${validation.byteLength} bytes: ${validation.message}`);
    continue;
  }

  for (const variant of VISUAL_VARIANTS) {
    try {
      const svg = qrRuntime.createQrSvg(testCase.value, variant.options);
      const decoded = decodeQrSvg(svg);
      assertEqual(decoded.value, testCase.value, `${testCase.name} / ${variant.name} decoded value`);
      assertEqual(decoded.byteLength, validation.byteLength, `${testCase.name} / ${variant.name} byte length`);
      console.log(
        `ok ${testCase.name} / ${variant.name}: version ${decoded.version}, mask ${decoded.mask}, ${decoded.byteLength} bytes`,
      );
    } catch (caught) {
      failures.push(`${testCase.name} / ${variant.name}: ${caught instanceof Error ? caught.message : String(caught)}`);
    }
  }
}

verifyTooLongGuard(qrRuntime, failures);

if (failures.length) {
  console.error("\nQR verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`\nVerified ${cases.length * VISUAL_VARIANTS.length} QR render/decode combinations.`);

function loadCompiledQrRuntime() {
  const buildOutput = execFileSync(
    "npx",
    ["lakebed", "build", "--target", "anonymous", "--out", ARTIFACT_PATH, "--json"],
    { cwd: ROOT, encoding: "utf8" },
  );
  const { artifactPath } = JSON.parse(buildOutput);
  const artifact = JSON.parse(readFileSync(path.resolve(ROOT, artifactPath), "utf8"));
  const clientBundle = Buffer.from(artifact.clientBundle, "base64").toString("utf8");
  const qrSection = extractQrSection(clientBundle);
  const sandbox = {
    Buffer,
    console,
    TextDecoder,
  };
  vm.runInNewContext(
    `
      const DEFAULT_QR_FOREGROUND_COLOR = "#111827";
      const DEFAULT_QR_BACKGROUND_COLOR = "#ffffff";
      const DEFAULT_QR_ACCENT_COLOR = "#ef4444";
      const DEFAULT_QR_DOT_STYLE = "rounded";
      const DEFAULT_QR_CORNER_STYLE = "extra-rounded";
      const DEFAULT_QR_LOGO_SIZE = "20";
      function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
      }
      function safeColor(value) {
        const trimmed = value.trim();
        return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : "";
      }
      function slugify(value, fallback = "item") {
        const slug = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        return slug || fallback;
      }
      ${qrSection}
      globalThis.__qrRuntime = { createQrSvg, validateQrValue };
    `,
    sandbox,
    { filename: "compiled-qr-runtime.js" },
  );
  return sandbox.__qrRuntime;
}

function extractQrSection(clientBundle) {
  const start = clientBundle.indexOf("// lakebed-source:client/qr-code.tsx");
  const end = clientBundle.indexOf("// lakebed-source:client/owner-pages.tsx", start);
  if (start < 0 || end < 0) {
    throw new Error("Could not find compiled client/qr-code.tsx section in Lakebed bundle.");
  }
  return clientBundle.slice(start, end);
}

function buildCases({ localOrigin, publicIds, values }) {
  const cases = [
    {
      name: "canonical-default-public-id",
      value: `${CANONICAL_GUEST_ORIGIN}/q/main-abcd`,
    },
    {
      name: "local-default-public-id",
      value: `${localOrigin}/q/main-abcd`,
    },
    {
      name: "version-1-boundary",
      value: "https://b.co/a",
    },
    {
      name: "version-2-boundary",
      value: asciiPayloadOfLength("v2-", 26),
    },
    {
      name: "version-3-boundary",
      value: asciiPayloadOfLength("v3-", 42),
    },
    {
      name: "version-4-boundary",
      value: asciiPayloadOfLength("v4-", 62),
    },
    {
      name: "version-5-boundary",
      value: asciiPayloadOfLength("v5-", 84),
    },
  ];

  for (const publicId of publicIds) {
    cases.push({
      name: `canonical-public-id-${publicId}`,
      value: `${CANONICAL_GUEST_ORIGIN}/q/${publicId}`,
    });
    cases.push({
      name: `local-public-id-${publicId}`,
      value: `${localOrigin}/q/${publicId}`,
    });
  }

  for (const [index, value] of values.entries()) {
    cases.push({ name: `explicit-value-${index + 1}`, value });
  }

  return cases;
}

function asciiPayloadOfLength(prefix, length) {
  if (prefix.length > length) {
    throw new Error(`Boundary prefix ${prefix} is longer than ${length} bytes.`);
  }
  return `${prefix}${"x".repeat(length - prefix.length)}`;
}

function parseArgs(args) {
  const values = [];
  const publicIds = [];
  let localOrigin = DEFAULT_LOCAL_ORIGIN;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--value") {
      values.push(requireNext(args, ++index, arg));
    } else if (arg.startsWith("--value=")) {
      values.push(arg.slice("--value=".length));
    } else if (arg === "--public-id") {
      publicIds.push(requireNext(args, ++index, arg));
    } else if (arg.startsWith("--public-id=")) {
      publicIds.push(arg.slice("--public-id=".length));
    } else if (arg === "--local-origin") {
      localOrigin = normalizeOrigin(requireNext(args, ++index, arg));
    } else if (arg.startsWith("--local-origin=")) {
      localOrigin = normalizeOrigin(arg.slice("--local-origin=".length));
    } else if (arg === "--help" || arg === "-h") {
      printHelpAndExit();
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return {
    localOrigin,
    publicIds: publicIds.map((id) => id.trim()).filter(Boolean),
    values: values.map((value) => value.trim()).filter(Boolean),
  };
}

function requireNext(args, index, flag) {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function normalizeOrigin(value) {
  return value.replace(/\/+$/g, "");
}

function printHelpAndExit() {
  console.log(`Usage: node scripts/verify-qr-codes.mjs [--public-id id] [--value url] [--local-origin origin]

Options:
  --public-id      Add both canonical and local /q/{publicId} QR payloads to the verification set.
  --value          Add an exact QR payload URL or reward code to the verification set.
  --local-origin   Local dev origin used for generated /q/{publicId} payloads. Defaults to ${DEFAULT_LOCAL_ORIGIN}.
`);
  process.exit(0);
}

function decodeQrSvg(svg) {
  const modules = matrixFromSvg(svg);
  const size = modules.length;
  const version = (size - 17) / 4;
  const spec = QR_SPECS.find((item) => item.version === version);
  if (!spec) {
    throw new Error(`Unsupported decoded QR size ${size}.`);
  }

  const observedFormat = readFormatBits(modules);
  const mask = maskFromFormatBits(observedFormat);
  const isFunction = makeGrid(size, false);
  markFunctionPatterns(isFunction, version);

  const dataBits = [];
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical += 1) {
      const y = upward ? size - 1 - vertical : vertical;
      for (let column = 0; column < 2; column += 1) {
        const x = right - column;
        if (!isFunction[y][x]) {
          const masked = modules[y][x];
          dataBits.push(shouldMask(mask, x, y) ? !masked : masked);
        }
      }
    }
    upward = !upward;
  }

  const totalCodewords = spec.dataCodewords + spec.errorCodewords;
  const codewords = [];
  for (let index = 0; index < totalCodewords * 8; index += 8) {
    codewords.push(bitsToByte(dataBits.slice(index, index + 8)));
  }

  const dataCodewords = deinterleaveDataCodewords(codewords, spec);
  const decoded = decodeByteModeData(dataCodewords);
  return {
    ...decoded,
    mask,
    version,
  };
}

function matrixFromSvg(svg) {
  const viewBox = /viewBox="0 0 ([0-9.]+) ([0-9.]+)"/.exec(svg);
  if (!viewBox) {
    throw new Error("QR SVG is missing a numeric viewBox.");
  }
  const viewBoxSize = Number(viewBox[1]);
  const size = viewBoxSize - QUIET_ZONE * 2;
  if (!Number.isInteger(size) || size < 21) {
    throw new Error(`QR SVG has invalid module size ${size}.`);
  }

  const modules = makeGrid(size, false);
  const dataGroup = /<g fill="[^"]*">([\s\S]*?)<\/g>/.exec(svg);
  if (!dataGroup) {
    throw new Error("QR SVG is missing the foreground module group.");
  }

  for (const rect of dataGroup[1].matchAll(/<rect\b([^>]*)\/>/g)) {
    const x = readNumberAttr(rect[1], "x");
    const y = readNumberAttr(rect[1], "y");
    setModule(modules, Math.round(x - QUIET_ZONE), Math.round(y - QUIET_ZONE), true);
  }
  for (const circle of dataGroup[1].matchAll(/<circle\b([^>]*)\/>/g)) {
    const cx = readNumberAttr(circle[1], "cx");
    const cy = readNumberAttr(circle[1], "cy");
    setModule(modules, Math.round(cx - QUIET_ZONE - 0.5), Math.round(cy - QUIET_ZONE - 0.5), true);
  }

  drawFinderPattern(modules, 3, 3);
  drawFinderPattern(modules, size - 4, 3);
  drawFinderPattern(modules, 3, size - 4);
  return modules;
}

function readNumberAttr(attrs, name) {
  const match = new RegExp(`${name}="([0-9.]+)"`).exec(attrs);
  if (!match) {
    throw new Error(`QR SVG element is missing ${name}.`);
  }
  return Number(match[1]);
}

function setModule(modules, x, y, value) {
  if (y >= 0 && y < modules.length && x >= 0 && x < modules.length) {
    modules[y][x] = value;
  }
}

function readFormatBits(modules) {
  const size = modules.length;
  let bits = 0;
  for (let i = 0; i <= 5; i += 1) {
    if (modules[i][8]) bits |= 1 << i;
  }
  if (modules[7][8]) bits |= 1 << 6;
  if (modules[8][8]) bits |= 1 << 7;
  if (modules[8][7]) bits |= 1 << 8;
  for (let i = 9; i < 15; i += 1) {
    if (modules[8][14 - i]) bits |= 1 << i;
  }

  const duplicateBits = [];
  for (let i = 0; i < 8; i += 1) {
    duplicateBits[i] = modules[8][size - 1 - i];
  }
  for (let i = 8; i < 15; i += 1) {
    duplicateBits[i] = modules[size - 15 + i][8];
  }
  const duplicate = duplicateBits.reduce((value, bit, index) => bit ? value | (1 << index) : value, 0);
  if (hammingDistance(bits, duplicate) > 3) {
    throw new Error("QR format bit copies disagree.");
  }
  return bits;
}

function maskFromFormatBits(observed) {
  let bestMask = -1;
  let bestDistance = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    const distance = hammingDistance(observed, calculateFormatBits(mask));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMask = mask;
    }
  }
  if (bestDistance > 3) {
    throw new Error("QR format bits do not match a medium-error-correction mask.");
  }
  return bestMask;
}

function calculateFormatBits(mask) {
  const data = (EC_LEVEL_M << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i -= 1) {
    if (((rem >>> i) & 1) !== 0) {
      rem ^= FORMAT_DIVISOR << (i - 10);
    }
  }
  return ((data << 10) | rem) ^ FORMAT_MASK;
}

function markFunctionPatterns(isFunction, version) {
  const size = isFunction.length;
  markFinderZone(isFunction, 0, 0);
  markFinderZone(isFunction, size - 8, 0);
  markFinderZone(isFunction, 0, size - 8);

  for (let i = 0; i < size; i += 1) {
    isFunction[i][6] = true;
    isFunction[6][i] = true;
  }

  for (const x of ALIGNMENT_POSITIONS[version]) {
    for (const y of ALIGNMENT_POSITIONS[version]) {
      const overlapsFinder = (x === 6 && y === 6) || (x === 6 && y === size - 7) || (x === size - 7 && y === 6);
      if (!overlapsFinder) {
        for (let dy = -2; dy <= 2; dy += 1) {
          for (let dx = -2; dx <= 2; dx += 1) {
            isFunction[y + dy][x + dx] = true;
          }
        }
      }
    }
  }

  for (let i = 0; i <= 5; i += 1) isFunction[i][8] = true;
  isFunction[7][8] = true;
  isFunction[8][8] = true;
  isFunction[8][7] = true;
  for (let i = 9; i < 15; i += 1) isFunction[8][14 - i] = true;
  for (let i = 0; i < 8; i += 1) isFunction[8][size - 1 - i] = true;
  for (let i = 8; i < 15; i += 1) isFunction[size - 15 + i][8] = true;
  isFunction[size - 8][8] = true;
}

function markFinderZone(grid, left, top) {
  for (let y = top; y < top + 9; y += 1) {
    for (let x = left; x < left + 9; x += 1) {
      if (y >= 0 && y < grid.length && x >= 0 && x < grid.length) {
        grid[y][x] = true;
      }
    }
  }
}

function drawFinderPattern(modules, centerX, centerY) {
  for (let dy = -3; dy <= 3; dy += 1) {
    for (let dx = -3; dx <= 3; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setModule(modules, centerX + dx, centerY + dy, distance !== 2);
    }
  }
}

function shouldMask(mask, x, y) {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function deinterleaveDataCodewords(codewords, spec) {
  const interleavedData = codewords.slice(0, spec.dataCodewords);
  const blocks = spec.dataBlocks.map(() => []);
  let offset = 0;
  const maxDataBlockLength = Math.max(...spec.dataBlocks);
  for (let index = 0; index < maxDataBlockLength; index += 1) {
    for (let block = 0; block < spec.dataBlocks.length; block += 1) {
      if (index < spec.dataBlocks[block]) {
        blocks[block].push(interleavedData[offset]);
        offset += 1;
      }
    }
  }
  return blocks.flat();
}

function decodeByteModeData(codewords) {
  const bits = [];
  for (const codeword of codewords) {
    for (let bit = 7; bit >= 0; bit -= 1) {
      bits.push(((codeword >>> bit) & 1) !== 0);
    }
  }

  let offset = 0;
  const readBits = (length) => {
    let value = 0;
    for (let i = 0; i < length; i += 1) {
      value = (value << 1) | (bits[offset++] ? 1 : 0);
    }
    return value;
  };

  const mode = readBits(4);
  if (mode !== 4) {
    throw new Error(`Expected QR byte mode, got mode ${mode}.`);
  }

  const byteLength = readBits(8);
  const bytes = [];
  for (let index = 0; index < byteLength; index += 1) {
    bytes.push(readBits(8));
  }

  return {
    byteLength,
    value: new TextDecoder().decode(Uint8Array.from(bytes)),
  };
}

function verifyTooLongGuard(qrRuntime, failures) {
  const tooLong = `${CANONICAL_GUEST_ORIGIN}/q/${"x".repeat(81)}`;
  const validation = qrRuntime.validateQrValue(tooLong);
  if (validation.ok) {
    failures.push(`too-long guard: accepted ${validation.byteLength} bytes`);
  } else {
    console.log(`ok too-long guard: rejected ${validation.byteLength} bytes`);
  }
}

function makeGrid(size, value) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => value));
}

function bitsToByte(bits) {
  return bits.reduce((byte, bit) => (byte << 1) | (bit ? 1 : 0), 0);
}

function hammingDistance(left, right) {
  let diff = left ^ right;
  let distance = 0;
  while (diff) {
    distance += diff & 1;
    diff >>>= 1;
  }
  return distance;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
