# Architecture du Bot IA - Bible Strong

## Vue d'ensemble

Ce document propose l'architecture d'un assistant IA intégré à Bible Strong, connecté à **toutes les ressources** de l'application : Bibles (40+ versions), concordance Strong (hébreu/grec), dictionnaire Westphal, références croisées (Trésor), Nave's Topical Bible, interlinéaire, timeline biblique, et commentaires Matthew Henry.

L'objectif : un bot **RAG** (Retrieval Augmented Generation) qui donne des réponses **contextuelles et interactives** — chaque mot hébreu/grec, chaque verset cité est un widget cliquable qui ouvre la ressource correspondante dans l'app.

---

## 1. Architecture Globale

```
┌─────────────────────────────────────────────────────────┐
│                    BIBLE STRONG APP                      │
│                                                          │
│  ┌──────────────┐   ┌──────────────────────────────┐    │
│  │  Chat UI      │   │  Parseur de réponse           │    │
│  │  (Vercel AI   │──▶│  (Markdown → Widgets React    │    │
│  │   SDK + Expo) │   │   Native cliquables)          │    │
│  └──────┬───────┘   └──────────────────────────────┘    │
│         │ Stream (SSE)                                   │
└─────────┼───────────────────────────────────────────────┘
          │ HTTPS
┌─────────▼───────────────────────────────────────────────┐
│              BACKEND (Edge Functions / API)               │
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Auth &      │  │  RAG Pipeline │  │  Conversation  │  │
│  │  Rate Limit  │  │              │  │  Store +       │  │
│  │  Middleware   │  │  1. Classify  │  │  Monitoring    │  │
│  │              │  │  2. Retrieve  │  │                │  │
│  │              │  │  3. Generate  │  │                │  │
│  └─────────────┘  └──────┬───────┘  └────────────────┘  │
│                          │                                │
│  ┌───────────────────────▼────────────────────────────┐  │
│  │              COUCHE OUTILS (Tool Use)               │  │
│  │                                                     │  │
│  │  search_bible()      │  get_strong_definition()     │  │
│  │  get_cross_refs()    │  get_nave_topics()           │  │
│  │  get_dictionary()    │  get_interlinear()           │  │
│  │  get_commentary()    │  get_timeline_event()        │  │
│  │  search_semantic()   │                              │  │
│  └──────────┬──────────────────────────────────────────┘  │
│             │                                             │
│  ┌──────────▼──────────────────────────────────────────┐  │
│  │           BASE DE DONNÉES                            │  │
│  │                                                      │  │
│  │  SQLite (miroir serveur des DBs de l'app)           │  │
│  │  ├── bibles.sqlite (40+ versions + FTS5)            │  │
│  │  ├── strong.sqlite (hébreu + grec)                  │  │
│  │  ├── dictionnaire.sqlite (Westphal)                 │  │
│  │  ├── nave.sqlite (thématique)                       │  │
│  │  ├── commentaires-tresor.sqlite (références croisées)│  │
│  │  ├── interlineaire.sqlite                           │  │
│  │  ├── mhy.sqlite (Matthew Henry)                     │  │
│  │  └── bible-timeline-events.json                     │  │
│  │                                                      │  │
│  │  Vector DB (embeddings pré-calculés)                │  │
│  │  └── Supabase pgvector OU SQLite-vec               │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

---

## 2. Choix Technologiques Recommandés

### 2.1 LLM — Approche par Paliers (Tiered Model)

L'idée clé : **ne pas utiliser le même modèle pour tout**. 80% des requêtes sont simples et ne nécessitent pas un modèle coûteux.

| Palier | Modèle | Coût (input / output par 1M tokens) | Cas d'usage |
|--------|--------|--------------------------------------|-------------|
| **Tier 0** | Cache sémantique | $0 | Questions déjà posées (60-85% hit rate estimé) |
| **Tier 1 — Économique** | GPT-4o mini | $0.15 / $0.60 | Questions factuelles, recherche de versets, définitions |
| **Tier 2 — Standard** | GPT-4o mini + RAG | $0.15 / $0.60 | Questions théologiques avec contexte enrichi |
| **Tier 3 — Avancé** | Claude Sonnet 4.6 | $3 / $15 | Études approfondies, analyses doctrinales, méditations |

**Alternatives ultra low-cost** (si budget très serré) :
| Modèle | Input / Output par 1M tokens | Notes |
|--------|------------------------------|-------|
| GPT-5 nano | $0.05 / $0.40 | Le moins cher côté OpenAI |
| Groq (Llama 3 8B) | ~$0.05 / $0.08 | Le plus rapide (500+ tok/s), le moins cher |
| Gemini 2.0 Flash | ~$0.10 / $0.40 | Long context, budget Google |
| On-device (Llama 3.2 3B) | $0 | Qualité limitée, pas viable pour théologie |

> **Note** : Claude Haiku 4.5 ($1.00/$5.00) est plus cher que GPT-4o mini ($0.15/$0.60).
> Pour le tier standard, GPT-4o mini offre un meilleur rapport qualité/prix.
> Le Vercel AI SDK est **provider-agnostique** — on peut switcher facilement.

**Estimation de coût mensuel** (1000 utilisateurs actifs, ~10 messages/jour) :

| Scénario | Coût/mois |
|----------|-----------|
| GPT-4o mini seul, sans cache | ~$30-60 |
| GPT-4o mini + cache sémantique (70% hit) | ~$10-20 |
| Tiered (GPT-4o mini + Sonnet pour 5% des requêtes) + cache | ~$20-50 |
| Groq Llama 3 + cache | ~$5-15 |

**Recommandation** : Commencer avec **GPT-4o mini + cache sémantique** (~$10-20/mois), puis ajouter Claude Sonnet pour les questions complexes si la qualité le justifie.

### 2.2 Architecture du Backend — **Tool Use (Function Calling)** plutôt que RAG vectoriel pur

**Recommandation forte : utiliser le Tool Use de Claude comme mécanisme principal, complété par la recherche vectorielle.**

Pourquoi ? Bible Strong a des données **structurées** (SQLite avec des schémas précis). Le RAG vectoriel classique est idéal pour du texte non structuré, mais pour vos données, les "tools" sont plus précis, moins coûteux, et plus contrôlables.

```typescript
// Exemple de définition d'outils pour Claude
const tools = [
  {
    name: "search_bible",
    description: "Recherche de versets dans une ou plusieurs versions de la Bible",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Termes de recherche" },
        version: { type: "string", description: "Version biblique (LSG, S21, KJV...)" },
        book: { type: "number", description: "Numéro du livre (1-66), optionnel" },
      },
      required: ["query"]
    }
  },
  {
    name: "get_strong_definition",
    description: "Obtenir la définition Strong d'un mot hébreu ou grec",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Code Strong (ex: H1234, G5678)" }
      },
      required: ["code"]
    }
  },
  {
    name: "get_verse_context",
    description: "Obtenir un verset avec toutes ses ressources associées (Strong, références croisées, dictionnaire, Nave, commentaires)",
    input_schema: {
      type: "object",
      properties: {
        book: { type: "number" },
        chapter: { type: "number" },
        verse: { type: "number" },
        version: { type: "string", default: "LSG" },
        include: {
          type: "array",
          items: { type: "string", enum: ["strong", "cross_refs", "dictionary", "nave", "commentary", "interlinear"] }
        }
      },
      required: ["book", "chapter", "verse"]
    }
  },
  {
    name: "get_cross_references",
    description: "Obtenir les références croisées (Trésor) d'un verset",
    input_schema: {
      type: "object",
      properties: {
        book: { type: "number" },
        chapter: { type: "number" },
        verse: { type: "number" }
      },
      required: ["book", "chapter", "verse"]
    }
  },
  {
    name: "get_nave_topics",
    description: "Obtenir les sujets de la Bible thématique de Nave liés à un verset ou un sujet",
    input_schema: {
      type: "object",
      properties: {
        verse_id: { type: "string", description: "ID du verset (ex: 1-1-1)" },
        topic: { type: "string", description: "Nom du sujet à rechercher" }
      }
    }
  },
  {
    name: "get_dictionary_entry",
    description: "Obtenir l'entrée du dictionnaire Westphal pour un mot biblique",
    input_schema: {
      type: "object",
      properties: {
        word: { type: "string" }
      },
      required: ["word"]
    }
  },
  {
    name: "get_timeline_events",
    description: "Obtenir les événements de la timeline biblique pour une période ou un personnage",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Recherche d'événement ou période" },
        start_year: { type: "number" },
        end_year: { type: "number" }
      }
    }
  },
  {
    name: "search_semantic",
    description: "Recherche sémantique sur l'ensemble des ressources bibliques (embeddings vectoriels)",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        sources: {
          type: "array",
          items: { type: "string", enum: ["bible", "dictionary", "nave", "commentary", "strong"] }
        },
        limit: { type: "number", default: 10 }
      },
      required: ["query"]
    }
  }
]
```

### 2.3 Recherche Vectorielle (Complément au Tool Use)

Pour les questions ouvertes ("Que dit la Bible sur le pardon ?"), la recherche sémantique est indispensable.

**Option recommandée : Supabase pgvector**

| Critère | Supabase pgvector | Pinecone | Turso + sqlite-vec |
|---------|-------------------|----------|---------------------|
| **Coût** | Gratuit (500MB) puis $25/mois | $70/mois (Starter) | ~$10/mois |
| **Setup** | Simple, PostgreSQL | Managed, propriétaire | SQLite natif |
| **Performance** | Excellente | Excellente | Bonne |
| **Avantages** | Auth + DB + Vector en un | Spécialisé vector | Même techno que l'app |
| **Recommandation** | **Premier choix** | Si scale massive | Alternative low-cost |

**Stratégie d'embeddings :**

```
Données à vectoriser (pré-calcul unique) :
├── Versets bibliques (par groupes de 3-5 versets pour le contexte)
│   └── ~10,000 chunks pour toute la Bible
├── Définitions Strong (chaque entrée = 1 chunk)
│   └── ~8,674 entrées (5,624 grec + 3,050 hébreu)
├── Articles dictionnaire Westphal (par paragraphe)
│   └── ~5,000 chunks
├── Sujets Nave (chaque topic = 1 chunk)
│   └── ~20,000 entrées
├── Commentaires Matthew Henry (par section)
│   └── ~5,000 chunks
└── Timeline events (chaque événement = 1 chunk)
    └── ~500 entrées

