import { useMemo } from "preact/hooks";
import {
  DEFAULT_QR_ACCENT_COLOR,
  DEFAULT_QR_BACKGROUND_COLOR,
  DEFAULT_QR_CORNER_STYLE,
  DEFAULT_QR_DOT_STYLE,
  DEFAULT_QR_FOREGROUND_COLOR,
  DEFAULT_QR_LOGO_SIZE,
  clamp,
  safeColor,
  slugify,
} from "../shared/domain";
import type { QrCode, QrCornerStyle, QrDotStyle } from "../shared/domain";

type QrPattern = {
  modules: boolean[][];
  size: number;
};

type QrVersionSpec = {
  version: number;
  dataCodewords: number;
  errorCodewords: number;
  ecCodewordsPerBlock: number;
  dataBlocks: number[];
};

export type QrVisualOptions = {
  foregroundColor: string;
  backgroundColor: string;
  accentColor: string;
  dotStyle: QrDotStyle;
  cornerStyle: QrCornerStyle;
  logoImageUrl: string;
  logoSize: string;
};

const QR_SPECS: QrVersionSpec[] = [
  { version: 1, dataCodewords: 16, errorCodewords: 10, ecCodewordsPerBlock: 10, dataBlocks: [16] },
  { version: 2, dataCodewords: 28, errorCodewords: 16, ecCodewordsPerBlock: 16, dataBlocks: [28] },
  { version: 3, dataCodewords: 44, errorCodewords: 26, ecCodewordsPerBlock: 26, dataBlocks: [44] },
  { version: 4, dataCodewords: 64, errorCodewords: 36, ecCodewordsPerBlock: 18, dataBlocks: [32, 32] },
  { version: 5, dataCodewords: 86, errorCodewords: 48, ecCodewordsPerBlock: 24, dataBlocks: [43, 43] },
];

const ALIGNMENT_POSITIONS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
};

const FORMAT_DIVISOR = 0x537;
const FORMAT_MASK = 0x5412;
const EC_LEVEL_M = 0;
const QUIET_ZONE = 4;
const FINDER_SIZE = 7;
const FINDER_ZONE_SIZE = 9;
const DEFAULT_OPTIONS: QrVisualOptions = {
  foregroundColor: DEFAULT_QR_FOREGROUND_COLOR,
  backgroundColor: DEFAULT_QR_BACKGROUND_COLOR,
  accentColor: DEFAULT_QR_ACCENT_COLOR,
  dotStyle: DEFAULT_QR_DOT_STYLE,
  cornerStyle: DEFAULT_QR_CORNER_STYLE,
  logoImageUrl: "",
  logoSize: DEFAULT_QR_LOGO_SIZE,
};

export function QrArtwork({ options, value }: { options?: Partial<QrVisualOptions>; value: string }) {
  const result = useMemo(() => {
    try {
      return { ok: true as const, svg: createQrSvg(value, options), message: "" };
    } catch (caught) {
      return {
        ok: false as const,
        svg: "",
        message: caught instanceof Error ? caught.message : "QR code could not be generated.",
      };
    }
  }, [options, value]);

  if (!result.ok) {
    return (
      <div className="grid aspect-square w-full place-items-center rounded-md border border-dashed bg-neutral-50 p-4 text-center">
        <div>
          <p className="text-sm font-medium">QR unavailable</p>
          <p className="mt-1 text-xs leading-5 text-neutral-600">{result.message}</p>
        </div>
      </div>
    );
  }

  return <div className="aspect-square w-full" dangerouslySetInnerHTML={{ __html: result.svg }} />;
}

