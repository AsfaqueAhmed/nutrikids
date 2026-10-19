import { describe, expect, it, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { HospitalImport } from './HospitalImport';

describe('HospitalImport component', () => {
  it('rejects files larger than 5MB client-side without calling onImport', async () => {
    const onImport = vi.fn();
    const user = userEvent.setup();

    render(<HospitalImport onImport={onImport} />);

    // Create a 6MB dummy file
    const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large_hospitals.csv', {
      type: 'text/csv',
    });

    const fileInput = screen.getByLabelText(/choose csv file/i);
    await user.upload(fileInput, largeFile);

    expect(screen.getByText(/file size exceeds 5 mb limit/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /import hospitals/i })).toBeDisabled();
    expect(onImport).not.toHaveBeenCalled();
  });

  it('previews first 5 rows and triggers import when valid CSV file is uploaded', async () => {
    const onImport = vi.fn().mockResolvedValue({
      imported: 3,
      updated: 1,
      errors: [{ line: 4, message: 'Invalid coordinates' }],
    });
    const user = userEvent.setup();

    render(<HospitalImport onImport={onImport} />);

    const sampleCsv = [
      'name,type,address,district,lat,lng,phone,services,source',
      'Dhaka Medical,Hospital,Secretariat Rd,Dhaka,23.7259,90.3973,0255165,Emergency,OSM',
      'Chittagong Medical,Hospital,KB Fazlul,Chittagong,22.3592,91.8214,0316194,Pediatrics,OSM',
      'Sylhet MAG Osmani,Hospital,Medical Rd,Sylhet,24.8993,91.8542,0821713,Vaccination,OSM',
      'Bad Row Hospital,Clinic,Unknown,Dhaka,999,999,,,OSM',
    ].join('\n');

    const validFile = new File([sampleCsv], 'hospitals.bd.csv', {
      type: 'text/csv',
    });

    const fileInput = screen.getByLabelText(/choose csv file/i);
    await user.upload(fileInput, validFile);

    // Expect preview rows to appear
    await waitFor(() => {
      expect(screen.getByText('Dhaka Medical')).toBeInTheDocument();
      expect(screen.getByText('Chittagong Medical')).toBeInTheDocument();
    });

    const importBtn = screen.getByRole('button', { name: /import hospitals/i });
    expect(importBtn).toBeEnabled();
    await user.click(importBtn);

    expect(onImport).toHaveBeenCalledWith(sampleCsv);

    // Expect summary and error results to render
    await waitFor(() => {
      expect(screen.getByText(/3 new hospitals imported/i)).toBeInTheDocument();
      expect(screen.getByText(/1 hospital record updated/i)).toBeInTheDocument();
      expect(screen.getByText(/invalid coordinates/i)).toBeInTheDocument();
      expect(screen.getByText(/line 4/i)).toBeInTheDocument();
    });
  });
});