Total estimé : ~50,000 vecteurs
Modèle d'embedding : text-embedding-3-small (OpenAI) à $0.02/1M tokens
Coût d'indexation unique : ~$0.50
```

### 2.4 Backend — Options d'Hébergement

| Option | Coût | Latence | Avantages | Inconvénients |
|--------|------|---------|-----------|---------------|
| **Expo API Routes** | $0 (inclus) | ~200ms | Zéro infra supplémentaire, même codebase | Limité en compute |
| **Supabase Edge Functions** | $0-25/mois | ~100ms | Edge, intégré pgvector | Deno runtime |
| **Cloudflare Workers** | $5/mois | ~50ms | Ultra rapide, D1 SQLite | Limites mémoire |
| **Vercel Functions** | $0-20/mois | ~150ms | Intégration Vercel AI SDK | Cold starts |

**Recommandation : Supabase Edge Functions** — combine la DB vectorielle, l'auth Firebase existante, et les fonctions serverless en un seul service.

### 2.5 Frontend — Vercel AI SDK + Expo

L'app utilise Expo SDK 54, qui supporte nativement le streaming via `expo/fetch`.

```typescript
// src/features/ai-chat/hooks/useAIChat.ts
import { useChat } from '@ai-sdk/react'

export const useAIChat = () => {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: getApiUrl('/api/chat'),  // Expo API route ou Supabase Edge Function
    fetch: globalThis.fetch,      // expo/fetch pour le streaming
    onError: (error) => {
      // Gestion d'erreur
    },
  })

  return { messages, input, handleInputChange, handleSubmit, isLoading }
}
```

---

## 3. Widgets Interactifs — Le Coeur de l'Expérience

### 3.1 Format de Réponse Structuré

Le bot utilise un **format markdown enrichi** avec des annotations spéciales que le parseur transforme en widgets React Native cliquables.

```markdown
<!-- Exemple de réponse du bot -->
Le mot "amour" dans [[1Jean 4:8]]{book:62,chapter:4,verse:8,version:LSG}
utilise le grec **agapē** [[G26]]{type:strong,code:G26} (ἀγάπη),
qui désigne un amour inconditionnel et sacrificiel.

