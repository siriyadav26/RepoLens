// ================================================================
// Text Chunking for RAG
// ================================================================

/**
 * Split text into overlapping chunks.
 * Each chunk is at most `chunkSize` characters.
 * Adjacent chunks share `overlap` characters.
 */
export function chunkText(
  text: string,
  chunkSize = 800,
  overlap = 100
): string[] {
  if (!text || text.trim().length === 0) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    // Try to break at a whitespace boundary (look back up to 50 chars)
    if (end < text.length) {
      let breakPoint = -1;
      for (let j = end; j >= Math.max(start, end - 50); j--) {
        if (/\s/.test(text[j])) {
          breakPoint = j;
          break;
        }
      }
      if (breakPoint !== -1) end = breakPoint;
    } else {
      end = text.length;
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) chunks.push(chunk);

    // Move forward by (chunkSize - overlap), but never less than 1
    const stride = Math.max(1, chunkSize - overlap);
    start += stride;
  }

  return chunks;
}
