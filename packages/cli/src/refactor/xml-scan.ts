// Tiny XML element scanner (offset-preserving) for pom/csproj edits. It is not
// a general XML parser: it only needs element paths and the text range of
// leaf elements so values can be spliced without reformatting the document.

export interface XmlLeaf {
  /** Element path from the root, e.g. ['project', 'dependencies', 'dependency', 'artifactId']. */
  path: string[];
  value: string;
  /** Offset range of the value text (between the open and close tags). */
  start: number;
  end: number;
}

/** Replace comments/CDATA with spaces so offsets stay valid while scanning. */
function mask(xml: string): string {
  return xml
    .replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '))
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, m => m.replace(/[^\n]/g, ' '));
}

/** All leaf elements (elements whose content has no child elements). */
export function scanLeaves(xml: string): XmlLeaf[] {
  const masked = mask(xml);
  const leaves: XmlLeaf[] = [];
  const stack: Array<{ tag: string; contentStart: number; hasChild: boolean }> = [];
  const re = /<(\/?)([A-Za-z_][\w.:-]*)(?:\s[^<>]*?)?(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked)) !== null) {
    const closing = m[1] === '/';
    const tag = m[2];
    const selfClose = m[3] === '/';
    if (!closing) {
      if (stack.length > 0) stack[stack.length - 1].hasChild = true;
      if (selfClose) continue;
      stack.push({ tag, contentStart: m.index + m[0].length, hasChild: false });
    } else {
      const top = stack.pop();
      if (!top) continue;
      if (!top.hasChild) {
        const path = [...stack.map(s => s.tag), top.tag];
        leaves.push({ path, value: xml.slice(top.contentStart, m.index).trim(), start: top.contentStart, end: m.index });
      }
    }
  }
  return leaves;
}

/** Splice replacements (by offset, applied from the end) into text. */
export function spliceText(text: string, edits: Array<{ start: number; end: number; text: string }>): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let out = text;
  for (const e of sorted) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

/** Trim-aware replacement range: replaces only the trimmed value inside [start,end). */
export function valueRange(xml: string, leaf: XmlLeaf): { start: number; end: number } {
  const raw = xml.slice(leaf.start, leaf.end);
  const lead = raw.length - raw.trimStart().length;
  return { start: leaf.start + lead, end: leaf.start + lead + leaf.value.length };
}