Ce concept est distinct de :
- **phileō** [[G5368]]{type:strong,code:G5368} — amour fraternel/amical
- **éros** — amour romantique (absent du NT)

Voir aussi le [[Dictionnaire: Amour]]{type:dict,word:amour} et les
[[Références croisées]]{type:cross_ref,book:62,chapter:4,verse:8}.

### Versets liés
- [[Romains 5:8]]{book:45,chapter:5,verse:8,version:LSG}
- [[Jean 3:16]]{book:43,chapter:3,verse:16,version:LSG}
- [[1 Corinthiens 13:4-7]]{book:46,chapter:13,verse:4,version:LSG}
```

### 3.2 Parseur de Widgets

```typescript
// src/features/ai-chat/components/MessageParser.tsx
// Le parseur détecte les patterns [[texte]]{metadata} et les transforme en composants

type WidgetType = 'verse' | 'strong' | 'dict' | 'nave' | 'cross_ref' | 'timeline'

interface WidgetData {
  type: WidgetType
  displayText: string
  // Données spécifiques au type
  book?: number
  chapter?: number
  verse?: number
  version?: string
  code?: string      // Strong code
  word?: string      // Dictionary word
  topic?: string     // Nave topic
  eventSlug?: string // Timeline event
}

// Chaque widget mappe vers une navigation existante de l'app :
const widgetActions: Record<WidgetType, (data: WidgetData, navigation) => void> = {
  verse: (data, nav) => nav.navigate('BibleView', {
    book: data.book, chapter: data.chapter, verse: data.verse
  }),
  strong: (data, nav) => nav.navigate('Strong', {
    reference: data.code, book: data.book
  }),
  dict: (data, nav) => nav.navigate('DictionnaireLetter', {
    word: data.word
  }),
  nave: (data, nav) => nav.navigate('NaveDetail', {
    name_lower: data.topic
  }),
  cross_ref: (data, nav) => nav.navigate('CrossReferences', {
    book: data.book, chapter: data.chapter, verse: data.verse
  }),
  timeline: (data, nav) => nav.navigate('Timeline', {
    eventSlug: data.eventSlug
  }),
}
```

### 3.3 Composant Widget Visuel

```typescript
// Chaque widget est un petit "chip" coloré et cliquable
// Couleurs par type pour reconnaissance immédiate :
const widgetColors = {
  verse: '#4A90D9',     // Bleu — verset
  strong: '#E8A838',    // Orange — mot hébreu/grec
  dict: '#7B68EE',      // Violet — dictionnaire
  nave: '#50C878',      // Vert — thématique
  cross_ref: '#DC143C', // Rouge — références croisées
  timeline: '#708090',  // Gris — timeline
}
```

---

## 4. Pipeline RAG Détaillé

### 4.1 Flux de Traitement d'une Question

```
Utilisateur : "Que signifie le mot hébreu pour 'paix' dans Esaïe 9:6 ?"
                    │
                    ▼
            ┌───────────────┐
            │  1. CLASSIFIER  │  ← Haiku (rapide, pas cher)
            │                 │
            │  Intent: étude  │
            │  de mot hébreu  │
            │  Complexité:    │
            │  standard       │
            └───────┬─────────┘
                    │
                    ▼
            ┌───────────────────┐
            │  2. TOOL SELECTION │  ← Le LLM choisit les outils
            │                    │
            │  Tools appelés :   │
            │  ├─ get_verse_context(book:23, ch:9, v:6, include:[strong,interlinear])
            │  ├─ search_bible(query:"paix", version:"LSGS")
            │  └─ get_dictionary_entry(word:"paix")
            └───────┬────────────┘
                    │
                    ▼
            ┌───────────────────┐
            │  3. RETRIEVE       │  ← Requêtes SQLite parallèles
            │                    │
            │  Résultats :       │
            │  ├─ Verset Esaïe 9:6 avec codes Strong
            │  ├─ H7965 (שָׁלוֹם shalom) — définition complète
            │  ├─ Interlinéaire du verset
            │  └─ Article dictionnaire "Paix"
            └───────┬────────────┘
                    │
                    ▼
            ┌───────────────────┐
            │  4. GENERATE       │  ← Haiku ou Sonnet selon complexité
            │                    │
            │  Prompt système :  │
            │  "Tu es un assistant│
            │  d'étude biblique. │
            │  Utilise le format │
            │  [[texte]]{meta}   │
            │  pour les widgets" │
            │                    │
            │  Contexte injecté :│
            │  tous les résultats│
            │  des tools         │
            └───────┬────────────┘
                    │
                    ▼
            ┌───────────────────┐
            │  5. STREAM         │  ← SSE vers l'app
            │                    │
            │  Réponse parsée    │
            │  en temps réel     │
            │  avec widgets      │
            │  interactifs       │
            └───────────────────┘
