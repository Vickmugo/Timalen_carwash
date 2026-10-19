/**
 * ONE CSV CELL, SAFE TO OPEN IN EXCEL.
 *
 * Quoting a field (RFC 4180) keeps commas and quotes inside it, but it does
 * NOT stop a spreadsheet evaluating it: `"=HYPERLINK(...)"` still opens as
 * a live formula. So any value starting with `=`, `+`, `-`, `@`, tab or CR
 * gets a leading apostrophe, which Excel and Sheets read as "this is text".
 *
 * The one exception is a value that is exactly a phone number
 * (`+254712345678`, `0712345678`): it cannot be a formula, and prefixing
 * every phone in the export with a visible apostrophe would make the file
 * worse for the people actually using it.
 */

const FORMULA_START = /^[=+\-@\t\r]/;
const PHONE_ONLY = /^\+?\d{9,15}$/;

export function csvCell(value: string | number | null | undefined): string {
  let text = String(value ?? "");
  if (FORMULA_START.test(text) && !PHONE_ONLY.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
