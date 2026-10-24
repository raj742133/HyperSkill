/**
 * Release notes are plain text everywhere they are shown (the app's App update card, the home
 * page), so the Publishing editor (components/admin/NotesEditor.tsx) converts between that text
 * and its document: lines are paragraphs, "• " / "- " lines a bullet list, "1. " lines a
 * numbered list. Pure, so it is tested (tests/notes-text.test.ts).
 */

/** The shape of a Tiptap/ProseMirror JSON document, as much of it as this needs. */
export interface JSONContent {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JSONContent[];
  text?: string;
}

const BULLET = /^[•\-*]\s+/;
const NUMBER = /^(\d+)[.)]\s+/;

function para(text: string): JSONContent {
  return text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' };
}

/** Plain text -> editor document. */
export function textToDoc(text: string): JSONContent {
  const content: JSONContent[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (BULLET.test(line) || NUMBER.test(line)) {
      const ordered = NUMBER.test(line);
      const re = ordered ? NUMBER : BULLET;
      const items: JSONContent[] = [];
      const start = ordered ? Number(NUMBER.exec(line)![1]) : 1;
      while (i < lines.length && re.test(lines[i])) {
        items.push({ type: 'listItem', content: [para(lines[i].replace(re, ''))] });
        i++;
      }
      content.push(ordered ? { type: 'orderedList', attrs: { start }, content: items } : { type: 'bulletList', content: items });
    } else {
      content.push(para(line));
      i++;
    }
  }
  return { type: 'doc', content: content.length ? content : [para('')] };
}

function inline(node: JSONContent | undefined): string {
  return (node?.content ?? []).map((c) => (c.type === 'hardBreak' ? '\n' : c.text ?? inline(c))).join('');
}

/** Editor document -> plain text. */
export function docToText(doc: JSONContent): string {
  const out: string[] = [];
  for (const block of doc.content ?? []) {
    if (block.type === 'bulletList' || block.type === 'orderedList') {
      let n = Number(block.attrs?.start ?? 1);
      for (const item of block.content ?? []) {
        const text = (item.content ?? []).map(inline).join(' ').trim();
        out.push(block.type === 'bulletList' ? `• ${text}` : `${n++}. ${text}`);
      }
    } else {
      out.push(inline(block));
    }
  }
  return out.join('\n').replace(/\s+$/, '');
}

