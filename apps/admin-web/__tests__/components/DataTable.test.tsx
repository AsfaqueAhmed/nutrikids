import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { DataTable } from '@/components/DataTable';

describe('DataTable component', () => {
  type TestItem = { id: string; name: string; email: string };

  const columns = [
    { key: 'name', header: 'Name', render: (row: TestItem) => row.name },
    { key: 'email', header: 'Email', render: (row: TestItem) => row.email },
  ];

  const rows: TestItem[] = [
    { id: '1', name: 'Alice', email: 'alice@example.com' },
    { id: '2', name: 'Bob', email: 'bob@example.com' },
  ];

  it('renders headers and rows correctly', () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        page={1}
        limit={10}
        total={2}
        onPage={vi.fn()}
      />
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows empty text when rows is empty and not loading', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        empty="No data records found."
        page={1}
        limit={10}
        total={0}
        onPage={vi.fn()}
      />
    );

    expect(screen.getByText('No data records found.')).toBeInTheDocument();
  });

  it('shows a role="status" loading indicator when loading', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        loading={true}
        page={1}
        limit={10}
        total={0}
        onPage={vi.fn()}
      />
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('disables "Previous" on page 1 and "Next" on the last page', () => {
    const { rerender } = render(
      <DataTable
        columns={columns}
        rows={rows}
        page={1}
        limit={2}
        total={4}
        onPage={vi.fn()}
      />
    );

    const prevButton = screen.getByRole('button', { name: /previous/i });
    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    // Rerender on last page (page 2 of 4 items with limit 2)
    rerender(
      <DataTable
        columns={columns}
        rows={rows}
        page={2}
        limit={2}
        total={4}
        onPage={vi.fn()}
      />
    );

    expect(prevButton).not.toBeDisabled();
    expect(nextButton).toBeDisabled();
  });

  it('calls onPage(2) when clicking Next', async () => {
    const onPage = vi.fn();
    const user = userEvent.setup();

    render(
      <DataTable
        columns={columns}
        rows={rows}
        page={1}
        limit={2}
        total={4}
        onPage={onPage}
      />
    );

    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    expect(onPage).toHaveBeenCalledWith(2);
  });
});