```

### 4.2 System Prompt

```typescript
const SYSTEM_PROMPT = `Tu es un assistant d'étude biblique expert, intégré à l'application Bible Strong.

RÔLE :
- Tu aides les utilisateurs à comprendre la Bible en profondeur
- Tu utilises les ressources disponibles (concordance Strong, dictionnaire, références croisées, etc.)
- Tu donnes des réponses doctrinalement neutres et académiques
- Tu cites toujours tes sources bibliques

FORMAT DE RÉPONSE :
- Pour citer un verset : [[Genèse 1:1]]{book:1,chapter:1,verse:1,version:LSG}
- Pour un mot Strong hébreu : [[shalom]]{type:strong,code:H7965}
- Pour un mot Strong grec : [[agapē]]{type:strong,code:G26}
- Pour le dictionnaire : [[Dictionnaire: Paix]]{type:dict,word:paix}
- Pour Nave : [[Nave: Amour]]{type:nave,topic:amour}
- Pour les références croisées : [[Réf. croisées]]{type:cross_ref,book:1,chapter:1,verse:1}
- Pour la timeline : [[Exode]]{type:timeline,eventSlug:exode}

RÈGLES :
- Toujours utiliser les widgets pour les références, JAMAIS du texte brut
- Citer les mots originaux (hébreu/grec) quand c'est pertinent
- Être concis mais complet
- Si tu n'es pas sûr, le dire explicitement
- Ne jamais inventer de références bibliques
- Langue : répondre dans la langue de l'utilisateur (FR ou EN)
`
```

---

## 5. Sécurité & Monitoring

### 5.1 Protection des APIs

```
┌─────────────────────────────────────────────┐
│           COUCHE SÉCURITÉ                    │
│                                              │
│  1. Auth Firebase (JWT)                      │
│     └─ Vérification du token Firebase        │
│        existant dans l'app                   │
│                                              │
│  2. Rate Limiting                            │
│     ├─ Gratuit : 20 messages/jour            │
│     ├─ Premium : 100 messages/jour           │
│     └─ Stocké dans Supabase/Redis            │
│                                              │
│  3. Clé API                                  │
│     └─ JAMAIS côté client                    │
│     └─ Uniquement dans les Edge Functions    │
│     └─ Variables d'environnement Supabase    │
│                                              │
│  4. Input Sanitization                       │
│     ├─ Longueur max : 2000 caractères        │
│     ├─ Détection injection de prompt         │
│     └─ Filtrage de contenu inapproprié       │
└─────────────────────────────────────────────┘
```

### 5.2 Monitoring des Conversations Sensibles

```typescript
// Classification automatique des conversations
interface ConversationLog {
  id: string
  userId: string
  timestamp: number
  messages: Message[]
  flags: ConversationFlag[]
  riskLevel: 'low' | 'medium' | 'high'
}

