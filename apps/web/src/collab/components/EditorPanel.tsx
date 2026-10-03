import * as React from 'react';
import { transformPosition, type CollabDoc } from '@re-shell/contracts';
import { Badge, Button, Input, cn } from '@re-shell/ui';
import { FileText } from 'lucide-react';

import type { SharedDocView } from '../useCollabSession';
import { Field, InlineError, Panel } from './shared';

export interface EditorPanelProps {
  docs: CollabDoc[];
  docId: string | null;
  onSelectDoc: (docId: string) => void;
  view: SharedDocView;
  /** Ended sessions are read-only. */
  readOnly: boolean;
  /** Report the caret (for the presence cursors). */
  onCaret: (docId: string, index: number) => void;
  onCreateDoc: (input: { docId: string; title: string; kind: 'notes' | 'yaml-draft' | 'text' }) => void;
  createError: string | null;
}

/** The shared notes / runbook / YAML-draft editor. Edits are merged with operational transformation. */
export function EditorPanel(props: EditorPanelProps): React.ReactElement {
  const { docs, docId, view, readOnly } = props;
  const current = docs.find((d) => d.id === docId) ?? null;
  const ref = React.useRef<HTMLTextAreaElement | null>(null);
  const [newName, setNewName] = React.useState('');

  // Apply somebody else's edit to the textarea IMMEDIATELY (not via the next React render): the next
  // keystroke is diffed against the sync object's text, so the DOM must already show the same text or that
  // keystroke would silently revert the remote edit. The caret stays anchored in the text.
  React.useEffect(() => {
    return view.doc?.on('change', (text, info) => {
      const el = ref.current;
      if (info.local || !el || el.value === text) return;
      const focused = document.activeElement === el;
      const start = transformPosition(el.selectionStart, info.op);
      const end = transformPosition(el.selectionEnd, info.op);
      el.value = text;
      if (focused) el.setSelectionRange(start, end);
    });
  }, [view.doc]);

  const reportCaret = (): void => {
    const el = ref.current;
    if (el && current) props.onCaret(current.id, el.selectionStart);
  };

  return (
    <Panel
      testId="collab-editor-panel"
      icon={<FileText className="size-3.5 text-signal" />}
      title="Shared editor"
      description="Runbook and notes everyone can edit at once. Concurrent edits are merged by the server (operational transformation)."
      actions={
        <Badge variant={view.dirty ? 'warn' : 'healthy'} data-testid="collab-editor-sync">
          {view.dirty ? 'saving...' : `synced · rev ${view.rev}`}
        </Badge>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2" role="tablist" aria-label="Documents">
        {docs.map((d) => (
          <Button
            key={d.id}
            type="button"
            role="tab"
            size="sm"
            aria-selected={d.id === docId}
            variant={d.id === docId ? 'secondary' : 'outline'}
            data-testid={`collab-doc-${d.id}`}
            onClick={() => props.onSelectDoc(d.id)}
          >
            {d.title}
            {d.kind === 'yaml-draft' ? <span className="font-mono text-[0.65rem]"> yaml</span> : null}
          </Button>
        ))}
      </div>

      {current ? (
        <>
          {current.kind === 'yaml-draft' ? (
            <p className="mb-2 text-xs text-warn" data-testid="collab-yaml-note">
              Draft only: this text is shared for review and is never written to your workspace or applied automatically.
            </p>
          ) : null}
          <textarea
            ref={ref}
            data-testid="collab-editor"
            aria-label={`Editing ${current.title}`}
            className={cn(
              'min-h-56 w-full resize-y rounded-md border border-border bg-input p-3 font-mono text-[0.8125rem] leading-[1.5]',
              'focus-visible:border-ring/60 focus-visible:outline-none focus-visible:shadow-focus-ring',
              readOnly && 'opacity-70'
            )}
            value={view.text}
            readOnly={readOnly}
            spellCheck={false}
            onChange={(e) => view.setText(e.target.value)}
            onSelect={reportCaret}
            onKeyUp={reportCaret}
            onClick={reportCaret}
          />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No document selected.</p>
      )}
      {view.notice ? (
        <p role="status" className="mt-2 text-sm text-warn" data-testid="collab-editor-notice">
          {view.notice}
        </p>
      ) : null}
      {view.error ? <InlineError message={view.error} /> : null}

      {!readOnly ? (
        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          data-testid="collab-new-doc"
          onSubmit={(event) => {
            event.preventDefault();
            const id = newName.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[.-]+|[.-]+$/g, '');
            if (!id) return;
            props.onCreateDoc({ docId: id, title: newName.trim(), kind: id.includes('yaml') ? 'yaml-draft' : 'text' });
            setNewName('');
          }}
        >
          <Field id="collab-new-doc-name" label="New document" hint='Names containing "yaml" become a workspace YAML draft.'>
            <Input
              id="collab-new-doc-name"
              data-testid="collab-new-doc-name"
              value={newName}
              placeholder="workspace-yaml"
              onChange={(e) => setNewName(e.target.value)}
            />
          </Field>
          <Button type="submit" size="sm" variant="outline" data-testid="collab-create-doc" disabled={newName.trim() === ''}>
            Add
          </Button>
        </form>
      ) : null}
      {props.createError ? <InlineError message={props.createError} /> : null}
    </Panel>
  );
}
