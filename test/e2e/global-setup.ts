// Propagate before workers spawn: failed editor snapshots contain pairing keys.
export default function setup() {
  process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1'
}