type ConversationFlag =
  | 'prompt_injection'      // Tentative de manipulation du bot
  | 'reverse_engineering'   // Questions sur le fonctionnement interne
  | 'api_probing'          // Tentatives d'extraction des prompts/outils
  | 'inappropriate'        // Contenu inapproprié
  | 'doctrinal_extreme'    // Propos doctrinalement extrêmes
  | 'off_topic'           // Hors sujet (non biblique)

// Pipeline de détection (exécuté en post-traitement, pas bloquant)
const detectSensitiveContent = async (message: string): Promise<ConversationFlag[]> => {
  const flags: ConversationFlag[] = []

  // 1. Patterns de prompt injection
  const injectionPatterns = [
    /ignore.*previous.*instructions/i,
    /system.*prompt/i,
    /you.*are.*now/i,
    /reveal.*your.*instructions/i,
    /what.*tools.*do.*you.*have/i,
  ]

  // 2. Patterns de reverse engineering
  const reversePatterns = [
    /how.*are.*you.*built/i,
    /what.*model.*are.*you/i,
    /show.*me.*your.*code/i,
    /what.*database/i,
    /api.*key/i,
  ]

  // 3. Classification par LLM (Haiku, très peu coûteux)
  // Pour les cas ambigus, un appel rapide à Haiku classifie le message

  return flags
}
```

### 5.3 Dashboard de Monitoring

```
Supabase Table: ai_conversations
├── id (UUID)
├── user_id (TEXT) — lié à Firebase Auth
├── created_at (TIMESTAMP)
├── messages (JSONB) — historique complet
├── flags (TEXT[]) — drapeaux de sécurité
├── risk_level (TEXT)
├── model_used (TEXT) — haiku/sonnet
├── tokens_used (INTEGER)
├── cost_usd (DECIMAL)
└── metadata (JSONB) — version app, langue, etc.