export function downloadQrSvg(name: string, value: string, options?: Partial<QrVisualOptions>): { ok: boolean; message: string } {
  let url = "";
  try {
    const svg = createQrSvg(value, options);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slugify(name, "qr-code")}.svg`;
    anchor.click();
    return { ok: true, message: "" };
  } catch (caught) {
    return {
      ok: false,
      message: caught instanceof Error ? caught.message : "QR download failed.",
    };
  } finally {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
}

export function validateQrValue(value: string): { ok: boolean; byteLength: number; message: string } {
  const byteLength = utf8Bytes(value).length;
  try {
    chooseVersion(byteLength);
    return { ok: true, byteLength, message: "QR value fits the branded medium-error-correction generator." };
  } catch (caught) {
    return {
      ok: false,
      byteLength,
      message: caught instanceof Error ? caught.message : "QR value is too long.",
    };
  }
}

export function qrOptionsFromCode(qrCode: QrCode): QrVisualOptions {
  return normalizeVisualOptions(qrCode);
}

export function createQrSvg(value: string, options?: Partial<QrVisualOptions>): string {
  const visual = normalizeVisualOptions(options);
  const qr = createQrPattern(value);
  const viewBoxSize = qr.size + QUIET_ZONE * 2;
  const logo = createLogoLayout(qr.size, visual);
  const modules: string[] = [];
  for (let y = 0; y < qr.size; y += 1) {
    for (let x = 0; x < qr.size; x += 1) {
      if (qr.modules[y][x] && !isFinderZone(qr.size, x, y) && !isInLogoClearance(logo, x, y)) {
        modules.push(drawDataModule(x + QUIET_ZONE, y + QUIET_ZONE, visual.dotStyle));
      }
    }
  }

  const eyes = [
    drawFinderEye(QUIET_ZONE, QUIET_ZONE, visual),
    drawFinderEye(QUIET_ZONE + qr.size - FINDER_SIZE, QUIET_ZONE, visual),
    drawFinderEye(QUIET_ZONE, QUIET_ZONE + qr.size - FINDER_SIZE, visual),
  ].join("");
  const logoSvg = logo ? drawLogo(logo, visual) : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="QR code" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}"><rect width="${viewBoxSize}" height="${viewBoxSize}" rx="2" fill="${visual.backgroundColor}"/><g fill="${visual.foregroundColor}">${modules.join("")}</g>${eyes}${logoSvg}</svg>`;
}

function normalizeVisualOptions(options?: Partial<QrVisualOptions>): QrVisualOptions {
  const logoSize = numericLogoSize(options?.logoSize);
  return {
    foregroundColor: safeColor(String(options?.foregroundColor ?? "")) || DEFAULT_OPTIONS.foregroundColor,
    backgroundColor: safeColor(String(options?.backgroundColor ?? "")) || DEFAULT_OPTIONS.backgroundColor,
    accentColor: safeColor(String(options?.accentColor ?? "")) || DEFAULT_OPTIONS.accentColor,
    dotStyle: normalizeDotStyle(String(options?.dotStyle ?? "")),
    cornerStyle: normalizeCornerStyle(String(options?.cornerStyle ?? "")),
    logoImageUrl: safeLogoHref(String(options?.logoImageUrl ?? "")),
    logoSize: String(logoSize),
  };
}

function normalizeDotStyle(value: string): QrDotStyle {
  return value === "dots" || value === "classy" || value === "square" ? value : DEFAULT_OPTIONS.dotStyle;
}

function normalizeCornerStyle(value: string): QrCornerStyle {
  return value === "rounded" || value === "square" ? value : DEFAULT_OPTIONS.cornerStyle;
}

