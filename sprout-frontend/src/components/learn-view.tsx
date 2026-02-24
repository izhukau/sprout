"use client";
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  Code2,
  ExternalLink,
  FileText,
  HelpCircle,
  Layers,
  Loader2,
  Lock,
  Mic,
  MicOff,
  PenLine,
  PhoneOff,
  Play,
  Radio,
  Send,
  Sparkles,
  Square,
  Volume2,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  type DrawSubmissionPayload,
  ExcalidrawBoard,
} from "@/components/excalidraw-board";
import { MarkdownLite } from "@/components/markdown-lite";
import { SproutAvatar } from "@/components/sprout-avatar";
import { DEFAULT_USER_ID } from "@/lib/constants";
import {
  type BackendChatMessage,
  createChatSession,
  getActiveNodeContent,
  getNode,
  listChatMessages,
  listChatSessions,
  sendTutorMessage,
} from "@/lib/backend-api";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

type SummaryCard = {
  id: string;
  type: "summary";
  title: string;
  topic: string;
  content: string;
  keyPoints: string[];
};

type QuizCard = {
  id: string;
  type: "quiz";
  title: string;
  topic: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

type CodeCard = {
  id: string;
  type: "code";
  title: string;
  topic: string;
  prompt: string;
  starterCode: string;
  hint: string;
};

type TextCard = {
  id: string;
  type: "text";
  title: string;
  topic: string;
  prompt: string;
  guidingQuestions: string[];
};

type MiroCard = {
  id: string;
  type: "miro";
  title: string;
  topic: string;
  description: string;
};

type VoiceCard = {
  id: string;
  type: "voice";
  title: string;
  topic: string;
  prompt: string;
  script: string;
};

type DrawCard = {
  id: string;
  type: "draw";
  title: string;
  topic: string;
  prompt: string;
};

type MiroSummaryCard = {
  id: string;
  type: "miro-summary";
  title: string;
  topic: string;
  keyPoints: string[];
};

type LearnCard =
  | SummaryCard
  | QuizCard
  | CodeCard
  | TextCard
  | MiroCard
  | VoiceCard
  | DrawCard
  | MiroSummaryCard;

type BackendCard = {
  id: string;
  index: number;
  explanation: string;
  question: string | null;
  questionType: AnswerMode | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "ai";
  content: string;
  linkedCardId: string | null;
  linkedCardTitle: string | null;
  channel?: "answer" | "clarification";
  answerKind?: AnswerMode;
  isComplete?: boolean;
};

type BackendTimelineItem =
  | {
      kind: "ai";
      chunk: {
        id: string;
        index: number;
        explanation: string;
        question: string | null;
        questionType: AnswerMode | null;
      };
      answers: ChatMessage[];
    }
  | { kind: "user"; message: ChatMessage };

// ── Dummy data ─────────────────────────────────────────────────────────────────

const CARDS: LearnCard[] = [
  {
    id: "c1",
    type: "summary",
    title: "What is Machine Learning?",
    topic: "Introduction",
    content:
      "Machine learning is a branch of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed. Instead of writing rules, we feed data to algorithms that build mathematical models to make decisions or predictions.",
    keyPoints: [
      "ML systems learn patterns from data rather than following explicit rules",
      "Three core paradigms: supervised, unsupervised, and reinforcement learning",
      "Training data quality directly determines model performance",
      "ML models generalise — they apply learned patterns to new, unseen data",
    ],
  },
  {
    id: "c2",
    type: "quiz",
    title: "Quiz: ML Basics",
    topic: "Introduction",
    question: "Which statement best describes supervised learning?",
    options: [
      "The algorithm discovers hidden patterns in unlabelled data",
      "The model learns by receiving rewards and penalties from an environment",
      "The algorithm learns from labelled input-output pairs to predict future outputs",
      "The system generates new data similar to its training distribution",
    ],
    correctIndex: 2,
    explanation:
      "Supervised learning uses labelled training data — each input has a corresponding correct output — so the model learns the mapping and generalises to new inputs.",
  },
  {
    id: "c3",
    type: "code",
    title: "Code: Normalise a Dataset",
    topic: "Data Preparation",
    prompt:
      "Complete the function below to normalise a list of values to the range [0, 1] using min-max scaling. The formula is: (x - min) / (max - min).",
    starterCode: `def normalise(values: list[float]) -> list[float]:
    """Return values scaled to [0, 1] using min-max normalisation."""
    # TODO: compute min and max
    # TODO: return normalised list
    pass


# Test
print(normalise([10, 20, 30, 40, 50]))
# Expected: [0.0, 0.25, 0.5, 0.75, 1.0]`,
    hint: "Compute `min_v = min(values)` and `max_v = max(values)`, then return `[(x - min_v) / (max_v - min_v) for x in values]`.",
  },
  {
    id: "c4",
    type: "text",
    title: "Explain: Overfitting",
    topic: "Model Evaluation",
    prompt:
      "In your own words, explain what overfitting is in machine learning, why it happens, and how you would detect and prevent it.",
    guidingQuestions: [
      "What does a model that overfits 'memorise' vs 'learn'?",
      "How would training accuracy vs validation accuracy reveal overfitting?",
      "Name two regularisation techniques that help prevent it.",
    ],
  },
  {
    id: "c-draw",
    type: "draw",
    title: "Sketch: Decision Boundary",
    topic: "Model Evaluation",
    prompt:
      "On the whiteboard, sketch a 2D scatter plot with two classes (circles and crosses). Draw the decision boundary a linear classifier would learn, then annotate where overfitting vs underfitting might occur.",
  },
  {
    id: "c5",
    type: "miro",
    title: "Concept Map: Types of ML",
    topic: "Core Concepts",
    description:
      "Explore the interactive concept map below to visualise the three main learning paradigms and their relationships. Drag nodes, add your own connections, and annotate what you've learnt.",
  },
  {
    id: "c6",
    type: "voice",
    title: "Voice: Neural Networks Explained",
    topic: "Deep Learning",
    prompt:
      "Listen to the AI explanation of neural networks, then record a 60-second summary in your own words. Your spoken response will be transcribed and analysed for comprehension.",
    script:
      "A neural network is a computational graph of interconnected nodes inspired by biological neurons. Each layer transforms its input through a learned weight matrix followed by a non-linear activation function. During training, backpropagation computes the gradient of the loss with respect to every weight, and an optimiser like Adam iteratively adjusts those weights to minimise prediction error. Deeper networks can represent increasingly abstract features — edges become textures become shapes become objects.",
  },
  {
    id: "c7",
    type: "summary",
    title: "Neural Networks",
    topic: "Deep Learning",
    content:
      "Neural networks are computational models loosely inspired by the brain. They consist of layers of interconnected nodes. Each connection carries a weight adjusted during training via backpropagation, allowing the network to learn complex, non-linear mappings from inputs to outputs.",
    keyPoints: [
      "Input layer receives raw features; hidden layers extract representations; output produces predictions",
      "Activation functions (ReLU, sigmoid, softmax) introduce non-linearity",
      "Backpropagation computes gradients; optimisers (SGD, Adam) update weights",
      "Depth enables learning hierarchical, abstract representations",
    ],
  },
  {
    id: "c8",
    type: "quiz",
    title: "Quiz: Neural Networks",
    topic: "Deep Learning",
    question:
      "What is the primary role of activation functions in a neural network?",
    options: [
      "They initialise the weights before training begins",
      "They introduce non-linearity, enabling the network to learn complex patterns",
      "They determine the learning rate during backpropagation",
      "They shuffle training data to prevent overfitting",
    ],
    correctIndex: 1,
    explanation:
      "Without non-linear activation functions, stacking linear layers is equivalent to a single linear transformation. Activations like ReLU allow networks to model highly complex, non-linear relationships.",
  },
  {
    id: "c-miro-summary",
    type: "miro-summary",
    title: "Topic Summary Board",
    topic: "Machine Learning Fundamentals",
    keyPoints: [
      "ML learns patterns from data — no explicit rules",
      "Supervised learning uses labelled input-output pairs",
      "Unsupervised learning finds hidden structure in data",
      "Min-max normalisation scales features to [0, 1]",
      "Overfitting: memorises training data, fails to generalise",
      "Neural networks learn via backpropagation + gradient descent",
      "Activation functions (ReLU) introduce non-linearity",
      "Depth enables hierarchical, abstract representations",
    ],
  },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "m0",
    role: "ai",
    content:
      "Hi! I'm your AI tutor. I'll guide you through each card and answer any questions. Let's start — what is machine learning?",
    linkedCardId: null,
    linkedCardTitle: null,
  },
  {
    id: "m1",
    role: "ai",
    content:
      "The core insight: ML doesn't write rules — it discovers them from data. Think of teaching a child by examples rather than a rulebook.",
    linkedCardId: "c1",
    linkedCardTitle: "What is Machine Learning?",
  },
  {
    id: "m2",
    role: "user",
    content: "What's the difference between a model and an algorithm?",
    linkedCardId: "c1",
    linkedCardTitle: "What is Machine Learning?",
  },
  {
    id: "m3",
    role: "ai",
    content:
      "An algorithm is the procedure (e.g. gradient descent). A model is the output — the learned function with fitted parameters. The algorithm trains the model; the model makes predictions.",
    linkedCardId: "c1",
    linkedCardTitle: "What is Machine Learning?",
  },
  {
    id: "m4",
    role: "ai",
    content:
      "For this quiz, focus on the word 'labelled'. Only one option explicitly mentions learning from labelled input-output pairs.",
    linkedCardId: "c2",
    linkedCardTitle: "Quiz: ML Basics",
  },
  {
    id: "m5",
    role: "ai",
    content:
      "Min-max normalisation squashes all values into [0, 1]. Watch out for edge cases — what happens if all values are identical?",
    linkedCardId: "c3",
    linkedCardTitle: "Code: Normalise a Dataset",
  },
];

function mapBackendMessagesToUi(messages: BackendChatMessage[]): ChatMessage[] {
  const parseAnswerModeToken = (raw: string): AnswerMode | null => {
    const normalized = raw
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");
    if (normalized === "text") return "text";
    if (normalized === "code") return "code";
    if (normalized === "draw" || normalized === "drawing") return "draw";
    if (
      normalized === "mcp" ||
      normalized === "mcq" ||
      normalized === "multiple choice" ||
      normalized === "multiple choices" ||
      normalized === "multiple choice question"
    ) {
      return "text";
    }
    return null;
  };

  const parseTaggedUserMessage = (
    raw: string,
  ): {
    content: string;
    channel: "answer" | "clarification";
    answerKind?: AnswerMode;
  } => {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[CLARIFICATION]")) {
      return {
        content: trimmed.replace(/^\[CLARIFICATION\]\s*/i, ""),
        channel: "clarification",
      };
    }
    if (trimmed.startsWith("[ANSWER]")) {
      const withoutTag = trimmed.replace(/^\[ANSWER\]\s*/i, "").trim();
      const lines = withoutTag.split(/\r?\n/);
      if (lines.length > 0) {
        const match = lines[0].match(/^\s*mode\s*:\s*(.+)\s*$/i);
        if (match?.[1]) {
          const parsedKind = parseAnswerModeToken(match[1]);
          if (parsedKind) {
            return {
              content: lines.slice(1).join("\n").trim(),
              channel: "answer",
              answerKind: parsedKind,
            };
          }
        }
      }
      return {
        content: withoutTag,
        channel: "answer",
      };
    }

    return { content: raw, channel: "answer" };
  };

  const sorted = [...messages]
    .filter(
      (message) => message.role === "user" || message.role === "assistant",
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const mapped: ChatMessage[] = [];
  let pendingAssistantChannel: "answer" | "clarification" | null = null;

  for (const message of sorted) {
    if (message.role === "assistant") {
      const channel =
        message.kind === "hint_response"
          ? "clarification"
          : pendingAssistantChannel;

      mapped.push({
        id: message.id,
        role: "ai",
        content: message.content,
        linkedCardId: null,
        linkedCardTitle: null,
        channel: channel ?? undefined,
      });

      pendingAssistantChannel = null;
      continue;
    }

    const parsed = parseTaggedUserMessage(message.content);
    const channel =
      message.kind === "hint_request" ? "clarification" : parsed.channel;

    mapped.push({
      id: message.id,
      role: "user",
      content: parsed.content,
      linkedCardId: null,
      linkedCardTitle: null,
      channel,
      answerKind: parsed.answerKind,
    });

    pendingAssistantChannel = channel;
  }

  return mapped;
}

