export const bookNames: Record<string, string> = {
  Gen: "Genèse",
  Exod: "Exode",
  Lev: "Lévitique",
  Num: "Nombres",
  Deut: "Deutéronome",
  Josh: "Josué",
  Judg: "Juges",
  Ruth: "Ruth",
  "1Sam": "1 Samuel",
  "2Sam": "2 Samuel",
  "1Kgs": "1 Rois",
  "2Kgs": "2 Rois",
  "1Chr": "1 Chroniques",
  "2Chr": "2 Chroniques",
  Ezra: "Esdras",
  Neh: "Néhémie",
  Esth: "Esther",
  Job: "Job",
  Ps: "Psaumes",
  Prov: "Proverbes",
  Eccl: "Ecclésiaste",
  Song: "Cantique",
  Isa: "Ésaïe",
  Jer: "Jérémie",
  Lam: "Lamentations",
  Ezek: "Ézéchiel",
  Dan: "Daniel",
  Hos: "Osée",
  Joel: "Joël",
  Amos: "Amos",
  Obad: "Abdias",
  Jonah: "Jonas",
  Mic: "Michée",
  Nah: "Nahum",
  Hab: "Habacuc",
  Zeph: "Sophonie",
  Hag: "Aggée",
  Zech: "Zacharie",
  Mal: "Malachie",
  Matt: "Matthieu",
  Mark: "Marc",
  Luke: "Luc",
  John: "Jean",
  Acts: "Actes",
  Rom: "Romains",
  "1Cor": "1 Corinthiens",
  "2Cor": "2 Corinthiens",
  Gal: "Galates",
  Eph: "Éphésiens",
  Phil: "Philippiens",
  Col: "Colossiens",
  "1Thess": "1 Thessaloniciens",
  "2Thess": "2 Thessaloniciens",
  "1Tim": "1 Timothée",
  "2Tim": "2 Timothée",
  Titus: "Tite",
  Phlm: "Philémon",
  Heb: "Hébreux",
  Jas: "Jacques",
  "1Pet": "1 Pierre",
  "2Pet": "2 Pierre",
  "1John": "1 Jean",
  "2John": "2 Jean",
  "3John": "3 Jean",
  Jude: "Jude",
  Rev: "Apocalypse"
};

export const bookOrder = Object.keys(bookNames);

export function bookLabel(bookId: string) {
  return bookNames[bookId] ?? bookId;
}

export function resolveBookId(rawBookId: string | null | undefined) {
  if (!rawBookId) return "";
  return (
    bookOrder.find((bookId) => bookId === rawBookId) ??
    bookOrder.find((bookId) => bookId.toLowerCase() === rawBookId.toLowerCase()) ??
    rawBookId
  );
}
