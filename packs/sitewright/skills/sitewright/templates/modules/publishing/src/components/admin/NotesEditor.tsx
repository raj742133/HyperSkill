'use client';

import { useEffect, useRef } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { docToText, textToDoc } from '@/lib/notes-text';

/**
 * The release-notes box on Publishing, on Tiptap: lists, undo/redo, a placeholder and a live count.
 *
 * Notes are stored and shown as plain text - the client's update card and the home page's
 * "What's new" print them as they are - so the editor reads and writes plain text: paragraphs are
 * lines, a bullet list is "• " lines, a numbered list "1. " lines. There is no bold, heading or link
 * on purpose: nothing outside this box could show them.
 */

export function NotesEditor({ value, onChange, placeholder, maxLength = 2000, disabled = false, label = 'Notes' }: {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  label?: string;
}) {
  const last = useRef(value);
  const editor = useEditor({
    // Next renders this on the server first: build the editor in the browser only.
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: false, blockquote: false, codeBlock: false, code: false, horizontalRule: false,
        bold: false, italic: false, strike: false, underline: false, link: false,
      }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      CharacterCount.configure({ limit: maxLength }),
    ],
    content: textToDoc(value),
    editorProps: { attributes: { 'aria-label': label, 'aria-multiline': 'true', role: 'textbox' } },
    onUpdate: ({ editor: e }) => {
      const text = docToText(e.getJSON());
      last.current = text;
      onChange(text);
    },
  });

  // A value changed from outside (cleared after publishing, or a different version): load it.
  useEffect(() => {
    if (editor && value !== last.current) {
      last.current = value;
      editor.commands.setContent(textToDoc(value), { emitUpdate: false });
    }
  }, [editor, value]);
  useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bullet: e?.isActive('bulletList') ?? false,
      ordered: e?.isActive('orderedList') ?? false,
      undo: e?.can().undo() ?? false,
      redo: e?.can().redo() ?? false,
      count: e?.storage.characterCount.characters() ?? value.length,
    }),
  });

  const tool = (title: string, on: boolean, enabled: boolean, run: () => void, icon: React.ReactNode) => (
    <button type="button" className={`ne-b${on ? ' on' : ''}`} title={title} aria-label={title} aria-pressed={on}
      disabled={disabled || !enabled} onMouseDown={(e) => e.preventDefault()} onClick={run}>
      <svg viewBox="0 0 20 20" aria-hidden="true">{icon}</svg>
    </button>
  );

  return (
    <div className={`notes-ed${disabled ? ' off' : ''}`}>
      <div className="ne-bar" role="toolbar" aria-label={`${label} formatting`}>
        {tool('Bullet list', !!state?.bullet, true, () => editor?.chain().focus().toggleBulletList().run(),
          <><circle cx="4" cy="5.5" r="1.3" /><circle cx="4" cy="10" r="1.3" /><circle cx="4" cy="14.5" r="1.3" /><path d="M8 5.5h9M8 10h9M8 14.5h9" /></>)}
        {tool('Numbered list', !!state?.ordered, true, () => editor?.chain().focus().toggleOrderedList().run(),
          <><path d="M3 4h1.5v4M3 8h3M3 12.5c0-1 3-1.3 3 .2 0 1-3 1.8-3 3.3h3" /><path d="M9 5.5h8M9 10h8M9 14.5h8" /></>)}
        <span className="ne-sep" />
        {tool('Undo', false, !!state?.undo, () => editor?.chain().focus().undo().run(), <path d="M7 5 3.5 8.5 7 12M4 8.5h7.5a4.5 4.5 0 0 1 0 9H9" />)}
        {tool('Redo', false, !!state?.redo, () => editor?.chain().focus().redo().run(), <path d="M13 5l3.5 3.5L13 12M16 8.5H8.5a4.5 4.5 0 0 0 0 9H11" />)}
        <span className={`ne-count${(state?.count ?? 0) > maxLength * 0.9 ? ' near' : ''}`}>{state?.count ?? 0} / {maxLength}</span>
      </div>
      <EditorContent editor={editor} className="ne-body" />
      <p className="ne-hint">Start a line with “- ” or “1. ” for a list. Shown as plain text in the app and on the home page.</p>
    </div>
  );
}
