import rtfParser from 'rtf-parser';

/**
 * Safely extracts raw text from an RTF string.
 * @param rawRtf The raw RTF formatted string
 * @returns Promise resolving to extracted raw text string
 */
export function safeExtractRtfText(rawRtf: string): Promise<string> {
  return new Promise((resolve, reject) => {
    rtfParser.string(rawRtf, (err: Error, doc: any) => {
      if (err) return reject(err);
      
      function extractText(node: any): string {
        if (!node) return '';
        if (node.value !== undefined) return node.value;
        if (Array.isArray(node.content)) {
          return node.content.map(extractText).join('');
        }
        return '';
      }
      
      if (!doc || !doc.content || !Array.isArray(doc.content)) {
          return resolve('');
      }

      const lines = doc.content.map((p: any) => extractText(p));
      resolve(lines.join('\n'));
    });
  });
}
