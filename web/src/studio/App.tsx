import {
  BookOpen,
  Braces,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  FileJson,
  Gauge,
  GitCompareArrows,
  Loader2,
  MessageSquareText,
  Search,
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
  loadLedger
} from "./data";
import { pct, ratio } from "./format";
import type {
  LexiconEntryPayload,
  LexiconRow,
  LexicalAuditItem,
  LexicalCandidate,
  ReaderMode,
  ReviewFile,
  ReviewItem,
  StrongAnnotation,
  StrongLedger,
  StrongVerse,
  ViewId
} from "./types";
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
    label: "Revue",
    description: "Décisions assistées et overrides",
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

export function App() {
  const [view, setView] = useState<ViewId>(currentViewFromLocation() as ViewId);
  const [ledger, setLedger] = useState<StrongLedger | null>(null);
  const [ledgerPath, setLedgerPath] = useState(defaultLedgerPath());
  const [loadingLedger, setLoadingLedger] = useState(false);

  useEffect(() => {
    if (view === "workflow") {
      setLoadingLedger(false);
      return;
    }
    setLoadingLedger(true);
    loadLedger(ledgerPath)
      .then((nextLedger) => {
        setLedger(nextLedger);
      })
      .catch((error) => {
        toast.error(
          error instanceof Error ? error.message : "Chargement impossible"
        );
      })
      .finally(() => setLoadingLedger(false));
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
              {view !== "workflow" ? (
                <LedgerStatus ledger={ledger} loading={loadingLedger} />
              ) : null}
            </div>

            <div
              className={cn(
                "mt-auto hidden flex-col gap-2 lg:flex",
                view === "workflow" && "lg:hidden"
              )}
            >
              <label className="text-muted-foreground text-xs font-medium">
                Ledger JSON
              </label>
              <div className="flex gap-2">
                <Input
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
  const [query, setQuery] = useState("");
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
    return chaptersForBook(bookVerses, book);
  }, [book, bookVerses]);

  useEffect(() => {
    setBookVerses([]);
    setSelectedStrong("");
    if (!ledger || !book) return;

    setLoadingBook(true);
    loadBookVerses(ledger, book)
      .then(setBookVerses)
      .catch((error) =>
        toast.error(
          error instanceof Error ? error.message : "Livre inaccessible"
        )
      )
      .finally(() => setLoadingBook(false));
  }, [book, ledger]);

  useEffect(() => {
    setLexicalByRef(new Map());
    if (!ledger) return;
    loadLexicalItemsByRef(ledger)
      .then(setLexicalByRef)
      .catch(() => setLexicalByRef(new Map()));
  }, [ledger]);

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
                onCheckedChange={(checked) =>
                  changeShowLexicalCandidates(
                    checked === true,
                    setShowLexicalCandidates
                  )
                }
              />
              Candidats lexicaux
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
          onClick={(event) => {
            const target = event.target as HTMLElement;
            const tagged = target.closest("[strong]") as HTMLElement | null;
            const strong = tagged?.getAttribute("strong");
            if (strong) onSelectStrong(strong);
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
        {candidates.map((candidate, index) => (
          <LexicalCandidateChip
            key={`${candidate.target}-${candidate.wordIndex}-${candidate.text}-${index}`}
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
                <Badge variant="secondary">
                  {annotation?.placement ?? "placement inconnu"}
                </Badge>
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
              </CardContent>
            </Card>
            {entry ? <LexiconEntryCard payload={entry} compact /> : null}
          </>
        )}
      </div>
    </ScrollArea>
  );
}

function LexiconView() {
  const [query, setQuery] = useState("H0430");
  const [rows, setRows] = useState<LexiconRow[]>([]);
  const [selected, setSelected] = useState<LexiconEntryPayload | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/lexicon/search?q=${encodeURIComponent(query)}&limit=40`)
        .then((response) => response.json())
        .then((payload) => {
          setRows(payload.rows ?? []);
          const first = payload.rows?.[0];
          if (first) return fetch(`/api/lexicon/entry?id=${first.id}`);
        })
        .then((response) => (response?.ok ? response.json() : undefined))
        .then((payload) => {
          if (payload) setSelected(payload);
        })
        .catch((error) =>
          toast.error(
            error instanceof Error ? error.message : "Recherche impossible"
          )
        )
        .finally(() => setLoading(false));
    }, 180);
    return () => window.clearTimeout(handle);
  }, [query]);

  return (
    <section className="grid h-screen min-h-0 grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="border-border/70 bg-card/60 min-h-0 border-b xl:border-r xl:border-b-0">
        <div className="flex h-full flex-col gap-4 p-4">
          <div>
            <Badge variant="outline">Lexique TAHOT/TAGNT + FR</Badge>
            <h2 className="mt-2 text-2xl font-semibold">Lexique</h2>
            <p className="text-muted-foreground text-sm">
              Recherche par Strong, translittération, gloss ou traduction.
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
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className={compact ? "text-lg" : "text-3xl"}>
              {entry.eStrong}
            </CardTitle>
            <CardDescription>
              {entry.dStrong} · {entry.uStrong} · {entry.morph}
            </CardDescription>
          </div>
          <Badge>{entry.language}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-3 md:grid-cols-2">
          <InfoBlock label="Original" value={entry.original} />
          <InfoBlock
            label="Translittération"
            value={entry.transliteration || entry.classicTransliteration}
          />
          <InfoBlock label="Gloss FR" value={entry.glossFr || "—"} />
          <InfoBlock label="Gloss EN" value={entry.glossEn || "—"} />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Définition française</h3>
          <div
            className="prose-strong rounded-lg border p-4 text-sm"
            dangerouslySetInnerHTML={{
              __html:
                entry.meaningHtmlFr ||
                entry.meaningSimpleFr ||
                entry.meaningEn ||
                "<p>Aucune définition.</p>"
            }}
          />
        </div>
        {!compact && payload.resources.length > 0 ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Ressources</h3>
            {payload.resources.slice(0, 5).map((resource, index) => (
              <div
                key={`${resource.source}-${resource.kind}-${index}`}
                className="rounded-lg border p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="outline">{resource.source}</Badge>
                  <Badge variant="secondary">{resource.kind}</Badge>
                </div>
                <div
                  className="prose-strong text-sm"
                  dangerouslySetInnerHTML={{
                    __html: resource.contentHtmlFr || resource.contentHtml || ""
                  }}
                />
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
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

function ReviewView() {
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
            <Badge variant="outline">Revue assistée</Badge>
            <h2 className="mt-2 text-2xl font-semibold">Décisions curées</h2>
            <p className="text-muted-foreground text-sm">
              Le LLM propose, le reviewer décide, le pipeline valide.
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
            Enregistrer décisions
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
            items.map((item, index) => (
              <Card key={`${item.ref}-${item.strong}-${index}`}>
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
