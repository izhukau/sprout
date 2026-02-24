import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Loader2, Send, Sparkles, X } from "lucide-react";
import type {
  BackendAnswer,
  BackendAssessment,
  BackendQuestion,
} from "@/lib/backend-api";
import {
  listAssessmentAnswers,
  submitAssessmentAnswer,
} from "@/lib/backend-api";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "ai" | "user";
  text: string;
};

type Props = {
  userId: string;
  conceptTitle: string;
  assessment: BackendAssessment;
  questions: BackendQuestion[];
  requiredAnswers: number;
  onComplete: () => void;
  onClose?: () => void;
};

const theme = {
  bg: "#0A1A0F",
  panel: "rgba(17,34,20,0.85)",
  border: "rgba(46,232,74,0.2)",
  accent: "#2EE84A",
  accentText: "#BFF8C9",
};

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function isOpenAnswerCorrect(answer: string, expected: string | null): boolean {
  if (!expected) return false;
  return normalize(answer) === normalize(expected);
}

export function ConceptDiagnosticChat({
  userId,
  conceptTitle,
  assessment,
  questions: rawQuestions,
  requiredAnswers,
  onComplete,
  onClose,
}: Props) {
  const questions = useMemo(() => {
    return rawQuestions.map((q) => {
      let opts: string[] | null = null;
      if (Array.isArray(q.options)) {
        opts = q.options;
      } else if (typeof q.options === "string") {
        try {
          const parsed = JSON.parse(q.options);
          if (Array.isArray(parsed)) {
            opts = parsed.map((item) => String(item));
          }
        } catch {
          opts = null;
        }
      }
      return { ...q, options: opts };
    });
  }, [rawQuestions]);

  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: "intro",
      role: "ai",
      text: `Optional pre-check for "${conceptTitle}". ${questions.length} quick questions (single pass, no repeats). Answers help personalize the concept graph and tutoring later.`,
    },
  ]);
  const [answeredMap, setAnsweredMap] = useState<Map<string, BackendAnswer>>(
    () => new Map(),
  );
  const [isLoadingAnswers, setIsLoadingAnswers] = useState(true);
  const [currentText, setCurrentText] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadExisting = async () => {
      try {
        const existing = await listAssessmentAnswers(assessment.id, userId);
        if (cancelled) return;
        setAnsweredMap(new Map(existing.map((row) => [row.questionId, row])));
      } catch {
        /* show nothing; still allow answering */
      } finally {
        if (!cancelled) setIsLoadingAnswers(false);
      }
    };
    void loadExisting();
    return () => {
      cancelled = true;
    };
  }, [assessment.id, userId]);

  const remainingQuestions = useMemo(
    () => questions.filter((q) => !answeredMap.has(q.id)),
    [questions, answeredMap],
  );

  const currentQuestion = remainingQuestions[0];

  useEffect(() => {
    if (!currentQuestion && !isLoadingAnswers) {
      onComplete();
    }
  }, [currentQuestion, isLoadingAnswers, onComplete]);

  if (!currentQuestion && !isLoadingAnswers) {
    return null;
  }

  const handleSubmit = async () => {
    if (!currentQuestion || isSubmitting) return;
    const isMcq = currentQuestion.format === "mcq";
    const answerContent = isMcq ? (selectedOption ?? "") : currentText.trim();
    if (!answerContent) return;

    setIsSubmitting(true);
    try {
      const isCorrect =
        currentQuestion.format === "mcq"
          ? normalize(answerContent) ===
            normalize(currentQuestion.correctAnswer ?? "")
          : currentQuestion.correctAnswer
            ? isOpenAnswerCorrect(
                answerContent,
                currentQuestion.correctAnswer ?? "",
              )
            : null;
      const payload = {
        userId,
        questionId: currentQuestion.id,
        answerText: isMcq ? null : answerContent,
        selectedOption: isMcq ? answerContent : null,
        isCorrect,
        score: isCorrect === null ? null : isCorrect ? 1 : 0,
        feedback: null,
      };

      const saved = await submitAssessmentAnswer(assessment.id, payload);

      setMessages((prev) => [
        ...prev,
        {
          id: `q-${currentQuestion.id}`,
          role: "ai",
          text: currentQuestion.prompt,
        },
        {
          id: `a-${currentQuestion.id}`,
          role: "user",
          text: answerContent,
        },
        {
          id: `fb-${currentQuestion.id}`,
          role: "ai",
          text:
            isCorrect === null
              ? "Answer recorded. Moving to the next question."
              : isCorrect
                ? "Correct. Continuing."
                : "Not quite. No retries — advancing.",
        },
      ]);
      setAnsweredMap((prev) => {
        const next = new Map(prev);
        next.set(currentQuestion.id, saved);
        return next;
      });
      setCurrentText("");
      setSelectedOption(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress =
    questions.length > 0 ? (answeredMap.size / questions.length) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-4 py-6"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="relative flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border shadow-2xl"
        style={{ background: theme.panel, borderColor: theme.border }}
      >
        <div
          className="flex items-center justify-between border-b px-6 py-4"
          style={{ borderColor: theme.border }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                background: "rgba(46,232,74,0.15)",
                border: `1px solid ${theme.border}`,
              }}
            >
              <Sparkles className="h-4 w-4" style={{ color: theme.accent }} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white">
                Diagnostic · {conceptTitle}
              </div>
              <div
                className="text-xs"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                Optional: {questions.length} quick questions to improve
                personalization. Close anytime to skip.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-semibold uppercase"
                style={{ color: theme.accentText }}
              >
                {answeredMap.size}/{requiredAnswers}
              </span>
              <div
                className="h-2 w-32 overflow-hidden rounded-full"
                style={{ background: "rgba(255,255,255,0.12)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, progress)}%`,
                    background: theme.accent,
                  }}
                />
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl border transition-all hover:opacity-80"
                style={{
                  borderColor: "rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.05)",
                }}
              >
                <X className="h-4 w-4 text-white" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 gap-6 overflow-hidden p-6">
          <div
            className="flex-1 overflow-y-auto rounded-2xl border p-4"
            style={{
              borderColor: theme.border,
              background: "rgba(10,26,15,0.7)",
            }}
          >
            <div className="flex flex-col gap-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "ai"
                      ? "self-start rounded-tl-[6px]"
                      : "self-end rounded-tr-[6px]",
                  )}
                  style={{
                    background:
                      msg.role === "ai" ? "rgba(46,232,74,0.08)" : theme.accent,
                    color:
                      msg.role === "ai" ? "rgba(255,255,255,0.9)" : "#0a1a0f",
                    border:
                      msg.role === "ai"
                        ? `1px solid ${theme.border}`
                        : "1px solid rgba(0,0,0,0.05)",
                  }}
                >
                  {msg.text}
                </div>
              ))}
            </div>
          </div>

          <div
            className="w-[360px] shrink-0 rounded-2xl border p-4"
            style={{
              borderColor: theme.border,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            {currentQuestion ? (
              <>
                <div
                  className="mb-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: theme.accentText }}
                >
                  Question {answeredMap.size + 1} / {requiredAnswers}
                </div>
                <div className="mb-4 text-sm font-medium leading-6 text-white">
                  {currentQuestion.prompt}
                </div>

                {currentQuestion.format === "mcq" && (
                  <div className="mb-4 flex flex-col gap-2">
                    {(currentQuestion.options ?? []).map((opt) => {
                      const isSelected = selectedOption === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSelectedOption(opt)}
                          className="rounded-xl border px-3 py-2 text-left text-sm transition-all hover:opacity-90"
                          style={{
                            borderColor: isSelected
                              ? theme.accent
                              : "rgba(255,255,255,0.12)",
                            background: isSelected
                              ? "rgba(46,232,74,0.12)"
                              : "rgba(255,255,255,0.04)",
                            color: "rgba(255,255,255,0.9)",
                          }}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {currentQuestion.format === "open_ended" && (
                  <textarea
                    value={currentText}
                    onChange={(e) => setCurrentText(e.target.value)}
                    placeholder="Short answer..."
                    className="mb-4 h-28 w-full rounded-xl border px-3 py-2 text-sm text-white outline-none placeholder:text-white/40"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      borderColor: "rgba(255,255,255,0.14)",
                    }}
                    disabled={isSubmitting}
                  />
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={
                    isSubmitting ||
                    (currentQuestion.format === "mcq"
                      ? !selectedOption
                      : !currentText.trim())
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all disabled:opacity-40"
                  style={{ background: theme.accent, color: "#0a1a0f" }}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Submit and continue
                </button>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <Check className="h-10 w-10 text-emerald-400" />
                <div className="text-sm font-semibold text-white">
                  Questionnaire complete
                </div>
                <div
                  className="text-xs"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                >
                  The agent will continue graph generation.
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className="flex items-center justify-between border-t px-6 py-3 text-xs"
          style={{ borderColor: theme.border, color: "rgba(255,255,255,0.55)" }}
        >
          We store each answer and immediately move to the next — no repeats.
          <div className="flex items-center gap-2">
            <ChevronRight className="h-4 w-4 text-white/50" />
            {answeredMap.size + 1 <= requiredAnswers
              ? `Next: ${answeredMap.size + 1}/${requiredAnswers}`
              : "Done"}
          </div>
        </div>
      </div>
    </div>
  );
}