→ Dashboard Supabase Studio pour visualiser :
  - Conversations flaggées
  - Coût par utilisateur
  - Tendances d'utilisation
  - Alertes en temps réel (webhook → Slack/Discord)
```

---

## 6. Optimisations de Coût

### 6.1 Cache Sémantique

```typescript
// Avant chaque appel LLM, vérifier si une question similaire a déjà été posée
// Utilise les embeddings pour trouver des questions proches (cosine similarity > 0.95)

interface CachedResponse {
  questionEmbedding: number[]
  question: string
  response: string
  toolResults: Record<string, any>  // Résultats des outils utilisés
  createdAt: number
  hitCount: number
}

// Flux :
// 1. Calculer l'embedding de la question
// 2. Chercher dans le cache (pgvector similarity search)
// 3. Si match > 0.95, retourner la réponse cachée
// 4. Sinon, appeler le LLM et sauvegarder dans le cache

// Économie estimée : 30-50% des appels LLM pour les questions fréquentes
// ("Qu'est-ce que l'amour agapē ?", "Qui est l'auteur de la Genèse ?", etc.)
```

### 6.2 Contexte Adaptatif

```typescript
// Ne pas envoyer toute l'historique de conversation à chaque message
// Stratégie : fenêtre glissante + résumé

const buildContext = (messages: Message[]) => {
  if (messages.length <= 6) {
    return messages // Court : tout envoyer
  }

  // Long : résumer les anciens messages + garder les 4 derniers
  const summary = summarizeMessages(messages.slice(0, -4)) // Haiku résume
  return [
    { role: 'system', content: `Résumé de la conversation : ${summary}` },
    ...messages.slice(-4)
  ]
}
```

### 6.3 Pré-calcul des Ressources Populaires

```
Pré-générer des réponses pour :
├── Les 100 versets les plus recherchés (Jean 3:16, Psaume 23, etc.)
├── Les 50 mots Strong les plus consultés
├── Les 30 sujets doctrinaux les plus fréquents
└── Le verset du jour (bible-vod.json) — pré-enrichi chaque nuit

