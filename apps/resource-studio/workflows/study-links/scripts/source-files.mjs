import { readFile } from "node:fs/promises";
import path from "node:path";

export const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character !== '"') field += character;
      else if (text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
};

export const readSource = async (sourcesRoot, name) => {
  const [header, ...rows] = parseCsv(
    await readFile(path.join(sourcesRoot, `${name}.csv`), "utf8")
  );
  return rows.map((row) =>
    Object.fromEntries(header.map((column, index) => [column, row[index]]))
  );
};

const BOOKS =
  "Gen Exo Lev Num Deu Jos Jdg Rut 1Sa 2Sa 1Ki 2Ki 1Ch 2Ch Ezr Neh Est Job Psa Pro Ecc Sng Isa Jer Lam Ezk Dan Hos Jol Amo Oba Jon Mic Nam Hab Zep Hag Zec Mal Mat Mrk Luk Jhn Act Rom 1Co 2Co Gal Eph Php Col 1Th 2Th 1Ti 2Ti Tit Phm Heb Jas 1Pe 2Pe 1Jn 2Jn 3Jn Jud Rev".split(
    " "
  );
export const bookNumber = new Map(BOOKS.map((book, index) => [book, index + 1]));

export const isVerseKey = (verseKey) => verseKey.split("-").length === 3;
