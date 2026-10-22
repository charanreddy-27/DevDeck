'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import FileTree from './FileTree';
import DiffView from './DiffView';
import { diffLines } from '@/lib/diff';
import ErrorBanner from './ErrorBanner';
import EmptyState from './EmptyState';
import { Line } from './Skeletons';
import { useToast } from './ToastProvider';
import { fetchJson } from '@/lib/client';
import { cx, formatBytes, shortSha } from '@/lib/format';

export default function CodeTab({ repo, onCommitted }) {
  const toast = useToast();

  const [tree, setTree] = useState(null);
  const [treeError, setTreeError] = useState(null);

  const [file, setFile] = useState(null); // { path, sha, content, binary, size, url }
  const [fileError, setFileError] = useState(null);
  const [fileLoading, setFileLoading] = useState(false);

  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  // Show the diff instead of the editor: what the commit will change, before it deploys.
  const [reviewing, setReviewing] = useState(false);

  const editorRef = useRef(null);
  const gutterRef = useRef(null);

  const dirty = Boolean(file) && !file.binary && draft !== file.content;

  // +/− counts for the commit bar. Deferred so a burst of typing in a large
  // file never waits on the diff; the counts catch up a frame later.
  const deferredDraft = useDeferredValue(draft);
  const changeCount = useMemo(() => {
    if (!file || file.binary || deferredDraft === file.content) return null;
    const { added, removed } = diffLines(file.content, deferredDraft);
    return { added, removed };
  }, [file, deferredDraft]);

  // Read through a ref inside openFile so its identity stays stable across
  // keystrokes — otherwise the memoized file tree would re-render constantly.
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const loadTree = useCallback(
    () =>
      fetchJson(`/api/github/tree?owner=${encodeURIComponent(repo.owner)}&repo=${encodeURIComponent(repo.name)}`).then(
        (data) => {
          setTree(data);
          setTreeError(null);
        },
        (err) => setTreeError(err),
      ),
    [repo.owner, repo.name],
  );

  function retryTree() {
    setTreeError(null);
    loadTree();
  }

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const branch = tree?.branch || repo.branch || '';

  const openFile = useCallback(
    async (entry) => {
      if (dirtyRef.current && !window.confirm('Discard your unsaved changes to this file?')) return;

      setFileLoading(true);
      setFileError(null);
      setFile(null);
      try {
        const params = new URLSearchParams({
          owner: repo.owner,
          repo: repo.name,
          path: entry.path,
          ref: branch,
        });
        const data = await fetchJson(`/api/github/file?${params.toString()}`);
        setFile(data);
        setDraft(data.content || '');
        setMessage('');
        setReviewing(false);
      } catch (err) {
        setFileError(err);
      } finally {
        setFileLoading(false);
      }
    },
    [repo.owner, repo.name, branch],
  );

  // Opening a new file resets the textarea to the top, so the gutter offset
  // has to be reset with it or the two drift apart.
  useEffect(() => {
    if (gutterRef.current) gutterRef.current.style.transform = 'translateY(0)';
    if (editorRef.current) editorRef.current.scrollTop = 0;
  }, [file?.path]);

  async function commit() {
    if (!file || !dirty) return;
    setCommitting(true);
    try {
      const result = await fetchJson('/api/github/file', {
        method: 'PUT',
        body: JSON.stringify({
          owner: repo.owner,
          repo: repo.name,
          path: file.path,
          branch: tree?.branch || repo.branch,
          message: message.trim() || `Update ${file.path}`,
          content: draft,
          sha: file.sha,
        }),
      });

      // Adopt the new blob sha so a second edit commits cleanly.
      setFile((current) => (current ? { ...current, content: draft, sha: result.file?.sha || current.sha } : current));
      setMessage('');
      setReviewing(false);
      toast.success('Committed — Vercel is deploying.', { title: 'Pushed to GitHub' });
      onCommitted?.();
    } catch (err) {
      toast.error(err.hint ? `${err.message} ${err.hint}` : err.message);
    } finally {
      setCommitting(false);
    }
  }

  // Tab inserts two spaces instead of leaving the textarea.
  function onEditorKeyDown(event) {
    if (event.key === 'Tab') {
      event.preventDefault();
      const el = event.target;
      const { selectionStart, selectionEnd, value } = el;
      const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
      setDraft(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = selectionStart + 2;
      });
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (dirty && !committing) commit();
    }
  }

  const lineCount = useMemo(() => draft.split('\n').length, [draft]);

  function syncGutter(event) {
    if (gutterRef.current) gutterRef.current.style.transform = `translateY(-${event.target.scrollTop}px)`;
  }

  if (treeError) {
    return <ErrorBanner error={treeError} onRetry={retryTree} />;
  }

  if (!tree) {
    return (
      <div className="panel">
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 8 }, (_, index) => (
            <Line key={index} width={`${70 - index * 6}%`} height={12} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {tree.truncated ? (
        <div className="banner banner-warn">
          <div>
            <div className="banner-title">Large repository</div>
            <div className="banner-hint">
              GitHub truncated the file listing, so some files are not shown. Everything listed is still editable.
            </div>
          </div>
        </div>
      ) : null}

      <div className="code-layout">
        <FileTree files={tree.files} selectedPath={file?.path} onSelect={openFile} />

        <div className="panel editor-panel">
          <div className="editor-head">
            <span className="editor-path mono">{file ? file.path : 'No file selected'}</span>

            {file ? (
              <>
                <span className="badge">{tree.branch}</span>
                {file.sha ? <span className="badge">{shortSha(file.sha)}</span> : null}
                <span className="faint mono" style={{ fontSize: 11 }}>
                  {formatBytes(file.size)} · {lineCount} lines
                </span>
                {dirty ? (
                  <span className="topbar-meta" style={{ color: 'var(--building)' }}>
                    <span className="dirty-dot" aria-hidden="true" />
                    unsaved
                  </span>
                ) : null}
              </>
            ) : null}

            <div className="topbar-spacer" />

            {file ? (
              <>
                {dirty ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm"
                      aria-pressed={reviewing}
                      onClick={() => setReviewing((value) => !value)}
                    >
                      {reviewing ? 'Back to editor' : 'Review changes'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        setDraft(file.content);
                        setReviewing(false);
                      }}
                    >
                      Reset
                    </button>
                  </>
                ) : null}
                {file.url ? (
                  <a className="link-chip" href={file.url} target="_blank" rel="noreferrer">
                    View on GitHub &#8599;
                  </a>
                ) : null}
              </>
            ) : null}
          </div>

          {fileLoading ? (
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {Array.from({ length: 10 }, (_, index) => (
                <Line key={index} width={`${92 - index * 7}%`} height={11} />
              ))}
            </div>
          ) : null}

          {fileError ? (
            <div className="panel-body">
              <ErrorBanner error={fileError} />
            </div>
          ) : null}

          {!fileLoading && !fileError && !file ? (
            <EmptyState title="Pick a file to edit">
              <p>
                Choose any file from {repo.owner}/{repo.name} on the left. Edit it, write a commit message, and
                DevDeck commits straight to <span className="mono">{tree.branch}</span> — Vercel picks up the push and
                deploys.
              </p>
            </EmptyState>
          ) : null}

          {file && file.binary ? (
            <EmptyState title="Binary file">
              This file is not text, so it cannot be edited here.
            </EmptyState>
          ) : null}

          {file && !file.binary ? (
            <>
              {reviewing && dirty ? (
                <div className="diff-wrap">
                  <DiffView before={file.content} after={draft} path={file.path} />
                </div>
              ) : null}
              <div className="editor-wrap" hidden={reviewing && dirty}>
                <div className="gutter-viewport">
                  <div className="gutter" ref={gutterRef}>
                    {Array.from({ length: lineCount }, (_, index) => (
                      <div key={index}>{index + 1}</div>
                    ))}
                  </div>
                </div>
                <textarea
                  ref={editorRef}
                  className="editor"
                  value={draft}
                  spellCheck={false}
                  wrap="off"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onEditorKeyDown}
                  onScroll={syncGutter}
                  aria-label={`Contents of ${file.path}`}
                />
              </div>

              <div className={cx('commit-bar', dirty && 'is-dirty')}>
                {dirty ? <span className="dirty-dot" aria-hidden="true" /> : null}
                <input
                  className="input"
                  type="text"
                  placeholder={`Update ${file.path}`}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  disabled={!dirty || committing}
                  aria-label="Commit message"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && dirty && !committing) commit();
                  }}
                />
                <button type="button" className="btn btn-primary" onClick={commit} disabled={!dirty || committing}>
                  {committing ? (
                    <>
                      <span className="spinner" aria-hidden="true" />
                      Committing
                    </>
                  ) : (
                    'Commit & Deploy'
                  )}
                </button>
                {changeCount ? (
                  <button
                    type="button"
                    className="change-count"
                    onClick={() => setReviewing((value) => !value)}
                    title={reviewing ? 'Back to the editor' : 'Review what this commit changes'}
                  >
                    <span className="diff-add">+{changeCount.added}</span>
                    <span className="diff-del">−{changeCount.removed}</span>
                  </button>
                ) : null}
                <span className="faint mono" style={{ fontSize: 11 }}>
                  {dirty ? 'commits to ' : 'no changes · '}
                  {dirty ? tree.branch : 'edit to enable'}
                </span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