→ Stocké comme contenu statique, servi sans appel LLM
→ Économie : 15-25% supplémentaire
```

---

## 7. Stack Technique Finale Recommandée

### Résumé

| Composant | Technologie | Coût mensuel |
|-----------|-------------|-------------|
| **LLM standard** | GPT-4o mini (tier 1-2) | ~$10-30 |
| **LLM avancé** | Claude Sonnet 4.6 (tier 3, ~5% des requêtes) | ~$5-20 |
| **Embeddings** | text-embedding-3-small (OpenAI) | ~$0.02 (unique) |
| **Vector DB + Backend** | Supabase (pgvector + Edge Functions + Auth) | $0-25 |
| **Cache sémantique** | Supabase (même instance, 60-85% hit rate) | Inclus |
| **Monitoring** | Supabase Tables + Alertes webhook | Inclus |
| **Frontend SDK** | Vercel AI SDK (`@ai-sdk/react`) | $0 |
| **Streaming** | `expo/fetch` natif (Expo SDK 54) | $0 |
| **Total estimé** | | **~$20-75/mois** pour 1000 utilisateurs |

### Dépendances NPM à Ajouter

```json
{
  "ai": "^4.x",
  "@ai-sdk/react": "^1.x",
  "@ai-sdk/anthropic": "^1.x",
  "@supabase/supabase-js": "^2.x"
}
```

---

## 8. Structure de Fichiers Proposée

```
src/features/ai-chat/
├── AIChatScreen.tsx              # Écran principal du chat
├── components/
│   ├── ChatBubble.tsx            # Bulle de message (user/bot)
│   ├── ChatInput.tsx             # Zone de saisie avec suggestions
│   ├── MessageParser.tsx         # Parse markdown → widgets
│   ├── widgets/
│   │   ├── VerseWidget.tsx       # Widget verset cliquable
│   │   ├── StrongWidget.tsx      # Widget mot hébreu/grec
│   │   ├── DictionaryWidget.tsx  # Widget dictionnaire
│   │   ├── NaveWidget.tsx        # Widget thématique Nave
│   │   ├── CrossRefWidget.tsx    # Widget références croisées
│   │   ├── TimelineWidget.tsx    # Widget timeline
│   │   └── WidgetBase.tsx        # Composant de base (chip coloré)
│   ├── SuggestedQuestions.tsx    # Questions suggérées
│   └── TypingIndicator.tsx       # Animation de frappe
├── hooks/
│   ├── useAIChat.ts              # Hook principal (Vercel AI SDK)
│   └── useConversationHistory.ts # Historique local
├── utils/
│   ├── parseWidgets.ts           # Logique de parsing des widgets
│   └── formatPrompt.ts           # Construction du prompt avec contexte
└── types.ts                      # Types TypeScript
```

---

## 9. Plan de Déploiement Progressif

### Phase 1 — MVP (2-3 semaines)
- Chat basique avec Claude Haiku
- 3 outils : `search_bible`, `get_strong_definition`, `get_verse_context`
- Widgets versets + Strong cliquables
- Rate limiting basique (20 msg/jour gratuit)
- Pas de RAG vectoriel (juste SQL)

### Phase 2 — RAG & Enrichissement (2-3 semaines)
- Ajout recherche vectorielle (Supabase pgvector)
- Outils complets : dictionnaire, Nave, références croisées, timeline, commentaires
- Cache sémantique
- Monitoring des conversations

### Phase 3 — Optimisation (1-2 semaines)
- Modèle par paliers (routeur Haiku → Sonnet si nécessaire)
- Pré-calcul des réponses populaires
- Questions suggérées contextuelles
- Fenêtre de contexte adaptative

### Phase 4 — Premium (optionnel)
- Historique de conversations cloud (sync Firestore)
- Études guidées par l'IA (méditations, plans de lecture personnalisés)
- Mode "étude de passage" — analyse approfondie d'un chapitre entier
- Export des études en PDF

---

## 10. Alternatives et Trade-offs Considérés

### Pourquoi pas un LLM on-device ?
- [`react-native-executorch`](https://docs.swmansion.com/react-native-executorch/) supporte Llama 3.2, Qwen 3, SmolLM 2 sur Expo SDK 54
- [`llama.rn`](https://github.com/mybigday/llama.rn) permet de lancer n'importe quel modèle GGUF avec accélération GPU
- [`callstackincubator/ai`](https://github.com/callstackincubator/ai) fournit une API compatible Vercel AI SDK
- **Problème** : les modèles on-device (~3B paramètres max) sont trop limités pour de l'analyse biblique de qualité
- **Verdict** : intéressant comme fallback offline ou pour les questions très simples. Viable comme complément futur.

### Pourquoi GPT-4o mini plutôt que Claude Haiku ?
- GPT-4o mini ($0.15/$0.60) est **6-8x moins cher** que Claude Haiku 4.5 ($1.00/$5.00)
- Qualité comparable pour ce cas d'usage
- Le Vercel AI SDK est provider-agnostique → un changement d'une ligne pour switcher
- Claude Sonnet reste recommandé pour le tier avancé (meilleur Tool Use, raisonnement supérieur)
- **Verdict** : GPT-4o mini pour le quotidien, Claude Sonnet pour les analyses profondes

### Pourquoi pas tout côté client ?
- Les clés API seraient exposées → faille de sécurité critique
- Pas de monitoring possible
- Pas de cache partagé entre utilisateurs
- **Verdict** : backend obligatoire, même minimal

### Pourquoi Supabase plutôt que Firebase Functions ?
- Firebase Functions = Node.js cold starts (1-3s)
- Supabase Edge Functions = Deno, démarrage instantané (~50ms)
- pgvector intégré, pas besoin de service vectoriel séparé
- Dashboard SQL natif pour le monitoring
- **Verdict** : Supabase est plus adapté pour ce cas d'usage spécifique
- **Note** : l'app garde Firebase pour l'auth et le sync Firestore existant

---

## 11. Schéma de la Base de Données Serveur

```sql
-- Tables Supabase (en plus des SQLite miroirs)

-- Conversations
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,          -- Firebase UID
  title TEXT,                      -- Auto-généré depuis le premier message
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  message_count INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost_usd DECIMAL(10,6) DEFAULT 0,
  flags TEXT[] DEFAULT '{}',
  risk_level TEXT DEFAULT 'low',
  language TEXT DEFAULT 'fr',
  metadata JSONB DEFAULT '{}'
);

-- Messages individuels
CREATE TABLE ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_calls JSONB,               -- Outils utilisés par le bot
  tool_results JSONB,             -- Résultats des outils
  model TEXT,                     -- haiku/sonnet
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd DECIMAL(10,6),
  flags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cache sémantique