function safeLogoHref(value: string): string {
  const trimmed = value.trim();
  return /^https?:\/\/[^\s"'<>]+$/i.test(trimmed) ? trimmed : "";
}

function numericLogoSize(value: unknown): number {
  const parsed = Number(value ?? DEFAULT_OPTIONS.logoSize);
  return Number.isFinite(parsed) ? clamp(Math.round(parsed), 0, 28) : Number(DEFAULT_OPTIONS.logoSize);
}

type LogoLayout = {
  clearEnd: number;
  clearStart: number;
  imageSize: number;
  imageX: number;
  imageY: number;
  plateRadius: number;
  plateSize: number;
  plateX: number;
  plateY: number;
};

function createLogoLayout(qrSize: number, visual: QrVisualOptions): LogoLayout | null {
  const logoSize = numericLogoSize(visual.logoSize);
  if (!visual.logoImageUrl || logoSize <= 0) {
    return null;
  }

  const imageSize = Math.max(4, Math.round((qrSize * logoSize) / 100));
  const plateSize = imageSize + 2;
  const plateX = QUIET_ZONE + (qrSize - plateSize) / 2;
  const plateY = plateX;
  const imageX = QUIET_ZONE + (qrSize - imageSize) / 2;
  const imageY = imageX;
  const clearStart = Math.floor((qrSize - plateSize) / 2);
  const clearEnd = Math.ceil((qrSize + plateSize) / 2);

  return {
    clearEnd,
    clearStart,
    imageSize,
    imageX,
    imageY,
    plateRadius: Math.max(1.2, plateSize * 0.22),
    plateSize,
    plateX,
    plateY,
  };
}

function isInLogoClearance(logo: LogoLayout | null, x: number, y: number): boolean {
  return Boolean(logo && x >= logo.clearStart && x < logo.clearEnd && y >= logo.clearStart && y < logo.clearEnd);
}

function isFinderZone(size: number, x: number, y: number): boolean {
  const inTop = y < FINDER_ZONE_SIZE;
  const inLeft = x < FINDER_ZONE_SIZE;
  const inRight = x >= size - FINDER_ZONE_SIZE;
  const inBottom = y >= size - FINDER_ZONE_SIZE;
  return (inTop && inLeft) || (inTop && inRight) || (inBottom && inLeft);
}

function drawDataModule(x: number, y: number, style: QrDotStyle): string {
  if (style === "square") {
    return `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  }
  if (style === "dots") {
    return `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.42"/>`;
  }
  if (style === "classy") {
    return `<rect x="${x + 0.08}" y="${y + 0.08}" width="0.84" height="0.84" rx="0.32"/>`;
  }
  return `<rect x="${x + 0.06}" y="${y + 0.06}" width="0.88" height="0.88" rx="0.18"/>`;
}

function drawFinderEye(x: number, y: number, visual: QrVisualOptions): string {
  const outerRadius = visual.cornerStyle === "square" ? 0 : visual.cornerStyle === "rounded" ? 0.9 : 1.7;
  const innerRadius = visual.cornerStyle === "square" ? 0 : visual.cornerStyle === "rounded" ? 0.55 : 1.2;
  const coreRadius = visual.cornerStyle === "square" ? 0 : 0.65;

  return [
    `<rect x="${x}" y="${y}" width="7" height="7" rx="${outerRadius}" fill="${visual.foregroundColor}"/>`,
    `<rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx="${innerRadius}" fill="${visual.backgroundColor}"/>`,
    `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="${coreRadius}" fill="${visual.accentColor}"/>`,
  ].join("");
}

function drawLogo(logo: LogoLayout, visual: QrVisualOptions): string {
  const href = escapeAttribute(visual.logoImageUrl);
  return [
    `<rect x="${logo.plateX}" y="${logo.plateY}" width="${logo.plateSize}" height="${logo.plateSize}" rx="${logo.plateRadius}" fill="${visual.backgroundColor}" stroke="${visual.foregroundColor}" stroke-width="0.22"/>`,
    `<image href="${href}" x="${logo.imageX}" y="${logo.imageY}" width="${logo.imageSize}" height="${logo.imageSize}" preserveAspectRatio="xMidYMid meet"/>`,
  ].join("");
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function createQrPattern(value: string): QrPattern {
  const bytes = utf8Bytes(value);
  const spec = chooseVersion(bytes.length);
  const size = spec.version * 4 + 17;
  const modules = makeGrid<boolean>(size, false);
  const isFunction = makeGrid<boolean>(size, false);

  drawFunctionPatterns(modules, isFunction, spec.version);
  drawCodewords(modules, isFunction, createFinalCodewords(bytes, spec));

  let bestMask = 0;
  let bestPenalty = Infinity;
  let bestModules = modules;
  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = cloneGrid(modules);
    applyMask(candidate, isFunction, mask);
    drawFormatBits(candidate, isFunction, mask);
    const penalty = calculatePenalty(candidate);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = mask;
      bestModules = candidate;
    }
  }

  drawFormatBits(bestModules, isFunction, bestMask);
  return { modules: bestModules, size };
}

function chooseVersion(byteLength: number): QrVersionSpec {
  const requiredBits = 4 + 8 + byteLength * 8;
  const spec = QR_SPECS.find((candidate) => candidate.dataCodewords * 8 >= requiredBits);
  if (!spec) {
    throw new Error("QR value is too long. Keep printed QR links under 84 bytes.");
  }
  return spec;
}

function createFinalCodewords(bytes: number[], spec: QrVersionSpec): number[] {
  const dataCodewords = createDataCodewords(bytes, spec.dataCodewords);
  const dataBlocks = splitDataBlocks(dataCodewords, spec.dataBlocks);
  const errorBlocks = dataBlocks.map((block) => reedSolomonRemainder(block, spec.ecCodewordsPerBlock));
  const codewords: number[] = [];
  const maxDataBlockLength = Math.max(...dataBlocks.map((block) => block.length));

  for (let index = 0; index < maxDataBlockLength; index += 1) {
    for (const block of dataBlocks) {
      if (index < block.length) {
        codewords.push(block[index]);
      }
    }
  }

  for (let index = 0; index < spec.ecCodewordsPerBlock; index += 1) {
    for (const block of errorBlocks) {
      codewords.push(block[index]);
    }
  }

  if (codewords.length !== spec.dataCodewords + spec.errorCodewords) {
    throw new Error("QR codeword generation failed.");
  }
  return codewords;
}

