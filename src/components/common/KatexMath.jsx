import React, { useMemo } from 'react';
import katex from 'katex';

export function KatexMath({ latex, block = false, className = '' }) {
  const html = useMemo(() => {
    if (!latex) return '';
    try {
      return katex.renderToString(latex, {
        displayMode: block,
        throwOnError: false,
        strict: false,
      });
    } catch (err) {
      console.warn('KaTeX render error:', err);
      return `<span class="katex-error">${latex}</span>`;
    }
  }, [latex, block]);

  if (block) {
    return (
      <div
        className={`katex-block-wrapper my-2 overflow-x-auto ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <span
      className={`katex-inline-wrapper ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default KatexMath;
