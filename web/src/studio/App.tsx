import {
  Archive,
  Bot,
  BookOpen,
  Bug,
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
  Network,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  type LucideIcon
} from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from "react";
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

const JsonlBibleView = lazy(() =>
  import("./JsonlBibleView").then((module) => ({
    default: module.JsonlBibleView
  }))
);
const WorkflowView = lazy(() =>
  import("./WorkflowView").then((module) => ({
    default: module.WorkflowView
  }))
);

const VIEW_NAVIGATION_EVENT = "bible-strong:navigate";

function subscribeToLocation(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(VIEW_NAVIGATION_EVENT, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(VIEW_NAVIGATION_EVENT, callback);
  };
}

function currentViewSnapshot() {
  return currentViewFromLocation() as ViewId;
}

function notifyNavigation() {
  window.dispatchEvent(new Event(VIEW_NAVIGATION_EVENT));
}

function ViewLoading() {
  return (
    <div className="text-muted-foreground flex min-h-[40dvh] items-center justify-center gap-2 text-sm">
      <Loader2 className="size-4 animate-spin" />
      Chargement de la vue…
    </div>
  );
}

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
    label: "Bibles",
    description: "Lire et comparer les 8 versions",
    icon: BookOpen
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
  const view = useSyncExternalStore(
    subscribeToLocation,
    currentViewSnapshot,
    () => "viewer" as ViewId
  );
  const [ledger, setLedger] = useState<StrongLedger | null>(null);
  const [ledgerPath, setLedgerPathState] = useState(
    () =>
      new URLSearchParams(window.location.search).get("file") ||
      window.localStorage.getItem("bible-strong:ledger-source") ||
      defaultLedgerPath()
  );
  const [loadingLedger, setLoadingLedger] = useState(false);

  useEffect(() => {
    if (view !== "viewer") {
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

  function setLedgerPath(path: string) {
    setLedgerPathState(path);
    window.localStorage.setItem("bible-strong:ledger-source", path);
  }

  function changeView(next: string) {
    window.localStorage.setItem("bible-strong:last-view", next);
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.pushState(null, "", url);
    notifyNavigation();
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
              <TabsList className="grid w-full grid-cols-4">
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
              {view === "viewer" ? (
                <LedgerStatus ledger={ledger} loading={loadingLedger} />
              ) : null}
            </div>

            <div
              className={cn(
                "mt-auto hidden flex-col gap-2 lg:flex",
                view !== "viewer" && "lg:hidden"
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
          {view === "jsonl" ? (
            <Suspense fallback={<ViewLoading />}>
              <JsonlBibleView renderLexiconEntry={renderBibleLexiconEntry} />
            </Suspense>
          ) : null}
          {view === "workflow" ? (
            <Suspense fallback={<ViewLoading />}>
              <WorkflowView />
            </Suspense>
          ) : null}
          {view === "lexicon" ? <LexiconView /> : null}
          {view === "review" ? <ReviewView /> : null}
        </main>
      </div>
    </div>
  );
}

function renderBibleLexiconEntry(
  payload: LexiconEntryPayload,
  options: { locale: "fr" | "en"; debug: boolean }
) {
  return (
    <LexiconEntryCard
      payload={payload}
      locale={options.locale}
      debug={options.debug}
    />
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

function returnToBibles() {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "jsonl");
  url.searchParams.delete("q");
  url.searchParams.delete("from");
  window.history.pushState(null, "", url);
  notifyNavigation();
}

function lexiconStepCode(row: LexiconRow) {
  return /^([GH]\d{4,5}[A-Z]?)/u.exec(row.dStrong.trim())?.[1] ?? row.eStrong;
}

const LEXICON_ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");
const LEXICON_PAGE_SIZE = 40;

function LexiconView() {
  const initialParams = new URLSearchParams(window.location.search);
  const [query, setQuery] = useState(
    () =>
      initialParams.get("q") ||
      window.localStorage.getItem("bible-strong:lexicon-query") ||
      ""
  );
  const [language, setLanguage] = useState(
    () => initialParams.get("language") || "all"
  );
  const [letter, setLetter] = useState(() => initialParams.get("letter") || "");
  const [page, setPage] = useState(() =>
    Math.max(1, Number(initialParams.get("page")) || 1)
  );
  const [contentLocale, setContentLocale] = useState<"fr" | "en">(() => {
    const value =
      initialParams.get("locale") ||
      window.localStorage.getItem("bible-strong:lexicon-locale");
    return value === "en" ? "en" : "fr";
  });
  const [debugMode, setDebugMode] = useState(
    () =>
      initialParams.get("debug") === "1" ||
      window.localStorage.getItem("bible-strong:lexicon-debug") === "1"
  );
  const [rows, setRows] = useState<LexiconRow[]>([]);
  const [selected, setSelected] = useState<LexiconEntryPayload | null>(null);
  const [metadata, setMetadata] = useState<LexiconMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const requestSerial = useRef(0);
  const entryRequestController = useRef<AbortController | null>(null);
  const entryCache = useRef(new Map<number, LexiconEntryPayload>());
  const cameFromBibles =
    new URLSearchParams(window.location.search).get("from") === "bibles";

  const loadEntry = useCallback(async (id: number) => {
    entryRequestController.current?.abort();
    const cachedEntry = entryCache.current.get(id);
    if (cachedEntry) {
      requestSerial.current += 1;
      entryCache.current.delete(id);
      entryCache.current.set(id, cachedEntry);
      setSelected(cachedEntry);
      setLoadingDetail(false);
      return;
    }
    const controller = new AbortController();
    entryRequestController.current = controller;
    const serial = ++requestSerial.current;
    setLoadingDetail(true);
    try {
      const response = await fetch(
        `/api/lexicon/entry?id=${id}&include=extended`,
        { signal: controller.signal }
      );
      if (!response.ok) throw new Error("Notice lexicale indisponible");
      const completeEntry = (await response.json()) as LexiconEntryPayload;
      if (serial === requestSerial.current) {
        entryCache.current.set(id, completeEntry);
        if (entryCache.current.size > 24) {
          const oldestId = entryCache.current.keys().next().value;
          if (oldestId !== undefined) entryCache.current.delete(oldestId);
        }
        setSelected(completeEntry);
      }
    } catch (error) {
      if (
        serial === requestSerial.current &&
        !(error instanceof Error && error.name === "AbortError")
      ) {
        toast.error(
          error instanceof Error ? error.message : "Notice indisponible"
        );
      }
    } finally {
      if (serial === requestSerial.current) {
        setLoadingDetail(false);
        entryRequestController.current = null;
      }
    }
  }, []);

  useEffect(
    () => () => {
      entryRequestController.current?.abort();
    },
    []
  );

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
    requestSerial.current += 1;
    entryRequestController.current?.abort();
    entryRequestController.current = null;
    setLoadingDetail(false);
    let cancelled = false;
    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      const normalized = query.trim();
      const url = new URL(window.location.href);
      if (normalized) url.searchParams.set("q", normalized);
      else url.searchParams.delete("q");
      if (language !== "all") url.searchParams.set("language", language);
      else url.searchParams.delete("language");
      if (letter) url.searchParams.set("letter", letter);
      else url.searchParams.delete("letter");
      if (page > 1) url.searchParams.set("page", String(page));
      else url.searchParams.delete("page");
      window.history.replaceState(null, "", url);
      window.localStorage.setItem("bible-strong:lexicon-query", normalized);
      setLoading(true);
      const params = new URLSearchParams({
        q: normalized,
        language,
        letter,
        limit: String(LEXICON_PAGE_SIZE),
        offset: String((page - 1) * LEXICON_PAGE_SIZE)
      });
      fetch(`/api/lexicon/search?${params}`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error("Recherche lexicale indisponible");
          return response.json();
        })
        .then((payload) => {
          if (cancelled) return undefined;
          setRows(payload.rows ?? []);
          const requestedEntry = new URL(window.location.href).searchParams.get(
            "entry"
          );
          const requestedRow = requestedEntry
            ? payload.rows?.find(
                (row: LexiconRow) => lexiconStepCode(row) === requestedEntry
              )
            : null;
          const initialRow = requestedRow || payload.rows?.[0];
          if (initialRow) void loadEntry(initialRow.id);
          else setSelected(null);
        })
        .catch((error) =>
          !cancelled && error instanceof Error && error.name !== "AbortError"
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
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [language, letter, loadEntry, page, query]);

  function selectRow(row: LexiconRow) {
    const url = new URL(window.location.href);
    url.searchParams.set("entry", lexiconStepCode(row));
    window.history.replaceState(null, "", url);
    void loadEntry(row.id);
  }

  function changeContentLocale(value: "fr" | "en") {
    setContentLocale(value);
    window.localStorage.setItem("bible-strong:lexicon-locale", value);
    const url = new URL(window.location.href);
    url.searchParams.set("locale", value);
    window.history.replaceState(null, "", url);
  }

  function changeDebugMode(value: boolean) {
    setDebugMode(value);
    window.localStorage.setItem(
      "bible-strong:lexicon-debug",
      value ? "1" : "0"
    );
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("debug", "1");
    else url.searchParams.delete("debug");
    window.history.replaceState(null, "", url);
  }

  return (
    <section className="flex h-dvh min-h-0 flex-col overflow-hidden">
      <header className="border-border/70 bg-card/65 shrink-0 border-b px-4 py-4 lg:px-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {cameFromBibles ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mb-1 -ml-2"
                  onClick={returnToBibles}
                >
                  <ChevronLeft data-icon="inline-start" />
                  Retour aux Bibles
                </Button>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold tracking-tight">
                  {contentLocale === "fr" ? "Lexique Strong" : "Strong Lexicon"}
                </h2>
                {debugMode ? (
                  <Badge variant="outline">
                    {metadata?.releaseKey ?? "STEP EN-FR"}
                  </Badge>
                ) : null}
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                {metadata?.entries.toLocaleString(
                  contentLocale === "fr" ? "fr-FR" : "en-US"
                ) ?? "…"}{" "}
                {contentLocale === "fr"
                  ? "mots documentés"
                  : "documented words"}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div
                className="bg-muted/60 flex rounded-lg border p-1"
                aria-label={
                  contentLocale === "fr"
                    ? "Langue du contenu"
                    : "Content language"
                }
              >
                {(["fr", "en"] as const).map((locale) => (
                  <button
                    key={locale}
                    type="button"
                    onClick={() => changeContentLocale(locale)}
                    aria-pressed={contentLocale === locale}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                      contentLocale === locale
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {locale.toUpperCase()}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant={debugMode ? "default" : "outline"}
                onClick={() => changeDebugMode(!debugMode)}
                aria-pressed={debugMode}
              >
                <Bug data-icon="inline-start" />
                {debugMode
                  ? contentLocale === "fr"
                    ? "Debug actif"
                    : "Debug on"
                  : contentLocale === "fr"
                    ? "Mode debug"
                    : "Debug mode"}
              </Button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[minmax(260px,520px)_170px_auto]">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-3" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                className="pl-9"
                placeholder={
                  contentLocale === "fr"
                    ? "Code Strong, mot français, grec ou hébreu"
                    : "Strong code, English, Greek or Hebrew word"
                }
              />
            </div>
            <Select
              value={language}
              onValueChange={(value) => {
                setLanguage(value);
                setPage(1);
              }}
            >
              <SelectTrigger
                aria-label={
                  contentLocale === "fr"
                    ? "Langue du lexique"
                    : "Lexicon language"
                }
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">
                    {contentLocale === "fr"
                      ? "Toutes les langues"
                      : "All languages"}
                  </SelectItem>
                  <SelectItem value="hebrew">
                    {contentLocale === "fr" ? "Hébreu" : "Hebrew"}
                  </SelectItem>
                  <SelectItem value="greek">
                    {contentLocale === "fr" ? "Grec" : "Greek"}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              type="button"
              onClick={() => {
                setLetter("");
                setPage(1);
              }}
            >
              {contentLocale === "fr" ? "Rechercher" : "Search"}
            </Button>
          </div>

          <div
            className="flex flex-wrap items-center gap-1"
            aria-label="Index alphabétique"
          >
            <button
              type="button"
              onClick={() => {
                setLetter("");
                setPage(1);
              }}
              className={cn(
                "hover:bg-muted rounded-md border px-2.5 py-1 text-xs font-semibold transition",
                !letter && "border-primary bg-primary text-primary-foreground"
              )}
            >
              A–Z
            </button>
            {LEXICON_ALPHABET.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setLetter(item);
                  setQuery("");
                  setPage(1);
                }}
                className={cn(
                  "hover:bg-muted size-7 rounded-md border text-xs font-semibold uppercase transition",
                  letter === item &&
                    "border-primary bg-primary text-primary-foreground"
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(520px,0.9fr)_minmax(0,1.6fr)]">
        <aside className="border-border/70 bg-card/35 flex min-h-0 flex-col border-b xl:border-r xl:border-b-0">
          <div className="bg-muted/40 text-muted-foreground grid grid-cols-[110px_150px_minmax(0,1fr)] gap-3 border-b px-4 py-2 text-[0.68rem] font-semibold tracking-wider uppercase">
            <span>{debugMode ? "Code STEP" : "Strong"}</span>
            <span>
              {contentLocale === "fr" ? "Translittération" : "Transliteration"}
            </span>
            <span>
              {contentLocale === "fr" ? "Sens français" : "English meaning"}
            </span>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="divide-border/60 divide-y">
              {loading ? (
                <div className="text-muted-foreground flex items-center gap-2 p-4 text-sm">
                  <Loader2 className="size-4 animate-spin" />
                  {contentLocale === "fr" ? "Recherche…" : "Searching…"}
                </div>
              ) : null}
              {!loading && rows.length === 0 ? (
                <p className="text-muted-foreground p-5 text-sm">
                  {contentLocale === "fr"
                    ? "Aucune entrée ne correspond à ces filtres."
                    : "No entry matches these filters."}
                </p>
              ) : null}
              {rows.map((row) => {
                const stepCode = lexiconStepCode(row);
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => selectRow(row)}
                    className={cn(
                      "hover:bg-muted/70 grid w-full grid-cols-[110px_150px_minmax(0,1fr)] gap-3 px-4 py-2.5 text-left text-sm transition",
                      selected?.entry.id === row.id &&
                        "bg-primary/10 shadow-[inset_3px_0_0_var(--primary)]"
                    )}
                  >
                    <span className="min-w-0">
                      <strong className="text-primary block">{stepCode}</strong>
                      {stepCode !== row.eStrong ? (
                        <small className="text-muted-foreground">
                          Strong {row.eStrong}
                        </small>
                      ) : null}
                    </span>
                    <span className="truncate">
                      {lexiconTransliteration(row) || row.original}
                    </span>
                    <span className="truncate">
                      {contentLocale === "fr"
                        ? row.glossFr || row.glossEn
                        : row.glossEn || row.glossFr}
                    </span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
          <footer className="flex items-center justify-between gap-3 border-t p-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft data-icon="inline-start" />
              {contentLocale === "fr" ? "Précédent" : "Previous"}
            </Button>
            <span className="text-muted-foreground text-xs">Page {page}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={rows.length < LEXICON_PAGE_SIZE || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              {contentLocale === "fr" ? "Suivant" : "Next"}{" "}
              <ChevronRight data-icon="inline-end" />
            </Button>
          </footer>
        </aside>

        <ScrollArea className="min-h-0">
          <div className="p-4">
            {loading || loadingDetail ? (
              <LexiconEntryLoader locale={contentLocale} />
            ) : selected ? (
              <LexiconEntryCard
                payload={selected}
                locale={contentLocale}
                debug={debugMode}
              />
            ) : (
              <EmptyPanel
                icon={Database}
                title={contentLocale === "fr" ? "Aucune entrée" : "No entry"}
                copy={
                  contentLocale === "fr"
                    ? "Lance une recherche pour afficher une fiche lexicale."
                    : "Search to display a lexical entry."
                }
              />
            )}
          </div>
        </ScrollArea>
      </div>
    </section>
  );
}

function LexiconEntryLoader({ locale }: { locale: "fr" | "en" }) {
  const french = locale === "fr";
  return (
    <div
      className="border-border/70 bg-card/70 flex min-h-[420px] items-center justify-center overflow-hidden rounded-xl border"
      role="status"
      aria-live="polite"
    >
      <div className="relative flex max-w-md flex-col items-center px-8 text-center">
        <div className="bg-primary/10 absolute size-36 animate-pulse rounded-full blur-3xl" />
        <div className="border-primary/20 bg-background relative mb-5 grid size-14 place-items-center rounded-full border shadow-lg">
          <Loader2 className="text-primary size-6 animate-spin" />
        </div>
        <p className="font-serif text-xl font-semibold">
          {french
            ? "Chargement de la fiche complète"
            : "Loading the complete entry"}
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {french
            ? "Définition, contexte, grammaire, relations et occurrences sont récupérés ensemble."
            : "Definition, context, grammar, relationships and occurrences are loaded together."}
        </p>
      </div>
    </div>
  );
}

function LexiconEntryCard({
  payload,
  compact = false,
  locale = "fr",
  debug = false
}: {
  payload: LexiconEntryPayload;
  compact?: boolean;
  locale?: "fr" | "en";
  debug?: boolean;
}) {
  const entry = payload.entry;
  const identity = payload.identity;
  const french = locale === "fr";
  const stepCode =
    identity?.stepCode || entry.dStrong.split(/\s+/u)[0] || entry.eStrong;
  const gloss = french ? entry.glossFr || entry.glossEn : entry.glossEn;
  const meaning = french
    ? entry.meaningHtmlFr ||
      entry.meaningSimpleFr ||
      "<p>Aucune définition française disponible.</p>"
    : entry.meaningEn || "<p>No English definition available.</p>";
  const transliteration = lexiconTransliteration(entry);
  const resources = payload.resources ?? [];
  const substantiveResources = resources.filter(
    (resource) => !isMissingLsjFallback(resource)
  );
  const lsjAbsent = resources.some(isMissingLsjFallback);
  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardContent className="flex flex-col gap-4 p-0">
        <details open className="lexicon-panel">
          <summary className="lexicon-panel-summary flex-wrap">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <ChevronRight className="lexicon-panel-chevron" />
              <h3 className="lexicon-panel-title">
                {french ? "Mot et identité" : "Word and identity"}
              </h3>
              <Badge variant="outline">{stepCode}</Badge>
              {stepCode !== entry.eStrong ? (
                <Badge variant="secondary">Strong {entry.eStrong}</Badge>
              ) : null}
              <Badge variant="secondary">
                {entry.language === "hebrew"
                  ? french
                    ? "hébreu"
                    : "Hebrew"
                  : french
                    ? "grec"
                    : "Greek"}
              </Badge>
            </div>
          </summary>
          <CardHeader className="lexicon-panel-content block bg-[linear-gradient(135deg,var(--color-muted),transparent_42%)] p-5 md:p-6">
            <div className="flex max-w-2xl flex-col items-start gap-5 text-left">
              {gloss ? (
                <div className="w-full">
                  <CardDescription className="mb-1.5 text-xs font-medium uppercase tracking-[0.16em]">
                    {french ? "Sens principal" : "Main sense"}
                  </CardDescription>
                  <p className="text-xl font-semibold tracking-tight">
                    {gloss}
                  </p>
                  {debug ? (
                    <DebugFieldTag
                      source={
                        french && entry.glossFr
                          ? "LEXIQUE_FR.LexiconTranslations.gloss"
                          : "LEXIQUE_STEP.StepEntries.gloss"
                      }
                    />
                  ) : null}
                </div>
              ) : null}

              <div className="w-full border-t pt-5">
                <CardDescription className="mb-2 text-xs font-medium uppercase tracking-[0.16em]">
                  {french ? "Mot original" : "Original word"}
                </CardDescription>
                <CardTitle
                  className={cn(
                    "text-left font-serif tracking-tight",
                    compact ? "text-2xl" : "text-4xl"
                  )}
                  dir="auto"
                >
                  {entry.original}
                </CardTitle>
                {debug ? (
                  <DebugFieldTag source="LEXIQUE_STEP.StepEntries.original" />
                ) : null}
              </div>

              {transliteration || entry.pronunciation ? (
                <dl className="flex w-full flex-col gap-3 border-t pt-5 text-sm">
                  {transliteration ? (
                    <div className="flex flex-col items-start gap-0.5">
                      <dt className="text-muted-foreground text-xs">
                        {french ? "Translittération" : "Transliteration"}
                      </dt>
                      <dd className="font-medium">{transliteration}</dd>
                      {debug ? (
                        <DebugFieldTag
                          source={
                            entry.classicTransliteration
                              ? "LEXIQUE_STEP.StepEntries.classicTransliteration"
                              : "LEXIQUE_STEP.StepEntries.transliteration"
                          }
                        />
                      ) : null}
                    </div>
                  ) : null}
                  {entry.pronunciation ? (
                    <div className="flex flex-col items-start gap-0.5">
                      <dt className="text-muted-foreground text-xs">
                        {french ? "Prononciation" : "Pronunciation"}
                      </dt>
                      <dd className="font-medium">{entry.pronunciation}</dd>
                      {debug ? (
                        <DebugFieldTag source="LEXIQUE_STEP.StepEntries.pronunciation" />
                      ) : null}
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </div>
          </CardHeader>
        </details>
        <details open className="lexicon-panel">
          <summary className="lexicon-panel-summary justify-start">
            <ChevronRight className="lexicon-panel-chevron" />
            <h3 className="lexicon-panel-title">
              {french ? "Définition" : "Definition"}
            </h3>
          </summary>
          <div className="lexicon-panel-content p-4 md:p-5">
            <div
              className="prose-strong min-w-0 text-[0.95rem] leading-7"
              dangerouslySetInnerHTML={{ __html: meaning }}
            />
            {debug ? (
              <DebugFieldTag
                source={
                  french && entry.meaningHtmlFr
                    ? "LEXIQUE_FR.LexiconTranslations.meaningHtml"
                    : french && entry.meaningSimpleFr
                      ? "LEXIQUE_FR.LexiconTranslations.meaning"
                      : "LEXIQUE_STEP.StepEntries.meaning"
                }
              />
            ) : null}
          </div>
        </details>
        {!compact && (payload.tipnrEntities ?? []).length > 0 ? (
          <TipnrEntityContexts
            payload={payload}
            locale={locale}
            debug={debug}
          />
        ) : null}
        {!compact ? (
          <LexiconMorphologyPanel
            payload={payload}
            locale={locale}
            debug={debug}
          />
        ) : null}
        {!compact ? (
          <LexiconRelationsPanel
            payload={payload}
            locale={locale}
            debug={debug}
          />
        ) : null}
        {!compact && substantiveResources.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.16em]">
                {french ? "Pour aller plus loin" : "Explore further"}
              </h3>
            </div>
            {substantiveResources.slice(0, 5).map((resource) => (
              <details
                open
                key={lexiconResourceKey(resource)}
                className="lexicon-panel"
              >
                <summary className="lexicon-panel-summary">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="lexicon-panel-chevron" />
                    <strong className="lexicon-panel-title">
                      {resource.source === "TFLSJ"
                        ? french
                          ? "Dictionnaire grec détaillé"
                          : "Detailed Greek dictionary"
                        : french
                          ? "Notice complémentaire"
                          : "Additional note"}
                    </strong>
                  </div>
                </summary>
                <div className="lexicon-panel-content">
                  <LexiconLanguagePanel
                    language={french ? "Français" : "English"}
                    locale={french ? "FR" : "EN"}
                    gloss=""
                    html={
                      french
                        ? resource.contentHtmlFr ||
                          "<p>Traduction indisponible.</p>"
                        : resource.contentHtml || "<p>Content unavailable.</p>"
                    }
                    showLocale={debug}
                    debugSource={
                      debug
                        ? french && resource.contentHtmlFr
                          ? "LEXIQUE_FR.LexiconResourceTranslations.contentHtml"
                          : resource.source === "TFLSJ"
                            ? "DICTIONNAIRE_LSJ.LexiconResources.contentHtml"
                            : "LEXIQUE_STEP.LexiconResources.contentHtml"
                        : undefined
                    }
                  />
                </div>
              </details>
            ))}
          </div>
        ) : null}
        {!compact && debug && lsjAbsent ? (
          <details open className="lexicon-panel border-dashed">
            <summary className="lexicon-panel-summary text-muted-foreground">
              <span className="flex items-center gap-2">
                <ChevronRight className="lexicon-panel-chevron" />
                LSJ
              </span>
              <Badge variant="outline">
                {french ? "absent" : "not available"}
              </Badge>
            </summary>
            <div className="lexicon-panel-content p-4">
              <p className="text-muted-foreground text-sm">
                {french
                  ? "Aucune notice LSJ n’est disponible pour cette entrée."
                  : "No LSJ entry is available for this record."}
              </p>
              <DebugFieldTag source="DICTIONNAIRE_LSJ.LexiconResources.contentHtml" />
            </div>
          </details>
        ) : null}
        {!compact && debug ? (
          <LegacyLexiconComparison payload={payload} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function LexiconLanguagePanel({
  language,
  locale,
  gloss,
  html,
  showLocale = true,
  debugSource
}: {
  language: string;
  locale: "FR" | "EN";
  gloss: string;
  html: string;
  showLocale?: boolean;
  debugSource?: string;
}) {
  return (
    <article className="min-w-0 p-4 md:p-5">
      {showLocale ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">
            {language}
          </span>
          <Badge variant={locale === "FR" ? "default" : "outline"}>
            {locale}
          </Badge>
        </div>
      ) : null}
      {gloss ? <p className="mb-4 text-lg font-semibold">{gloss}</p> : null}
      <div
        className="prose-strong min-w-0 text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {debugSource ? <DebugFieldTag source={debugSource} /> : null}
    </article>
  );
}

function DebugFieldTag({
  source,
  className
}: {
  source: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "mt-1.5 flex w-fit max-w-full items-center gap-1.5 rounded border border-amber-400/35 bg-amber-500/10 px-2 py-1 font-mono text-[0.62rem] leading-none text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/8 dark:text-amber-200",
        className
      )}
      aria-label={`Source : ${source}`}
    >
      <Database className="size-3 shrink-0 opacity-80" aria-hidden="true" />
      <code className="truncate">{source}</code>
    </span>
  );
}

function LexiconMorphologyPanel({
  payload,
  locale,
  debug
}: {
  payload: LexiconEntryPayload;
  locale: "fr" | "en";
  debug: boolean;
}) {
  if (!payload.entry.morph && payload.morphology.length === 0) return null;
  const primary = payload.morphology[0];
  const french = locale === "fr";
  const meaning = primary
    ? french
      ? primary.meaningFr || primary.meaningEn
      : primary.meaningEn
    : "";
  const description = primary
    ? french
      ? primary.descriptionFr || primary.descriptionEn
      : primary.descriptionEn
    : "";
  const showDescription =
    Boolean(description) &&
    !isRedundantMorphologyDescription(meaning, description);
  return (
    <details open className="lexicon-panel">
      <summary className="lexicon-panel-summary flex-wrap">
        <div className="flex items-center gap-2">
          <ChevronRight className="lexicon-panel-chevron" />
          <h3 className="lexicon-panel-title">
            {french ? "Informations grammaticales" : "Grammar"}
          </h3>
        </div>
        <div className="flex flex-col items-end">
          <Badge variant="outline">
            {payload.entry.morph || primary?.code}
          </Badge>
          {debug ? (
            <DebugFieldTag source="LEXIQUE_STEP.StepEntries.morph" />
          ) : null}
        </div>
      </summary>
      {primary ? (
        <div className="lexicon-panel-content p-4">
          <p className="text-sm font-semibold">{meaning}</p>
          {debug ? (
            <DebugFieldTag
              source={
                french && primary.meaningFr
                  ? "MORPHOLOGIE_STEP.MorphologyCodeTranslations.meaning"
                  : "MORPHOLOGIE_STEP.MorphologyCodes.meaning"
              }
            />
          ) : null}
          {showDescription ? (
            <div className="mt-3">
              <p className="text-muted-foreground text-xs leading-relaxed">
                {description}
              </p>
              {debug ? (
                <DebugFieldTag
                  source={
                    french && primary.descriptionFr
                      ? "MORPHOLOGIE_STEP.MorphologyCodeTranslations.description"
                      : "MORPHOLOGIE_STEP.MorphologyCodes.description"
                  }
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}

function isRedundantMorphologyDescription(
  meaning: string,
  description: string
) {
  const normalize = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/gu, "")
      .toLocaleLowerCase("fr-FR")
      .replace(/^\s*(?:categorie\s+lexicale|lexical\s+category)\s*[:=]\s*/u, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();

  return normalize(meaning) === normalize(description);
}

function LexiconRelationsPanel({
  payload,
  locale,
  debug
}: {
  payload: LexiconEntryPayload;
  locale: "fr" | "en";
  debug: boolean;
}) {
  const relations = payload.relations ?? [];
  if (relations.length === 0) return null;
  const french = locale === "fr";
  const groups = [
    {
      id: "subentry",
      title: french ? "Autres sens" : "Other meanings"
    },
    {
      id: "identity",
      title: french ? "Variantes et équivalents" : "Variants and equivalents"
    },
    {
      id: "family",
      title: french ? "Même famille de mots" : "Word family"
    }
  ] as const;
  return (
    <details open className="lexicon-panel">
      <summary className="lexicon-panel-summary">
        <div className="flex items-center gap-2">
          <ChevronRight className="lexicon-panel-chevron" />
          <Network className="text-muted-foreground size-4" />
          <h3 className="lexicon-panel-title">
            {french ? "Mots liés" : "Related words"}
          </h3>
        </div>
        <Badge variant="secondary">{relations.length}</Badge>
      </summary>
      <div className="lexicon-panel-content divide-y">
        {groups.map((group) => {
          const items = relations.filter(
            (relation) => relation.groupKind === group.id
          );
          if (items.length === 0) return null;
          return (
            <section key={group.id} className="min-w-0 px-4 py-5">
              <div>
                <h4 className="lexicon-field-label">{group.title}</h4>
              </div>
              <div className="text-muted-foreground mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-3 text-[10px] font-semibold tracking-[0.14em] uppercase sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto]">
                <span>{french ? "Mot" : "Word"}</span>
                <span className="hidden sm:block">
                  {french ? "Relation" : "Relationship"}
                </span>
                <span>Strong</span>
              </div>
              <div className="mt-2 overflow-hidden rounded-xl border">
                {items.slice(0, 24).map((relation) => {
                  const relatedGloss =
                    (french ? relation.glossFr : relation.glossEn) ||
                    relation.glossEn ||
                    relation.transliteration ||
                    relation.toStepCode;
                  const glossSource =
                    french && relation.glossFr
                      ? "LEXIQUE_FR.LexiconTranslations.gloss"
                      : relation.glossEn
                        ? "LEXIQUE_STEP.StepEntries.gloss"
                        : relation.transliteration
                          ? "LEXIQUE_STEP.StepEntries.transliteration"
                          : "LEXIQUE_STEP.LexiconRelations.toStepCode";
                  return (
                    <a
                      key={`${relation.id}-${relation.toStepCode}`}
                      href={`/viewer/lexicon.html?q=${encodeURIComponent(relation.toStepCode)}`}
                      className="hover:bg-muted/65 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b px-3 py-3.5 transition last:border-b-0 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto]"
                    >
                      <div className="min-w-0">
                        <p className="text-sm leading-5 font-semibold break-words">
                          {relatedGloss}
                        </p>
                        {debug ? <DebugFieldTag source={glossSource} /> : null}
                        <p className="text-muted-foreground mt-1 text-xs leading-5 sm:hidden">
                          {french ? relation.labelFr : relation.labelEn}
                        </p>
                        {debug ? (
                          <div className="sm:hidden">
                            <DebugFieldTag
                              source={`LEXIQUE_STEP.LexiconRelations.${french ? "labelFr" : "labelEn"}`}
                            />
                          </div>
                        ) : null}
                      </div>
                      <div className="hidden min-w-0 sm:block">
                        <p className="text-muted-foreground text-xs leading-5 break-words">
                          {french ? relation.labelFr : relation.labelEn}
                        </p>
                        {debug ? (
                          <DebugFieldTag
                            source={`LEXIQUE_STEP.LexiconRelations.${french ? "labelFr" : "labelEn"}`}
                          />
                        ) : null}
                      </div>
                      <div className="flex min-w-16 shrink-0 flex-col items-end">
                        <Badge variant="outline" className="font-mono">
                          {relation.toStepCode}
                        </Badge>
                        {debug ? (
                          <DebugFieldTag source="LEXIQUE_STEP.LexiconRelations.toStepCode" />
                        ) : null}
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </details>
  );
}

function LexiconOccurrencesPanel({
  payload,
  locale,
  debug
}: {
  payload: LexiconEntryPayload;
  locale: "fr" | "en";
  debug: boolean;
}) {
  const occurrences = payload.occurrences;
  if (!occurrences) return null;
  const french = locale === "fr";
  const stats = occurrences.exactStats || occurrences.classicalStats;
  if (!stats) return null;
  return (
    <details open className="lexicon-panel">
      <summary className="lexicon-panel-summary flex-wrap">
        <div className="flex items-center gap-2">
          <ChevronRight className="lexicon-panel-chevron" />
          <div>
            <h3 className="lexicon-panel-title">
              {french ? "Emplois dans la Bible" : "Uses in the Bible"}
            </h3>
            <p className="text-muted-foreground text-xs">
              {stats.totalCount.toLocaleString(french ? "fr-FR" : "en-US")}{" "}
              {french ? "occurrences dans" : "occurrences across"}{" "}
              {stats.verseCount.toLocaleString(french ? "fr-FR" : "en-US")}{" "}
              {french ? "versets" : "verses"}
            </p>
            {debug ? (
              <div className="flex flex-wrap gap-1">
                <DebugFieldTag source="OCCURRENCES_STEP.OccurrenceStats.totalCount" />
                <DebugFieldTag source="OCCURRENCES_STEP.OccurrenceStats.verseCount" />
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex flex-col items-end">
            <Badge variant="secondary">
              {french ? "AT" : "OT"}{" "}
              {stats.oldTestamentCount.toLocaleString(
                french ? "fr-FR" : "en-US"
              )}
            </Badge>
            {debug ? (
              <DebugFieldTag source="OCCURRENCES_STEP.OccurrenceStats.oldTestamentCount" />
            ) : null}
          </div>
          <div className="flex flex-col items-end">
            <Badge variant="secondary">
              NT{" "}
              {stats.newTestamentCount.toLocaleString(
                french ? "fr-FR" : "en-US"
              )}
            </Badge>
            {debug ? (
              <DebugFieldTag source="OCCURRENCES_STEP.OccurrenceStats.newTestamentCount" />
            ) : null}
          </div>
        </div>
      </summary>
      <div className="lexicon-panel-content p-4">
        {occurrences.exactStats && occurrences.classicalStats ? (
          <div className="mb-4">
            <p className="text-muted-foreground text-xs">
              {french ? "Sous-entrée STEP" : "STEP subentry"}:{" "}
              {occurrences.exactStats.totalCount.toLocaleString("fr-FR")}
              {french
                ? " occurrence(s). Strong classique : "
                : " occurrence(s). Classical Strong: "}
              {occurrences.classicalStats.totalCount.toLocaleString("fr-FR")}
              {" occurrence(s)."}
            </p>
            {debug ? (
              <div className="flex flex-wrap gap-1">
                <DebugFieldTag source="OCCURRENCES_STEP.OccurrenceStats.identityKind" />
                <DebugFieldTag source="OCCURRENCES_STEP.OccurrenceStats.totalCount" />
              </div>
            ) : null}
          </div>
        ) : null}
        {occurrences.forms.length > 0 ? (
          <div>
            <h4 className="text-sm font-semibold">
              {french ? "Formes rencontrées" : "Observed forms"}
            </h4>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {occurrences.forms.map((form) => (
                <div key={form.code} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col items-start">
                      <Badge variant="outline">{form.code}</Badge>
                      {debug ? (
                        <DebugFieldTag source="OCCURRENCES_STEP.OccurrenceMorphology.code" />
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-muted-foreground text-xs">
                        {form.count.toLocaleString("fr-FR")}×
                      </span>
                      {debug ? (
                        <DebugFieldTag source="OCCURRENCES_STEP.OccurrenceMorphology.code" />
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-sm font-medium">
                    {(french ? form.meaningFr : form.meaningEn) ||
                      form.meaningEn ||
                      form.code}
                  </p>
                  {debug ? (
                    <DebugFieldTag
                      source={
                        french && form.meaningFr
                          ? "MORPHOLOGIE_STEP.MorphologyCodeTranslations.meaning"
                          : "MORPHOLOGIE_STEP.MorphologyCodes.meaning"
                      }
                    />
                  ) : null}
                  <p className="text-muted-foreground mt-1 text-xs">
                    {debug && french && form.meaningEn && form.meaningFr
                      ? form.meaningEn
                      : ""}
                    {form.exampleSurface ? ` · ${form.exampleSurface}` : ""}
                  </p>
                  {debug && form.exampleSurface ? (
                    <DebugFieldTag source="OCCURRENCES_STEP.Occurrences.surface" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {occurrences.samples.length > 0 ? (
          <div className="mt-5">
            <h4 className="text-sm font-semibold">
              {french ? "Premières occurrences" : "First occurrences"}
            </h4>
            <div className="mt-3 overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/30 text-muted-foreground text-xs">
                  <tr>
                    <th className="px-3 py-2">
                      {french ? "Référence" : "Reference"}
                      {debug ? (
                        <DebugFieldTag source="OCCURRENCES_STEP.Occurrences.mainRef" />
                      ) : null}
                    </th>
                    <th className="px-3 py-2">
                      {french ? "Forme" : "Form"}
                      {debug ? (
                        <DebugFieldTag source="OCCURRENCES_STEP.Occurrences.surface" />
                      ) : null}
                    </th>
                    <th className="px-3 py-2">
                      {french ? "Translittération" : "Transliteration"}
                      {debug ? (
                        <DebugFieldTag source="OCCURRENCES_STEP.Occurrences.transliteration" />
                      ) : null}
                    </th>
                    {!french || debug ? (
                      <th className="px-3 py-2">
                        Gloss EN
                        {debug ? (
                          <DebugFieldTag source="OCCURRENCES_STEP.Occurrences.gloss" />
                        ) : null}
                      </th>
                    ) : null}
                    <th className="px-3 py-2">
                      {french ? "Morphologie" : "Morphology"}
                      {debug ? (
                        <DebugFieldTag source="OCCURRENCES_STEP.Occurrences.morphology" />
                      ) : null}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {occurrences.samples.slice(0, 16).map((sample, index) => (
                    <tr
                      key={`${sample.ref}-${sample.stepCode}-${sample.surface}-${index}`}
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-medium">
                        {sample.ref}
                      </td>
                      <td className="px-3 py-2" dir="auto">
                        {sample.surface}
                      </td>
                      <td className="px-3 py-2">{sample.transliteration}</td>
                      {!french || debug ? (
                        <td className="px-3 py-2">{sample.gloss}</td>
                      ) : null}
                      <td className="whitespace-nowrap px-3 py-2">
                        {sample.morphology || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function TipnrEntityContexts({
  payload,
  locale,
  debug
}: {
  payload: LexiconEntryPayload;
  locale: "fr" | "en";
  debug: boolean;
}) {
  const french = locale === "fr";
  return (
    <div className="flex flex-col gap-3">
      {(payload.tipnrEntities ?? []).map((entity) => (
        <details open key={entity.id} className="lexicon-panel">
          <summary className="lexicon-panel-summary flex-wrap">
            <div className="flex items-center gap-2">
              <ChevronRight className="lexicon-panel-chevron" />
              <h3 className="lexicon-panel-title">
                {french ? "Contexte biblique" : "Biblical context"}
              </h3>
            </div>
            {debug ? (
              <div className="flex flex-col items-end">
                <Badge variant="outline">{entity.matchedStrong}</Badge>
                <DebugFieldTag source="ENTITES_TIPNR.Entities.uStrong" />
              </div>
            ) : null}
          </summary>
          <div className="lexicon-panel-content">
            <TipnrLanguagePanel
              entity={entity}
              locale={french ? "FR" : "EN"}
              showLocale={debug}
              debug={debug}
            />
            <TipnrEntityEvidence
              entity={entity}
              locale={locale}
              debug={debug}
            />
            {entity.articleHtmlFr || entity.articleHtmlEn ? (
              <section className="border-t p-4 md:p-5">
                <h4 className="lexicon-field-label">
                  {french ? "Notice détaillée" : "Detailed article"}
                </h4>
                <div
                  className="prose-strong min-w-0 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: prepareTipnrHtml(
                      french
                        ? entity.articleHtmlFr ||
                            "<p>Traduction française indisponible.</p>"
                        : entity.articleHtmlEn ||
                            "<p>English article unavailable.</p>"
                    )
                  }}
                />
                {debug ? (
                  <DebugFieldTag
                    source={`ENTITES_TIPNR.${french ? "EntityTranslations" : "Entities"}.articleHtml`}
                  />
                ) : null}
              </section>
            ) : null}
          </div>
        </details>
      ))}
    </div>
  );
}

function TipnrEntityEvidence({
  entity,
  locale,
  debug
}: {
  entity: LexiconEntryPayload["tipnrEntities"][number];
  locale: "fr" | "en";
  debug: boolean;
}) {
  const french = locale === "fr";
  const hasPlace = entity.latitude != null && entity.longitude != null;
  const hasRelations = entity.relations.length > 0;
  const hasReferences = entity.references.length > 0;
  if (!hasPlace && !hasRelations && !hasReferences) return null;

  return (
    <div className="flex flex-col gap-5 border-t p-4 md:p-5">
      {hasPlace ? (
        <section className="lexicon-field-section">
          <h4 className="lexicon-field-label">
            {french ? "Localisation" : "Location"}
          </h4>
          <p className="text-muted-foreground mt-2 text-xs">
            {entity.openBibleName ||
              (french ? entity.displayNameFr : entity.displayNameEn) ||
              entity.displayNameEn}
            {entity.area ? ` · ${entity.area}` : ""}
          </p>
          {debug ? (
            <div className="flex flex-wrap gap-1">
              <DebugFieldTag source="ENTITES_TIPNR.EntityPlaces.openBibleName" />
              {entity.area ? (
                <DebugFieldTag source="ENTITES_TIPNR.EntityPlaces.area" />
              ) : null}
            </div>
          ) : null}
          <p className="mt-2 font-mono text-xs">
            {entity.latitude}, {entity.longitude}
          </p>
          {debug ? (
            <div className="flex flex-wrap gap-1">
              <DebugFieldTag source="ENTITES_TIPNR.EntityPlaces.latitude" />
              <DebugFieldTag source="ENTITES_TIPNR.EntityPlaces.longitude" />
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {entity.googleMapUrl ? (
              <a
                href={entity.googleMapUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-500 hover:underline"
              >
                Google Maps <ExternalLink className="size-3" />
              </a>
            ) : null}
            {entity.palopenmapsUrl ? (
              <a
                href={entity.palopenmapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-500 hover:underline"
              >
                OpenBible Maps <ExternalLink className="size-3" />
              </a>
            ) : null}
          </div>
        </section>
      ) : null}
      {hasRelations ? (
        <section className="lexicon-field-section">
          <div className="flex items-center justify-between gap-3">
            <h4 className="lexicon-field-label mb-0">
              {french ? "Relations" : "Relationships"}
            </h4>
            <Badge variant="outline">
              {entity.relationCount.toLocaleString("fr-FR")}
            </Badge>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {entity.relations.slice(0, 20).map((relation, index) => {
              const label =
                (french ? relation.displayNameFr : relation.displayNameEn) ||
                relation.displayNameEn ||
                relation.toUniqueName;
              const content = (
                <div className="flex min-w-0 flex-1 flex-col items-start">
                  <span className="max-w-full truncate">{label}</span>
                  {debug ? (
                    <DebugFieldTag
                      source={`ENTITES_TIPNR.${french && relation.displayNameFr ? "EntityTranslations.displayName" : "Entities.displayName"}`}
                    />
                  ) : null}
                  <span className="text-muted-foreground mt-1 text-xs">
                    {entityRelationLabel(relation.relation, locale)}
                  </span>
                  {debug ? (
                    <DebugFieldTag source="ENTITES_TIPNR.EntityRelations.relation" />
                  ) : null}
                </div>
              );
              return relation.uStrong ? (
                <a
                  key={`${relation.relation}-${relation.toUniqueName}-${index}`}
                  href={`/viewer/lexicon.html?q=${encodeURIComponent(relation.uStrong)}`}
                  className="hover:bg-muted flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm transition"
                >
                  {content}
                </a>
              ) : (
                <div
                  key={`${relation.relation}-${relation.toUniqueName}-${index}`}
                  className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  {content}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
      {hasReferences ? (
        <section className="lexicon-field-section">
          <div className="flex items-center justify-between gap-3">
            <h4 className="lexicon-field-label mb-0">
              {french ? "Références bibliques" : "Bible references"}
            </h4>
            <Badge variant="outline">
              {entity.referenceCount.toLocaleString(french ? "fr-FR" : "en-US")}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {entity.references.slice(0, 30).map((reference) => (
              <Badge
                key={`${reference.book}-${reference.chapter}-${reference.verse}-${reference.suffix}`}
                variant="outline"
              >
                {reference.refText ||
                  `${reference.book}.${reference.chapter}.${reference.verse}${reference.suffix}`}
              </Badge>
            ))}
            {entity.referenceCount > entity.references.length ? (
              <Badge variant="secondary">
                +
                {(
                  entity.referenceCount - entity.references.length
                ).toLocaleString("fr-FR")}
              </Badge>
            ) : null}
          </div>
          {debug ? (
            <DebugFieldTag source="ENTITES_TIPNR.EntityRefs.refText" />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function entityRelationLabel(value: string, locale: "fr" | "en") {
  const labelsFr: Record<string, string> = {
    father: "père",
    mother: "mère",
    offspring: "enfant",
    sibling: "fratrie",
    partner: "conjoint·e",
    founder_or_origin: "fondateur / origine",
    resident: "résident"
  };
  const labelsEn: Record<string, string> = {
    father: "father",
    mother: "mother",
    offspring: "child",
    sibling: "sibling",
    partner: "partner",
    founder_or_origin: "founder / origin",
    resident: "resident"
  };
  return (
    (locale === "fr" ? labelsFr : labelsEn)[value] || value.replaceAll("_", " ")
  );
}

function TipnrLanguagePanel({
  entity,
  locale,
  showLocale = true,
  debug = false
}: {
  entity: LexiconEntryPayload["tipnrEntities"][number];
  locale: "FR" | "EN";
  showLocale?: boolean;
  debug?: boolean;
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
    <article className="flex min-w-0 flex-col gap-5 p-4 md:p-5">
      {showLocale ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">
            {french ? "Français" : "English"}
          </span>
          <Badge variant={french ? "default" : "outline"}>{locale}</Badge>
        </div>
      ) : null}
      <div className="lexicon-field-section">
        <h4 className="lexicon-field-label">{french ? "Nom" : "Name"}</h4>
        <p className="text-lg font-semibold">{displayName || "—"}</p>
        {debug ? (
          <DebugFieldTag
            source={`ENTITES_TIPNR.${french ? "EntityTranslations" : "Entities"}.displayName`}
          />
        ) : null}
      </div>
      {description && description !== displayName ? (
        <div className="lexicon-field-section">
          <h4 className="lexicon-field-label">
            {french ? "Identité" : "Identity"}
          </h4>
          <p className="text-muted-foreground text-sm">{description}</p>
          {debug ? (
            <DebugFieldTag
              source={`ENTITES_TIPNR.${french ? "EntityTranslations" : "Entities"}.description`}
            />
          ) : null}
        </div>
      ) : null}
      {shortDescription ? (
        <div className="lexicon-field-section">
          <h4 className="lexicon-field-label">
            {french ? "En bref" : "In brief"}
          </h4>
          <p className="text-sm leading-relaxed">{shortDescription}</p>
          {debug ? (
            <DebugFieldTag
              source={`ENTITES_TIPNR.${french ? "EntityTranslations" : "Entities"}.shortDescription`}
            />
          ) : null}
        </div>
      ) : null}
      {summaryHtml ? (
        <div className="lexicon-field-section">
          <h4 className="lexicon-field-label">
            {french ? "Synthèse biblique" : "Biblical summary"}
          </h4>
          <div
            className="prose-strong min-w-0 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: prepareTipnrHtml(summaryHtml)
            }}
          />
          {debug ? (
            <DebugFieldTag
              source={`ENTITES_TIPNR.${french ? "EntityTranslations" : "Entities"}.summaryHtml`}
            />
          ) : null}
        </div>
      ) : null}
      {brief && brief !== description ? (
        <div className="lexicon-field-section">
          <h4 className="lexicon-field-label">
            {french ? "Résumé" : "Summary"}
          </h4>
          <p className="text-muted-foreground text-xs">{brief}</p>
          {debug ? (
            <DebugFieldTag
              source={`ENTITES_TIPNR.${french ? "EntityTranslations" : "Entities"}.brief`}
            />
          ) : null}
        </div>
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
      /(?:<br\s*\/?>\s*)?<a\b[^>]*href=["']https:\/\/(?:www\.)?stepbible\.org\/html\/names\.html(?:\?[^"']*)?["'][^>]*>[\s\S]*?<\/a>\s*$/giu,
      ""
    )
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
  const legacyTable = payload.entry.language === "greek" ? "Grec" : "Hebreu";
  if (!legacy) {
    return (
      <details open className="lexicon-panel border-dashed">
        <summary className="lexicon-panel-summary">
          <div className="flex items-center gap-2">
            <ChevronRight className="lexicon-panel-chevron" />
            <span className="lexicon-panel-title">Strong legacy français</span>
          </div>
          <Badge variant="secondary">Introuvable</Badge>
        </summary>
        <div className="lexicon-panel-content px-4 py-3">
          <p className="text-muted-foreground text-sm">
            Aucune notice legacy ne correspond au Strong classique de cette
            entrée STEP.
          </p>
          <DebugFieldTag source={`STRONG_LEGACY.${legacyTable}.Code`} />
        </div>
      </details>
    );
  }

  return (
    <details open className="lexicon-panel">
      <summary className="lexicon-panel-summary flex-wrap">
        <div className="flex items-center gap-2">
          <ChevronRight className="lexicon-panel-chevron" />
          <span className="lexicon-panel-title">Strong legacy français</span>
        </div>
        <div className="flex flex-col items-end">
          <Badge variant="outline">{legacy.strong}</Badge>
          <DebugFieldTag source={`STRONG_LEGACY.${legacyTable}.Code`} />
        </div>
      </summary>
      <div className="lexicon-panel-content p-4">
        <div>
          <p className="text-lg font-semibold">{legacy.word || "—"}</p>
          <DebugFieldTag source={`STRONG_LEGACY.${legacyTable}.Mot`} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <span className="text-muted-foreground block text-xs">
              Original
            </span>
            <p className="mt-1 text-sm" dir="auto">
              {legacy.original || "—"}
            </p>
            <DebugFieldTag
              source={`STRONG_LEGACY.${legacyTable}.${legacyTable}`}
            />
          </div>
          <div>
            <span className="text-muted-foreground block text-xs">
              Phonétique
            </span>
            <p className="mt-1 text-sm">{legacy.phonetic || "—"}</p>
            <DebugFieldTag source={`STRONG_LEGACY.${legacyTable}.Phonetique`} />
          </div>
          <div>
            <span className="text-muted-foreground block text-xs">Type</span>
            <p className="mt-1 text-sm">{legacy.type || "—"}</p>
            <DebugFieldTag source={`STRONG_LEGACY.${legacyTable}.Type`} />
          </div>
        </div>
        {legacy.lsg ? (
          <div className="mt-4">
            <span className="text-muted-foreground block text-xs">
              Rendus LSG
            </span>
            <p className="text-sm">{legacy.lsg}</p>
            <DebugFieldTag source={`STRONG_LEGACY.${legacyTable}.LSG`} />
          </div>
        ) : null}
        {legacy.originHtml ? (
          <div className="mt-4">
            <span className="text-muted-foreground block text-xs">Origine</span>
            <div
              className="prose-strong text-sm"
              dangerouslySetInnerHTML={{
                __html: prepareLegacyHtml(legacy.originHtml)
              }}
            />
            <DebugFieldTag source={`STRONG_LEGACY.${legacyTable}.Origine`} />
          </div>
        ) : null}
        <div className="mt-4">
          <span className="text-muted-foreground block text-xs">
            Définition
          </span>
          <div
            className="prose-strong mt-1 text-sm"
            dangerouslySetInnerHTML={{
              __html: prepareLegacyHtml(
                legacy.definitionHtml || "<p>Aucune définition.</p>"
              )
            }}
          />
          <DebugFieldTag source={`STRONG_LEGACY.${legacyTable}.Definition`} />
        </div>
      </div>
    </details>
  );
}

function lexiconTransliteration(
  entry: Pick<LexiconRow, "classicTransliteration" | "transliteration">
) {
  return entry.classicTransliteration.trim() || entry.transliteration.trim();
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

function isMissingLsjFallback(
  resource: LexiconEntryPayload["resources"][number]
) {
  if (resource.source !== "TFLSJ") return false;
  const content = [
    resource.contentHtml,
    resource.contentHtmlFr,
    resource.contentTextFr
  ]
    .join(" ")
    .toLowerCase();
  return (
    content.includes("lsj has no entry") ||
    content.includes("lsj ne contient aucune entrée") ||
    (content.includes("abbott-smith") && content.includes("lsj"))
  );
}

function prepareLegacyHtml(value: string) {
  return value.replace(
    /<img\b[^>]*\bsrc=["'][^"']*ClearPix\.gif["'][^>]*>/giu,
    "&emsp;"
  );
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
