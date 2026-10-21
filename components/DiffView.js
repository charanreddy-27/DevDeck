'use client';

import { useMemo } from 'react';
import { diffLines, toHunks } from '@/lib/diff';

/**
 * Unified diff of an unsaved edit against the file as loaded — what the
 * commit will actually change, before it becomes a deploy.
 */
export default function DiffView({ before, after, path }) {
  const { hunks, added, removed, tooLarge } = useMemo(() => {
    const result = diffLines(before, after);
    return { ...result, hunks: toHunks(result.ops, 3) };
  }, [before, after]);

  if (tooLarge) {
    return (
      <div className="diff-empty">
        This edit changes too much to show line by line (+{added} −{removed}). Commit it, or reset and make a smaller change.
      </div>
    );
  }
  if (!hunks.length) return <div className="diff-empty">No changes.</div>;

  return (
    <div className="diff" role="region" aria-label={`Changes to ${path}`}>
      <div className="diff-summary">
        <span className="mono">{path}</span>
        <span className="diff-add">+{added}</span>
        <span className="diff-del">−{removed}</span>
      </div>
      {hunks.map((hunk, index) => (
        <div className="diff-hunk" key={index}>
          <div className="diff-hunk-head">
            @@ −{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
          </div>
          {hunk.lines.map((row, rowIndex) => (
            <div className={`diff-row diff-${row.type}`} key={rowIndex}>
              <span className="diff-no">{row.oldNo ?? ''}</span>
              <span className="diff-no">{row.newNo ?? ''}</span>
              <span className="diff-sign" aria-hidden="true">
                {row.type === 'add' ? '+' : row.type === 'del' ? '−' : ' '}
              </span>
              <code className="diff-text">{row.text || ' '}</code>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