CREATE TABLE ai_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_embedding vector(1536), -- OpenAI text-embedding-3-small
  question TEXT NOT NULL,
  response TEXT NOT NULL,
  tool_results JSONB,
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days')
);

-- Index vectoriel pour la recherche de similarité
CREATE INDEX ON ai_cache USING ivfflat (question_embedding vector_cosine_ops)
  WITH (lists = 100);

-- Rate limiting
CREATE TABLE ai_rate_limits (
  user_id TEXT PRIMARY KEY,
  daily_count INTEGER DEFAULT 0,
  last_reset DATE DEFAULT CURRENT_DATE,
  tier TEXT DEFAULT 'free'        -- free/premium
);

-- Embeddings des ressources bibliques
CREATE TABLE bible_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,           -- bible/strong/dict/nave/commentary/timeline
  source_id TEXT NOT NULL,        -- ID dans la source (ex: "1-1-1" pour un verset)
  content TEXT NOT NULL,          -- Texte original
  embedding vector(1536),
  metadata JSONB,                 -- Données additionnelles (book, chapter, etc.)
  language TEXT DEFAULT 'fr'
);

CREATE INDEX ON bible_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 200);
```

---

## 12. Résumé des Décisions Clés

| Décision | Choix | Justification |
|----------|-------|---------------|
| **Approche RAG** | Tool Use + Vectoriel hybride | Données structurées = SQL, questions ouvertes = vectoriel |
| **LLM** | GPT-4o mini (standard) + Sonnet (avancé) | Meilleur rapport qualité/prix, architecture provider-agnostique |
| **Backend** | Supabase Edge Functions | Edge rapide, pgvector inclus, monitoring natif |
| **Vector DB** | Supabase pgvector | Même infra, gratuit jusqu'à 500MB |
| **Frontend SDK** | Vercel AI SDK + expo/fetch | Standard de l'industrie, streaming natif Expo 54 |
| **Widgets** | Markdown enrichi → parseur React Native | Format simple, extensible, compatible streaming |
| **Auth** | Firebase existant (JWT passé au backend) | Réutilise l'infra existante |
| **Monitoring** | Tables Supabase + webhooks | Simple, SQL queryable, pas de service tiers |
| **Cache** | Sémantique (embeddings) + TTL 30j | 60-85% hit rate pour les questions bibliques récurrentes |
| **Sécurité** | Pattern detection + classification LLM | Couverture maximale, coût minimal |

---

## 13. Sources & Références

### SDK & Frameworks
- [Vercel AI SDK — Expo Getting Started](https://ai-sdk.dev/docs/getting-started/expo)
- [Evan Bacon's expo-ai](https://github.com/EvanBacon/expo-ai) — Implémentation de référence
- [Callstack react-native-ai (on-device)](https://github.com/callstackincubator/ai)
- [React Native ExecuTorch](https://docs.swmansion.com/react-native-executorch/) — LLMs on-device
- [llama.rn](https://github.com/mybigday/llama.rn) — React Native llama.cpp binding

### Pricing & Optimisation
- [LLM API Pricing Comparison 2026](https://www.tldl.io/resources/llm-api-pricing-2026)
- [LLM Cost Optimization Guide](https://ai.koombea.com/blog/llm-cost-optimization)
- [Semantic Caching for Tiered LLM Architectures](https://arxiv.org/html/2602.13165v1)
- [LLM Token Optimization (Redis)](https://redis.io/blog/llm-token-optimization-speed-up-apps/)
- [Semantic Cache Eviction Policies](https://arxiv.org/html/2603.03301)

### RAG & Vector Search
- [RAG for Ancient Scriptures — DharmaSutra case study](https://www.gauraw.com/production-rag-system-based-app-ancient-scriptures-2026/)
- [bible-rag GitHub project](https://github.com/jacobweiss2305/bible-rag)
- [Best Chunking Strategies for RAG 2025](https://www.firecrawl.dev/blog/best-chunking-strategies-rag)
- [pgvector vs Pinecone comparison](https://supabase.com/blog/pgvector-vs-pinecone)
- [Vector Databases for RAG 2025](https://dev.to/klement_gunndu_e16216829c/vector-databases-guide-rag-applications-2025-55oj)

### Sécurité
- [OWASP LLM Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [Prompt Injection Prevention (APIsec)](https://www.apisec.ai/blog/prompt-injection-and-llm-api-security-risks-protect-your-ai)
