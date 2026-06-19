import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUTS = Object.freeze([
  Object.freeze({ size: 192, path: 'public/icons/icon-192.png' }),
  Object.freeze({ size: 512, path: 'public/icons/icon-512.png' }),
]);
const SAMPLE_GRID_SIZE = 3;
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const COLORS = Object.freeze({
  background: '#FFF8F0',
  outline: '#C96A80',
  body: '#FFB6C1',
  innerEar: '#F6A1B2',
  snout: '#F28FA5',
  eye: '#33222A',
  nostril: '#5A2B38',
  highlight: '#FFD6DE',
});
const CRC_TABLE = createCrcTable();

function createCrcTable() {
  return Array.from({ length: 256 }, (_, index) => {
    let crc = index;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }

    return crc >>> 0;
  });
}

function parseColor(hexColor) {
  const match = /^#(?<red>[0-9a-f]{2})(?<green>[0-9a-f]{2})(?<blue>[0-9a-f]{2})$/iu.exec(
    hexColor,
  );

  if (match?.groups === undefined) {
    throw new TypeError(`Couleur hexadecimale invalide: ${hexColor}`);
  }

  return Object.freeze({
    r: Number.parseInt(match.groups.red, 16),
    g: Number.parseInt(match.groups.green, 16),
    b: Number.parseInt(match.groups.blue, 16),
    a: 255,
  });
}

