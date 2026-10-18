import PDFDocument from 'pdfkit';

export type PdfInput = {
  childName: string;
  dateOfBirth: string;
  gender: string;
  ageMonths: number;
  rows: {
    date: string;
    heightCm: number | null;
    weightKg: number | null;
    headCircumferenceCm: number | null;
  }[];
  latest: {
    weightPercentile?: number;
    heightPercentile?: number;
    bmiPercentile?: number;
    bmiStatus?: string;
  } | null;
};

export function renderGrowthPdf(input: PdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('NutriKids — Growth summary');
    doc
      .moveDown()
      .fontSize(12)
      .text(`Child: ${input.childName}`)
      .text(`Date of birth: ${input.dateOfBirth}`)
      .text(`Sex: ${input.gender}`)
      .text(`Age: ${input.ageMonths} months`);
    if (input.latest) {
      doc.moveDown().text('Latest percentiles (WHO Child Growth Standards)');
      if (input.latest.weightPercentile !== undefined)
        doc.text(`  Weight-for-age: ${input.latest.weightPercentile}th`);
      if (input.latest.heightPercentile !== undefined)
        doc.text(`  Height-for-age: ${input.latest.heightPercentile}th`);
      if (input.latest.bmiPercentile !== undefined)
        doc.text(
          `  BMI-for-age: ${input.latest.bmiPercentile}th (${input.latest.bmiStatus})`,
        );
    }
    doc.moveDown().text('History');
    for (const r of input.rows) {
      doc.text(
        `${r.date}   height ${r.heightCm ?? '-'} cm   weight ${r.weightKg ?? '-'} kg   head ${r.headCircumferenceCm ?? '-'} cm`,
      );
    }
    doc
      .moveDown()
      .fontSize(9)
      .text(
        'NutriKids provides nutritional guidance, not a medical diagnosis. Percentile and status values are provisional and must be interpreted by a healthcare professional.',
      );
    doc.end();
  });
}
