import {
  Archive,
  Bot,
  BookOpen,
  Braces,
  CheckCircle2,
  CircleAlert,
  CircleCheckBig,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  FileJson,
  Fingerprint,
  Gauge,
  GitCompareArrows,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  type LucideIcon
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { bookLabel, bookOrder, resolveBookId } from "./bookNames";
import {
  currentViewFromLocation,
  defaultLedgerPath,
  loadBookVerses,
  loadLexicalItemsByRef,
  loadLedger,
  loadStrongReviewItems,
  loadStrongReviewSummary
} from "./data";
import { pct, ratio } from "./format";
import type {
  LexiconEntryPayload,
  LexiconMetadata,
  LexiconRow,
  LexicalAuditItem,
  LexicalCandidate,
  ReaderMode,
  ReviewFile,
  ReviewItem,
  StrongAnnotation,
  StrongLedger,
  StrongReviewBucket,
  StrongReviewDashboardItem,
  StrongReviewItemsPage,
  StrongReviewSummary,
  StrongVerse,
  ViewId
} from "./types";
import { JsonlBibleView } from "./JsonlBibleView";
import { WorkflowView } from "./WorkflowView";

const navItems: Array<{
  id: ViewId;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: "viewer",
    label: "Ledger",
    description: "Strong placés, vides et preuves",
    icon: BookOpen
  },
  {
    id: "jsonl",
    label: "JSONL",
    description: "Les 8 Bibles finales",
    icon: Braces
  },
  {
    id: "workflow",
    label: "Workflow",
    description: "Carte production et LLM borné",
    icon: GitCompareArrows
  },
  {
    id: "lexicon",
    label: "Lexique",
    description: "Strong + TAHOT/TAGNT",
    icon: Database
  },
  {
    id: "review",
    label: "Qualité",
    description: "Consensus, quarantaine et priorités",
    icon: MessageSquareText
  }
];

const sourceLegend = [
  ["Témoin", "Strong placé à partir des Bibles témoins françaises.", "witness"],
  [
    "Témoin confirmé",
    "Les témoins attendent ce Strong, et TAHOT/TAGNT confirme ou aide le placement.",
    "original"
  ],
  [
    "Ajout original",
    "Strong ajouté depuis TAHOT/TAGNT, absent du placement témoin normal.",
    "step"
  ],
  [
    "Lexique",
    "Strong placé par le système déterministe lexical: dictionnaire, synonymes, noms propres, etc.",
    "lexical"
  ],
  ["Revu", "Strong validé par une décision de revue.", "reviewed"],
  [
    "Sans mot",
    "Strong attendu, mais aucun mot français fiable ne le porte.",
    "empty"
  ]
] as const;

const REVIEW_PROVENANCE_STEPS = [
  ["01", "Deux modèles distincts"],
  ["02", "Choix borné identique"],
  ["03", "Filtre lexical v2"],
  ["04", "Override production"]
] as const;

