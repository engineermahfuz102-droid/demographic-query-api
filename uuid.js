/**
 * UUID v7 generator
 * UUID v7 is time-ordered: first 48 bits = Unix ms timestamp
 */
function generateUUIDv7() {
  const now = Date.now();

  // 48-bit timestamp (ms)
  const timeHigh = Math.floor(now / 0x100000000);
  const timeLow = now >>> 0;

  // 12-bit sequence (random)
  const seq = Math.floor(Math.random() * 0x1000);

  // 62-bit random node
  const randA = Math.floor(Math.random() * 0x10000);
  const randB = Math.floor(Math.random() * 0x100000000);

  const p1 = timeHigh.toString(16).padStart(8, '0');
  const p2 = timeLow.toString(16).padStart(8, '0');

  // version 7: 0111 => 7
  const ver = (0x7000 | seq).toString(16).padStart(4, '0');

  // variant: 10xx => 8-b
  const varSeq = (0x8000 | (randA & 0x3fff)).toString(16).padStart(4, '0');

  const node = randB.toString(16).padStart(8, '0');
  const nodeExtra = Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');

  // Format: xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx
  return `${p1.slice(0, 8)}-${p2.slice(0, 4)}-${ver}-${varSeq}-${node}${nodeExtra}`;
}

module.exports = { generateUUIDv7 };
