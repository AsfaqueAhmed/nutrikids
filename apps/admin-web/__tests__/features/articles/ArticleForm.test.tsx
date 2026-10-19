import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ArticleForm } from '@/features/articles/ArticleForm';

describe('ArticleForm component', () => {
  it('blocks submit and shows validation errors when required fields are empty', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<ArticleForm onSubmit={onSubmit} />);

    const saveBtn = screen.getByRole('button', { name: /save as draft/i });
    await user.click(saveBtn);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/title is required/i)).toBeInTheDocument();
  });

  it('auto-generates slug from title until user manually edits slug', async () => {
    const user = userEvent.setup();

    render(<ArticleForm onSubmit={vi.fn()} />);

    const titleInput = screen.getByLabelText(/title \*/i);
    const slugInput = screen.getByLabelText(/slug \*/i);

    await user.type(titleInput, 'Starting Solid Foods');
    expect(slugInput).toHaveValue('starting-solid-foods');

    // Manually edit the slug
    await user.clear(slugInput);
    await user.type(slugInput, 'custom-first-solids');

    // Type more in title; slug should remain custom
    await user.type(titleInput, ' for Babies');
    expect(slugInput).toHaveValue('custom-first-solids');
  });

  it('renders live markdown preview while typing body', async () => {
    const user = userEvent.setup();

    render(<ArticleForm onSubmit={vi.fn()} />);

    const bodyTextarea = screen.getByLabelText(/article markdown body \*/i);
    await user.type(bodyTextarea, '## Nutrition Guide\n\nApples are nutritious.');

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Nutrition Guide');
    expect(screen.getByText(/apples are nutritious\./i)).toBeInTheDocument();
  });

  it('submits with status DRAFT on "Save as Draft" and PUBLISHED on "Publish Now"', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<ArticleForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/title \*/i), 'Iron Rich Foods');
    await user.type(screen.getByLabelText(/category \*/i), 'Nutrition');
    await user.type(screen.getByLabelText(/summary \*/i), 'Essential guide to iron in infant diets.');
    await user.type(screen.getByLabelText(/article markdown body \*/i), '# Iron Rich Foods\n\nSpinach and lentils.');

    // Click Save as Draft
    const draftBtn = screen.getByRole('button', { name: /save as draft/i });
    await user.click(draftBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Iron Rich Foods',
          slug: 'iron-rich-foods',
          category: 'Nutrition',
          status: 'DRAFT',
        })
      );
    });

    // Now click Publish Now
    const publishBtn = screen.getByRole('button', { name: /publish now/i });
    await user.click(publishBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PUBLISHED',
        })
      );
    });
  });
});
