import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Markdown } from './Markdown';

describe('Markdown component', () => {
  it('renders heading as h1', () => {
    render(<Markdown source="# Hi" />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Hi');
  });

  it('renders external links with target="_blank" and rel="noopener noreferrer"', () => {
    render(<Markdown source="Check [this link](https://x.test) now" />);
    const link = screen.getByRole('link', { name: 'this link' });
    expect(link).toHaveAttribute('href', 'https://x.test');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('sanitizes script tags and dangerous event handlers', () => {
    const { container } = render(
      <Markdown source="<script>alert(1)</script><img src=x onerror=alert(1)>" />
    );
    expect(container.querySelector('script')).toBeNull();
    const img = container.querySelector('img');
    if (img) {
      expect(img).not.toHaveAttribute('onerror');
    }
  });

  it('sanitizes javascript: links removing or blocking href', () => {
    const { container } = render(
      <Markdown source="[click here](javascript:alert(1))" />
    );
    const link = container.querySelector('a');
    if (link) {
      expect(link.getAttribute('href')).not.toBe('javascript:alert(1)');
    }
  });
});