function createDataCodewords(bytes: number[], dataCodewordCapacity: number): number[] {
  const bits: number[] = [];
  appendBits(bits, 0x4, 4);
  appendBits(bits, bytes.length, 8);
  for (const byte of bytes) {
    appendBits(bits, byte, 8);
  }

  const capacityBits = dataCodewordCapacity * 8;
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8) {
    bits.push(0);
  }

  const codewords: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    codewords.push(bitsToByte(bits.slice(index, index + 8)));
  }

  for (let pad = 0xec; codewords.length < dataCodewordCapacity; pad ^= 0xfd) {
    codewords.push(pad);
  }
  return codewords;
}

function splitDataBlocks(dataCodewords: number[], blockSizes: number[]): number[][] {
  const blocks: number[][] = [];
  let offset = 0;
  for (const size of blockSizes) {
    blocks.push(dataCodewords.slice(offset, offset + size));
    offset += size;
  }
  if (offset !== dataCodewords.length) {
    throw new Error("QR data block split failed.");
  }
  return blocks;
}

function drawFunctionPatterns(modules: boolean[][], isFunction: boolean[][], version: number) {
  const size = modules.length;
  drawFinderPattern(modules, isFunction, 3, 3);
  drawFinderPattern(modules, isFunction, size - 4, 3);
  drawFinderPattern(modules, isFunction, 3, size - 4);

  for (let i = 0; i < size; i += 1) {
    if (!isFunction[i][6]) {
      setFunctionModule(modules, isFunction, 6, i, i % 2 === 0);
    }
    if (!isFunction[6][i]) {
      setFunctionModule(modules, isFunction, i, 6, i % 2 === 0);
    }
  }

  for (const x of ALIGNMENT_POSITIONS[version]) {
    for (const y of ALIGNMENT_POSITIONS[version]) {
      const overlapsFinder = (x === 6 && y === 6) || (x === 6 && y === size - 7) || (x === size - 7 && y === 6);
      if (!overlapsFinder) {
        drawAlignmentPattern(modules, isFunction, x, y);
      }
    }
  }

  setFunctionModule(modules, isFunction, 8, size - 8, true);
  drawFormatBits(modules, isFunction, 0);
}

function drawFinderPattern(modules: boolean[][], isFunction: boolean[][], centerX: number, centerY: number) {
  const size = modules.length;
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      const x = centerX + dx;
      const y = centerY + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setFunctionModule(modules, isFunction, x, y, distance !== 2 && distance !== 4);
    }
  }
}

function drawAlignmentPattern(modules: boolean[][], isFunction: boolean[][], centerX: number, centerY: number) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setFunctionModule(modules, isFunction, centerX + dx, centerY + dy, distance !== 1);
    }
  }
}

function drawFormatBits(modules: boolean[][], isFunction: boolean[][], mask: number) {
  const size = modules.length;
  const bits = calculateFormatBits(mask);
  for (let i = 0; i <= 5; i += 1) {
    setFunctionModule(modules, isFunction, 8, i, bitAt(bits, i));
  }
  setFunctionModule(modules, isFunction, 8, 7, bitAt(bits, 6));
  setFunctionModule(modules, isFunction, 8, 8, bitAt(bits, 7));
  setFunctionModule(modules, isFunction, 7, 8, bitAt(bits, 8));
  for (let i = 9; i < 15; i += 1) {
    setFunctionModule(modules, isFunction, 14 - i, 8, bitAt(bits, i));
  }
  for (let i = 0; i < 8; i += 1) {
    setFunctionModule(modules, isFunction, size - 1 - i, 8, bitAt(bits, i));
  }
  for (let i = 8; i < 15; i += 1) {
    setFunctionModule(modules, isFunction, 8, size - 15 + i, bitAt(bits, i));
  }
  setFunctionModule(modules, isFunction, 8, size - 8, true);
}

function calculateFormatBits(mask: number): number {
  const data = (EC_LEVEL_M << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i -= 1) {
    if (((rem >>> i) & 1) !== 0) {
      rem ^= FORMAT_DIVISOR << (i - 10);
    }
  }
  return ((data << 10) | rem) ^ FORMAT_MASK;
}

