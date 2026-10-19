import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MarkdownPreview } from '@/features/articles/MarkdownPreview';

describe('MarkdownPreview component', () => {
  it('renders markdown elements cleanly', () => {
    const md = '# Heading 1\n\nThis is **bold** and *italic* text.\n\n- Item 1\n- Item 2';
    render(<MarkdownPreview markdown={md} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Heading 1');
    expect(screen.getByText('bold')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  it('sanitizes dangerous HTML tags like script and onclick', () => {
    const dangerous = 'Normal text <script>alert("hack")</script> <img src="x" onerror="alert(1)" />';
    const { container } = render(<MarkdownPreview markdown={dangerous} />);

    expect(screen.getByText(/normal text/i)).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    // rehype-sanitize removes unsafe event handlers
    const img = container.querySelector('img');
    if (img) {
      expect(img).not.toHaveAttribute('onerror');
    }
  });
});