function createImage(size, backgroundColor) {
  assertPositiveInteger(size, 'size');

  const color = parseColor(backgroundColor);
  const pixels = Buffer.alloc(size * size * 4);

  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = color.r;
    pixels[offset + 1] = color.g;
    pixels[offset + 2] = color.b;
    pixels[offset + 3] = color.a;
  }

  return { size, pixels };
}

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${name} doit etre un entier positif.`);
  }
}

function blendPixel(image, x, y, color, alphaRatio) {
  if (alphaRatio <= 0 || x < 0 || y < 0 || x >= image.size || y >= image.size) {
    return;
  }

  const offset = (y * image.size + x) * 4;
  const sourceAlpha = Math.min(1, alphaRatio) * (color.a / 255);
  const targetAlpha = image.pixels[offset + 3] / 255;
  const outAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);

  if (outAlpha <= 0) {
    image.pixels[offset] = 0;
    image.pixels[offset + 1] = 0;
    image.pixels[offset + 2] = 0;
    image.pixels[offset + 3] = 0;
    return;
  }

  image.pixels[offset] = Math.round(
    (color.r * sourceAlpha + image.pixels[offset] * targetAlpha * (1 - sourceAlpha)) /
      outAlpha,
  );
  image.pixels[offset + 1] = Math.round(
    (color.g * sourceAlpha +
      image.pixels[offset + 1] * targetAlpha * (1 - sourceAlpha)) /
      outAlpha,
  );
  image.pixels[offset + 2] = Math.round(
    (color.b * sourceAlpha +
      image.pixels[offset + 2] * targetAlpha * (1 - sourceAlpha)) /
      outAlpha,
  );
  image.pixels[offset + 3] = Math.round(outAlpha * 255);
}

function paintShape(image, bounds, colorHex, containsPoint) {
  const color = parseColor(colorHex);
  const minX = Math.max(0, Math.floor(bounds.minX));
  const maxX = Math.min(image.size - 1, Math.ceil(bounds.maxX));
  const minY = Math.max(0, Math.floor(bounds.minY));
  const maxY = Math.min(image.size - 1, Math.ceil(bounds.maxY));
  const sampleCount = SAMPLE_GRID_SIZE * SAMPLE_GRID_SIZE;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let coveredSamples = 0;

      for (let sy = 0; sy < SAMPLE_GRID_SIZE; sy += 1) {
        for (let sx = 0; sx < SAMPLE_GRID_SIZE; sx += 1) {
          const sampleX = x + (sx + 0.5) / SAMPLE_GRID_SIZE;
          const sampleY = y + (sy + 0.5) / SAMPLE_GRID_SIZE;

          if (containsPoint(sampleX, sampleY)) {
            coveredSamples += 1;
          }
        }
      }

      blendPixel(image, x, y, color, coveredSamples / sampleCount);
    }
  }
}

function paintEllipse(image, cx, cy, rx, ry, colorHex) {
  paintShape(
    image,
    {
      minX: cx - rx - 1,
      maxX: cx + rx + 1,
      minY: cy - ry - 1,
      maxY: cy + ry + 1,
    },
    colorHex,
    (x, y) => {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;

      return dx * dx + dy * dy <= 1;
    },
  );
}

function paintCircle(image, cx, cy, radius, colorHex) {
  paintEllipse(image, cx, cy, radius, radius, colorHex);
}

function paintTriangle(image, points, colorHex) {
  const [a, b, c] = points;
  const minX = Math.min(a.x, b.x, c.x) - 1;
  const maxX = Math.max(a.x, b.x, c.x) + 1;
  const minY = Math.min(a.y, b.y, c.y) - 1;
  const maxY = Math.max(a.y, b.y, c.y) + 1;
  const area = edgeFunction(a, b, c);

  if (area === 0) {
    throw new TypeError('Triangle invalide: aire nulle.');
  }

  paintShape(
    image,
    { minX, maxX, minY, maxY },
    colorHex,
    (x, y) => {
      const point = { x, y };
      const weightA = edgeFunction(b, c, point);
      const weightB = edgeFunction(c, a, point);
      const weightC = edgeFunction(a, b, point);

      return area > 0
        ? weightA >= 0 && weightB >= 0 && weightC >= 0
        : weightA <= 0 && weightB <= 0 && weightC <= 0;
    },
  );
}

function edgeFunction(a, b, c) {
  return (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);
}

function point(x, y) {
  return { x, y };
}

function scalePoint(size, x, y) {
  return point(size * x, size * y);
}

function drawPigIcon(image) {
  const size = image.size;

  paintTriangle(
    image,
    [
      scalePoint(size, 0.22, 0.2),
      scalePoint(size, 0.38, 0.1),
      scalePoint(size, 0.35, 0.38),
    ],
    COLORS.outline,
  );
  paintTriangle(
    image,
    [
      scalePoint(size, 0.25, 0.21),
      scalePoint(size, 0.36, 0.14),
      scalePoint(size, 0.34, 0.34),
    ],
    COLORS.body,
  );
  paintTriangle(
    image,
    [
      scalePoint(size, 0.3, 0.24),
      scalePoint(size, 0.35, 0.2),
      scalePoint(size, 0.34, 0.31),
    ],
    COLORS.innerEar,
  );
  paintTriangle(
    image,
    [
      scalePoint(size, 0.78, 0.2),
      scalePoint(size, 0.62, 0.1),
      scalePoint(size, 0.65, 0.38),
    ],
    COLORS.outline,
  );
  paintTriangle(
    image,
    [
      scalePoint(size, 0.75, 0.21),
      scalePoint(size, 0.64, 0.14),
      scalePoint(size, 0.66, 0.34),
    ],
    COLORS.body,
  );
  paintTriangle(
    image,
    [
      scalePoint(size, 0.7, 0.24),
      scalePoint(size, 0.65, 0.2),
      scalePoint(size, 0.66, 0.31),
    ],
    COLORS.innerEar,
  );

  paintCircle(image, size * 0.5, size * 0.52, size * 0.34, COLORS.outline);
  paintCircle(image, size * 0.5, size * 0.52, size * 0.31, COLORS.body);
  paintCircle(image, size * 0.37, size * 0.43, size * 0.04, COLORS.eye);
  paintCircle(image, size * 0.63, size * 0.43, size * 0.04, COLORS.eye);
  paintCircle(image, size * 0.385, size * 0.415, size * 0.012, COLORS.highlight);
  paintCircle(image, size * 0.615, size * 0.415, size * 0.012, COLORS.highlight);
  paintEllipse(image, size * 0.5, size * 0.59, size * 0.18, size * 0.12, COLORS.outline);
  paintEllipse(image, size * 0.5, size * 0.59, size * 0.155, size * 0.095, COLORS.snout);
  paintEllipse(image, size * 0.44, size * 0.59, size * 0.027, size * 0.04, COLORS.nostril);
  paintEllipse(image, size * 0.56, size * 0.59, size * 0.027, size * 0.04, COLORS.nostril);
}

function encodePng(image) {
  const rawScanlines = Buffer.alloc((image.size * 4 + 1) * image.size);

  for (let y = 0; y < image.size; y += 1) {
    const rowStart = y * (image.size * 4 + 1);
    const sourceStart = y * image.size * 4;

    rawScanlines[rowStart] = 0;
    image.pixels.copy(rawScanlines, rowStart + 1, sourceStart, sourceStart + image.size * 4);
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    createChunk('IHDR', createIhdr(image.size, image.size)),
    createChunk('IDAT', deflateSync(rawScanlines, { level: 9 })),
    createChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createIhdr(width, height) {
  const buffer = Buffer.alloc(13);

  buffer.writeUInt32BE(width, 0);
  buffer.writeUInt32BE(height, 4);
  buffer[8] = 8;
  buffer[9] = 6;
  buffer[10] = 0;
  buffer[11] = 0;
  buffer[12] = 0;

  return buffer;
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  const crcBuffer = Buffer.alloc(4);

  lengthBuffer.writeUInt32BE(data.length, 0);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

async function writeIcon(output) {
  const outputPath = resolve(process.cwd(), output.path);
  const image = createImage(output.size, COLORS.background);

  drawPigIcon(image);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, encodePng(image));
}

export async function generateIcons() {
  await Promise.all(OUTPUTS.map((output) => writeIcon(output)));
}

const isCliEntrypoint = process.argv[1] === fileURLToPath(import.meta.url);

if (isCliEntrypoint) {
  generateIcons().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