export function App() {
  const [view, setView] = useState<ViewId>(
    () => currentViewFromLocation() as ViewId
  );
  const [ledger, setLedger] = useState<StrongLedger | null>(null);
  const [ledgerPath, setLedgerPath] = useState(() => defaultLedgerPath());
  const [loadingLedger, setLoadingLedger] = useState(false);

  useEffect(() => {
    if (view === "workflow" || view === "jsonl") {
      setLoadingLedger(false);
      return;
    }
    let cancelled = false;
    setLoadingLedger(true);
    loadLedger(ledgerPath)
      .then((nextLedger) => {
        if (!cancelled) setLedger(nextLedger);
      })
      .catch((error) => {
        if (!cancelled)
          toast.error(
            error instanceof Error ? error.message : "Chargement impossible"
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingLedger(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ledgerPath, view]);

  function changeView(next: string) {
    setView(next as ViewId);
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-border/70 bg-card/80 border-b lg:border-r lg:border-b-0">
          <div className="flex h-full flex-col gap-5 p-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-lg font-semibold">
                BS
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold">
                  Bible Strong Studio
                </h1>
                <p className="text-muted-foreground text-xs">
                  Ledger, lexique et revue unifiés
                </p>
              </div>
            </div>

            <Tabs
              value={view}
              onValueChange={changeView}
              className="w-full lg:hidden"
            >
              <TabsList className="grid w-full grid-cols-5">
                {navItems.map((item) => (
                  <TabsTrigger key={item.id} value={item.id}>
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="hidden flex-col gap-2 lg:flex">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => changeView(item.id)}
                    className={cn(
                      "hover:bg-muted flex w-full items-center gap-3 rounded-lg border p-3 text-left transition",
                      view === item.id
                        ? "border-primary/35 bg-primary/10"
                        : "border-transparent"
                    )}
                  >
                    <Icon className="text-primary" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {item.label}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {item.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <Separator className="hidden lg:block" />

            <div className="hidden lg:block">
              {view === "workflow" ? <WorkflowStatus /> : null}
              {view !== "workflow" && view !== "jsonl" ? (
                <LedgerStatus ledger={ledger} loading={loadingLedger} />
              ) : null}
            </div>

            <div
              className={cn(
                "mt-auto hidden flex-col gap-2 lg:flex",
                (view === "workflow" || view === "jsonl") && "lg:hidden"
              )}
            >
              <label
                htmlFor="ledger-source"
                className="text-muted-foreground text-xs font-medium"
              >
                Source ledger
              </label>
              <div className="flex gap-2">
                <Input
                  id="ledger-source"
                  value={ledgerPath}
                  onChange={(event) => setLedgerPath(event.target.value)}
                  className="h-9 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLedgerPath(defaultLedgerPath())}
                >
                  <FileJson data-icon="inline-start" />
                  NBS
                </Button>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          {view === "viewer" ? (
            <LedgerView ledger={ledger} loading={loadingLedger} />
          ) : null}
          {view === "jsonl" ? <JsonlBibleView /> : null}
          {view === "workflow" ? <WorkflowView /> : null}
          {view === "lexicon" ? <LexiconView /> : null}
          {view === "review" ? <ReviewView /> : null}
        </main>
      </div>
    </div>
  );
}

function WorkflowStatus() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Documentation workflow</CardTitle>
        <CardDescription>
          Carte React Flow du pipeline Strong, du determinisme au LLM borne.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground space-y-3 text-sm leading-6">
        <p>
          Le LLM n'est pas dans la generation brute. Il intervient apres le
          rapport residuel, via packets, consensus et filtre.
        </p>
      </CardContent>
    </Card>
  );
}

function LedgerStatus({
  ledger,
  loading
}: {
  ledger: StrongLedger | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-4 text-sm">
          <Loader2 className="animate-spin" />
          Chargement du ledger
        </CardContent>
      </Card>
    );
  }
  if (!ledger) {
    return (
      <Card>
        <CardContent className="text-muted-foreground p-4 text-sm">
          Aucun ledger chargé.
        </CardContent>
      </Card>
    );
  }

  const metrics = ledger.metrics;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">État production</CardTitle>
        <CardDescription>
          {ledger.bible.toUpperCase()} ·{" "}
          {metrics.verseCount.toLocaleString("fr-FR")} versets
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <MetricBar
          label="Témoins sur texte"
          value={metrics.referenceStrongCarrierCoverage}
          detail={ratio(
            metrics.referenceStrongCarrierCount,
            metrics.referenceStrongOccurrenceCount
          )}
        />
        <MetricBar
          label="TAHOT/TAGNT sur texte"
          value={metrics.originalStrongCarrierRate}
          detail={ratio(
            metrics.originalStrongCarrierCount,
            metrics.originalStrongOccurrenceCount
          )}
        />
        <div className="grid grid-cols-2 gap-2 text-xs">
          <MiniStat label="Vides" value={metrics.emptyStrongCount} />
          <MiniStat label="Risques" value={metrics.placementRiskCount} />
        </div>
      </CardContent>
    </Card>
  );
}

function MetricBar({
  label,
  value,
  detail
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-semibold">{pct(value)}</span>
      </div>
      <Progress value={value * 100} />
      <span className="text-muted-foreground text-xs">{detail}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/50 rounded-lg border p-3">
      <span className="text-muted-foreground block text-xs">{label}</span>
      <strong className="text-lg">{value.toLocaleString("fr-FR")}</strong>
    </div>
  );
}

function LedgerView({
  ledger,
  loading
}: {
  ledger: StrongLedger | null;
  loading: boolean;
}) {
  const [book, setBook] = useState("");
  const [chapter, setChapter] = useState("");
  const [mode, setMode] = useState<ReaderMode>("normal");
  const [query, setQuery] = useState(
    () => new URLSearchParams(window.location.search).get("q") ?? ""
  );
  const [selectedStrong, setSelectedStrong] = useState("");
  const [selectedStrongCodes, setSelectedStrongCodes] = useState<string[]>([]);
  const [bookVerses, setBookVerses] = useState<StrongVerse[]>([]);
  const [loadingBook, setLoadingBook] = useState(false);
  const [showLexicalCandidates, setShowLexicalCandidates] = useState(
    () => new URLSearchParams(window.location.search).get("showLexical") === "1"
  );
  const [lexicalByRef, setLexicalByRef] = useState<
    Map<string, LexicalAuditItem[]>
  >(new Map());

  const books = useMemo(() => {
    if (ledger?.books?.length) {
      const available = new Set(ledger.books.map((item) => item.bookId));
      return bookOrder.filter((id) => available.has(id));
    }
    const ids = new Set(
      ledger?.split
        ? ledger.verseFiles?.map((file) => file.bookId)
        : ledger?.verses.map((verse) => verse.bookId)
    );
    return bookOrder.filter((id) => ids.has(id));
  }, [ledger]);

  useEffect(() => {
    if (!ledger || book) return;
    const params = new URLSearchParams(window.location.search);
    const queryBook = resolveBookId(params.get("book"));
    const firstBook = books.includes(queryBook) ? queryBook : (books[0] ?? "");
    setBook(firstBook);
  }, [book, books, ledger]);

  const chapters = useMemo(() => {
    if (!book) return [];
    const outlined = ledger?.books?.find((item) => item.bookId === book);
    if (outlined) return outlined.chapters;
    if (ledger && !ledger.split) return chaptersForBook(ledger.verses, book);
    return chaptersForBook(bookVerses, book);
  }, [book, bookVerses, ledger]);

  useEffect(() => {
    let cancelled = false;
    setBookVerses([]);
    setSelectedStrong("");
    if (!ledger || !book) return;
    const selectedChapter = Number(chapter);
    if (ledger.apiBacked && !Number.isInteger(selectedChapter)) return;

    setLoadingBook(true);
    loadBookVerses(ledger, book, ledger.apiBacked ? selectedChapter : undefined)
      .then((verses) => {
        if (!cancelled) setBookVerses(verses);
      })
      .catch(
        (error) =>
          !cancelled &&
          toast.error(
            error instanceof Error ? error.message : "Livre inaccessible"
          )
      )
      .finally(() => {
        if (!cancelled) setLoadingBook(false);
      });
    return () => {
      cancelled = true;
    };
  }, [book, chapter, ledger]);

  useEffect(() => {
    let cancelled = false;
    setLexicalByRef(new Map());
    if (!ledger || !showLexicalCandidates) return;
    loadLexicalItemsByRef(ledger)
      .then((items) => {
        if (!cancelled) setLexicalByRef(items);
      })
      .catch(() => {
        if (!cancelled) setLexicalByRef(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [ledger, showLexicalCandidates]);

  useEffect(() => {
    if (!chapter && chapters.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const queryChapter = Number(params.get("chapter"));
      const nextChapter = chapters.includes(queryChapter)
        ? queryChapter
        : chapters[0];
      setChapter(String(nextChapter));
    }
  }, [chapter, chapters]);

  const chapterVerses = useMemo(() => {
    if (!book || !chapter) return [];
    const needle = query.trim().toLowerCase();
    return bookVerses.filter((verse) => {
      if (verse.bookId !== book || String(verse.chapter) !== chapter)
        return false;
      if (!needle) return true;
      return (
        verse.text.toLowerCase().includes(needle) ||
        verse.ref.toLowerCase().includes(needle) ||
        verse.annotations.some((annotation) =>
          annotation.strong.toLowerCase().includes(needle)
        )
      );
    });
  }, [book, bookVerses, chapter, query]);

  const chapterMetrics = useMemo(
    () => summarizeVerses(chapterVerses),
    [chapterVerses]
  );
  const selectedAnnotation = useMemo(() => {
    if (!selectedStrong) return undefined;
    return chapterVerses
      .flatMap((verse) => verse.annotations)
      .find((annotation) =>
        strongListIncludes(annotation.strong, selectedStrong)
      );
  }, [chapterVerses, selectedStrong]);
  const chapterNavigation = useMemo(() => {
    const currentChapter = Number(chapter);
    const currentChapterIndex = chapters.indexOf(currentChapter);
    const currentBookIndex = books.indexOf(book);
    return {
      currentChapterIndex,
      currentBookIndex,
      hasPrevious:
        currentChapterIndex >= 0 &&
        (currentChapterIndex > 0 || currentBookIndex > 0),
      hasNext:
        currentChapterIndex >= 0 &&
        (currentChapterIndex < chapters.length - 1 ||
          currentBookIndex < books.length - 1)
    };
  }, [book, books, chapter, chapters]);

  useEffect(() => {
    if (!book || !chapter) return;
    const url = new URL(window.location.href);
    url.searchParams.set("book", book);
    url.searchParams.set("chapter", chapter);
    window.history.replaceState(null, "", url);
  }, [book, chapter]);

  useEffect(() => {
    setSelectedStrong("");
    setSelectedStrongCodes([]);
  }, [book, chapter]);

  function selectStrong(value: string) {
    const codes = splitStrongCodes(value);
    setSelectedStrongCodes(codes);
    setSelectedStrong(codes[0] ?? "");
  }

  function switchSelectedStrong(value: string) {
    const code = normalizeStrongCode(value);
    setSelectedStrong(code);
    setSelectedStrongCodes((codes) =>
      codes.some((item) => strongCodesEqual(item, code)) ? codes : [code]
    );
  }

  function clearSelectedStrong() {
    setSelectedStrong("");
    setSelectedStrongCodes([]);
  }

  async function navigateChapter(direction: -1 | 1) {
    if (!ledger || !book || !chapter) return;

    const { currentBookIndex, currentChapterIndex } = chapterNavigation;
    if (currentChapterIndex < 0 || currentBookIndex < 0) return;

    const nextChapter = chapters[currentChapterIndex + direction];
    if (nextChapter !== undefined) {
      setChapter(String(nextChapter));
      return;
    }

    const nextBook = books[currentBookIndex + direction];
    if (!nextBook) return;

    const outlinedChapters = ledger.books?.find(
      (item) => item.bookId === nextBook
    )?.chapters;
    if (outlinedChapters?.length) {
      const targetChapter =
        direction < 0 ? outlinedChapters.at(-1) : outlinedChapters[0];
      if (targetChapter === undefined) return;
      setBook(nextBook);
      setChapter(String(targetChapter));
      return;
    }

    setLoadingBook(true);
    try {
      const nextBookVerses = await loadBookVerses(ledger, nextBook);
      const nextBookChapters = chaptersForBook(nextBookVerses, nextBook);
      const targetChapter =
        direction < 0 ? nextBookChapters.at(-1) : nextBookChapters[0];
      if (targetChapter === undefined) return;
      setBook(nextBook);
      setChapter(String(targetChapter));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Navigation de chapitre impossible"
      );
    } finally {
      setLoadingBook(false);
    }
  }

  return (
    <section className="flex min-h-screen flex-col lg:h-screen lg:min-h-0">
      <header className="border-border/70 bg-background/95 sticky top-0 z-10 border-b backdrop-blur">
        <div className="flex flex-col gap-4 p-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Ledger canonique</Badge>
              <Badge variant="secondary">{mode}</Badge>
            </div>
            <h2 className="mt-2 text-2xl font-semibold">
              {book ? bookLabel(book) : "Viewer Strong"}
              {chapter ? ` ${chapter}` : ""}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-[170px_190px_minmax(180px,220px)_190px_auto]">
            <Select
              value={book}
              onValueChange={(value) => {
                setBook(value);
                setChapter("1");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Livre" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {books.map((bookId) => (
                    <SelectItem key={bookId} value={bookId}>
                      {bookLabel(bookId)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-[36px_minmax(0,1fr)_36px] gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Chapitre précédent"
                title="Chapitre précédent"
                disabled={!chapterNavigation.hasPrevious || loadingBook}
                onClick={() => void navigateChapter(-1)}
              >
                <ChevronLeft />
              </Button>
              <Select value={chapter} onValueChange={setChapter}>
                <SelectTrigger>
                  <SelectValue placeholder="Chapitre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {chapters.map((item) => (
                      <SelectItem key={item} value={String(item)}>
                        Chapitre {item}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Chapitre suivant"
                title="Chapitre suivant"
                disabled={!chapterNavigation.hasNext || loadingBook}
                onClick={() => void navigateChapter(1)}
              >
                <ChevronRight />
              </Button>
            </div>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Strong, mot, référence"
            />
            <Select
              value={mode}
              onValueChange={(value) => setMode(value as ReaderMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <label className="border-input bg-background flex h-9 items-center gap-2 rounded-md border px-3 text-sm whitespace-nowrap">
              <Checkbox
                checked={showLexicalCandidates}
                disabled={ledger?.apiBacked}
                onCheckedChange={(checked) =>
                  changeShowLexicalCandidates(
                    checked === true,
                    setShowLexicalCandidates
                  )
                }
              />
              {ledger?.apiBacked
                ? "Candidats dans Qualité"
                : "Candidats lexicaux"}
            </label>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-h-0 overflow-visible lg:overflow-auto">
          <div className="flex flex-col gap-4 p-4">
            <ChapterScoreboard metrics={chapterMetrics} />
            <Legend />
            {loading || loadingBook ? (
              <EmptyPanel
                icon={Loader2}
                title="Chargement"
                copy="Lecture des fichiers split du ledger."
              />
            ) : chapterVerses.length === 0 ? (
              <EmptyPanel
                icon={Search}
                title="Aucun verset"
                copy="Aucun résultat pour ce livre, chapitre ou filtre."
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-border divide-y">
                    {chapterVerses.map((verse) => (
                      <VerseRow
                        key={verse.ref}
                        verse={verse}
                        mode={mode}
                        lexicalItems={lexicalByRef.get(verse.ref) ?? []}
                        showLexicalCandidates={showLexicalCandidates}
                        onSelectStrong={selectStrong}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        <aside className="border-border/70 bg-card/50 hidden min-h-0 border-t xl:block xl:border-t-0 xl:border-l">
          <StrongInspector
            strong={selectedStrong}
            strongCodes={selectedStrongCodes}
            annotation={selectedAnnotation}
            onStrongChange={switchSelectedStrong}
            onClear={clearSelectedStrong}
          />
        </aside>
      </div>
    </section>
  );
}

function changeShowLexicalCandidates(
  checked: boolean,
  setChecked: (checked: boolean) => void
) {
  setChecked(checked);
  const url = new URL(window.location.href);
  if (checked) {
    url.searchParams.set("showLexical", "1");
  } else {
    url.searchParams.delete("showLexical");
  }
  window.history.replaceState(null, "", url);
}

function chaptersForBook(verses: StrongVerse[], bookId: string) {
  return [
    ...new Set(
      verses
        .filter((verse) => verse.bookId === bookId)
        .map((verse) => verse.chapter)
    )
  ].sort((left, right) => left - right);
}

function ChapterScoreboard({
  metrics
}: {
  metrics: ReturnType<typeof summarizeVerses>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
      <MetricCard
        icon={ShieldCheck}
        label="Témoins sur texte"
        value={pct(metrics.referenceCarrierCoverage)}
        detail={ratio(metrics.referenceCarrier, metrics.referenceOcc)}
        intent={metrics.referenceCarrierCoverage >= 0.9 ? "good" : "warn"}
        progress={metrics.referenceCarrierCoverage}
      />
      <MetricCard
        icon={Braces}
        label="TAHOT/TAGNT sur texte"
        value={pct(metrics.originalCarrierRate)}
        detail={ratio(metrics.originalCarrier, metrics.originalOcc)}
        intent={metrics.originalCarrierRate >= 0.85 ? "good" : "warn"}
        progress={metrics.originalCarrierRate}
      />
      <MetricCard
        icon={TriangleAlert}
        label="À expliquer"
        value={String(metrics.empty)}
        detail={`${metrics.risk} risques`}
        intent={metrics.empty > 0 ? "warn" : "good"}
      />
      <MetricCard
        icon={Gauge}
        label="Mots"
        value={String(metrics.words)}
        detail={`${metrics.verses} versets`}
        intent="neutral"
      />
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  intent,
  progress
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  intent: "good" | "warn" | "neutral";
  progress?: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-lg",
            intent === "good" && "bg-accent text-accent-foreground",
            intent === "warn" && "bg-secondary text-secondary-foreground",
            intent === "neutral" && "bg-muted text-muted-foreground"
          )}
        >
          <Icon />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
          <p className="text-muted-foreground truncate text-xs">{detail}</p>
          {progress !== undefined ? (
            <Progress className="mt-2 h-1.5" value={progress * 100} />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Legend() {
  return (
    <Card>
      <CardContent className="flex flex-wrap gap-2 p-3">
        {sourceLegend.map(([label, copy, tone]) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="gap-2">
                <span className={cn("legend-dot", `legend-dot-${tone}`)} />
                {label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{copy}</TooltipContent>
          </Tooltip>
        ))}
      </CardContent>
    </Card>
  );
}

function VerseRow({
  verse,
  mode,
  lexicalItems,
  showLexicalCandidates,
  onSelectStrong
}: {
  verse: StrongVerse;
  mode: ReaderMode;
  lexicalItems: LexicalAuditItem[];
  showLexicalCandidates: boolean;
  onSelectStrong: (strong: string) => void;
}) {
  const html =
    mode === "debug"
      ? verse.views.debugHtml
      : mode === "advanced"
        ? verse.views.advancedHtml
        : verse.views.readerHtml;
  const decoratedHtml = useMemo(() => decorateStrongHtml(html), [html]);

  return (
    <div className="grid gap-3 p-4 md:grid-cols-[56px_minmax(0,1fr)]">
      <div className="text-primary text-sm font-semibold">{verse.verse}</div>
      <div className="min-w-0">
        <div
          className="strong-text"
          role="group"
          aria-label={`Annotations Strong du verset ${verse.ref}`}
          onClick={(event) => {
            const target = event.target as HTMLElement;
            const tagged = target.closest("[strong]") as HTMLElement | null;
            const strong = tagged?.getAttribute("strong");
            if (strong) onSelectStrong(strong);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            const target = event.target as HTMLElement;
            const tagged = target.closest("[strong]") as HTMLElement | null;
            const strong = tagged?.getAttribute("strong");
            if (!strong) return;
            event.preventDefault();
            onSelectStrong(strong);
          }}
          dangerouslySetInnerHTML={{ __html: decoratedHtml }}
        />
        {showLexicalCandidates && lexicalItems.length > 0 ? (
          <LexicalCandidatePanel
            items={lexicalItems}
            onSelectStrong={onSelectStrong}
          />
        ) : null}
      </div>
    </div>
  );
}

function LexicalCandidatePanel({
  items,
  onSelectStrong
}: {
  items: LexicalAuditItem[];
  onSelectStrong: (strong: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleCount = items.reduce(
    (sum, item) =>
      sum +
      item.candidates.filter((candidate) =>
        isDefaultVisibleLexicalCandidate(item, candidate)
      ).length,
    0
  );
  const autoSafeCount = items.filter(isLexicalAutoSafeItem).length;
  const groupCount = items.filter((item) => item.groupAutoSafe).length;
  const hiddenCount = items.reduce(
    (sum, item) =>
      sum +
      item.candidates.filter(
        (candidate) => !isDefaultVisibleLexicalCandidate(item, candidate)
      ).length,
    0
  );
  const visibleItems = items
    .map((item) => ({
      item,
      candidates: expanded
        ? item.candidates.slice(0, 5)
        : item.candidates.filter((candidate) =>
            isDefaultVisibleLexicalCandidate(item, candidate)
          )
    }))
    .filter((entry) => entry.candidates.length > 0);

  return (
    <div className="border-primary/20 bg-muted/30 mt-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Candidats déterministes</span>
          <Badge variant="secondary">{visibleCount} visibles</Badge>
          <Badge variant="outline">{autoSafeCount} auto-safe</Badge>
          {groupCount > 0 ? (
            <Badge variant="outline">{groupCount} groupés</Badge>
          ) : null}
        </div>
        {hiddenCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Moins" : `+ ${hiddenCount}`}
          </Button>
        ) : null}
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {visibleItems.length > 0 ? (
          visibleItems.map(({ item, candidates }) => (
            <LexicalCandidateItem
              key={item.annotationId}
              item={item}
              candidates={candidates}
              onSelectStrong={onSelectStrong}
            />
          ))
        ) : (
          <div className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
            Aucun candidat high ouvert
          </div>
        )}
      </div>
    </div>
  );
}

function LexicalCandidateItem({
  item,
  candidates,
  onSelectStrong
}: {
  item: LexicalAuditItem;
  candidates: LexicalCandidate[];
  onSelectStrong: (strong: string) => void;
}) {
  const meta = item.groupAutoSafe
    ? `assigné: ${item.groupAutoSafe.assignedWordIndex} ${item.groupAutoSafe.assignedText}`
    : item.currentTarget
      ? `actuel: ${item.currentTarget.wordIndex} ${item.currentTarget.text}`
      : item.insertAfterWordIndex !== undefined
        ? `après mot ${item.insertAfterWordIndex}`
        : "";

  return (
    <section className="bg-background/60 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 font-mono text-xs"
            onClick={() => onSelectStrong(item.strong)}
          >
            {item.strong}
          </Button>
          <strong className="text-sm">
            {item.auditKind === "empty" ? "Strong vide" : "relocation"}
            {item.groupAutoSafe ? " · groupe sûr" : ""}
          </strong>
        </div>
        {meta ? (
          <span className="text-muted-foreground text-xs">{meta}</span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {candidates.map((candidate) => (
          <LexicalCandidateChip
            key={lexicalCandidateKey(candidate)}
            item={item}
            candidate={candidate}
          />
        ))}
      </div>
    </section>
  );
}

function LexicalCandidateChip({
  item,
  candidate
}: {
  item: LexicalAuditItem;
  candidate: LexicalCandidate;
}) {
  const autoSafe = isLexicalAutoSafeCandidate(item, candidate);
  const groupAutoSafe = isLexicalGroupAutoSafeCandidate(item, candidate);
  const score = Math.round(candidate.score * 100);
  const scoreTone = lexicalScoreTone(score);
  const title = candidate.evidence
    ?.map((evidence) =>
      [displaySourceLabel(evidence.source), evidence.detail]
        .filter(Boolean)
        .join(" - ")
    )
    .join("\n");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "cursor-help gap-1 border px-2 py-1",
            scoreTone.container,
            (autoSafe || groupAutoSafe) && "ring-primary/60 ring-1"
          )}
        >
          <span className="text-muted-foreground font-mono">
            {lexicalCandidateTargetLabel(candidate)}
          </span>
          <span>{candidate.text}</span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0 font-mono text-[0.68rem] font-semibold",
              scoreTone.score
            )}
          >
            {score}%
          </span>
          {candidate.occupied ? (
            <span className="rounded-full border border-red-200/70 bg-red-500/30 px-1.5 py-0 font-semibold text-red-50">
              Occupé
            </span>
          ) : null}
        </Badge>
      </TooltipTrigger>
      {title ? (
        <TooltipContent className="max-w-sm whitespace-pre-line">
          {title}
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}

function lexicalScoreTone(score: number) {
  if (score >= 85) {
    return {
      container: "border-emerald-400/70 bg-emerald-500/15 text-emerald-100",
      score: "bg-emerald-400/20 text-emerald-50"
    };
  }
  if (score >= 70) {
    return {
      container: "border-lime-400/70 bg-lime-500/15 text-lime-100",
      score: "bg-lime-400/20 text-lime-50"
    };
  }
  if (score >= 50) {
    return {
      container: "border-amber-400/70 bg-amber-500/15 text-amber-100",
      score: "bg-amber-400/20 text-amber-50"
    };
  }
  if (score >= 25) {
    return {
      container: "border-orange-400/70 bg-orange-500/15 text-orange-100",
      score: "bg-orange-400/20 text-orange-50"
    };
  }
  return {
    container: "border-red-400/70 bg-red-500/15 text-red-100",
    score: "bg-red-400/20 text-red-50"
  };
}

function isDefaultVisibleLexicalCandidate(
  item: LexicalAuditItem,
  candidate: LexicalCandidate
) {
  if (item.groupAutoSafe) {
    return isLexicalGroupAutoSafeCandidate(item, candidate);
  }
  return (
    candidate.confidence === "high" &&
    (!candidate.occupied || isStackSafeLexicalCandidate(candidate))
  );
}

function isLexicalAutoSafeItem(item: LexicalAuditItem) {
  return (
    Boolean(item.groupAutoSafe) ||
    item.candidates.filter((candidate) =>
      isLexicalAutoSafeCandidate(item, candidate)
    ).length === 1
  );
}

function isLexicalGroupAutoSafeCandidate(
  item: LexicalAuditItem,
  candidate: LexicalCandidate
) {
  return (
    Boolean(item.groupAutoSafe) &&
    candidate.wordIndex === item.groupAutoSafe?.assignedWordIndex
  );
}

function isLexicalAutoSafeCandidate(
  item: LexicalAuditItem,
  candidate: LexicalCandidate
) {
  if (candidate.confidence !== "high") return false;
  if (candidate.occupied && !isStackSafeLexicalCandidate(candidate))
    return false;
  if (item.groupAutoSafe)
    return isLexicalGroupAutoSafeCandidate(item, candidate);
  return hasDirectLexicalEvidence(candidate);
}

function isStackSafeLexicalCandidate(candidate: LexicalCandidate) {
  return candidate.evidence?.some(
    (evidence) => evidence.source === "number-component"
  );
}

function hasDirectLexicalEvidence(candidate: LexicalCandidate) {
  return candidate.evidence?.some((evidence) =>
    [
      "seed-term",
      "seed-stem",
      "number-component",
      "kaikki-gloss",
      "proper-name-step",
      "proper-name-dictionary",
      "french-auxiliary-phrase",
      "wolf-synonym",
      "openoffice-synonym",
      "rezojdm-synonym"
    ].includes(evidence.source)
  );
}

function displaySourceLabel(value: string) {
  return value
    .replace(/\bSTEP\b/gi, "TAHOT/TAGNT")
    .replace(/\bstep\b/g, "TAHOT/TAGNT");
}

function splitStrongCodes(value: string | null | undefined) {
  const seen = new Set<string>();
  return (value ?? "")
    .split(/\s+/u)
    .map(normalizeStrongCode)
    .filter((code) => {
      if (!code || seen.has(code)) return false;
      seen.add(code);
      return true;
    });
}

function normalizeStrongCode(value: string) {
  const code = value.trim().toUpperCase();
  const match = code.match(/^([HG])0*(\d+)([A-Z]?)$/u);
  if (!match) return code;
  return `${match[1]}${match[2].padStart(4, "0")}${match[3] ?? ""}`;
}

function strongCodesEqual(left: string, right: string) {
  return normalizeStrongCode(left) === normalizeStrongCode(right);
}

function strongListIncludes(value: string | null | undefined, strong: string) {
  return splitStrongCodes(value).some((code) => strongCodesEqual(code, strong));
}

function inlineStrongLabel(strong: string) {
  return normalizeStrongCode(strong).replace(/^[HG]/u, "");
}

function lexicalCandidateTargetLabel(candidate: LexicalCandidate) {
  if (
    candidate.target === "phrase" &&
    candidate.startWordIndex !== undefined &&
    candidate.endWordIndex !== undefined
  ) {
    return `${candidate.startWordIndex}-${candidate.endWordIndex}`;
  }
  return String(candidate.wordIndex);
}

function lexicalCandidateKey(candidate: LexicalCandidate) {
  return [
    candidate.target,
    candidate.wordIndex,
    candidate.startWordIndex,
    candidate.endWordIndex,
    candidate.normalized,
    candidate.score,
    ...(candidate.evidence ?? []).map(
      (evidence) => `${evidence.source}:${evidence.detail ?? ""}`
    )
  ].join("|");
}

function decorateStrongHtml(html: string) {
  if (typeof document === "undefined" || !html.includes("<w")) return html;
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("w[strong]").forEach((node) => {
    if (node.querySelector("sup")) return;
    const strongCodes = splitStrongCodes(node.getAttribute("strong"));
    const compactStrong = strongCodes.map(inlineStrongLabel).join(" ");
    if (!strongCodes.length || !compactStrong) return;
    node.setAttribute("title", strongCodes.join(" "));
    node.setAttribute("tabindex", "0");
    node.setAttribute("role", "button");
    node.setAttribute("aria-label", `Inspecter ${strongCodes.join(" ")}`);
    const sup = document.createElement("sup");
    sup.textContent = compactStrong;
    node.append(sup);
  });
  return template.innerHTML;
}

function StrongInspector({
  strong,
  strongCodes,
  annotation,
  onStrongChange,
  onClear
}: {
  strong: string;
  strongCodes: string[];
  annotation?: StrongAnnotation;
  onStrongChange: (strong: string) => void;
  onClear: () => void;
}) {
  const [entry, setEntry] = useState<LexiconEntryPayload | null>(null);
  const normalizedStrong = normalizeStrongCode(strong);
  const activeStrongCodes =
    strongCodes.length > 0
      ? strongCodes
      : normalizedStrong
        ? [normalizedStrong]
        : [];
  const provenance = annotationProvenance(annotation);

  useEffect(() => {
    setEntry(null);
    if (!normalizedStrong) return;
    fetch(
      `/api/lexicon/search?q=${encodeURIComponent(normalizedStrong)}&limit=1`
    )
      .then((response) => response.json())
      .then(async (payload) => {
        const id = payload.rows?.[0]?.id;
        if (!id) return;
        const entryResponse = await fetch(`/api/lexicon/entry?id=${id}`);
        if (entryResponse.ok) setEntry(await entryResponse.json());
      })
      .catch(() => undefined);
  }, [normalizedStrong]);

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        {!normalizedStrong ? (
          <EmptyPanel
            icon={Sparkles}
            title="Inspecteur Strong"
            copy="Clique sur un tag Strong dans le texte pour voir sa source, son statut et le lexique."
          />
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>{normalizedStrong}</CardTitle>
                    <CardDescription>
                      {annotation?.source ?? "Source non trouvée"}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={onClear}>
                    Fermer
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {annotation?.placement ?? "placement inconnu"}
                  </Badge>
                  <Badge variant="outline" className={provenance.className}>
                    {provenance.label}
                  </Badge>
                  {annotation?.confidence !== undefined ? (
                    <Badge variant="outline">
                      {Math.round(annotation.confidence * 100)}% confiance
                    </Badge>
                  ) : null}
                </div>
                {activeStrongCodes.length > 1 ? (
                  <div className="flex flex-wrap gap-2">
                    {activeStrongCodes.map((code) => (
                      <Button
                        key={code}
                        type="button"
                        variant={
                          strongCodesEqual(code, normalizedStrong)
                            ? "secondary"
                            : "outline"
                        }
                        size="sm"
                        className="h-7 px-2 font-mono text-xs"
                        onClick={() => onStrongChange(code)}
                      >
                        {code}
                      </Button>
                    ))}
                  </div>
                ) : null}
                <p className="text-muted-foreground">
                  {annotation?.reason ??
                    "Aucun détail pour ce tag dans le chapitre courant."}
                </p>
                {annotation?.diagnostics?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {annotation.diagnostics.map((diagnostic) => (
                      <Badge
                        key={diagnostic}
                        variant="outline"
                        className="font-mono text-[0.68rem]"
                      >
                        {diagnostic}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {provenance.consensusFiltered ? <ReviewProvenanceRail /> : null}
                {annotation?.referenceSupport?.length ? (
                  <div className="bg-muted/35 rounded-lg border p-3">
                    <span className="text-muted-foreground text-xs">
                      Témoins éditoriaux
                    </span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {annotation.referenceSupport.map((source) => (
                        <Badge key={source} variant="secondary">
                          {source}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {annotation?.step?.slice(0, 3).map((step) => (
                  <div
                    key={`${step.dStrong}-${step.tokenIndex}`}
                    className="rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong>{step.dStrong}</strong>
                      <Badge variant="outline">
                        {displaySourceLabel(step.source)}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1">{step.gloss}</p>
                  </div>
                ))}
                {annotation ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={reviewTraceHref(annotation)}>
                      <ExternalLink data-icon="inline-start" />
                      Voir dans le cockpit qualité
                    </a>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
            {entry ? <LexiconEntryCard payload={entry} compact /> : null}
          </>
        )}
      </div>
    </ScrollArea>
  );
}

function annotationProvenance(annotation?: StrongAnnotation) {
  const diagnostics = annotation?.diagnostics ?? [];
  if (
    diagnostics.includes("semantic-refill:llm-consensus-filtered") ||
    diagnostics.some((item) => item.includes("consensus-filtered"))
  ) {
    return {
      label: "LLM consensus filtré",
      className: "border-fuchsia-400/45 bg-fuchsia-500/12 text-fuchsia-100",
      consensusFiltered: true
    };
  }
  if (annotation?.source === "curated-override") {
    return {
      label: "Override curé",
      className: "border-orange-400/45 bg-orange-500/12 text-orange-100",
      consensusFiltered: false
    };
  }
  if (annotation?.source === "semantic-lexicon") {
    return {
      label: "Déterministe lexical",
      className: "border-emerald-400/45 bg-emerald-500/12 text-emerald-100",
      consensusFiltered: false
    };
  }
  if (annotation?.source === "original-complete") {
    return {
      label: "Original STEP",
      className: "border-violet-400/45 bg-violet-500/12 text-violet-100",
      consensusFiltered: false
    };
  }
  return {
    label: annotation?.source ?? "Provenance inconnue",
    className: "",
    consensusFiltered: false
  };
}

function ReviewProvenanceRail() {
  return (
    <div className="quality-trace rounded-lg border p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
        <Fingerprint className="size-3.5" />
        Chaîne de preuve
      </div>
      <ol className="grid gap-2">
        {REVIEW_PROVENANCE_STEPS.map(([index, label]) => (
          <li key={index} className="flex items-center gap-2 text-xs">
            <span className="quality-trace-index">{index}</span>
            <span>{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function reviewTraceHref(annotation: StrongAnnotation) {
  const params = new URLSearchParams({
    view: "review",
    bucket: annotationProvenance(annotation).consensusFiltered
      ? "accepted-safe"
      : "actionable",
    q: [annotation.id.split(":")[0], annotation.strong]
      .filter(Boolean)
      .join(" ")
  });
  return `/viewer/review.html?${params}`;
}

function LexiconView() {
  const [query, setQuery] = useState(
    () => new URLSearchParams(window.location.search).get("q") || "H0430"
  );
  const [rows, setRows] = useState<LexiconRow[]>([]);
  const [selected, setSelected] = useState<LexiconEntryPayload | null>(null);
  const [metadata, setMetadata] = useState<LexiconMetadata | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/lexicon/metadata")
      .then((response) => {
        if (!response.ok)
          throw new Error("Métadonnées du lexique indisponibles");
        return response.json() as Promise<LexiconMetadata>;
      })
      .then(setMetadata)
      .catch((error) =>
        toast.error(
          error instanceof Error ? error.message : "Lexique indisponible"
        )
      );
  }, []);

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/lexicon/search?q=${encodeURIComponent(query)}&limit=40`)
        .then((response) => {
          if (!response.ok) throw new Error("Recherche lexicale indisponible");
          return response.json();
        })
        .then((payload) => {
          if (cancelled) return undefined;
          setRows(payload.rows ?? []);
          const first = payload.rows?.[0];
          if (first) return fetch(`/api/lexicon/entry?id=${first.id}`);
        })
        .then((response) => (response?.ok ? response.json() : undefined))
        .then((payload) => {
          if (payload && !cancelled) setSelected(payload);
        })
        .catch((error) =>
          !cancelled
            ? toast.error(
                error instanceof Error ? error.message : "Recherche impossible"
              )
            : undefined
        )
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query]);

  return (
    <section className="grid h-dvh min-h-0 grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="border-border/70 bg-card/60 min-h-0 border-b xl:border-r xl:border-b-0">
        <div className="flex h-full flex-col gap-4 p-4">
          <div>
            <Badge variant="outline">
              {metadata?.releaseKey ?? "Lexique STEP EN-FR"}
            </Badge>
            <h2 className="mt-2 text-2xl font-semibold">Lexique</h2>
            <p className="text-muted-foreground text-sm">
              Recherche dans {metadata?.entries.toLocaleString("fr-FR") ?? "…"}
              {" entrées STEP avec "}
              {metadata?.translationsFr.toLocaleString("fr-FR") ?? "…"}
              {" traductions françaises"}
              {metadata?.resourcesIncluded
                ? ` et ${metadata.resourceEntries.toLocaleString("fr-FR")} notices complémentaires bilingues.`
                : "."}
              {metadata?.tipnrEntities
                ? ` Contexte TIPNR : ${metadata.tipnrEntities.toLocaleString("fr-FR")} entités.`
                : ""}
            </p>
          </div>
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-3" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder="H0430, Dieu, logos..."
            />
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-2 pr-3">
              {loading ? (
                <p className="text-muted-foreground text-sm">Recherche...</p>
              ) : null}
              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={async () => {
                    const response = await fetch(
                      `/api/lexicon/entry?id=${row.id}`
                    );
                    if (response.ok) setSelected(await response.json());
                  }}
                  className={cn(
                    "hover:bg-muted rounded-lg border p-3 text-left transition",
                    selected?.entry.id === row.id &&
                      "border-primary/40 bg-primary/10"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong>{row.eStrong}</strong>
                    <Badge variant="secondary">{row.language}</Badge>
                  </div>
                  <p className="mt-1 truncate text-sm">
                    {row.glossFr || row.glossEn}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {row.transliteration || row.original}
                  </p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </aside>
      <ScrollArea className="min-h-0">
        <div className="p-4">
          {selected ? (
            <LexiconEntryCard payload={selected} />
          ) : (
            <EmptyPanel
              icon={Database}
              title="Aucune entrée"
              copy="Lance une recherche pour afficher une fiche lexicale."
            />
          )}
        </div>
      </ScrollArea>
    </section>
  );
}

function LexiconEntryCard({
  payload,
  compact = false
}: {
  payload: LexiconEntryPayload;
  compact?: boolean;
}) {
  const entry = payload.entry;
  const identity = payload.identity;
  const stepCode =
    identity?.stepCode || entry.dStrong.split(/\s+/u)[0] || entry.eStrong;
  const sourceLabel =
    entry.language === "greek"
      ? "STEP TBESG · Abbott-Smith"
      : "STEP TBESH · BDB abrégé";
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className={compact ? "text-lg" : "text-3xl"}>
              {stepCode}
            </CardTitle>
            <CardDescription>
              {identity?.relationLabelFr && identity.relatedStepCode ? (
                <>
                  {identity.relationLabelFr} {identity.relatedStepCode}
                  {" · "}
                  {identity.relationLabelEn} {identity.relatedStepCode}
                </>
              ) : (
                <>Strong classique {entry.eStrong}</>
              )}
              {entry.morph ? ` · ${entry.morph}` : ""}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {stepCode !== entry.eStrong ? (
              <Badge variant="outline">Strong {entry.eStrong}</Badge>
            ) : null}
            <Badge>{entry.language}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-3 md:grid-cols-2">
          <InfoBlock label="Original" value={entry.original} />
          <InfoBlock
            label="Translittération"
            value={entry.transliteration || entry.classicTransliteration}
          />
        </div>
        <section className="overflow-hidden rounded-xl border">
          <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">Sens principal STEP</h3>
              <p className="text-muted-foreground text-xs">{sourceLabel}</p>
            </div>
            <Badge variant="outline">{stepCode}</Badge>
          </div>
          <div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
            <LexiconLanguagePanel
              language="Français"
              locale="FR"
              gloss={entry.glossFr}
              html={
                entry.meaningHtmlFr ||
                entry.meaningSimpleFr ||
                "<p>Aucune définition française.</p>"
              }
            />
            <LexiconLanguagePanel
              language="English"
              locale="EN"
              gloss={entry.glossEn}
              html={entry.meaningEn || "<p>No English definition.</p>"}
            />
          </div>
        </section>
        {!compact && (payload.tipnrEntities ?? []).length > 0 ? (
          <TipnrEntityContexts payload={payload} />
        ) : null}
        {!compact && payload.resources.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-semibold">
                Dictionnaires complémentaires
              </h3>
              <p className="text-muted-foreground text-xs">
                Chaque notice reste attribuée à sa source et est disponible dans
                les deux langues.
              </p>
            </div>
            {payload.resources.slice(0, 5).map((resource) => (
              <details
                key={lexiconResourceKey(resource)}
                className="group overflow-hidden rounded-xl border"
              >
                <summary className="bg-muted/20 flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition hover:bg-muted/40">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="text-muted-foreground size-4 transition-transform group-open:rotate-90" />
                    <strong className="text-sm">
                      {resource.source === "TFLSJ"
                        ? "LSJ complet"
                        : resource.source}
                    </strong>
                    <Badge variant="secondary">FR + EN</Badge>
                  </div>
                  <Badge variant="outline">{resource.kind}</Badge>
                </summary>
                <div className="grid border-t md:grid-cols-2 md:divide-x">
                  <LexiconLanguagePanel
                    language="Français"
                    locale="FR"
                    gloss=""
                    html={
                      resource.contentHtmlFr ||
                      "<p>Traduction indisponible.</p>"
                    }
                  />
                  <LexiconLanguagePanel
                    language="English"
                    locale="EN"
                    gloss=""
                    html={resource.contentHtml || "<p>Content unavailable.</p>"}
                  />
                </div>
              </details>
            ))}
          </div>
        ) : null}
        {!compact ? <LegacyLexiconComparison payload={payload} /> : null}
      </CardContent>
    </Card>
  );
}

function LexiconLanguagePanel({
  language,
  locale,
  gloss,
  html
}: {
  language: string;
  locale: "FR" | "EN";
  gloss: string;
  html: string;
}) {
  return (
    <article className="min-w-0 p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">
          {language}
        </span>
        <Badge variant={locale === "FR" ? "default" : "outline"}>
          {locale}
        </Badge>
      </div>
      {gloss ? <p className="mb-4 text-lg font-semibold">{gloss}</p> : null}
      <div
        className="prose-strong min-w-0 text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}

function TipnrEntityContexts({ payload }: { payload: LexiconEntryPayload }) {
  return (
    <div className="flex flex-col gap-3">
      {(payload.tipnrEntities ?? []).map((entity) => (
        <section
          key={entity.id}
          className="overflow-hidden rounded-xl border border-sky-400/30 bg-sky-500/5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-400/20 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">
                Contexte encyclopédique STEP
              </h3>
              <p className="text-muted-foreground text-xs">
                {entity.matchKind === "uStrong-exact"
                  ? "TIPNR · entité reliée exactement par uStrong"
                  : "TIPNR · entité reliée au Strong classique correspondant"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">FR + EN</Badge>
              <Badge variant="outline">{entity.matchedStrong}</Badge>
            </div>
          </div>
          <div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
            <TipnrLanguagePanel entity={entity} locale="FR" />
            <TipnrLanguagePanel entity={entity} locale="EN" />
          </div>
          {entity.articleHtmlFr || entity.articleHtmlEn ? (
            <details className="group border-t border-sky-400/20">
              <summary className="bg-sky-500/5 flex cursor-pointer list-none items-center gap-2 px-4 py-3 transition hover:bg-sky-500/10">
                <ChevronRight className="text-muted-foreground size-4 transition-transform group-open:rotate-90" />
                <span className="text-sm font-semibold">
                  Notice détaillée TIPNR
                </span>
              </summary>
              <div className="grid border-t border-sky-400/20 md:grid-cols-2 md:divide-x">
                <LexiconLanguagePanel
                  language="Français"
                  locale="FR"
                  gloss=""
                  html={prepareTipnrHtml(
                    entity.articleHtmlFr ||
                      "<p>Traduction française indisponible.</p>"
                  )}
                />
                <LexiconLanguagePanel
                  language="English"
                  locale="EN"
                  gloss=""
                  html={prepareTipnrHtml(
                    entity.articleHtmlEn ||
                      "<p>English article unavailable.</p>"
                  )}
                />
              </div>
            </details>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function TipnrLanguagePanel({
  entity,
  locale
}: {
  entity: LexiconEntryPayload["tipnrEntities"][number];
  locale: "FR" | "EN";
}) {
  const french = locale === "FR";
  const displayName = french ? entity.displayNameFr : entity.displayNameEn;
  const description = french ? entity.descriptionFr : entity.descriptionEn;
  const shortDescription = french
    ? entity.shortDescriptionFr
    : entity.shortDescriptionEn;
  const summaryHtml = french ? entity.summaryHtmlFr : entity.summaryHtmlEn;
  const brief = cleanTipnrText(french ? entity.briefFr : entity.briefEn);

  return (
    <article className="min-w-0 p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">
          {french ? "Français" : "English"}
        </span>
        <Badge variant={french ? "default" : "outline"}>{locale}</Badge>
      </div>
      <p className="text-lg font-semibold">{displayName || "—"}</p>
      {description && description !== displayName ? (
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      ) : null}
      {shortDescription ? (
        <p className="mt-4 text-sm leading-relaxed">{shortDescription}</p>
      ) : null}
      {summaryHtml ? (
        <div
          className="prose-strong mt-4 min-w-0 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{
            __html: prepareTipnrHtml(summaryHtml)
          }}
        />
      ) : null}
      {brief && brief !== description ? (
        <p className="text-muted-foreground mt-4 border-t pt-3 text-xs">
          {brief}
        </p>
      ) : null}
    </article>
  );
}

function cleanTipnrText(value: string) {
  return value.trim().replace(/^@Brief=\s*/iu, "");
}

function prepareTipnrHtml(value: string) {
  return value
    .trim()
    .replace(/^#/u, "")
    .replace(/^3(?=\p{L})/u, "")
    .replace(/^@Brief=\s*/iu, "")
    .replace(
      /<strong="([HG]\d{4,5}[A-Z]*)">([\s\S]*?)<\/strong>/giu,
      (_match, strong: string, label: string) =>
        `<a href="/viewer/lexicon.html?q=${encodeURIComponent(strong)}">${label}</a>`
    );
}

function LegacyLexiconComparison({
  payload
}: {
  payload: LexiconEntryPayload;
}) {
  const legacy = payload.legacy;
  if (!legacy) {
    return (
      <details className="group rounded-xl border border-dashed">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3">
          <ChevronRight className="text-muted-foreground size-4 transition-transform group-open:rotate-90" />
          <span className="text-sm font-semibold">Strong legacy français</span>
          <Badge variant="secondary">Introuvable</Badge>
        </summary>
        <p className="text-muted-foreground border-t px-4 py-3 text-sm">
          Aucune notice legacy ne correspond au Strong classique de cette entrée
          STEP.
        </p>
      </details>
    );
  }

  return (
    <details className="group overflow-hidden rounded-xl border border-amber-400/30 bg-amber-500/5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition hover:bg-amber-500/10">
        <div className="flex items-center gap-2">
          <ChevronRight className="text-muted-foreground size-4 transition-transform group-open:rotate-90" />
          <span className="text-sm font-semibold">Strong legacy français</span>
          <span className="text-muted-foreground text-xs">
            source historique séparée
          </span>
        </div>
        <Badge variant="outline">{legacy.strong}</Badge>
      </summary>
      <div className="border-t border-amber-400/20 p-4">
        <p className="mb-1 text-lg font-semibold">{legacy.word || "—"}</p>
        <p className="text-muted-foreground mb-3 text-xs">
          {legacy.original} · {legacy.phonetic} · {legacy.type}
        </p>
        {legacy.lsg ? (
          <div className="mb-3">
            <span className="text-muted-foreground block text-xs">
              Rendus LSG
            </span>
            <p className="text-sm">{legacy.lsg}</p>
          </div>
        ) : null}
        {legacy.originHtml ? (
          <div className="mb-3">
            <span className="text-muted-foreground block text-xs">Origine</span>
            <div
              className="prose-strong text-sm"
              dangerouslySetInnerHTML={{ __html: legacy.originHtml }}
            />
          </div>
        ) : null}
        <div
          className="prose-strong text-sm"
          dangerouslySetInnerHTML={{
            __html: legacy.definitionHtml || "<p>Aucune définition.</p>"
          }}
        />
      </div>
    </details>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-lg border p-3">
      <span className="text-muted-foreground block text-xs">{label}</span>
      <strong className="text-sm">{value || "—"}</strong>
    </div>
  );
}

function lexiconResourceKey(
  resource: LexiconEntryPayload["resources"][number]
) {
  const content =
    resource.contentHtmlFr || resource.contentTextFr || resource.contentHtml;
  return `${resource.source}|${resource.kind}|${content.length}|${content.slice(0, 80)}`;
}

function ReviewView() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const requestedBucket = params.get("bucket");
  const initialBucket = isStrongReviewBucket(requestedBucket)
    ? requestedBucket
    : "actionable";
  const [bucket, setBucket] = useState<StrongReviewBucket | "manual">(
    initialBucket
  );
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [offset, setOffset] = useState(0);
  const [summary, setSummary] = useState<StrongReviewSummary | null>(null);
  const [page, setPage] = useState<StrongReviewItemsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const limit = 36;

  useEffect(() => {
    let cancelled = false;
    loadStrongReviewSummary("nbs")
      .then((nextSummary) => {
        if (!cancelled) setSummary(nextSummary);
      })
      .catch(
        (error) =>
          !cancelled &&
          toast.error(
            error instanceof Error ? error.message : "Synthèse indisponible"
          )
      );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 220);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (bucket === "manual") {
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadStrongReviewItems({
      bible: "nbs",
      bucket,
      query: debouncedQuery,
      limit,
      offset
    })
      .then((nextPage) => {
        if (!cancelled) setPage(nextPage);
      })
      .catch(
        (error) =>
          !cancelled &&
          toast.error(
            error instanceof Error ? error.message : "Queue indisponible"
          )
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bucket, debouncedQuery, offset]);

  function selectBucket(next: StrongReviewBucket | "manual") {
    if (next === "manual") setLoading(false);
    setBucket(next);
    setOffset(0);
    const url = new URL(window.location.href);
    url.searchParams.set("bucket", next);
    if (query.trim()) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
  }

  if (bucket === "manual") {
    return (
      <div className="relative h-screen">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="absolute top-4 right-4 z-20"
          onClick={() => selectBucket("actionable")}
        >
          <ChevronLeft data-icon="inline-start" />
          Cockpit qualité
        </Button>
        <LegacyManualReviewPanel />
      </div>
    );
  }

  return (
    <section className="quality-shell flex min-h-screen flex-col lg:h-screen lg:min-h-0">
      <header className="quality-header border-border/70 border-b px-4 py-4 xl:px-6">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-emerald-400/30 bg-emerald-500/12 text-emerald-100">
                <LockKeyhole data-icon="inline-start" />
                Lecture seule
              </Badge>
              <Badge variant="outline">NBS · batch v2</Badge>
              <Badge variant="outline">
                {summary?.plan.adaptiveSecondModel
                  ? "Second modèle adaptatif"
                  : "Consensus strict"}
              </Badge>
            </div>
            <p className="quality-kicker mt-5">
              Quality control / Strong ledger
            </p>
            <h2 className="quality-title mt-1">
              La preuve avant la promotion.
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
              Les dérives courantes et les consensus retenus remontent ici. Les
              archives quarantinées restent séparées pour ne pas recréer une
              montagne de revue manuelle inutile.
            </p>
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2 2xl:w-[640px] 2xl:grid-cols-4">
            <QualityPulse
              label="Drift production"
              value={summary?.drift.invalidProduction}
              tone="critical"
              detail="P0 · cible invalide"
            />
            <QualityPulse
              label="Témoin requis"
              value={summary?.decisions.needsWitnessReview}
              tone="warn"
              detail="P1 · consensus retenu"
            />
            <QualityPulse
              label="Consensus filtrés"
              value={summary?.production.consensusFiltered}
              tone="good"
              detail="promus production"
            />
            <QualityPulse
              label="Planifiés"
              value={summary?.plan.items}
              tone="neutral"
              detail={`${summary?.plan.tasks ?? 0} tâches stables`}
            />
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-border/70 bg-card/55 border-b p-4 xl:min-h-0 xl:border-r xl:border-b-0">
          <div className="flex h-full flex-col gap-5">
            <section>
              <p className="quality-section-label">Flux</p>
              <div className="mt-2 grid gap-2">
                <QualityBucketButton
                  active={bucket === "actionable"}
                  icon={ShieldAlert}
                  label="Actionnable"
                  copy="Dérives P0 + témoins P1"
                  count={
                    (summary?.drift.invalidProduction ?? 0) +
                    (summary?.decisions.needsWitnessReview ?? 0)
                  }
                  onClick={() => selectBucket("actionable")}
                />
                <QualityBucketButton
                  active={bucket === "planned"}
                  icon={Bot}
                  label="Planifié"
                  copy="High ouverts, pas encore appelés"
                  count={summary?.plan.items}
                  onClick={() => selectBucket("planned")}
                />
                <QualityBucketButton
                  active={bucket === "accepted-safe"}
                  icon={CircleCheckBig}
                  label="Accepté sûr"
                  copy="Journal post-consensus"
                  count={summary?.decisions.acceptedSafe}
                  onClick={() => selectBucket("accepted-safe")}
                />
                <QualityBucketButton
                  active={bucket === "quarantined"}
                  icon={Archive}
                  label="Quarantaine"
                  copy="Archive exclue de production"
                  count={summary?.quarantine.total}
                  onClick={() => selectBucket("quarantined")}
                />
              </div>
            </section>

            <section>
              <p className="quality-section-label">Recherche</p>
              <div className="relative mt-2">
                <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 size-4" />
                <Input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setOffset(0);
                  }}
                  className="pl-8"
                  placeholder="Gen.14.12, H3876, stacking…"
                />
              </div>
            </section>

            <section className="quality-gate rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <LockKeyhole className="size-4 text-emerald-300" />
                Gate production fermé
              </div>
              <p className="text-muted-foreground mt-2 text-xs leading-5">
                Cette vue n’applique rien. Toute promotion moderne repasse par
                deux modèles distincts, le filtre lexical v2 et la transaction
                du batch.
              </p>
            </section>

            <Button
              type="button"
              variant="ghost"
              className="mt-auto justify-start"
              onClick={() => selectBucket("manual")}
            >
              <FileJson data-icon="inline-start" />
              Ouvrir la revue humaine legacy
            </Button>
          </div>
        </aside>

        <ScrollArea className="min-h-0">
          <div className="p-4 xl:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="quality-section-label">
                  {qualityBucketEyebrow(bucket)}
                </p>
                <h3 className="mt-1 text-xl font-semibold">
                  {qualityBucketTitle(bucket)}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {page?.total.toLocaleString("fr-FR") ?? "—"} résultats
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  title="Recharger"
                  onClick={() => {
                    setPage(null);
                    setOffset((value) => value);
                    loadStrongReviewSummary("nbs").then(setSummary);
                    loadStrongReviewItems({
                      bible: "nbs",
                      bucket,
                      query: debouncedQuery,
                      limit,
                      offset
                    }).then(setPage);
                  }}
                >
                  <RefreshCw />
                </Button>
              </div>
            </div>

            {loading ? (
              <EmptyPanel
                icon={Loader2}
                title="Chargement de la preuve"
                copy="Lecture du ledger de décisions et de l’audit des overrides."
              />
            ) : !page || page.items.length === 0 ? (
              <EmptyPanel
                icon={Search}
                title="Aucun cas"
                copy="Aucun élément ne correspond à ce flux et à cette recherche."
              />
            ) : (
              <div className="grid gap-3 2xl:grid-cols-2">
                {page.items.map((item, index) => (
                  <QualityReviewCard key={item.id} item={item} index={index} />
                ))}
              </div>
            )}

            {page && page.total > limit ? (
              <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border p-3">
                <span className="text-muted-foreground text-xs">
                  {offset + 1}–{Math.min(offset + limit, page.total)} sur{" "}
                  {page.total}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                  >
                    <ChevronLeft />
                    Précédent
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={offset + limit >= page.total}
                    onClick={() => setOffset(offset + limit)}
                  >
                    Suivant
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </section>
  );
}

function QualityPulse({
  label,
  value,
  detail,
  tone
}: {
  label: string;
  value?: number;
  detail: string;
  tone: "critical" | "warn" | "good" | "neutral";
}) {
  return (
    <div className={cn("quality-pulse", `quality-pulse-${tone}`)}>
      <span className="quality-pulse-label">{label}</span>
      <strong>{value?.toLocaleString("fr-FR") ?? "—"}</strong>
      <span>{detail}</span>
    </div>
  );
}

function QualityBucketButton({
  active,
  icon: Icon,
  label,
  copy,
  count,
  onClick
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  copy: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("quality-bucket", active && "quality-bucket-active")}
    >
      <span className="quality-bucket-icon">
        <Icon />
      </span>
      <span className="min-w-0 flex-1">
        <strong>{label}</strong>
        <small>{copy}</small>
      </span>
      <span className="quality-bucket-count">
        {count?.toLocaleString("fr-FR") ?? "—"}
      </span>
    </button>
  );
}

function QualityReviewCard({
  item,
  index
}: {
  item: StrongReviewDashboardItem;
  index: number;
}) {
  const models = item.models?.length
    ? item.models
    : modelsFromConsensusLabel(item.model);
  const target = qualityTargetLabel(item.target);
  return (
    <article
      className={cn(
        "quality-review-card",
        `quality-tier-${item.priority.tier}`
      )}
      style={{ animationDelay: `${Math.min(index, 10) * 32}ms` }}
    >
      <div className="quality-card-rail" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="quality-priority">{item.priority.tier}</span>
            <Badge variant="outline">{qualityKindLabel(item)}</Badge>
            <Badge variant="secondary">{item.status}</Badge>
          </div>
          <h4 className="mt-3 flex flex-wrap items-center gap-2 text-lg font-semibold">
            {item.ref}
            {item.strong.map((strong) => (
              <span key={strong} className="quality-strong-code">
                {strong}
              </span>
            ))}
          </h4>
        </div>
        <ProductionStateBadge value={item.productionState} />
      </div>

      <p className="text-muted-foreground mt-3 line-clamp-3 text-sm leading-6">
        {item.reason}
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <QualityDatum label="Cible" value={target || "—"} />
        <QualityDatum
          label="Confiance"
          value={
            item.confidence === undefined
              ? "—"
              : `${Math.round(item.confidence * 100)}%`
          }
        />
        <QualityDatum
          label="Preuve directe"
          value={item.directDeterministicSupport ? "Oui" : "Non / absente"}
        />
        <QualityDatum
          label="Familles témoins"
          value={item.exactWitnessFamilies?.join(" · ") || "—"}
        />
      </div>

      {models.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Bot className="text-muted-foreground size-4" />
          {models.map((model) => (
            <Badge
              key={model}
              variant="outline"
              className="font-mono text-[0.68rem]"
            >
              {model}
            </Badge>
          ))}
        </div>
      ) : null}

      {item.priority.reasons.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.priority.reasons.map((reason) => (
            <span key={reason} className="quality-reason-chip">
              {reason}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3">
        <span className="text-muted-foreground truncate font-mono text-[0.68rem]">
          {item.source ?? item.stage ?? item.taskId ?? item.id}
        </span>
        <Button asChild type="button" variant="outline" size="sm">
          <a href={ledgerHref(item.ref, item.strong[0])}>
            Voir le verset
            <ExternalLink />
          </a>
        </Button>
      </div>
    </article>
  );
}

function QualityDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="quality-datum">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProductionStateBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const applied = normalized === "applied-production";
  const acceptedNotApplied = normalized === "accepted-safe-not-applied";
  const quarantined = normalized.includes("quarant");
  return (
    <Badge
      variant="outline"
      className={cn(
        applied && "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
        acceptedNotApplied && "border-sky-400/40 bg-sky-500/10 text-sky-100",
        quarantined && "border-slate-400/35 bg-slate-500/10 text-slate-200"
      )}
    >
      {applied || acceptedNotApplied ? (
        <CircleCheckBig data-icon="inline-start" />
      ) : (
        <CircleAlert data-icon="inline-start" />
      )}
      {productionStateLabel(value)}
    </Badge>
  );
}

function productionStateLabel(value: string) {
  if (value === "applied-production") return "Appliqué production";
  if (value === "accepted-safe-not-applied") return "Accepté · non appliqué";
  if (value === "drifted-production") return "Dérive production";
  if (value === "pending-review") return "Témoin requis";
  if (value === "not-applied") return "Non appliqué";
  if (value === "quarantined") return "Quarantaine";
  return value;
}

function isStrongReviewBucket(
  value: string | null
): value is StrongReviewBucket {
  return [
    "actionable",
    "needs-witness-review",
    "accepted-safe",
    "drifted",
    "planned",
    "quarantined"
  ].includes(value ?? "");
}

function qualityBucketEyebrow(bucket: StrongReviewBucket) {
  if (bucket === "actionable") return "P0 + P1 / maintenant";
  if (bucket === "planned") return "P2 / prochain batch";
  if (bucket === "accepted-safe") return "Trace durable / post-consensus";
  if (bucket === "quarantined") return "P3 / archive fermée";
  return bucket;
}

function qualityBucketTitle(bucket: StrongReviewBucket) {
  if (bucket === "actionable")
    return "Ce qui mérite réellement un regard humain";
  if (bucket === "planned") return "Résiduels prêts pour le batch adaptatif";
  if (bucket === "accepted-safe") return "Décisions prouvées par le pipeline";
  if (bucket === "quarantined")
    return "Anciennes décisions exclues de production";
  if (bucket === "drifted") return "Cibles qui ont dérivé";
  return "Consensus en attente de témoin";
}

function qualityKindLabel(item: StrongReviewDashboardItem) {
  if (item.kind === "override") return "Override";
  if (item.taskId) return `Plan · ${item.kind}`;
  return `Décision · ${item.kind}`;
}

function qualityTargetLabel(target: StrongReviewDashboardItem["target"]) {
  if (!target) return "";
  if (typeof target === "string") return target;
  if (target.label) return target.label;
  if (target.type === "phrase") {
    return `phrase ${target.startWordIndex ?? "?"}–${target.endWordIndex ?? "?"}`;
  }
  return [target.type, target.wordIndex, target.normalized]
    .filter((value) => value !== undefined && value !== "")
    .join(" · ");
}

function modelsFromConsensusLabel(model?: string) {
  const match = model?.match(/^consensus\((.*)\)(?:\+.*)?$/u);
  return match?.[1]
    ? match[1].split(",").flatMap((item) => {
        const normalized = item.trim();
        return normalized ? [normalized] : [];
      })
    : [];
}

function ledgerHref(ref: string, strong?: string) {
  const [book = "Gen", chapter = "1"] = ref.split(".");
  const params = new URLSearchParams({
    view: "viewer",
    book,
    chapter,
    q: strong ?? ref
  });
  return `/viewer/?${params}`;
}

function LegacyManualReviewPanel() {
  const [review, setReview] = useState<ReviewFile | null>(null);
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reviewPath = params.get("review");
    const manifestPath = params.get("manifest");
    if (manifestPath) {
      loadManifest(manifestPath)
        .then(setReview)
        .catch((error) => toast.error(String(error)));
      return;
    }
    if (reviewPath) {
      fetch(reviewPath)
        .then((response) => response.json())
        .then(setReview)
        .catch((error) => toast.error(String(error)));
    }
  }, []);

  const items = useMemo(() => {
    const needle = search.toLowerCase().trim();
    return (review?.items ?? []).filter((item) => {
      const decision = item.decision ?? "pending";
      if (filter !== "all" && decision !== filter) return false;
      if (!needle) return true;
      return [
        item.ref,
        item.strong,
        item.targetText,
        item.llmReason,
        item.reviewSource
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [filter, review, search]);

  const stats = useMemo(() => {
    const all = review?.items ?? [];
    return {
      total: all.length,
      accept: all.filter((item) => item.decision === "accept").length,
      reject: all.filter((item) => item.decision === "reject").length,
      pending: all.filter(
        (item) => !item.decision || item.decision === "pending"
      ).length
    };
  }, [review]);

  function updateItem(item: ReviewItem, patch: Partial<ReviewItem>) {
    if (!review) return;
    setReview({
      ...review,
      items: review.items.map((candidate) =>
        candidate === item ? { ...candidate, ...patch } : candidate
      )
    });
  }

  async function save() {
    if (!review) return;
    setSaving(true);
    try {
      const response = await fetch("/api/llm-review/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(review)
      });
      if (!response.ok) throw new Error("Sauvegarde impossible");
      toast.success("Décisions sauvegardées");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur de sauvegarde"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid h-screen min-h-0 grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="border-border/70 bg-card/60 border-b p-4 xl:border-r xl:border-b-0">
        <div className="flex h-full flex-col gap-4">
          <div>
            <Badge variant="outline">Legacy · validation humaine</Badge>
            <h2 className="mt-2 text-2xl font-semibold">Décisions manuelles</h2>
            <p className="text-muted-foreground text-sm">
              Réservé aux anciens fichiers human-approved. Ne charge jamais un
              artefact consensus v2 dans ce formulaire.
            </p>
          </div>
          <label className="border-border hover:bg-muted/50 flex cursor-pointer flex-col gap-2 rounded-lg border border-dashed p-4 text-sm">
            <FileJson />
            <span className="font-medium">Charger une revue JSON</span>
            <span className="text-muted-foreground text-xs">
              Fichier `llm-review-*.json`
            </span>
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setReview(JSON.parse(await file.text()) as ReviewFile);
              }}
            />
          </label>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pending">À voir</TabsTrigger>
              <TabsTrigger value="accept">OK</TabsTrigger>
              <TabsTrigger value="reject">Non</TabsTrigger>
              <TabsTrigger value="all">Tout</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Dan.12.1, H5975..."
          />
          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Total" value={stats.total} />
            <MiniStat label="À revoir" value={stats.pending} />
            <MiniStat label="Acceptées" value={stats.accept} />
            <MiniStat label="Rejetées" value={stats.reject} />
          </div>
          <Button disabled={!review || saving} onClick={save}>
            {saving ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <CheckCircle2 data-icon="inline-start" />
            )}
            Appliquer la revue humaine legacy
          </Button>
        </div>
      </aside>
      <ScrollArea className="min-h-0">
        <div className="flex flex-col gap-3 p-4">
          {!review ? (
            <EmptyPanel
              icon={GitCompareArrows}
              title="Aucune revue chargée"
              copy="Charge une revue LLM ou ouvre cette page avec un paramètre ?review= ou ?manifest=."
            />
          ) : items.length === 0 ? (
            <EmptyPanel
              icon={Search}
              title="Aucun item"
              copy="Aucun item ne correspond au filtre courant."
            />
          ) : (
            items.map((item) => (
              <Card key={legacyReviewItemKey(item)}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {item.ref}
                        <Badge>{item.strong}</Badge>
                      </CardTitle>
                      <CardDescription>
                        {String(
                          item.reviewSource ?? review.diagnosticsPath ?? ""
                        )}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={
                        item.decision === "accept" ? "default" : "secondary"
                      }
                    >
                      {item.decision ?? "pending"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <p className="rounded-lg border p-3 text-sm leading-7">
                    {item.text ??
                      item.verseText ??
                      item.context ??
                      "Aucun contexte textuel."}
                  </p>
                  <div className="grid gap-3 md:grid-cols-3">
                    <InfoBlock
                      label="Décision LLM"
                      value={String(item.llmDecision ?? "—")}
                    />
                    <InfoBlock
                      label="Mot cible"
                      value={String(
                        item.targetText ?? item.targetNormalized ?? "—"
                      )}
                    />
                    <InfoBlock
                      label="Index"
                      value={String(item.targetWordIndex ?? "—")}
                    />
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {item.llmReason ?? "Aucune raison LLM fournie."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => updateItem(item, { decision: "accept" })}
                    >
                      Accepter
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => updateItem(item, { decision: "pending" })}
                    >
                      À revoir
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateItem(item, { decision: "reject" })}
                    >
                      Rejeter
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </section>
  );
}

function legacyReviewItemKey(item: ReviewItem) {
  return [
    item.id,
    item.ref,
    item.strong,
    item.targetWordIndex,
    item.targetNormalized,
    item.reviewSource,
    item.llmDecision
  ]
    .filter((value) => value !== undefined && value !== "")
    .join("|");
}

async function loadManifest(path: string): Promise<ReviewFile> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Manifest inaccessible: ${path}`);
  const manifest = (await response.json()) as {
    reviews?: Array<{
      status?: string;
      reviewHref?: string;
      reviewPath?: string;
    }>;
  };
  const reviews: Array<{ review: ReviewFile; source: string }> =
    await Promise.all(
      (manifest.reviews ?? [])
        .filter((entry: { status?: string }) => entry.status !== "failed")
        .map(async (entry: { reviewHref?: string; reviewPath?: string }) => {
          const href = entry.reviewHref ?? `/${entry.reviewPath}`;
          const reviewResponse = await fetch(href);
          if (!reviewResponse.ok)
            throw new Error(`Revue inaccessible: ${href}`);
          return {
            review: (await reviewResponse.json()) as ReviewFile,
            source: href
          };
        })
    );
  const first = reviews[0]?.review;
  return {
    bible: first?.bible ?? "nbs",
    generatedAt: new Date().toISOString(),
    diagnosticsPath: path,
    decisionsPath: "",
    items: reviews.flatMap(({ review, source }) =>
      review.items.map((item) => ({ ...item, reviewSource: source }))
    )
  };
}

function EmptyPanel({
  icon: Icon,
  title,
  copy
}: {
  icon: LucideIcon;
  title: string;
  copy: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <div className="bg-muted flex size-12 items-center justify-center rounded-lg">
          <Icon />
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-muted-foreground mt-1 max-w-md text-sm">{copy}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function summarizeVerses(verses: StrongVerse[]) {
  const summary = {
    verses: verses.length,
    words: 0,
    referenceOcc: 0,
    referenceCarrier: 0,
    originalOcc: 0,
    originalCarrier: 0,
    empty: 0,
    risk: 0,
    referenceCarrierCoverage: 0,
    originalCarrierRate: 0
  };
  for (const verse of verses) {
    summary.words += verse.metrics.wordCount;
    summary.referenceOcc += verse.metrics.referenceStrongOccurrenceCount;
    summary.referenceCarrier += verse.metrics.referenceStrongCarrierCount;
    summary.originalOcc += verse.metrics.originalStrongOccurrenceCount;
    summary.originalCarrier += verse.metrics.originalStrongCarrierCount;
    summary.empty += verse.metrics.emptyStrongCount;
    summary.risk += verse.metrics.placementRiskCount;
  }
  summary.referenceCarrierCoverage =
    summary.referenceCarrier / Math.max(1, summary.referenceOcc);
  summary.originalCarrierRate =
    summary.originalCarrier / Math.max(1, summary.originalOcc);
  return summary;
}
