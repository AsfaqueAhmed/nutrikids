// Converts the raw WHO xlsx tables in data/who/raw into data/who/<IND>_<GENDER>.json.
// 0-60 months come from the WHO Child Growth Standards (day-indexed tables are sampled at
// round(month * 30.4375) days); 61-228 months come from the 2007 WHO growth reference.
import { Workbook } from 'exceljs';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

type Row = { ageMonths: number; L: number; M: number; S: number };
const RAW = resolve(__dirname, '../../../data/who/raw');
const OUT = resolve(__dirname, '../../../data/who');

async function readLms(file: string): Promise<{ key: number; L: number; M: number; S: number }[]> {
  const wb = new Workbook();
  await wb.xlsx.readFile(resolve(RAW, file));
  const ws = wb.worksheets[0];
  const rows: { key: number; L: number; M: number; S: number }[] = [];
  ws.eachRow((r, n) => {
    if (n === 1) return;
    const [key, L, M, S] = [1, 2, 3, 4].map((c) => Number(r.getCell(c).value));
    if ([key, L, M, S].some(Number.isNaN)) throw new Error(`${file}: bad row ${n}`);
    rows.push({ key, L, M, S });
  });
  return rows;
}

function fromDays(rows: { key: number; L: number; M: number; S: number }[]): Row[] {
  const byDay = new Map(rows.map((r) => [r.key, r]));
  const out: Row[] = [];
  for (let m = 0; m <= 60; m++) {
    const r = byDay.get(Math.round(m * 30.4375));
    if (!r) throw new Error(`missing day for month ${m}`);
    out.push({ ageMonths: m, L: r.L, M: r.M, S: r.S });
  }
  return out;
}

const fromMonths = (rows: { key: number; L: number; M: number; S: number }[]): Row[] =>
  rows.map((r) => ({ ageMonths: r.key, L: r.L, M: r.M, S: r.S })).sort((a, b) => a.ageMonths - b.ageMonths);

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const g of ['MALE', 'FEMALE']) {
    const tables: Record<string, Row[]> = {
      WFA: [...fromDays(await readLms(`wfa_${g}_0-5.xlsx`)), ...fromMonths(await readLms(`wfa_${g}_5-10.xlsx`))],
      HFA: [...fromDays(await readLms(`hfa_${g}_0-5.xlsx`)), ...fromMonths(await readLms(`hfa_${g}_5-19.xlsx`))],
      BFA: [...fromDays(await readLms(`bfa_${g}_0-5.xlsx`)), ...fromMonths(await readLms(`bfa_${g}_5-19.xlsx`))],
      HCFA: fromMonths(await readLms(`hcfa_${g}_0-5.xlsx`)),
    };
    for (const [ind, rows] of Object.entries(tables)) {
      writeFileSync(resolve(OUT, `${ind}_${g}.json`), JSON.stringify(rows, null, 1) + '\n');
      console.log(`${ind}_${g}: ${rows.length} rows, ${rows[0].ageMonths}-${rows[rows.length - 1].ageMonths} months`);
    }
  }
}
void main();
