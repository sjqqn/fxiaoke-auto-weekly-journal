/**
 * 捕获进程内写入 stdout / stderr 的内容（含 console.log / warn / error）
 * 用于任务结束后将完整终端输出同步到飞书。
 */

let installed = false;
/** @type {string[]} */
const chunks = [];

/** @type {typeof process.stdout.write} */
let origStdoutWrite;
/** @type {typeof process.stderr.write} */
let origStderrWrite;

export function installLogCapture() {
  if (installed) return;
  installed = true;

  origStdoutWrite = process.stdout.write.bind(process.stdout);
  origStderrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = wrapWrite(origStdoutWrite, chunks);
  process.stderr.write = wrapWrite(origStderrWrite, chunks);
}

/**
 * @param {typeof process.stdout.write} orig
 * @param {string[]} buf
 */
function wrapWrite(orig, buf) {
  return function writeWrap(chunk, encoding, cb) {
    try {
      captureChunk(buf, chunk, encoding);
    } catch {
      /* ignore */
    }
    return orig(chunk, encoding, cb);
  };
}

/**
 * @param {string[]} buf
 * @param {string | Uint8Array | Buffer} chunk
 * @param {BufferEncoding | ((err?: Error) => void) | undefined} encoding
 */
function captureChunk(buf, chunk, encoding) {
  if (chunk == null) return;
  if (typeof chunk === 'function') return;

  if (typeof encoding === 'function') {
    encoding = undefined;
  }

  if (Buffer.isBuffer(chunk)) {
    buf.push(chunk.toString(typeof encoding === 'string' ? encoding : 'utf8'));
    return;
  }
  if (chunk instanceof Uint8Array) {
    buf.push(Buffer.from(chunk).toString('utf8'));
    return;
  }
  buf.push(String(chunk));
}

/** @returns {string} */
export function getCapturedLog() {
  return chunks.join('');
}