function splitTutorChunk(content: string): {
  explanation: string;
  question: string | null;
  questionType: AnswerMode | null;
} {
  const normalized = content.replaceAll("\r\n", "\n").trim();
  if (!normalized) {
    return { explanation: "", question: null, questionType: null };
  }

  const rawLines = normalized.split("\n");

  const normalizeQuestionLine = (line: string) =>
    line
      .replace(/^\s*#{1,6}\s*/, "")
      .replace(/^\s*(?:[-*>]|\d+[.)])\s+/, "")
      .replace(
        /^\s*(checkpoint\s+question|new\s+question|question)\s*:\s*/i,
        "",
      )
      .trim();

  const stripQuestionLinePrefix = (line: string) =>
    line
      .replace(/^\s*#{1,6}\s*/, "")
      .replace(/^\s*(?:[-*>]|\d+[.)])\s+/, "")
      .trim();

  const toMarkerComparable = (line: string) =>
    stripQuestionLinePrefix(line)
      .replace(/[*_`~]/g, "")
      .trim();

  const isQuestionMarkerOnly = (line: string) =>
    /^(checkpoint\s+question|new\s+question|question)\s*:?\s*$/i.test(
      toMarkerComparable(line),
    );

  const extractInlineQuestion = (line: string): string | null => {
    const stripped = stripQuestionLinePrefix(line);
    const colonIndex = stripped.indexOf(":");
    if (colonIndex === -1) return null;

    const marker = stripped
      .slice(0, colonIndex)
      .replace(/[*_`~]/g, "")
      .trim();
    if (!/^(checkpoint\s+question|new\s+question|question)$/i.test(marker)) {
      return null;
    }

    const questionBody = stripped
      .slice(colonIndex + 1)
      .replace(/^\s*[*_`~]+\s*/, "")
      .trim();
    const questionText = normalizeQuestionLine(questionBody);
    return questionText || null;
  };

  const hasInlineQuestion = (line: string): boolean =>
    /^(checkpoint\s+question|new\s+question|question)\s*:\s*.+$/i.test(
      toMarkerComparable(line),
    );

  const parseQuestionTypeToken = (raw: string): AnswerMode | null => {
    const normalizedToken = raw
      .replace(/[*_`~]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");

    if (normalizedToken === "text") return "text";
    if (normalizedToken === "code") return "code";
    if (normalizedToken === "draw" || normalizedToken === "drawing")
      return "draw";
    if (
      normalizedToken === "mcp" ||
      normalizedToken === "mcq" ||
      normalizedToken === "multiple choice" ||
      normalizedToken === "multiple choices" ||
      normalizedToken === "multiple choice question"
    ) {
      return "text";
    }

    return null;
  };

  const extractQuestionType = (line: string): AnswerMode | null => {
    const stripped = stripQuestionLinePrefix(line);
    const match = stripped.match(
      /^\s*(question\s*type|question-type|mode)\s*[:\-–—]\s*(.+)\s*$/i,
    );
    if (!match?.[2]) return null;
    return parseQuestionTypeToken(match[2]);
  };

  const questionType =
    rawLines.map((line) => extractQuestionType(line)).find(Boolean) ?? null;

  const explanationWithoutQuestionType = (lines: string[]) =>
    lines
      .filter((line) => !extractQuestionType(line))
      .join("\n")
      .trim();

  const trimEmptyEdges = (lines: string[]) => {
    const copy = [...lines];
    while (copy.length && !copy[0].trim()) copy.shift();
    while (copy.length && !copy[copy.length - 1].trim()) copy.pop();
    return copy;
  };

  for (let i = 0; i < rawLines.length; i++) {
    if (!isQuestionMarkerOnly(rawLines[i])) continue;

    const questionParts: string[] = [];
    for (let j = i + 1; j < rawLines.length; j++) {
      if (isQuestionMarkerOnly(rawLines[j]) || hasInlineQuestion(rawLines[j])) {
        break;
      }
      if (extractQuestionType(rawLines[j])) continue;

      const rawLine = rawLines[j];
      const comparableLine = stripQuestionLinePrefix(rawLine)
        .replace(/[*_`~]/g, "")
        .trim();

      if (!questionParts.length && parseQuestionTypeToken(comparableLine)) {
        continue;
      }

      if (!rawLine.trim()) {
        if (questionParts.length) questionParts.push("");
        continue;
      }

      if (!questionParts.length) {
        const normalizedLeadLine = normalizeQuestionLine(rawLine);
        if (normalizedLeadLine) questionParts.push(normalizedLeadLine);
        continue;
      }

      questionParts.push(rawLine.trimEnd());
    }
    const questionText = trimEmptyEdges(questionParts).join("\n").trim();

    if (questionText) {
      return {
        explanation: explanationWithoutQuestionType(rawLines.slice(0, i)),
        question: questionText,
        questionType,
      };
    }
  }

  for (let i = 0; i < rawLines.length; i++) {
    const inlineQuestionHead = extractInlineQuestion(rawLines[i]);
    if (inlineQuestionHead) {
      const questionParts: string[] = [inlineQuestionHead];
      for (let j = i + 1; j < rawLines.length; j++) {
        if (
          isQuestionMarkerOnly(rawLines[j]) ||
          hasInlineQuestion(rawLines[j])
        ) {
          break;
        }
        if (extractQuestionType(rawLines[j])) continue;

        const rawLine = rawLines[j];
        if (!rawLine.trim()) {
          questionParts.push("");
          continue;
        }

        questionParts.push(rawLine.trimEnd());
      }

      const questionText = trimEmptyEdges(questionParts).join("\n").trim();
      return {
        explanation: explanationWithoutQuestionType(rawLines.slice(0, i)),
        question: questionText,
        questionType,
      };
    }
  }

  for (let i = rawLines.length - 1; i >= 0; i--) {
    if (extractQuestionType(rawLines[i])) continue;
    const candidate = normalizeQuestionLine(rawLines[i]);
    if (candidate.endsWith("?")) {
      return {
        explanation: explanationWithoutQuestionType(rawLines.slice(0, i)),
        question: candidate,
        questionType,
      };
    }
  }

  return {
    explanation: explanationWithoutQuestionType(rawLines),
    question: null,
    questionType,
  };
}

// ── Main component ─────────────────────────────────────────────────────────────

type AnswerMode = "text" | "code" | "draw";

const CODE_KEYWORDS = new Set([
  "and",
  "as",
  "break",
  "case",
  "catch",
  "char",
  "class",
  "const",
  "continue",
  "def",
  "do",
  "double",
  "elif",
  "else",
  "enum",
  "false",
  "finally",
  "float",
  "for",
  "from",
  "function",
  "if",
  "import",
  "in",
  "int",
  "let",
  "new",
  "null",
  "None",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "var",
  "void",
  "while",
]);

const CODE_TOKEN_REGEX =
  /\/\/.*$|#.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:and|as|break|case|catch|char|class|const|continue|def|do|double|elif|else|enum|false|finally|float|for|from|function|if|import|in|int|let|new|null|None|private|protected|public|return|static|switch|this|throw|true|try|var|void|while)\b|\b\d+(?:\.\d+)?\b/g;

function getCodeTokenColor(token: string): string | null {
  if (token.startsWith("//") || token.startsWith("#")) return "#94a3b8";
  if (token.startsWith('"') || token.startsWith("'") || token.startsWith("`"))
    return "#86efac";
  if (/^\d+(?:\.\d+)?$/.test(token)) return "#fbbf24";
  if (CODE_KEYWORDS.has(token)) return "#60a5fa";
  return null;
}

function highlightCodeToNodes(source: string): ReactNode[] {
  if (!source) return [];

  const normalized = source.replaceAll("\r\n", "\n");
  const lines = normalized.split("\n");
  const nodes: ReactNode[] = [];
  let absoluteOffset = 0;

  for (const line of lines) {
    const lineStart = absoluteOffset;
    const regex = new RegExp(CODE_TOKEN_REGEX);
    let cursor = 0;
    let match = regex.exec(line);

    while (match) {
      const token = match[0];
      const start = match.index ?? 0;
      const end = start + token.length;

      if (start > cursor) {
        const plainText = line.slice(cursor, start);
        nodes.push(<span key={`t-${lineStart + cursor}`}>{plainText}</span>);
      }

      const color = getCodeTokenColor(token);
      nodes.push(
        <span
          key={`t-${lineStart + start}`}
          style={color ? { color } : undefined}
        >
          {token}
        </span>,
      );

      cursor = end;
      match = regex.exec(line);
    }

    if (cursor < line.length) {
      nodes.push(
        <span key={`t-${lineStart + cursor}`}>{line.slice(cursor)}</span>,
      );
    } else if (!line.length) {
      nodes.push(<span key={`t-${lineStart}`}> </span>);
    }

    absoluteOffset += line.length;
    if (absoluteOffset < normalized.length) {
      nodes.push(<br key={`br-${absoluteOffset}`} />);
      absoluteOffset += 1;
    }
  }

  return nodes;
}

const ANSWER_MODE_META: Record<
  AnswerMode,
  {
    label: string;
    helper: string;
    placeholder: string;
    Icon: (props: { className?: string }) => ReturnType<typeof FileText>;
  }
> = {
  text: {
    label: "Text",
    helper: "Explain in plain language.",
    placeholder: "Type your answer...",
    Icon: FileText,
  },
  code: {
    label: "Code",
    helper: "Write runnable code or pseudocode.",
    placeholder: "Write code answer...",
    Icon: Code2,
  },
  draw: {
    label: "Draw",
    helper: "Sketch and optionally add a short note.",
    placeholder: "Describe your drawing...",
    Icon: PenLine,
  },
};

type VoiceConversation = {
  status: "disconnected" | "connecting" | "connected";
  isSpeaking: boolean;
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  sendContextualUpdate: (text: string) => void;
};

function useVoiceConversation(): VoiceConversation {
  const [status, setStatus] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const startSession = useCallback(async () => {
    if (status === "connecting" || status === "connected") return;
    setStatus("connecting");

    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      setStatus("connected");
    } catch (error) {
      setStatus("disconnected");
      throw error;
    }
  }, [status]);

  const endSession = useCallback(async () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    setIsSpeaking(false);
    setStatus("disconnected");
  }, []);

  const sendContextualUpdate = useCallback(
    (text: string) => {
      if (status !== "connected") return;
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [status],
  );

  return { status, isSpeaking, startSession, endSession, sendContextualUpdate };
}

export function LearnView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nodeId = searchParams.get("nodeId");
  const branchIdFromQuery = searchParams.get("branchId");
  const conceptIdFromQuery = searchParams.get("conceptId");
  const backendUserId = DEFAULT_USER_ID;
  const isBackendChatEnabled = !!nodeId;

  const [activeIndex, setActiveIndex] = useState(0);
  const [quizSelected, setQuizSelected] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<Set<string>>(new Set());
  const [codeValues, setCodeValues] = useState<Record<string, string>>({});
  const [codeSubmitted, setCodeSubmitted] = useState<Set<string>>(new Set());
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [textSubmitted, setTextSubmitted] = useState<Set<string>>(new Set());
  const [voiceStates, setVoiceStates] = useState<
    Record<string, "idle" | "playing" | "recording" | "done">
  >({});
  const [drawSubmitted, setDrawSubmitted] = useState<Set<string>>(new Set());
  const [miroEmbedUrls, setMiroEmbedUrls] = useState<Record<string, string>>(
    {},
  );
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [clarifyInput, setClarifyInput] = useState("");
  const [answerInput, setAnswerInput] = useState("");
  const [codeAnswerInput, setCodeAnswerInput] = useState("");
  const [drawAnswerInput, setDrawAnswerInput] = useState("");
  const [drawAnswerImageDataUrl, setDrawAnswerImageDataUrl] = useState<
    string | null
  >(null);
  const [answerMode, setAnswerMode] = useState<AnswerMode>("text");
  const [isDrawAnswerBoardOpen, setIsDrawAnswerBoardOpen] = useState(false);
  const [isDrawAnswerBoardSubmitted, setIsDrawAnswerBoardSubmitted] =
    useState(false);
  const [voiceTutorEnabled, setVoiceTutorEnabled] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isTutorSending, setIsTutorSending] = useState(false);
  const [pendingTutorChannel, setPendingTutorChannel] = useState<
    "answer" | "clarification" | null
  >(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [nodeTitle, setNodeTitle] = useState<string | null>(null);
  const [nodeExplanation, setNodeExplanation] = useState<string | null>(null);
  const [isNodeLoading, setIsNodeLoading] = useState(false);
  const [backendCards, setBackendCards] = useState<BackendCard[]>([]);

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const codeAnswerLineNumbersRef = useRef<HTMLDivElement | null>(null);
  const codeAnswerOverlayRef = useRef<HTMLPreElement | null>(null);

  // Use backend cards when available, otherwise fall back to hardcoded demo cards
  const useBackendCards = isBackendChatEnabled && backendCards.length > 0;
  const effectiveCards: LearnCard[] = useMemo(() => {
    if (!useBackendCards) return CARDS;
    return backendCards.map((bc) => ({
      id: bc.id,
      type: "text" as const,
      title: bc.question ?? `Chunk ${bc.index + 1}`,
      topic: "",
      prompt: bc.explanation,
      guidingQuestions: bc.question ? [bc.question] : [],
    }));
  }, [useBackendCards, backendCards]);

  const activeCard = effectiveCards[activeIndex] as LearnCard | undefined;
  const isFinished = activeIndex >= effectiveCards.length;
  const highlightedCodeAnswerNodes = useMemo(
    () => highlightCodeToNodes(codeAnswerInput),
    [codeAnswerInput],
  );

  const conversation = useVoiceConversation();

  const startVoiceTutor = useCallback(async () => {
    try {
      await conversation.startSession();
      setVoiceTutorEnabled(true);
      setChatError(null);
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : "Failed to start voice tutor session",
      );
      setVoiceTutorEnabled(false);
    }
  }, [conversation]);

  const stopVoiceTutor = useCallback(async () => {
    try {
      await conversation.endSession();
    } finally {
      setVoiceTutorEnabled(false);
    }
  }, [conversation]);

  const scrollToCard = useCallback((cardId: string) => {
    cardRefs.current[cardId]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, []);

  const syncCodeAnswerScroll = useCallback((textarea: HTMLTextAreaElement) => {
    if (codeAnswerLineNumbersRef.current) {
      codeAnswerLineNumbersRef.current.scrollTop = textarea.scrollTop;
    }
    if (!codeAnswerOverlayRef.current) return;
    codeAnswerOverlayRef.current.scrollTop = textarea.scrollTop;
    codeAnswerOverlayRef.current.scrollLeft = textarea.scrollLeft;
  }, []);

  const handleCodeAnswerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Tab") return;
      event.preventDefault();

      const textarea = event.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextValue = `${codeAnswerInput.slice(0, start)}\t${codeAnswerInput.slice(end)}`;

      setCodeAnswerInput(nextValue);
      requestAnimationFrame(() => {
        textarea.selectionStart = start + 1;
        textarea.selectionEnd = start + 1;
        syncCodeAnswerScroll(textarea);
      });
    },
    [codeAnswerInput, syncCodeAnswerScroll],
  );

  useEffect(() => {
    if (!activeCard) return;
    cardRefs.current[activeCard.id]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeCard]);

  const msgCount = messages.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: chatEndRef is stable
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgCount]);

  useEffect(() => {
    if (conversation.status === "connected") {
      setVoiceTutorEnabled(true);
      return;
    }

    if (conversation.status === "disconnected") {
      setVoiceTutorEnabled(false);
    }
  }, [conversation.status]);

  useEffect(() => {
    if (!isBackendChatEnabled || !nodeId || !backendUserId) {
      setChatSessionId(null);
      setIsSessionComplete(false);
      setIsChatLoading(false);
      setChatError(null);
      setMessages(INITIAL_MESSAGES);
      return;
    }

    let cancelled = false;

    const bootstrapBackendChat = async () => {
      setIsChatLoading(true);
      setChatError(null);
      setMessages([]);

      try {
        const sessions = await listChatSessions({
          userId: backendUserId,
          nodeId,
        });
        const sortedSessions = [...sessions].sort((a, b) =>
          b.startedAt.localeCompare(a.startedAt),
        );
        const resolvedSession =
          sortedSessions.find((session) => !session.endedAt) ??
          sortedSessions[0] ??
          (await createChatSession({ userId: backendUserId, nodeId }));

        if (cancelled) return;
        setChatSessionId(resolvedSession.id);
        setIsSessionComplete(Boolean(resolvedSession.endedAt));

        let history = await listChatMessages(resolvedSession.id);
        if (!history.length) {
          const firstResponse = await sendTutorMessage(resolvedSession.id, {
            userId: backendUserId,
            content: "",
          });
          if (cancelled) return;
          setIsSessionComplete(firstResponse.isComplete);
          history = await listChatMessages(resolvedSession.id);
        }

        if (cancelled) return;
        setMessages(mapBackendMessagesToUi(history));
      } catch (error) {
        if (cancelled) return;
        setChatError(
          error instanceof Error
            ? error.message
            : "Failed to connect tutor chat",
        );
      } finally {
        if (!cancelled) setIsChatLoading(false);
      }
    };

    void bootstrapBackendChat();

    return () => {
      cancelled = true;
    };
  }, [isBackendChatEnabled, nodeId, backendUserId]);

  useEffect(() => {
    if (!isBackendChatEnabled || !nodeId) {
      setNodeTitle(null);
      setNodeExplanation(null);
      setIsNodeLoading(false);
      return;
    }

    let cancelled = false;

    const loadNodeExplanation = async () => {
      setIsNodeLoading(true);
      try {
        const [node, content] = await Promise.all([
          getNode(nodeId),
          getActiveNodeContent(nodeId),
        ]);
        if (cancelled) return;
        setNodeTitle(node.title);
        setNodeExplanation(content?.explanationMd ?? node.desc ?? null);
        // Parse persisted cards
        if (content?.cards) {
          try {
            const parsed = JSON.parse(content.cards) as BackendCard[];
            setBackendCards(parsed);
          } catch {
            setBackendCards([]);
          }
        } else {
          setBackendCards([]);
        }
      } catch {
        if (cancelled) return;
        setNodeTitle(null);
        setNodeExplanation(null);
        setBackendCards([]);
      } finally {
        if (!cancelled) setIsNodeLoading(false);
      }
    };

    void loadNodeExplanation();

    return () => {
      cancelled = true;
    };
  }, [isBackendChatEnabled, nodeId]);

  const handleContinue = useCallback(() => {
    setActiveIndex((i) => i + 1);
  }, []);

  const sendMessageToTutor = useCallback(
    async (
      content: string,
      channel: "answer" | "clarification",
      answerKind?: AnswerMode,
      options?: { drawingImageDataUrl?: string | null },
    ) => {
      const trimmedInput = content.trim();
      if (!trimmedInput) return;

      const card = isFinished ? null : activeCard;
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmedInput,
        linkedCardId: card?.id ?? null,
        linkedCardTitle: card?.title ?? null,
        channel,
        answerKind: channel === "answer" ? answerKind : undefined,
      };

      if (isBackendChatEnabled && chatSessionId && backendUserId) {
        setMessages((prev) => [...prev, userMsg]);
        setIsTutorSending(true);
        setPendingTutorChannel(channel);
        setChatError(null);

        try {
          const taggedContent =
            channel === "clarification"
              ? `[CLARIFICATION]\n${trimmedInput}`
              : `[ANSWER]\n${answerKind ? `Mode: ${answerKind}\n` : ""}${trimmedInput}`;
          const response = await sendTutorMessage(chatSessionId, {
            userId: backendUserId,
            content: taggedContent,
            drawingImageDataUrl: options?.drawingImageDataUrl ?? undefined,
          });
          setIsSessionComplete((prev) => prev || response.isComplete);

          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "ai",
              content: response.message,
              linkedCardId: null,
              linkedCardTitle: null,
              channel,
              isComplete: response.isComplete,
            },
          ]);

          // Refresh persisted cards after tutor response
          if (nodeId && channel === "answer") {
            getActiveNodeContent(nodeId)
              .then((content) => {
                if (content?.cards) {
                  try {
                    setBackendCards(JSON.parse(content.cards) as BackendCard[]);
                  } catch {
                    /* ignore parse errors */
                  }
                }
              })
              .catch(() => {
                /* ignore fetch errors */
              });
          }
        } catch (error) {
          setChatError(
            error instanceof Error ? error.message : "Failed to send message",
          );
        } finally {
          setIsTutorSending(false);
          setPendingTutorChannel(null);
        }

        return;
      }

      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "ai",
        content: card
          ? `Good question about "${card.title}"! Keep engaging with the material — the more connections you make, the deeper the understanding.`
          : "Great follow-up! Feel free to revisit any card if you want to reinforce your learning.",
        linkedCardId: card?.id ?? null,
        linkedCardTitle: card?.title ?? null,
      };

      setMessages((prev) => [...prev, userMsg, aiMsg]);
    },
    [
      activeCard,
      isFinished,
      isBackendChatEnabled,
      chatSessionId,
      backendUserId,
      nodeId,
    ],
  );

  const handleSendClarification = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const text = clarifyInput.trim();
      if (!text) return;
      setClarifyInput("");
      await sendMessageToTutor(text, "clarification");
    },
    [clarifyInput, sendMessageToTutor],
  );

  const handleSubmitAnswer = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      let text = "";

      if (answerMode === "text") {
        text = answerInput.trim();
      } else if (answerMode === "code") {
        text = codeAnswerInput.trim();
      } else {
        const drawText = drawAnswerInput.trim();
        const hasDrawAttachment = Boolean(drawAnswerImageDataUrl);
        if (hasDrawAttachment && drawText) {
          text = `${drawText}\n\n[Drawing image attached]`;
        } else if (hasDrawAttachment) {
          text = "[Drawing image attached]";
        } else if (isDrawAnswerBoardSubmitted && drawText) {
          text = `${drawText}\n\n[Drawing submitted]`;
        } else if (isDrawAnswerBoardSubmitted) {
          text = "[Drawing submitted]";
        } else {
          text = drawText;
        }
      }

      if (!text) return;

      if (answerMode === "text") {
        setAnswerInput("");
      } else if (answerMode === "code") {
        setCodeAnswerInput("");
      } else {
        setDrawAnswerInput("");
        setDrawAnswerImageDataUrl(null);
        setIsDrawAnswerBoardSubmitted(false);
      }

      await sendMessageToTutor(text, "answer", answerMode, {
        drawingImageDataUrl:
          answerMode === "draw" ? drawAnswerImageDataUrl : undefined,
      });
    },
    [
      answerMode,
      answerInput,
      codeAnswerInput,
      drawAnswerInput,
      drawAnswerImageDataUrl,
      isDrawAnswerBoardSubmitted,
      sendMessageToTutor,
    ],
  );

  // Only show messages for cards already studied
  const visibleMessages = messages.filter((msg) => {
    if (!msg.linkedCardId) return true;
    const idx = effectiveCards.findIndex((c) => c.id === msg.linkedCardId);
    return idx <= activeIndex;
  });

  const tutorChunks = useMemo(() => {
    if (!isBackendChatEnabled) return [];

    const aiMessages = messages.filter(
      (message) => message.role === "ai" && message.channel !== "clarification",
    );
    let lastKnownQuestion: string | null = null;
    let lastKnownQuestionType: AnswerMode = "text";

    return aiMessages.map((message, index) => {
      const parsed = splitTutorChunk(message.content);
      const isLastChunk = index === aiMessages.length - 1;
      const canReusePreviousQuestion =
        !message.isComplete && !(isLastChunk && isSessionComplete);
      const question =
        parsed.question ??
        (canReusePreviousQuestion
          ? (lastKnownQuestion ??
            "What is the key idea from this chunk, in your own words?")
          : null);
      const questionType =
        parsed.questionType ??
        (question && canReusePreviousQuestion ? lastKnownQuestionType : null);

      if (question) {
        lastKnownQuestion = question;
        lastKnownQuestionType = questionType ?? "text";
      }

      return {
        id: message.id,
        index,
        explanation: parsed.explanation || message.content,
        question,
        questionType,
      };
    });
  }, [isBackendChatEnabled, isSessionComplete, messages]);

  const currentChunk = tutorChunks.length
    ? tutorChunks[tutorChunks.length - 1]
    : null;
  const currentQuestion = currentChunk?.question ?? null;
  const currentQuestionType = currentChunk?.questionType ?? answerMode;

  useEffect(() => {
    if (!isBackendChatEnabled) return;
    setAnswerMode(currentChunk?.questionType ?? "text");
  }, [isBackendChatEnabled, currentChunk?.questionType]);

  useEffect(() => {
    if (!voiceTutorEnabled || conversation.status !== "connected") return;

    const context = [
      `Topic: ${nodeTitle ?? "Current subconcept"}`,
      `Current question: ${currentQuestion ?? "No active question yet."}`,
      `Current question type: ${currentQuestion ? currentQuestionType : "n/a"}`,
      `Latest chunk index: ${currentChunk ? currentChunk.index + 1 : 0}`,
    ].join("\n");

    const timer = setTimeout(() => {
      conversation.sendContextualUpdate(context);
    }, 400);

    return () => clearTimeout(timer);
  }, [
    voiceTutorEnabled,
    conversation,
    nodeTitle,
    currentQuestion,
    currentQuestionType,
    currentChunk,
  ]);

  const backendTimeline = useMemo(() => {
    if (!isBackendChatEnabled) return [];

    const chunkById = new Map(tutorChunks.map((chunk) => [chunk.id, chunk]));
    const timeline: BackendTimelineItem[] = [];
    let lastAgentItem: Extract<BackendTimelineItem, { kind: "ai" }> | null =
      null;

    for (const message of messages) {
      if (message.role === "ai") {
        if (message.channel === "clarification") continue;
        const chunk = chunkById.get(message.id);
        if (!chunk) continue;
        const agentItem: Extract<BackendTimelineItem, { kind: "ai" }> = {
          kind: "ai",
          chunk,
          answers: [],
        };
        timeline.push(agentItem);
        lastAgentItem = agentItem;
      } else {
        if (message.channel === "answer" && lastAgentItem) {
          lastAgentItem.answers.push(message);
        }
      }
    }

    return timeline;
  }, [isBackendChatEnabled, messages, tutorChunks]);

  const sidebarMessages = isBackendChatEnabled
    ? messages.filter((message) => message.channel === "clarification")
    : visibleMessages;

  // Cards to render: completed + active only
  const renderedCards = effectiveCards.slice(0, activeIndex + 1);
  const nextCard = effectiveCards[activeIndex + 1] as LearnCard | undefined;
  const currentAnswerDraft = useMemo(() => {
    if (answerMode === "text") return answerInput.trim();
    if (answerMode === "code") return codeAnswerInput.trim();
    if (drawAnswerInput.trim()) return drawAnswerInput.trim();
    if (drawAnswerImageDataUrl) return "[Drawing image attached]";
    if (isDrawAnswerBoardSubmitted) return "[Drawing submitted]";
    return "";
  }, [
    answerMode,
    answerInput,
    codeAnswerInput,
    drawAnswerInput,
    drawAnswerImageDataUrl,
    isDrawAnswerBoardSubmitted,
  ]);
  const isClarificationSendDisabled =
    !clarifyInput.trim() ||
    isTutorSending ||
    (isBackendChatEnabled && (isChatLoading || !chatSessionId));
  const isAnswerSendDisabled =
    !currentAnswerDraft ||
    isTutorSending ||
    !currentQuestion ||
    (isBackendChatEnabled && (isChatLoading || !chatSessionId));

  const handleBackToSubconcepts = useCallback(() => {
    if (branchIdFromQuery && conceptIdFromQuery) {
      const query = new URLSearchParams({
        branchId: branchIdFromQuery,
        conceptId: conceptIdFromQuery,
      });
      router.push(`/graph?${query.toString()}`);
      return;
    }

    router.push("/graph");
  }, [branchIdFromQuery, conceptIdFromQuery, router]);
  const graphTheme = {
    bg: "#0A1A0F",
    panel: "rgba(17,34,20,0.55)",
    panelMuted: "rgba(17,34,20,0.42)",
    border: "rgba(46,232,74,0.16)",
    borderStrong: "rgba(46,232,74,0.28)",
    textMuted: "rgba(255,255,255,0.58)",
    accent: "#2EE84A",
    accentSoft: "#3DBF5A",
    accentBg: "rgba(46,232,74,0.1)",
    accentBgStrong: "rgba(46,232,74,0.16)",
    accentBorder: "rgba(46,232,74,0.3)",
    accentText: "#BFF8C9",
  } as const;

  return (
    <div
      className="flex h-screen w-screen overflow-hidden"
      style={{ background: graphTheme.bg }}
    >
      {/* ── Card column ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header
          className="flex shrink-0 items-center justify-between border-b px-8 py-4"
          style={{
            borderColor: graphTheme.border,
            background: graphTheme.panel,
          }}
        >
          <div className="flex items-center gap-3">
            {isBackendChatEnabled && (
              <button
                type="button"
                onClick={handleBackToSubconcepts}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold uppercase tracking-wide transition-all hover:opacity-85"
                style={{
                  borderColor: graphTheme.borderStrong,
                  background: graphTheme.accentBg,
                  color: graphTheme.accentText,
                }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
            <Sparkles
              className="h-4 w-4"
              style={{ color: graphTheme.accent }}
            />
            <span
              className="text-sm font-bold uppercase tracking-widest"
              style={{ color: graphTheme.accentSoft }}
            >
              {isBackendChatEnabled
                ? (nodeTitle ?? "Subconcept")
                : "Machine Learning Fundamentals"}
            </span>
          </div>
          {!isBackendChatEnabled && (
            <div className="flex items-center gap-3">
              <span
                className="text-sm font-medium"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                {Math.min(activeIndex, effectiveCards.length)} / {effectiveCards.length}
              </span>
              <div
                className="h-2 w-32 overflow-hidden rounded-full"
                style={{ background: "rgba(255,255,255,0.1)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(Math.min(activeIndex, effectiveCards.length) / effectiveCards.length) * 100}%`,
                    background: graphTheme.accent,
                  }}
                />
              </div>
            </div>
          )}
          {isBackendChatEnabled && (
            <button
              type="button"
              onClick={voiceTutorEnabled ? stopVoiceTutor : startVoiceTutor}
              className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-all hover:opacity-85 active:scale-[0.98]"
              style={
                voiceTutorEnabled
                  ? {
                      background: "rgba(239,68,68,0.15)",
                      borderColor: "rgba(239,68,68,0.35)",
                      color: "#f87171",
                    }
                  : {
                      background: "rgba(52,211,153,0.1)",
                      borderColor: "rgba(52,211,153,0.28)",
                      color: "#34d399",
                    }
              }
            >
              {voiceTutorEnabled ? (
                <>
                  <PhoneOff className="h-3.5 w-3.5" />
                  End Voice
                </>
              ) : (
                <>
                  <Radio className="h-3.5 w-3.5" />
                  Voice Mode
                </>
              )}
            </button>
          )}
        </header>

        {/* Scrollable cards */}
        <div className="flex flex-1 overflow-y-auto">
          {isBackendChatEnabled ? (
            <div className="mx-auto w-full max-w-3xl px-6 py-12">
              {backendTimeline.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {backendTimeline.map((item) => {
                    if (item.kind === "user") {
                      const channelLabel =
                        item.message.channel === "clarification"
                          ? "Clarification"
                          : "Answer";
                      return (
                        <div key={item.message.id} className="flex justify-end">
                          <div
                            className="max-w-[85%] rounded-2xl rounded-tr-[6px] border px-4 py-3 text-sm leading-6"
                            style={{
                              background: graphTheme.accentBg,
                              borderColor: graphTheme.accentBorder,
                              color: "rgba(255,255,255,0.9)",
                            }}
                          >
                            <div
                              className="mb-1 text-[10px] font-semibold uppercase tracking-wide"
                              style={{ color: graphTheme.accentText }}
                            >
                              {channelLabel}
                            </div>
                            <MarkdownLite content={item.message.content} />
                          </div>
                        </div>
                      );
                    }

                    const chunk = item.chunk;
                    const isCurrentChunk = chunk.id === currentChunk?.id;
                    const questionMode = chunk.questionType ?? "text";
                    const questionMeta = ANSWER_MODE_META[questionMode];
                    const QuestionModeIcon = questionMeta.Icon;
                    const canAnswerCurrentQuestion =
                      isCurrentChunk &&
                      Boolean(chunk.question) &&
                      item.answers.length === 0 &&
                      !(
                        isTutorSending &&
                        pendingTutorChannel === "clarification"
                      ) &&
                      !isSessionComplete;

                    return (
                      <div
                        key={chunk.id}
                        className="relative overflow-hidden rounded-2xl border transition-all duration-300"
                        style={{
                          borderColor: isCurrentChunk
                            ? graphTheme.borderStrong
                            : graphTheme.border,
                          background: "rgba(255,255,255,0.03)",
                          boxShadow: isCurrentChunk
                            ? "0 10px 36px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)"
                            : undefined,
                        }}
                      >
                        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.03] to-transparent" />
                        <div className="relative p-6">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Bot
                                className="h-4 w-4"
                                style={{ color: graphTheme.accent }}
                              />
                              <h2 className="text-sm font-semibold tracking-wide text-white/90 uppercase">
                                Agent · Chunk {chunk.index + 1}
                              </h2>
                            </div>
                            {isCurrentChunk && (
                              <span
                                className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase"
                                style={{
                                  background: graphTheme.accentBgStrong,
                                  border: `1px solid ${graphTheme.accentBorder}`,
                                  color: graphTheme.accentText,
                                }}
                              >
                                Current
                              </span>
                            )}
                          </div>

                          <div
                            className="text-sm leading-7"
                            style={{ color: "rgba(255,255,255,0.9)" }}
                          >
                            <MarkdownLite content={chunk.explanation} />
                          </div>

                          {chunk.question && (
                            <div
                              className="mt-5 rounded-2xl border p-5"
                              style={{
                                borderColor: graphTheme.accentBorder,
                                background: graphTheme.accentBg,
                              }}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div
                                  className="text-xs font-bold uppercase tracking-[0.2em]"
                                  style={{ color: graphTheme.accentText }}
                                >
                                  Question
                                </div>
                                <span
                                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
                                  style={{
                                    borderColor: "rgba(255,255,255,0.2)",
                                    background: "rgba(255,255,255,0.05)",
                                    color: "rgba(255,255,255,0.82)",
                                  }}
                                >
                                  <QuestionModeIcon className="h-3 w-3" />
                                  {questionMeta.label}
                                </span>
                              </div>

                              <div
                                className="mt-3 text-sm leading-7"
                                style={{ color: "rgba(255,255,255,0.95)" }}
                              >
                                <MarkdownLite content={chunk.question} />
                              </div>
                              <div
                                className="mt-2 text-xs"
                                style={{ color: "rgba(255,255,255,0.56)" }}
                              >
                                {questionMeta.helper}
                              </div>

                              {item.answers.length > 0 && (
                                <div
                                  className="mt-4 flex flex-col gap-3 border-t pt-4"
                                  style={{
                                    borderColor: "rgba(255,255,255,0.12)",
                                  }}
                                >
                                  {item.answers.map((answer) => {
                                    const answerKind = answer.answerKind;
                                    const answerLabel = answerKind
                                      ? ANSWER_MODE_META[answerKind].label
                                      : questionMeta.label;
                                    return (
                                      <div key={answer.id}>
                                        <div
                                          className="mb-1 text-xs font-semibold uppercase tracking-wide"
                                          style={{
                                            color: graphTheme.accentText,
                                          }}
                                        >
                                          Your answer · {answerLabel}
                                        </div>
                                        <div
                                          className="text-sm leading-6"
                                          style={{
                                            color: "rgba(255,255,255,0.9)",
                                          }}
                                        >
                                          <MarkdownLite
                                            content={answer.content}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {canAnswerCurrentQuestion && (
                                <form
                                  onSubmit={handleSubmitAnswer}
                                  className="mt-4 space-y-3 border-t pt-4"
                                  style={{
                                    borderColor: "rgba(255,255,255,0.12)",
                                  }}
                                >
                                  <div
                                    className="text-xs font-semibold uppercase tracking-wide"
                                    style={{ color: graphTheme.accentText }}
                                  >
                                    Your answer
                                  </div>
                                  {answerMode === "text" && (
                                    <textarea
                                      value={answerInput}
                                      onChange={(e) =>
                                        setAnswerInput(e.target.value)
                                      }
                                      placeholder={questionMeta.placeholder}
                                      disabled={isTutorSending || isChatLoading}
                                      className="h-24 w-full resize-none rounded-xl px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
                                      style={{
                                        background: "rgba(255,255,255,0.06)",
                                        border: `1px solid ${graphTheme.border}`,
                                      }}
                                    />
                                  )}
                                  {answerMode === "code" && (
                                    <div
                                      className="overflow-hidden rounded-xl border"
                                      style={{
                                        background: "rgba(5,12,8,0.95)",
                                        borderColor: graphTheme.border,
                                      }}
                                    >
                                      <div
                                        className="flex items-center gap-2 border-b px-3 py-2"
                                        style={{
                                          borderColor: "rgba(255,255,255,0.08)",
                                          background: "rgba(255,255,255,0.03)",
                                        }}
                                      >
                                        <div
                                          className="h-2.5 w-2.5 rounded-full"
                                          style={{
                                            background: "rgba(239,68,68,0.55)",
                                          }}
                                        />
                                        <div
                                          className="h-2.5 w-2.5 rounded-full"
                                          style={{
                                            background: "rgba(46,232,74,0.45)",
                                          }}
                                        />
                                        <div
                                          className="h-2.5 w-2.5 rounded-full"
                                          style={{
                                            background: "rgba(74,222,128,0.55)",
                                          }}
                                        />
                                        <span
                                          className="ml-1 text-[11px]"
                                          style={{
                                            color: "rgba(255,255,255,0.4)",
                                          }}
                                        >
                                          answer.ts
                                        </span>
                                      </div>
                                      <div
                                        className="grid"
                                        style={{
                                          gridTemplateColumns: "auto 1fr",
                                        }}
                                      >
                                        <div
                                          ref={codeAnswerLineNumbersRef}
                                          className="h-44 overflow-hidden border-r px-2 py-3 text-right text-[11px] leading-6 select-none"
                                          style={{
                                            borderColor:
                                              "rgba(255,255,255,0.08)",
                                            color: "rgba(255,255,255,0.3)",
                                            background:
                                              "rgba(255,255,255,0.02)",
                                          }}
                                        >
                                          <pre className="m-0 font-mono leading-6 whitespace-pre">
                                            {Array.from(
                                              {
                                                length: Math.max(
                                                  1,
                                                  codeAnswerInput.split("\n")
                                                    .length,
                                                ),
                                              },
                                              (_, i) => i + 1,
                                            ).join("\n")}
                                          </pre>
                                        </div>
                                        <div className="relative h-44">
                                          {highlightedCodeAnswerNodes.length ? (
                                            <pre
                                              ref={codeAnswerOverlayRef}
                                              aria-hidden
                                              className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre px-3 py-3 font-mono text-xs leading-6 text-[#e2e8f0]"
                                            >
                                              {highlightedCodeAnswerNodes}
                                            </pre>
                                          ) : (
                                            <div
                                              className="pointer-events-none absolute inset-0 px-3 py-3 font-mono text-xs leading-6"
                                              style={{
                                                color: "rgba(255,255,255,0.25)",
                                              }}
                                            >
                                              {questionMeta.placeholder}
                                            </div>
                                          )}
                                          <textarea
                                            value={codeAnswerInput}
                                            onChange={(e) =>
                                              setCodeAnswerInput(e.target.value)
                                            }
                                            onKeyDown={handleCodeAnswerKeyDown}
                                            onScroll={(e) =>
                                              syncCodeAnswerScroll(
                                                e.currentTarget,
                                              )
                                            }
                                            disabled={
                                              isTutorSending || isChatLoading
                                            }
                                            spellCheck={false}
                                            className="absolute inset-0 h-full w-full resize-none bg-transparent px-3 py-3 font-mono text-xs leading-6 text-transparent caret-white outline-none selection:bg-[rgba(46,232,74,0.35)]"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  {answerMode === "draw" && (
                                    <div className="space-y-2">
                                      <textarea
                                        value={drawAnswerInput}
                                        onChange={(e) =>
                                          setDrawAnswerInput(e.target.value)
                                        }
                                        placeholder={questionMeta.placeholder}
                                        disabled={
                                          isTutorSending || isChatLoading
                                        }
                                        className="h-24 w-full resize-none rounded-xl px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
                                        style={{
                                          background: "rgba(255,255,255,0.06)",
                                          border: `1px solid ${graphTheme.border}`,
                                        }}
                                      />
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setIsDrawAnswerBoardOpen(true)
                                          }
                                          className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition-all hover:opacity-85"
                                          style={{
                                            background: graphTheme.accentBg,
                                            borderColor:
                                              graphTheme.accentBorder,
                                            color: graphTheme.accentText,
                                          }}
                                        >
                                          <PenLine className="h-3.5 w-3.5" />
                                          Open board
                                        </button>
                                        {isDrawAnswerBoardSubmitted && (
                                          <div
                                            className="inline-flex items-center gap-1 text-xs font-medium"
                                            style={{ color: "#86efac" }}
                                          >
                                            <Check className="h-3.5 w-3.5" />
                                            Board submitted
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  <button
                                    type="submit"
                                    disabled={isAnswerSendDisabled}
                                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-35"
                                    style={{
                                      background: graphTheme.accent,
                                      color: "#070d06",
                                    }}
                                  >
                                    {isTutorSending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Send className="h-4 w-4" />
                                    )}
                                    Submit {questionMeta.label.toLowerCase()}{" "}
                                    answer
                                  </button>
                                </form>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
              ) : isChatLoading || isNodeLoading ? (
                <div
                  className="rounded-2xl border p-8 text-sm"
                  style={{
                    borderColor: graphTheme.border,
                    background: graphTheme.panel,
                    color: graphTheme.textMuted,
                  }}
                >
                  Preparing first chunk...
                </div>
              ) : (
                <div
                  className="rounded-2xl border p-8"
                  style={{
                    borderColor: graphTheme.border,
                    background: graphTheme.panel,
                  }}
                >
                  <div
                    className="mb-3 text-xs font-semibold tracking-wide uppercase"
                    style={{ color: graphTheme.accentText }}
                  >
                    Overview
                  </div>
                  <div
                    className="text-sm leading-7"
                    style={{ color: "rgba(255,255,255,0.88)" }}
                  >
                    <MarkdownLite
                      content={
                        nodeExplanation ??
                        "No tutor chunks yet. Ask the agent to start the tutoring flow."
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
              {renderedCards.map((card, i) => {
                const state: "completed" | "active" =
                  i < activeIndex ? "completed" : "active";
                return (
                  <div
                    key={card.id}
                    ref={(el) => {
                      cardRefs.current[card.id] = el;
                    }}
                  >
                    {card.type === "summary" && (
                      <SummaryCardUI
                        card={card}
                        cardNumber={i + 1}
                        total={effectiveCards.length}
                        state={state}
                        onContinue={handleContinue}
                      />
                    )}
                    {card.type === "quiz" && (
                      <QuizCardUI
                        card={card}
                        cardNumber={i + 1}
                        total={effectiveCards.length}
                        state={state}
                        selectedOption={quizSelected[card.id] ?? null}
                        isSubmitted={quizSubmitted.has(card.id)}
                        onSelect={(idx) =>
                          setQuizSelected((p) => ({ ...p, [card.id]: idx }))
                        }
                        onSubmit={() =>
                          setQuizSubmitted((p) => new Set([...p, card.id]))
                        }
                        onContinue={handleContinue}
                      />
                    )}
                    {card.type === "code" && (
                      <CodeCardUI
                        card={card}
                        cardNumber={i + 1}
                        total={effectiveCards.length}
                        state={state}
                        value={
                          codeValues[card.id] !== undefined
                            ? codeValues[card.id]
                            : card.starterCode
                        }
                        isSubmitted={codeSubmitted.has(card.id)}
                        onChange={(v) =>
                          setCodeValues((p) => ({ ...p, [card.id]: v }))
                        }
                        onSubmit={() =>
                          setCodeSubmitted((p) => new Set([...p, card.id]))
                        }
                        onContinue={handleContinue}
                      />
                    )}
                    {card.type === "text" && (
                      <TextCardUI
                        card={card}
                        cardNumber={i + 1}
                        total={effectiveCards.length}
                        state={state}
                        value={textValues[card.id] ?? ""}
                        isSubmitted={textSubmitted.has(card.id)}
                        onChange={(v) =>
                          setTextValues((p) => ({ ...p, [card.id]: v }))
                        }
                        onSubmit={() =>
                          setTextSubmitted((p) => new Set([...p, card.id]))
                        }
                        onContinue={handleContinue}
                      />
                    )}
                    {card.type === "miro" && (
                      <MiroCardUI
                        card={card}
                        cardNumber={i + 1}
                        total={effectiveCards.length}
                        state={state}
                        onContinue={handleContinue}
                      />
                    )}
                    {card.type === "voice" && (
                      <VoiceCardUI
                        card={card}
                        cardNumber={i + 1}
                        total={effectiveCards.length}
                        state={state}
                        voiceState={voiceStates[card.id] ?? "idle"}
                        onVoiceState={(s) =>
                          setVoiceStates((p) => ({ ...p, [card.id]: s }))
                        }
                        onContinue={handleContinue}
                      />
                    )}
                    {card.type === "draw" && (
                      <DrawCardUI
                        card={card}
                        cardNumber={i + 1}
                        total={effectiveCards.length}
                        state={state}
                        isSubmitted={drawSubmitted.has(card.id)}
                        onSubmit={() =>
                          setDrawSubmitted((p) => new Set([...p, card.id]))
                        }
                        onContinue={handleContinue}
                      />
                    )}
                    {card.type === "miro-summary" && (
                      <MiroSummaryCardUI
                        card={card}
                        cardNumber={i + 1}
                        total={effectiveCards.length}
                        state={state}
                        embedUrl={miroEmbedUrls[card.id] ?? null}
                        onEmbedUrl={(url) =>
                          setMiroEmbedUrls((p) => ({ ...p, [card.id]: url }))
                        }
                        onContinue={handleContinue}
                      />
                    )}
                  </div>
                );
              })}

              {/* Next locked card placeholder */}
              {!isFinished && nextCard && (
                <div
                  ref={(el) => {
                    if (nextCard) cardRefs.current[nextCard.id] = el;
                  }}
                >
                  <LockedCardUI
                    card={nextCard}
                    cardNumber={activeIndex + 2}
                    total={effectiveCards.length}
                  />
                </div>
              )}

              {isFinished && (
                <div
                  className="rounded-2xl border p-12 text-center"
                  style={{
                    borderColor: "rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div className="mb-4 text-5xl">🎓</div>
                  <div className="text-2xl font-bold text-white">
                    Module Complete!
                  </div>
                  <div
                    className="mt-2 text-base"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    You've finished all cards for Machine Learning Fundamentals.
                  </div>
                </div>
              )}

              <div className="h-20" />
            </div>
          )}
        </div>
      </div>

      {isBackendChatEnabled && voiceTutorEnabled ? (
        <VoiceAgentPanel
          status={conversation.status}
          isSpeaking={conversation.isSpeaking}
          nodeTitle={nodeTitle}
          onStop={() => void stopVoiceTutor()}
        />
      ) : (
        <>
          {/* ── AI Chat ───────────────────────────────────────── */}
          <aside
            className="flex w-[400px] shrink-0 flex-col border-l"
            style={{
              borderColor: graphTheme.border,
              background: graphTheme.panelMuted,
            }}
          >
            {/* Chat header */}
            <div
              className="flex shrink-0 items-center gap-3 border-b px-5 py-4"
              style={{ borderColor: graphTheme.border }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: graphTheme.accentBg,
                  border: `1px solid ${graphTheme.accentBorder}`,
                }}
              >
                <Bot className="h-4 w-4" style={{ color: graphTheme.accent }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-white">
                  {isBackendChatEnabled ? "Clarification Chat" : "AI Tutor"}
                </div>
                <div
                  className="text-xs"
                  style={{ color: "rgba(255,255,255,0.38)" }}
                >
                  {isBackendChatEnabled
                    ? "Ask clarifying questions. New chunks appear in the center."
                    : "Click a message to jump to its card"}
                </div>
              </div>
              {!isBackendChatEnabled && !isFinished && (
                <div
                  className="shrink-0 rounded-full px-3 py-1 text-xs font-bold"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "rgba(255,255,255,0.8)",
                  }}
                >
                  Card {activeIndex + 1}
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-5">
              {isBackendChatEnabled && isChatLoading && (
                <div
                  className="rounded-xl border px-3 py-2 text-xs"
                  style={{
                    borderColor: graphTheme.border,
                    background: graphTheme.panel,
                    color: graphTheme.textMuted,
                  }}
                >
                  Connecting to tutor...
                </div>
              )}
              {chatError && (
                <div
                  className="rounded-xl border px-3 py-2 text-xs"
                  style={{
                    borderColor: "rgba(255,120,120,0.3)",
                    background: "rgba(255,80,80,0.08)",
                    color: "rgba(255,200,200,0.95)",
                  }}
                >
                  {chatError}
                </div>
              )}
              {isBackendChatEnabled &&
                !isChatLoading &&
                !chatError &&
                sidebarMessages.length === 0 && (
                  <div
                    className="rounded-xl border px-3 py-2 text-xs"
                    style={{
                      borderColor: graphTheme.border,
                      background: graphTheme.panel,
                      color: graphTheme.textMuted,
                    }}
                  >
                    Ask your first clarification about the current chunk.
                  </div>
                )}
              {sidebarMessages.map((msg) => {
                const cardIdx = msg.linkedCardId
                  ? effectiveCards.findIndex((c) => c.id === msg.linkedCardId)
                  : -1;
                const isClickable = msg.linkedCardId !== null && cardIdx !== -1;
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col gap-1.5",
                      msg.role === "user" ? "items-end" : "items-start",
                    )}
                  >
                    {/* Card badge */}
                    {msg.linkedCardId && cardIdx !== -1 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isClickable && msg.linkedCardId)
                            scrollToCard(msg.linkedCardId);
                        }}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all",
                          isClickable && "cursor-pointer hover:opacity-80",
                        )}
                        style={{
                          background: "rgba(17,34,20,0.8)",
                          border: `1px solid ${graphTheme.border}`,
                          color:
                            msg.role === "ai"
                              ? "rgba(255,255,255,0.6)"
                              : "rgba(255,255,255,0.4)",
                        }}
                      >
                        <span style={{ opacity: 0.6 }}>↗</span>
                        <span className="max-w-[190px] truncate">
                          Card {cardIdx + 1} · {msg.linkedCardTitle}
                        </span>
                      </button>
                    )}
                    {/* Bubble */}
                    <div
                      className={cn(
                        "max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                        msg.role === "ai"
                          ? "rounded-tl-[4px]"
                          : "rounded-tr-[4px]",
                      )}
                      style={{
                        background:
                          msg.role === "ai"
                            ? "rgba(17,34,20,0.8)"
                            : graphTheme.accentBg,
                        border:
                          msg.role === "ai"
                            ? `1px solid ${graphTheme.border}`
                            : `1px solid ${graphTheme.accentBorder}`,
                        color:
                          msg.role === "ai"
                            ? "rgba(255,255,255,0.88)"
                            : "rgba(255,255,255,0.82)",
                      }}
                    >
                      <MarkdownLite content={msg.content} />
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div
              className="shrink-0 border-t p-4"
              style={{ borderColor: graphTheme.border }}
            >
              {!isBackendChatEnabled && !isFinished && activeCard && (
                <div
                  className="mb-2.5 flex items-center gap-1.5 text-xs"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  <span>Asking about</span>
                  <span
                    className="max-w-[220px] truncate font-medium"
                    style={{ color: graphTheme.accent }}
                  >
                    Card {activeIndex + 1} · {activeCard.title}
                  </span>
                </div>
              )}
              {isBackendChatEnabled && (
                <div
                  className="mb-2.5 rounded-xl border px-3 py-2 text-xs leading-relaxed"
                  style={{
                    borderColor: graphTheme.border,
                    background: graphTheme.panel,
                    color: graphTheme.textMuted,
                  }}
                >
                  Clarification chat only. Submit checkpoint answers in the
                  center panel.
                </div>
              )}
              <form onSubmit={handleSendClarification} className="flex gap-2">
                <input
                  value={clarifyInput}
                  onChange={(e) => setClarifyInput(e.target.value)}
                  placeholder={
                    isBackendChatEnabled
                      ? "Ask a clarification..."
                      : isFinished
                        ? "Ask a follow-up..."
                        : "Ask anything..."
                  }
                  disabled={isChatLoading || isTutorSending}
                  className="flex-1 rounded-xl px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 transition-colors"
                  style={{
                    background: "rgba(17,34,20,0.78)",
                    border: `1px solid ${graphTheme.border}`,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = graphTheme.accentBorder;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = graphTheme.border;
                  }}
                />
                <button
                  type="submit"
                  disabled={isClarificationSendDisabled}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all disabled:opacity-25 hover:opacity-85 active:scale-95"
                  style={{ background: graphTheme.accent }}
                >
                  {isTutorSending ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      style={{ color: "#070d06" }}
                    />
                  ) : (
                    <Send className="h-4 w-4" style={{ color: "#070d06" }} />
                  )}
                </button>
              </form>
            </div>
          </aside>
        </>
      )}

      {isBackendChatEnabled &&
        isDrawAnswerBoardOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{
              background: "rgba(7,13,6,0.75)",
              backdropFilter: "blur(6px)",
            }}
          >
            <div
              className="flex flex-col overflow-hidden rounded-2xl"
              style={{
                width: "80vw",
                height: "80vh",
                background: "#16213e",
                border: "1px solid rgba(244,114,182,0.3)",
                boxShadow:
                  "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset",
              }}
            >
              <div
                className="flex shrink-0 items-center justify-between border-b px-6 py-4"
                style={{ borderColor: "rgba(244,114,182,0.18)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                      background: "rgba(244,114,182,0.12)",
                      border: "1px solid rgba(244,114,182,0.25)",
                    }}
                  >
                    <PenLine className="h-4 w-4" style={{ color: "#f472b6" }} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">
                      Draw your answer
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: "rgba(255,255,255,0.35)" }}
                    >
                      Submit board and continue in the current question card
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawAnswerBoardOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg transition-all hover:opacity-70"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>

              <div className="relative min-h-0 flex-1">
                <ExcalidrawBoard
                  onSubmit={(payload: DrawSubmissionPayload) => {
                    setIsDrawAnswerBoardSubmitted(true);
                    setDrawAnswerImageDataUrl(payload.imageDataUrl);
                    setIsDrawAnswerBoardOpen(false);
                  }}
                  isSubmitted={false}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function VoiceAgentPanel({
  status,
  isSpeaking,
  nodeTitle,
  onStop,
}: {
  status: string;
  isSpeaking: boolean;
  nodeTitle: string | null;
  onStop: () => void;
}) {
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  return (
    <aside
      className="flex w-[400px] shrink-0 flex-col border-l"
      style={{
        borderColor: "rgba(52,211,153,0.15)",
        background: "rgba(52,211,153,0.02)",
      }}
    >
      <div
        className="flex shrink-0 items-center gap-3 border-b px-5 py-4"
        style={{ borderColor: "rgba(52,211,153,0.12)" }}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: isConnected
              ? "rgba(52,211,153,0.15)"
              : "rgba(255,255,255,0.06)",
            border: `1px solid ${isConnected ? "rgba(52,211,153,0.35)" : "rgba(255,255,255,0.12)"}`,
          }}
        >
          <Radio
            className={cn("h-4 w-4", isConnected && "animate-pulse")}
            style={{ color: isConnected ? "#34d399" : "rgba(255,255,255,0.4)" }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white">Voice Tutor</div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.38)" }}>
            {isConnecting
              ? "Connecting..."
              : isConnected
                ? isSpeaking
                  ? "Agent is speaking"
                  : "Listening"
                : "Disconnected"}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8">
        <SproutAvatar
          isSpeaking={isConnected && isSpeaking}
          isListening={isConnected && !isSpeaking}
          size={180}
        />

        <div className="text-center">
          <div
            className="text-base font-bold"
            style={{
              color: isConnected ? "#34d399" : "rgba(255,255,255,0.3)",
            }}
          >
            {isConnecting
              ? "Starting session..."
              : isConnected
                ? isSpeaking
                  ? "AI tutor is speaking"
                  : "Speak now"
                : "Voice tutor ended"}
          </div>
          <div
            className="mt-1 text-sm"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            {isConnected
              ? "Ask anything about the current subconcept"
              : "Reconnect from header button"}
          </div>
        </div>

        <div
          className="w-full rounded-xl p-4"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
          }}
        >
          <div
            className="mb-2 text-xs font-bold uppercase tracking-widest"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            Current context
          </div>
          <div className="flex items-center gap-2.5">
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide"
              style={{
                background: "rgba(255,160,37,0.12)",
                border: "1px solid rgba(255,160,37,0.3)",
                color: "#ffa025",
              }}
            >
              Subconcept
            </span>
            <span className="truncate text-sm font-medium text-white">
              {nodeTitle ?? "Current topic"}
            </span>
            <span className="ml-auto shrink-0">
              {isConnected ? (
                <Mic className="h-4 w-4 text-emerald-300" />
              ) : (
                <MicOff className="h-4 w-4 text-white/40" />
              )}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onStop}
          className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition-all hover:opacity-85 active:scale-95"
          style={{
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.28)",
            color: "#f87171",
          }}
        >
          <PhoneOff className="h-4 w-4" />
          End Session
        </button>
      </div>
    </aside>
  );
}

// ── Shared card shell ──────────────────────────────────────────────────────────

function CardShell({
  state,
  children,
}: {
  state: "completed" | "active";
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border transition-all duration-500"
      style={{
        borderColor:
          state === "active"
            ? "rgba(255,255,255,0.14)"
            : "rgba(255,255,255,0.07)",
        background:
          state === "active"
            ? "rgba(255,255,255,0.045)"
            : "rgba(255,255,255,0.02)",
        boxShadow:
          state === "active"
            ? "0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)"
            : undefined,
      }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.025] to-transparent" />
      <div className="relative p-8">{children}</div>
    </div>
  );
}

// ── Card header row ────────────────────────────────────────────────────────────

const TYPE_META: Record<
  LearnCard["type"],
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    Icon: React.ElementType;
  }
> = {
  summary: {
    label: "Learn",
    color: "#4ade80",
    bg: "rgba(74,222,128,0.1)",
    border: "rgba(74,222,128,0.2)",
    Icon: BookOpen,
  },
  quiz: {
    label: "Quiz",
    color: "#ffa025",
    bg: "rgba(255,160,37,0.1)",
    border: "rgba(255,160,37,0.25)",
    Icon: HelpCircle,
  },
  code: {
    label: "Code",
    color: "#60a5fa",
    bg: "rgba(59,130,246,0.1)",
    border: "rgba(59,130,246,0.25)",
    Icon: Code2,
  },
  text: {
    label: "Write",
    color: "#c084fc",
    bg: "rgba(168,85,247,0.1)",
    border: "rgba(168,85,247,0.25)",
    Icon: FileText,
  },
  miro: {
    label: "Miro",
    color: "#fb923c",
    bg: "rgba(251,146,60,0.1)",
    border: "rgba(251,146,60,0.25)",
    Icon: BookOpen,
  },
  voice: {
    label: "Voice",
    color: "#34d399",
    bg: "rgba(52,211,153,0.1)",
    border: "rgba(52,211,153,0.25)",
    Icon: Volume2,
  },
  draw: {
    label: "Draw",
    color: "#f472b6",
    bg: "rgba(244,114,182,0.1)",
    border: "rgba(244,114,182,0.25)",
    Icon: PenLine,
  },
  "miro-summary": {
    label: "Summary",
    color: "#ffa025",
    bg: "rgba(255,160,37,0.12)",
    border: "rgba(255,160,37,0.3)",
    Icon: Layers,
  },
};

function CardHeader({
  type,
  topic,
  cardNumber,
  total,
  state,
}: {
  type: LearnCard["type"];
  topic: string;
  cardNumber: number;
  total: number;
  state: "completed" | "active";
}) {
  const meta = TYPE_META[type];
  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
          style={{
            background: meta.bg,
            border: `1px solid ${meta.border}`,
            color: meta.color,
          }}
        >
          <meta.Icon className="h-3 w-3" />
          {meta.label}
        </span>
        <span className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
          {topic}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {state === "completed" && (
          <span
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
            style={{
              background: "rgba(74,222,128,0.1)",
              border: "1px solid rgba(74,222,128,0.2)",
              color: "#4ade80",
            }}
          >
            <Check className="h-3 w-3" /> Done
          </span>
        )}
        <span
          className="font-mono text-xs"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          {cardNumber} / {total}
        </span>
      </div>
    </div>
  );
}

function ContinueButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl px-6 py-3 text-base font-bold transition-all hover:opacity-88 active:scale-[0.98]"
      style={{ background: "#ffa025", color: "#070d06" }}
    >
      Continue
      <ChevronRight className="h-4 w-4" />
    </button>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCardUI({
  card,
  cardNumber,
  total,
  state,
  onContinue,
}: {
  card: SummaryCard;
  cardNumber: number;
  total: number;
  state: "completed" | "active";
  onContinue: () => void;
}) {
  return (
    <CardShell state={state}>
      <CardHeader
        type="summary"
        topic={card.topic}
        cardNumber={cardNumber}
        total={total}
        state={state}
      />
      <h2 className="mb-5 text-2xl font-bold tracking-tight text-white">
        {card.title}
      </h2>
      <p
        className="mb-7 text-base leading-relaxed"
        style={{ color: "rgba(255,255,255,0.78)" }}
      >
        {card.content}
      </p>
      <div
        className="mb-7 rounded-xl p-5"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div
          className="mb-4 text-xs font-bold uppercase tracking-widest"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          Key Points
        </div>
        <ul className="flex flex-col gap-3">
          {card.keyPoints.map((point) => (
            <li
              key={point}
              className="flex items-start gap-3 text-base"
              style={{ color: "rgba(255,255,255,0.78)" }}
            >
              <span
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "#ffa025" }}
              />
              {point}
            </li>
          ))}
        </ul>
      </div>
      {state === "active" && <ContinueButton onClick={onContinue} />}
    </CardShell>
  );
}

// ── Quiz card ─────────────────────────────────────────────────────────────────

function QuizCardUI({
  card,
  cardNumber,
  total,
  state,
  selectedOption,
  isSubmitted,
  onSelect,
  onSubmit,
  onContinue,
}: {
  card: QuizCard;
  cardNumber: number;
  total: number;
  state: "completed" | "active";
  selectedOption: number | null;
  isSubmitted: boolean;
  onSelect: (idx: number) => void;
  onSubmit: () => void;
  onContinue: () => void;
}) {
  const isCorrect = isSubmitted && selectedOption === card.correctIndex;

  return (
    <CardShell state={state}>
      <CardHeader
        type="quiz"
        topic={card.topic}
        cardNumber={cardNumber}
        total={total}
        state={state}
      />
      <h2 className="mb-3 text-2xl font-bold tracking-tight text-white">
        {card.title}
      </h2>
      <p
        className="mb-7 text-base leading-relaxed"
        style={{ color: "rgba(255,255,255,0.78)" }}
      >
        {card.question}
      </p>

      <div className="mb-7 flex flex-col gap-3">
        {card.options.map((opt, i) => {
          const isSelected = selectedOption === i;
          const isCorrectOpt = i === card.correctIndex;
          const isWrong = isSubmitted && isSelected && !isCorrectOpt;

          let borderColor = "rgba(255,255,255,0.1)";
          let bg = "rgba(255,255,255,0.04)";
          let textColor = "rgba(255,255,255,0.72)";
          let labelBorder = "rgba(255,255,255,0.2)";
          let labelColor = "rgba(255,255,255,0.4)";
          let labelBg = "transparent";

          if (isSubmitted && isCorrectOpt) {
            borderColor = "#4ade80";
            bg = "rgba(74,222,128,0.08)";
            textColor = "rgba(255,255,255,0.92)";
            labelBorder = "#4ade80";
            labelColor = "#4ade80";
            labelBg = "rgba(74,222,128,0.1)";
          } else if (isWrong) {
            borderColor = "rgba(239,68,68,0.5)";
            bg = "rgba(239,68,68,0.07)";
            textColor = "rgba(255,255,255,0.72)";
            labelBorder = "rgba(239,68,68,0.5)";
            labelColor = "#f87171";
          } else if (isSelected) {
            borderColor = "rgba(255,160,37,0.55)";
            bg = "rgba(255,160,37,0.08)";
            textColor = "#fff";
            labelBorder = "#ffa025";
            labelColor = "#ffa025";
            labelBg = "rgba(255,160,37,0.12)";
          }

          return (
            <button
              key={opt}
              type="button"
              disabled={isSubmitted || state !== "active"}
              onClick={() => onSelect(i)}
              className="flex items-start gap-3.5 rounded-xl border px-5 py-3.5 text-left text-base transition-all duration-150 disabled:cursor-default hover:enabled:opacity-90"
              style={{ borderColor, background: bg, color: textColor }}
            >
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-all"
                style={{
                  borderColor: labelBorder,
                  color: labelColor,
                  background: labelBg,
                }}
              >
                {isSubmitted && isCorrectOpt ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  String.fromCharCode(65 + i)
                )}
              </span>
              <span className="leading-relaxed">{opt}</span>
            </button>
          );
        })}
      </div>

      {isSubmitted && (
        <div
          className="mb-7 rounded-xl p-5"
          style={{
            background: isCorrect
              ? "rgba(74,222,128,0.08)"
              : "rgba(239,68,68,0.07)",
            border: `1px solid ${isCorrect ? "rgba(74,222,128,0.2)" : "rgba(239,68,68,0.3)"}`,
          }}
        >
          <div
            className="mb-2 text-xs font-bold uppercase tracking-widest"
            style={{ color: isCorrect ? "#4ade80" : "#f87171" }}
          >
            {isCorrect ? "Correct!" : "Not quite —"}
          </div>
          <p
            className="text-base leading-relaxed"
            style={{ color: "rgba(255,255,255,0.78)" }}
          >
            {card.explanation}
          </p>
        </div>
      )}

      {state === "active" && !isSubmitted && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={selectedOption === null}
          className="flex items-center gap-2 rounded-xl px-6 py-3 text-base font-bold transition-all hover:opacity-88 active:scale-[0.98] disabled:opacity-30"
          style={{ background: "#ffa025", color: "#070d06" }}
        >
          Submit Answer
        </button>
      )}
      {state === "active" && isSubmitted && (
        <ContinueButton onClick={onContinue} />
      )}
    </CardShell>
  );
}

// ── Code card ─────────────────────────────────────────────────────────────────

function CodeCardUI({
  card,
  cardNumber,
  total,
  state,
  value,
  isSubmitted,
  onChange,
  onSubmit,
  onContinue,
}: {
  card: CodeCard;
  cardNumber: number;
  total: number;
  state: "completed" | "active";
  value: string;
  isSubmitted: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onContinue: () => void;
}) {
  const [showHint, setShowHint] = useState(false);

  return (
    <CardShell state={state}>
      <CardHeader
        type="code"
        topic={card.topic}
        cardNumber={cardNumber}
        total={total}
        state={state}
      />
      <h2 className="mb-4 text-2xl font-bold tracking-tight text-white">
        {card.title}
      </h2>
      <p
        className="mb-6 text-base leading-relaxed"
        style={{ color: "rgba(255,255,255,0.78)" }}
      >
        {card.prompt}
      </p>

      {/* Editor */}
      <div
        className="mb-4 overflow-hidden rounded-xl"
        style={{
          background: "#0d1117",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div
          className="flex items-center gap-2 border-b px-4 py-2.5"
          style={{
            borderColor: "rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div
            className="h-3 w-3 rounded-full"
            style={{ background: "rgba(239,68,68,0.5)" }}
          />
          <div
            className="h-3 w-3 rounded-full"
            style={{ background: "rgba(255,160,37,0.5)" }}
          />
          <div
            className="h-3 w-3 rounded-full"
            style={{ background: "rgba(74,222,128,0.5)" }}
          />
          <span
            className="ml-2 text-xs"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            solution.py
          </span>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isSubmitted || state !== "active"}
          rows={10}
          className="w-full resize-none bg-transparent px-5 py-4 text-sm leading-relaxed text-white outline-none disabled:cursor-default"
          style={{
            fontFamily: "var(--font-geist-mono, monospace)",
            color: "#e2e8f0",
          }}
          spellCheck={false}
        />
      </div>

      {/* Hint */}
      <div className="mb-6">
        {!showHint ? (
          <button
            type="button"
            onClick={() => setShowHint(true)}
            className="text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: "rgba(96,165,250,0.8)" }}
          >
            Show hint →
          </button>
        ) : (
          <div
            className="rounded-xl p-4"
            style={{
              background: "rgba(59,130,246,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <span
              className="mr-2 text-xs font-bold uppercase tracking-wider"
              style={{ color: "#60a5fa" }}
            >
              Hint
            </span>
            <span
              className="text-sm"
              style={{ color: "rgba(255,255,255,0.72)" }}
            >
              {card.hint}
            </span>
          </div>
        )}
      </div>

      {isSubmitted && (
        <div
          className="mb-6 rounded-xl p-5"
          style={{
            background: "rgba(74,222,128,0.08)",
            border: "1px solid rgba(74,222,128,0.2)",
          }}
        >
          <div
            className="mb-1.5 text-xs font-bold uppercase tracking-widest"
            style={{ color: "#4ade80" }}
          >
            Submitted
          </div>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.72)" }}>
            Great work! Your solution has been recorded. Review the approach and
            continue.
          </p>
        </div>
      )}

      {state === "active" && !isSubmitted && (
        <button
          type="button"
          onClick={onSubmit}
          className="flex items-center gap-2 rounded-xl px-6 py-3 text-base font-bold transition-all hover:opacity-88 active:scale-[0.98]"
          style={{ background: "#ffa025", color: "#070d06" }}
        >
          Run & Submit
        </button>
      )}
      {state === "active" && isSubmitted && (
        <ContinueButton onClick={onContinue} />
      )}
    </CardShell>
  );
}

// ── Text card ─────────────────────────────────────────────────────────────────

function TextCardUI({
  card,
  cardNumber,
  total,
  state,
  value,
  isSubmitted,
  onChange,
  onSubmit,
  onContinue,
}: {
  card: TextCard;
  cardNumber: number;
  total: number;
  state: "completed" | "active";
  value: string;
  isSubmitted: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onContinue: () => void;
}) {
  return (
    <CardShell state={state}>
      <CardHeader
        type="text"
        topic={card.topic}
        cardNumber={cardNumber}
        total={total}
        state={state}
      />
      <h2 className="mb-4 text-2xl font-bold tracking-tight text-white">
        {card.title}
      </h2>
      <p
        className="mb-6 text-base leading-relaxed"
        style={{ color: "rgba(255,255,255,0.75)" }}
      >
        {card.prompt}
      </p>

      {/* Guiding questions */}
      <div
        className="mb-6 rounded-xl p-5"
        style={{
          background: "rgba(168,85,247,0.07)",
          border: "1px solid rgba(168,85,247,0.2)",
        }}
      >
        <div
          className="mb-3 text-xs font-bold uppercase tracking-widest"
          style={{ color: "#c084fc" }}
        >
          Consider
        </div>
        <ul className="flex flex-col gap-2.5">
          {card.guidingQuestions.map((q) => (
            <li
              key={q}
              className="flex items-start gap-2.5 text-sm"
              style={{ color: "rgba(255,255,255,0.72)" }}
            >
              <span
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "#c084fc" }}
              />
              {q}
            </li>
          ))}
        </ul>
      </div>

      {/* Text area */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isSubmitted || state !== "active"}
        rows={6}
        placeholder="Write your response here..."
        className="mb-6 w-full resize-none rounded-xl px-5 py-4 text-base leading-relaxed text-white outline-none transition-colors disabled:cursor-default placeholder:text-white/20"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "rgba(192,132,252,0.4)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
        }}
      />

      {isSubmitted && (
        <div
          className="mb-6 rounded-xl p-5"
          style={{
            background: "rgba(74,222,128,0.08)",
            border: "1px solid rgba(74,222,128,0.2)",
          }}
        >
          <div
            className="mb-1.5 text-xs font-bold uppercase tracking-widest"
            style={{ color: "#4ade80" }}
          >
            Response recorded
          </div>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.72)" }}>
            Your answer has been saved. The AI tutor will provide personalised
            feedback in the chat.
          </p>
        </div>
      )}

      {state === "active" && !isSubmitted && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={value.trim().length < 20}
          className="flex items-center gap-2 rounded-xl px-6 py-3 text-base font-bold transition-all hover:opacity-88 active:scale-[0.98] disabled:opacity-30"
          style={{ background: "#ffa025", color: "#070d06" }}
        >
          Submit Response
        </button>
      )}
      {state === "active" && isSubmitted && (
        <ContinueButton onClick={onContinue} />
      )}
    </CardShell>
  );
}

