import { useState } from "react";
import { CircleHelp, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import type { JsonlBibleVerse } from "./types";
import { bookLabel } from "./bookNames";
import type { CandidateReviewReason } from "../../../src/strongCandidateReviewTypes";

const labels: Record<CandidateReviewReason, string> = {
  predicate: "Expression verbale à confirmer",
  reading: "Lecture du texte source à préciser",
  correspondence: "Correspondance entre versets à vérifier",
  group: "Répartition entre plusieurs mots à préciser",
  alignment: "Lien avec le texte français non établi"
};
export function VerseUncertainty({
  verse,
  version
}: {
  verse: JsonlBibleVerse;
  version: string;
}) {
  const [open, setOpen] = useState(false);
  const review = verse.review;
  if (!review) return null;
  if (!review.available)
    return (
      <span
        className="text-muted-foreground ml-2 inline-block font-sans text-xs"
        title="Les états de résolution ne sont pas disponibles pour ce fichier."
      >
        Vérification indisponible
      </span>
    );
  if (!review.unresolved && !review.issues && review.sourceUnits > 0)
    return null;
  const description = review.unresolved
    ? `${review.unresolved} lien${review.unresolved > 1 ? "s" : ""} non résolu${review.unresolved > 1 ? "s" : ""}`
    : "Source à vérifier";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${verse.ref} ${version} : ${description}`}
        className="ml-2 inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 align-middle font-sans text-xs text-amber-700 dark:text-amber-300"
      >
        <CircleHelp className="size-3" aria-hidden="true" />
        {description}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[85vh] overflow-y-auto sm:max-w-xl"
        >
          <button
            type="button"
            aria-label="Fermer les liens à vérifier"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 rounded p-1 opacity-70 hover:opacity-100 focus-visible:outline-2"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
          <DialogHeader>
            <DialogTitle>
              Liens à vérifier · {bookLabel(verse.bookId)} {verse.chapter}.
              {verse.verse}
            </DialogTitle>
            <DialogDescription>
              {version.replace("-CANDIDATE", " · candidate")} · Ces occurrences
              du texte source n’ont pas encore de lien suffisamment établi avec
              le français. Elles ne sont pas considérées comme absentes de la
              traduction.
            </DialogDescription>
          </DialogHeader>
          <p className="text-muted-foreground text-xs">
            Occurrences examinées : {review.sourceUnits} · Non résolues :{" "}
            {review.unresolved} · Vides établis : {review.establishedEmpty}
          </p>
          {review.issues > 0 || review.sourceUnits === 0 ? (
            <p className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              La source ou le découpage de ce verset demande également une
              vérification.
            </p>
          ) : null}
          <ul className="space-y-3">
            {review.items.map((item, index) => (
              <li key={item.sourceUnitId} className="rounded border p-3">
                <p className="font-mono text-sm font-semibold">
                  <span className="text-muted-foreground mr-2 font-sans text-xs">
                    Cas {index + 1}
                  </span>
                  {item.strong.join(" · ")}
                </p>
                <p className="mt-1 text-sm" dir="auto">
                  {item.source}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {labels[item.reason]}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">
            Ce bilan indique les cas non résolus par le moteur. Il ne certifie
            pas tous les Strong déjà affichés.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