function drawCodewords(modules: boolean[][], isFunction: boolean[][], codewords: number[]) {
  const size = modules.length;
  const bits: boolean[] = [];
  for (const codeword of codewords) {
    for (let bit = 7; bit >= 0; bit -= 1) {
      bits.push(((codeword >>> bit) & 1) !== 0);
    }
  }

  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical += 1) {
      const y = upward ? size - 1 - vertical : vertical;
      for (let column = 0; column < 2; column += 1) {
        const x = right - column;
        if (!isFunction[y][x]) {
          modules[y][x] = bitIndex < bits.length ? bits[bitIndex] : false;
          bitIndex += 1;
        }
      }
    }
    upward = !upward;
  }
}

function applyMask(modules: boolean[][], isFunction: boolean[][], mask: number) {
  const size = modules.length;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!isFunction[y][x] && shouldMask(mask, x, y)) {
        modules[y][x] = !modules[y][x];
      }
    }
  }
}

function shouldMask(mask: number, x: number, y: number): boolean {
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

function calculatePenalty(modules: boolean[][]): number {
  const size = modules.length;
  let penalty = 0;

  for (let y = 0; y < size; y += 1) {
    penalty += adjacentPenalty(modules[y]);
  }
  for (let x = 0; x < size; x += 1) {
    const column: boolean[] = [];
    for (let y = 0; y < size; y += 1) {
      column.push(modules[y][x]);
    }
    penalty += adjacentPenalty(column);
  }

  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const color = modules[y][x];
      if (modules[y][x + 1] === color && modules[y + 1][x] === color && modules[y + 1][x + 1] === color) {
        penalty += 3;
      }
    }
  }

  const finderRun = [true, false, true, true, true, false, true];
  for (let y = 0; y < size; y += 1) {
    penalty += finderPenalty(modules[y], finderRun);
  }
  for (let x = 0; x < size; x += 1) {
    const column: boolean[] = [];
    for (let y = 0; y < size; y += 1) {
      column.push(modules[y][x]);
    }
    penalty += finderPenalty(column, finderRun);
  }

  let dark = 0;
  for (const row of modules) {
    for (const module of row) {
      if (module) dark += 1;
    }
  }
  penalty += Math.floor(Math.abs((dark * 20) / (size * size) - 10)) * 10;
  return penalty;
}

function adjacentPenalty(line: boolean[]): number {
  let penalty = 0;
  let runColor = line[0];
  let runLength = 1;
  for (let index = 1; index < line.length; index += 1) {
    if (line[index] === runColor) {
      runLength += 1;
      if (runLength === 5) penalty += 3;
      if (runLength > 5) penalty += 1;
    } else {
      runColor = line[index];
      runLength = 1;
    }
  }
  return penalty;
}

function finderPenalty(line: boolean[], pattern: boolean[]): number {
  let penalty = 0;
  for (let index = 0; index <= line.length - 7; index += 1) {
    if (!pattern.every((color, offset) => line[index + offset] === color)) continue;
    const leftLight = index >= 4 && line.slice(index - 4, index).every((color) => !color);
    const rightLight = index + 11 <= line.length && line.slice(index + 7, index + 11).every((color) => !color);
    if (leftLight || rightLight) {
      penalty += 40;
    }
  }
  return penalty;
}

function reedSolomonRemainder(data: number[], degree: number): number[] {
  const divisor = reedSolomonDivisor(degree);
  const result = new Array<number>(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift()!;
    result.push(0);
    for (let index = 0; index < degree; index += 1) {
      result[index] ^= gfMultiply(divisor[index], factor);
    }
  }
  return result;
}

function reedSolomonDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) {
        result[j] ^= result[j + 1];
      }
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function utf8Bytes(value: string): number[] {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    let code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        index += 1;
      }
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >>> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >>> 12), 0x80 | ((code >>> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xf0 | (code >>> 18), 0x80 | ((code >>> 12) & 0x3f), 0x80 | ((code >>> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return bytes;
}

function appendBits(bits: number[], value: number, length: number) {
  for (let bit = length - 1; bit >= 0; bit -= 1) {
    bits.push((value >>> bit) & 1);
  }
}

function bitsToByte(bits: number[]): number {
  return bits.reduce((byte, bit) => (byte << 1) | bit, 0);
}

function bitAt(value: number, index: number): boolean {
  return ((value >>> index) & 1) !== 0;
}

function setFunctionModule(modules: boolean[][], isFunction: boolean[][], x: number, y: number, value: boolean) {
  modules[y][x] = value;
  isFunction[y][x] = true;
}

function makeGrid<T>(size: number, value: T): T[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => value));
}

function cloneGrid<T>(grid: T[][]): T[][] {
  return grid.map((row) => [...row]);
}