// ── Miro card ─────────────────────────────────────────────────────────────────

function MiroCardUI({
  card,
  cardNumber,
  total,
  state,
  onContinue,
}: {
  card: MiroCard;
  cardNumber: number;
  total: number;
  state: "completed" | "active";
  onContinue: () => void;
}) {
  return (
    <CardShell state={state}>
      <CardHeader
        type="miro"
        topic={card.topic}
        cardNumber={cardNumber}
        total={total}
        state={state}
      />
      <h2 className="mb-4 text-2xl font-bold tracking-tight text-white">
        {card.title}
      </h2>
      <p
        className="mb-6 text-base leading-relaxed"
        style={{ color: "rgba(255,255,255,0.78)" }}
      >
        {card.description}
      </p>

      {/* Mock Miro embed */}
      <div
        className="mb-6 overflow-hidden rounded-2xl"
        style={{
          background: "#1a1a2e",
          border: "1px solid rgba(255,255,255,0.1)",
          height: 300,
        }}
      >
        {/* Miro toolbar mock */}
        <div
          className="flex items-center gap-3 border-b px-4 py-2.5"
          style={{
            borderColor: "rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <div
            className="rounded px-2.5 py-1 text-xs font-bold"
            style={{ background: "#ffa025", color: "#070d06" }}
          >
            miro
          </div>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            ML Types — Concept Map
          </span>
          <div className="ml-auto flex gap-1.5">
            {["#4ade80", "#60a5fa", "#c084fc"].map((c) => (
              <div
                key={c}
                className="h-3 w-3 rounded"
                style={{ background: c, opacity: 0.6 }}
              />
            ))}
          </div>
        </div>

        {/* Mock concept map */}
        <div className="relative flex h-full items-center justify-center p-6">
          {/* Central node */}
          <div
            className="absolute flex h-14 w-28 items-center justify-center rounded-xl text-center text-xs font-bold"
            style={{
              background: "rgba(255,160,37,0.2)",
              border: "2px solid #ffa025",
              color: "#ffa025",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
            }}
          >
            Machine Learning
          </div>
          {/* Branch nodes */}
          {[
            { label: "Supervised", x: "18%", y: "25%", color: "#4ade80" },
            { label: "Unsupervised", x: "72%", y: "22%", color: "#60a5fa" },
            { label: "Reinforcement", x: "45%", y: "75%", color: "#c084fc" },
          ].map(({ label, x, y, color }) => (
            <div
              key={label}
              className="absolute flex h-11 w-28 items-center justify-center rounded-lg text-center text-xs font-semibold"
              style={{
                background: `${color}18`,
                border: `1.5px solid ${color}50`,
                color,
                left: x,
                top: y,
                transform: "translate(-50%,-50%)",
              }}
            >
              {label}
            </div>
          ))}
          {/* Sub-nodes */}
          {[
            { label: "Classification", x: "8%", y: "60%", color: "#4ade80" },
            { label: "Regression", x: "28%", y: "62%", color: "#4ade80" },
            { label: "Clustering", x: "65%", y: "55%", color: "#60a5fa" },
          ].map(({ label, x, y, color }) => (
            <div
              key={label}
              className="absolute flex items-center justify-center rounded-lg px-3 py-1.5 text-xs"
              style={{
                background: `${color}10`,
                border: `1px solid ${color}30`,
                color: `${color}cc`,
                left: x,
                top: y,
                transform: "translate(-50%,-50%)",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6 flex gap-3">
        <button
          type="button"
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all hover:opacity-85"
          style={{
            background: "rgba(255,160,37,0.12)",
            border: "1px solid rgba(255,160,37,0.3)",
            color: "#ffa025",
          }}
        >
          Open in Miro ↗
        </button>
      </div>

      {state === "active" && <ContinueButton onClick={onContinue} />}
    </CardShell>
  );
}

// ── Voice card ─────────────────────────────────────────────────────────────────

function VoiceCardUI({
  card,
  cardNumber,
  total,
  state,
  voiceState,
  onVoiceState,
  onContinue,
}: {
  card: VoiceCard;
  cardNumber: number;
  total: number;
  state: "completed" | "active";
  voiceState: "idle" | "playing" | "recording" | "done";
  onVoiceState: (s: "idle" | "playing" | "recording" | "done") => void;
  onContinue: () => void;
}) {
  const [playProgress, setPlayProgress] = useState(0);

  const handlePlay = useCallback(() => {
    onVoiceState("playing");
    setPlayProgress(0);
    const interval = setInterval(() => {
      setPlayProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          onVoiceState("idle");
          return 100;
        }
        return p + 2;
      });
    }, 80);
  }, [onVoiceState]);

  const handleRecord = useCallback(() => {
    if (voiceState === "recording") {
      onVoiceState("done");
    } else {
      onVoiceState("recording");
    }
  }, [voiceState, onVoiceState]);

  return (
    <CardShell state={state}>
      <CardHeader
        type="voice"
        topic={card.topic}
        cardNumber={cardNumber}
        total={total}
        state={state}
      />
      <h2 className="mb-4 text-2xl font-bold tracking-tight text-white">
        {card.title}
      </h2>
      <p
        className="mb-6 text-base leading-relaxed"
        style={{ color: "rgba(255,255,255,0.78)" }}
      >
        {card.prompt}
      </p>

      {/* Script preview */}
      <div
        className="mb-6 rounded-xl p-5"
        style={{
          background: "rgba(52,211,153,0.06)",
          border: "1px solid rgba(52,211,153,0.2)",
        }}
      >
        <div
          className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
          style={{ color: "#34d399" }}
        >
          <Volume2 className="h-3.5 w-3.5" />
          AI Explanation
        </div>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          {card.script}
        </p>
      </div>

      {/* Play button + progress */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-4">
          <button
            type="button"
            onClick={handlePlay}
            disabled={
              voiceState === "playing" ||
              voiceState === "recording" ||
              state !== "active"
            }
            className="flex h-12 w-12 items-center justify-center rounded-full transition-all hover:opacity-80 active:scale-95 disabled:opacity-40"
            style={{ background: "#34d399" }}
          >
            <Play
              className="h-5 w-5 translate-x-0.5"
              style={{ color: "#070d06" }}
            />
          </button>
          <div className="flex-1">
            <div
              className="h-2 overflow-hidden rounded-full"
              style={{ background: "rgba(52,211,153,0.15)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{
                  width: `${playProgress}%`,
                  background: "#34d399",
                }}
              />
            </div>
            <div
              className="mt-1.5 text-xs"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              {voiceState === "playing"
                ? "Playing ElevenLabs audio..."
                : playProgress === 100
                  ? "Playback complete"
                  : "Click to play AI explanation"}
            </div>
          </div>
        </div>
      </div>

      {/* Record button */}
      <div
        className="mb-6 flex items-center gap-4 rounded-xl p-5"
        style={{
          background:
            voiceState === "recording"
              ? "rgba(52,211,153,0.08)"
              : "rgba(255,255,255,0.04)",
          border: `1px solid ${voiceState === "recording" ? "rgba(52,211,153,0.35)" : "rgba(255,255,255,0.1)"}`,
        }}
      >
        <button
          type="button"
          onClick={handleRecord}
          disabled={state !== "active" || voiceState === "playing"}
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-all disabled:opacity-40",
            voiceState === "recording" && "animate-pulse",
          )}
          style={{
            background:
              voiceState === "recording"
                ? "rgba(239,68,68,0.3)"
                : "rgba(52,211,153,0.2)",
            border: `2px solid ${voiceState === "recording" ? "#f87171" : "#34d399"}`,
          }}
        >
          {voiceState === "recording" ? (
            <Square className="h-5 w-5" style={{ color: "#f87171" }} />
          ) : (
            <Mic className="h-5 w-5" style={{ color: "#34d399" }} />
          )}
        </button>
        <div>
          <div
            className="text-sm font-bold"
            style={{
              color:
                voiceState === "recording"
                  ? "#f87171"
                  : voiceState === "done"
                    ? "#4ade80"
                    : "rgba(255,255,255,0.7)",
            }}
          >
            {voiceState === "recording"
              ? "Recording… tap to stop"
              : voiceState === "done"
                ? "Response recorded"
                : "Record your spoken summary"}
          </div>
          <div
            className="mt-0.5 text-xs"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            {voiceState === "done"
              ? "Transcription will be analysed by the AI"
              : "60 seconds max · ElevenLabs STT"}
          </div>
        </div>
      </div>

      {state === "active" && voiceState === "done" && (
        <ContinueButton onClick={onContinue} />
      )}
      {state === "active" && voiceState !== "done" && (
        <button
          type="button"
          onClick={onContinue}
          className="text-sm font-medium transition-opacity hover:opacity-60"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          Skip for now →
        </button>
      )}
    </CardShell>
  );
}

// ── Locked placeholder ────────────────────────────────────────────────────────

function LockedCardUI({
  card,
  cardNumber,
  total,
}: {
  card: LearnCard;
  cardNumber: number;
  total: number;
}) {
  const meta = TYPE_META[card.type];

  return (
    <div
      className="relative overflow-hidden rounded-2xl border"
      style={{
        borderColor: "rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      {/* Blurred ghost content */}
      <div
        className="pointer-events-none select-none p-8"
        style={{ filter: "blur(6px)", opacity: 0.18 }}
      >
        <div className="mb-6 flex items-center gap-2.5">
          <span
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
            style={{
              background: meta.bg,
              border: `1px solid ${meta.border}`,
              color: meta.color,
            }}
          >
            <meta.Icon className="h-3 w-3" />
            {meta.label}
          </span>
          <span className="text-sm text-white/35">{card.topic}</span>
        </div>
        <div className="mb-4 h-8 w-3/4 rounded-lg bg-white/20" />
        <div className="flex flex-col gap-2">
          <div className="h-4 w-full rounded bg-white/10" />
          <div className="h-4 w-5/6 rounded bg-white/10" />
          <div className="h-4 w-4/6 rounded bg-white/10" />
        </div>
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <Lock
            className="h-7 w-7"
            style={{ color: "rgba(255,255,255,0.7)" }}
          />
        </div>
        <div className="text-center">
          <div className="text-base font-bold text-white">
            Up next: {card.title}
          </div>
          <div
            className="mt-1 text-sm"
            style={{ color: "rgba(255,255,255,0.38)" }}
          >
            Complete the current card to unlock
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
            style={{
              background: meta.bg,
              border: `1px solid ${meta.border}`,
              color: meta.color,
              opacity: 0.7,
            }}
          >
            <meta.Icon className="h-3 w-3" />
            {meta.label}
          </span>
          <span
            className="font-mono text-xs"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            {cardNumber} / {total}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Draw card ─────────────────────────────────────────────────────────────────

function DrawCardUI({
  card,
  cardNumber,
  total,
  state,
  isSubmitted,
  onSubmit,
  onContinue,
}: {
  card: DrawCard;
  cardNumber: number;
  total: number;
  state: "completed" | "active";
  isSubmitted: boolean;
  onSubmit: () => void;
  onContinue: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const handleSubmit = useCallback(
    (_payload: DrawSubmissionPayload) => {
      onSubmit();
      setModalOpen(false);
    },
    [onSubmit],
  );

  return (
    <CardShell state={state}>
      <CardHeader
        type="draw"
        topic={card.topic}
        cardNumber={cardNumber}
        total={total}
        state={state}
      />
      <h2 className="mb-4 text-2xl font-bold tracking-tight text-white">
        {card.title}
      </h2>
      <p
        className="mb-6 text-base leading-relaxed"
        style={{ color: "rgba(255,255,255,0.78)" }}
      >
        {card.prompt}
      </p>

      {/* Completed placeholder */}
      {state === "completed" && (
        <div
          className="flex items-center justify-center rounded-xl"
          style={{
            height: 120,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            className="flex items-center gap-2"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            <PenLine className="h-4 w-4" />
            <span className="text-sm">Whiteboard answer submitted</span>
          </div>
        </div>
      )}

      {/* Active state */}
      {state === "active" && !isSubmitted && (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-xl px-6 py-3 text-base font-bold transition-all hover:opacity-88 active:scale-[0.98]"
          style={{ background: "#f472b6", color: "#070d06" }}
        >
          <PenLine className="h-4 w-4" />
          Open Whiteboard
        </button>
      )}

      {state === "active" && isSubmitted && (
        <div className="flex flex-col gap-4">
          <div
            className="flex items-center gap-3 rounded-xl px-5 py-3"
            style={{
              background: "rgba(74,222,128,0.08)",
              border: "1px solid rgba(74,222,128,0.2)",
              width: "fit-content",
            }}
          >
            <Check className="h-4 w-4" style={{ color: "#4ade80" }} />
            <span className="text-sm font-medium" style={{ color: "#4ade80" }}>
              Whiteboard submitted
            </span>
          </div>
          <ContinueButton onClick={onContinue} />
        </div>
      )}

      {/* Floating whiteboard modal */}
      {modalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{
              background: "rgba(7,13,6,0.75)",
              backdropFilter: "blur(6px)",
            }}
          >
            {/* Panel */}
            <div
              className="flex flex-col overflow-hidden rounded-2xl"
              style={{
                width: "80vw",
                height: "80vh",
                background: "#16213e",
                border: "1px solid rgba(244,114,182,0.3)",
                boxShadow:
                  "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset",
              }}
            >
              {/* Panel header */}
              <div
                className="flex shrink-0 items-center justify-between border-b px-6 py-4"
                style={{ borderColor: "rgba(244,114,182,0.18)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                      background: "rgba(244,114,182,0.12)",
                      border: "1px solid rgba(244,114,182,0.25)",
                    }}
                  >
                    <PenLine className="h-4 w-4" style={{ color: "#f472b6" }} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">
                      {card.title}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: "rgba(255,255,255,0.35)" }}
                    >
                      Draw your answer, then hit Submit
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg transition-all hover:opacity-70"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>

              {/* Canvas — explicit height so Excalidraw fills it */}
              <div className="relative min-h-0 flex-1">
                <ExcalidrawBoard
                  onSubmit={handleSubmit}
                  isSubmitted={isSubmitted}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </CardShell>
  );
}

// ── Miro Summary card ─────────────────────────────────────────────────────────

function MiroSummaryCardUI({
  card,
  cardNumber,
  total,
  state,
  embedUrl,
  onEmbedUrl,
  onContinue,
}: {
  card: MiroSummaryCard;
  cardNumber: number;
  total: number;
  state: "completed" | "active";
  embedUrl: string | null;
  onEmbedUrl: (url: string) => void;
  onContinue: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setNeedsAuth(false);
    try {
      const res = await fetch("/api/miro/create-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicTitle: card.title,
          keyPoints: card.keyPoints,
        }),
      });
      if (res.status === 401) {
        setNeedsAuth(true);
        return;
      }
      if (!res.ok) {
        const body = await res.text();
        setError(`Failed to create board: ${body}`);
        return;
      }
      const data = (await res.json()) as { embedUrl: string };
      onEmbedUrl(data.embedUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <CardShell state={state}>
      <CardHeader
        type="miro-summary"
        topic={card.topic}
        cardNumber={cardNumber}
        total={total}
        state={state}
      />
      <h2 className="mb-3 text-2xl font-bold tracking-tight text-white">
        {card.title}
      </h2>
      <p
        className="mb-6 text-base leading-relaxed"
        style={{ color: "rgba(255,255,255,0.78)" }}
      >
        Generate an interactive Miro board summarising everything you've learnt
        in this topic. All key concepts will appear as colour-coded sticky notes
        you can rearrange, annotate, and share.
      </p>

      {/* Key points preview */}
      {!embedUrl && (
        <div
          className="mb-6 rounded-xl p-5"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div
            className="mb-3 text-xs font-bold uppercase tracking-widest"
            style={{ color: "#ffa025" }}
          >
            Will include
          </div>
          <div className="flex flex-wrap gap-2">
            {card.keyPoints.map((kp) => (
              <span
                key={kp}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background: "rgba(255,160,37,0.1)",
                  border: "1px solid rgba(255,160,37,0.22)",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                {kp}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Auth needed */}
      {needsAuth && (
        <div
          className="mb-6 flex items-start gap-4 rounded-xl p-5"
          style={{
            background: "rgba(255,160,37,0.06)",
            border: "1px solid rgba(255,160,37,0.25)",
          }}
        >
          <div className="flex-1">
            <div className="mb-1 text-sm font-bold text-white">
              Connect Miro to generate your board
            </div>
            <div
              className="mb-4 text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              You'll be redirected to Miro to authorise Sprout, then brought
              back here automatically.
            </div>
            <a
              href="/api/miro/auth"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all hover:opacity-85"
              style={{ background: "#ffa025", color: "#070d06" }}
            >
              Connect Miro
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="mb-6 rounded-xl p-4 text-sm"
          style={{
            background: "rgba(239,68,68,0.07)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#f87171",
          }}
        >
          {error}
        </div>
      )}

      {/* Miro embed */}
      {embedUrl && (
        <div className="mb-6">
          <iframe
            src={embedUrl}
            allow="fullscreen; clipboard-read; clipboard-write"
            className="w-full rounded-xl"
            style={{
              height: 520,
              border: "1px solid rgba(255,160,37,0.25)",
            }}
            title="Miro Summary Board"
          />
        </div>
      )}

      {/* Actions */}
      {state === "active" && !embedUrl && !needsAuth && (
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl px-6 py-3 text-base font-bold transition-all hover:opacity-88 active:scale-[0.98] disabled:opacity-60"
          style={{ background: "#ffa025", color: "#070d06" }}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating board…
            </>
          ) : (
            <>
              <Layers className="h-4 w-4" />
              Generate on Miro
            </>
          )}
        </button>
      )}

      {state === "active" && embedUrl && (
        <div className="flex items-center gap-3">
          <ContinueButton onClick={onContinue} />
          <a
            href={embedUrl.replace("live-embed", "app")}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all hover:opacity-85"
            style={{
              background: "rgba(255,160,37,0.1)",
              border: "1px solid rgba(255,160,37,0.28)",
              color: "#ffa025",
            }}
          >
            Open in Miro
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </CardShell>
  );
}
