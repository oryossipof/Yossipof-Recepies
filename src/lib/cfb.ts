/*
 * Compound File Binary format — the container a legacy .doc lives in.
 *
 * A .doc is not one document but a tiny filesystem: a header, a sector
 * allocation table, a directory, and a set of named streams inside it. Word's
 * text lives in a stream called "WordDocument" and the tables it needs live in
 * "0Table" or "1Table", so all this file does is find named streams and hand
 * back their bytes. Everything Word-specific lives in `doc.ts`.
 *
 * Only reading is implemented, and only what a .doc actually uses: the FAT for
 * ordinary streams, the mini FAT for small ones, and no directory tree walking
 * beyond a flat scan for the name.
 */

const SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

const END_OF_CHAIN = 0xfffffffe;
const FREE_SECTOR = 0xffffffff;

/** Directory entry types. */
const STREAM = 2;
const ROOT = 5;

type Entry = {
  name: string;
  type: number;
  start: number;
  size: number;
};

export type CompoundFile = {
  /** The bytes of a named stream, or null when there is no such stream. */
  read: (name: string) => Uint8Array | null;
};

export function isCompoundFile(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer, 0, Math.min(8, buffer.byteLength));
  return bytes.length === 8 && SIGNATURE.every((b, i) => bytes[i] === b);
}

export function openCompoundFile(buffer: ArrayBuffer): CompoundFile {
  if (!isCompoundFile(buffer)) throw new Error("הקובץ אינו מסמך Word תקין");

  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  const sectorSize = 1 << view.getUint16(0x1e, true);
  const miniSectorSize = 1 << view.getUint16(0x20, true);
  const fatSectorCount = view.getUint32(0x2c, true);
  const directoryStart = view.getUint32(0x30, true);
  const miniCutoff = view.getUint32(0x38, true);
  const miniFatStart = view.getUint32(0x3c, true);
  const difatStart = view.getUint32(0x44, true);
  const difatCount = view.getUint32(0x48, true);

  /** Sector 0 begins right after the 512-byte header. */
  const offsetOf = (sector: number) => (sector + 1) * sectorSize;

  // ---- the sector allocation table -------------------------------------

  const fatSectors: number[] = [];
  for (let i = 0; i < 109 && fatSectors.length < fatSectorCount; i++) {
    const sector = view.getUint32(0x4c + i * 4, true);
    if (sector === FREE_SECTOR) break;
    fatSectors.push(sector);
  }

  // Very large files continue the list in extra sectors of their own.
  let difat = difatStart;
  for (let n = 0; n < difatCount && difat !== END_OF_CHAIN && difat !== FREE_SECTOR; n++) {
    const base = offsetOf(difat);
    for (let i = 0; i < sectorSize / 4 - 1 && fatSectors.length < fatSectorCount; i++) {
      const sector = view.getUint32(base + i * 4, true);
      if (sector === FREE_SECTOR) break;
      fatSectors.push(sector);
    }
    difat = view.getUint32(base + sectorSize - 4, true);
  }

  const fat: number[] = [];
  for (const sector of fatSectors) {
    const base = offsetOf(sector);
    if (base + sectorSize > bytes.length) break;
    for (let i = 0; i < sectorSize / 4; i++) fat.push(view.getUint32(base + i * 4, true));
  }

  /** Follows a sector chain, guarding against a file that loops back on itself. */
  function chain(start: number, table: number[]): number[] {
    const sectors: number[] = [];
    const seen = new Set<number>();
    let sector = start;

    while (sector >= 0 && sector < table.length && !seen.has(sector)) {
      sectors.push(sector);
      seen.add(sector);
      sector = table[sector];
    }
    return sectors;
  }

  function readSectors(start: number, size: number): Uint8Array {
    const out = new Uint8Array(size);
    let at = 0;

    for (const sector of chain(start, fat)) {
      if (at >= size) break;
      const from = offsetOf(sector);
      const take = Math.min(sectorSize, size - at);
      if (from + take > bytes.length) break;
      out.set(bytes.subarray(from, from + take), at);
      at += take;
    }
    return out;
  }

  // ---- the directory ----------------------------------------------------

  const directory = readSectors(directoryStart, chain(directoryStart, fat).length * sectorSize);
  const dirView = new DataView(directory.buffer, directory.byteOffset, directory.byteLength);

  const entries: Entry[] = [];
  for (let at = 0; at + 128 <= directory.length; at += 128) {
    const type = directory[at + 0x42];
    if (type !== STREAM && type !== ROOT) continue;

    // The name is UTF-16 and its length counts the terminator.
    const nameBytes = dirView.getUint16(at + 0x40, true);
    let name = "";
    for (let i = 0; i + 1 < nameBytes - 1; i += 2) {
      name += String.fromCharCode(dirView.getUint16(at + i, true));
    }

    entries.push({
      name,
      type,
      start: dirView.getUint32(at + 0x74, true),
      size: Number(dirView.getBigUint64(at + 0x78, true)),
    });
  }

  // ---- small streams live packed inside the root's mini stream ----------

  const miniFat: number[] = [];
  for (const sector of chain(miniFatStart, fat)) {
    const base = offsetOf(sector);
    if (base + sectorSize > bytes.length) break;
    for (let i = 0; i < sectorSize / 4; i++) miniFat.push(view.getUint32(base + i * 4, true));
  }

  const root = entries.find((e) => e.type === ROOT);
  const miniStream = root ? readSectors(root.start, root.size) : new Uint8Array();

  function readMini(start: number, size: number): Uint8Array {
    const out = new Uint8Array(size);
    let at = 0;

    for (const sector of chain(start, miniFat)) {
      if (at >= size) break;
      const from = sector * miniSectorSize;
      const take = Math.min(miniSectorSize, size - at);
      if (from + take > miniStream.length) break;
      out.set(miniStream.subarray(from, from + take), at);
      at += take;
    }
    return out;
  }

  return {
    read(name) {
      const entry = entries.find((e) => e.type === STREAM && e.name === name);
      if (!entry || entry.size === 0) return null;

      return entry.size < miniCutoff
        ? readMini(entry.start, entry.size)
        : readSectors(entry.start, entry.size);
    },
  };
}
