"use client";

import { useState, type FormEvent } from "react";
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { AdminDrawer, AdminPagination } from "./admin-data-ui";
import {
  useAddLearningQuestion,
  useCreateLearningQuiz,
  useCreateLearningVersion,
  useLearningArticles,
  useLearningQuestions,
  useLearningQuizzes,
  usePublishLearningVersion,
  useSaveLearningArticle,
  useSaveLearningQuestion,
} from "../learning-content-hooks";
import type {
  AdminLearningArticle,
  AdminLearningQuestion,
  ArticleInput,
  QuestionInput,
  QuizInput,
} from "../learning-content-api";

const field = "input mt-1 w-full min-w-0";
const emptyArticle: ArticleInput = {
  title: "", summary: "", body: "", category: "Banking", categoryCode: "banking",
  topic: null, publisher: "AB Ignite", difficulty: "Beginner", readingMinutes: 5,
  publishedLabel: null, url: null, published: false, contentType: "internal", reason: "",
};
const emptyQuiz: QuizInput = {
  title: "", categoryCode: "banking", level: "beginner", objective: "", passMark: 70,
  pointsPerQuestion: 10, timeLimitSeconds: 600, questionCount: 1, reason: "",
};
const quizCategories = [
  { code: "banking", label: "Banking" },
  { code: "transformation", label: "Transformation" },
  { code: "technology", label: "Technology" },
] as const;
const quizLevels = ["beginner", "intermediate", "advanced", "expert"] as const;
const emptyQuestion = (sortOrder = 0, points = 10): QuestionInput => ({
  prompt: "", topic: "Banking", sortOrder, points, reason: "",
  options: [
    { optionKey: "a", label: "", sortOrder: 0, isCorrect: true },
    { optionKey: "b", label: "", sortOrder: 1, isCorrect: false },
  ],
});

function message(error: unknown) {
  return error instanceof Error ? error.message : "The request failed.";
}

export function validLink(input: ArticleInput) {
  if (input.contentType === "internal") return true;
  try {
    const url = new URL(input.url ?? "");
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function validQuestion(input: QuestionInput) {
  const options = input.options;
  return Boolean(input.prompt.trim() && input.topic.trim() && input.reason.trim())
    && input.reason.trim().length <= 500
    && Number.isInteger(input.sortOrder) && input.sortOrder >= 0 && input.sortOrder <= 1000
    && Number.isInteger(input.points) && input.points >= 1 && input.points <= 10000
    && options.length >= 2 && options.length <= 10
    && options.every((option) => option.label.trim() && option.optionKey.trim() && Number.isInteger(option.sortOrder) && option.sortOrder >= 0 && option.sortOrder <= 100)
    && new Set(options.map((option) => option.optionKey)).size === options.length
    && new Set(options.map((option) => option.sortOrder)).size === options.length
    && options.filter((option) => option.isCorrect).length === 1;
}

export function nextOption(input: QuestionInput): QuestionInput {
  const usedKeys = new Set(input.options.map((option) => option.optionKey));
  const usedOrders = new Set(input.options.map((option) => option.sortOrder));
  const optionKey = "abcdefghij".split("").find((key) => !usedKeys.has(key));
  const sortOrder = Array.from({ length: 101 }, (_, index) => index).find((order) => !usedOrders.has(order));
  if (!optionKey || sortOrder === undefined || input.options.length >= 10) return input;
  return { ...input, options: [...input.options, { optionKey, label: "", sortOrder, isCorrect: false }] };
}

const searchField = "input w-full min-w-0";

export function AdminLearningContent({ className = "" }: { className?: string }) {
  return <section className={`min-w-0 space-y-6 ${className}`}>
    <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#1762a7]">Admin · learning</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Learning Content Management</h1><p className="mt-2 max-w-3xl text-sm text-muted">Create a quiz, add its questions and correct answers, then publish it. Write or link an article and publish it when it is ready for employees.</p></div>
    <TabGroup>
      <TabList className="grid gap-3 sm:grid-cols-2" aria-label="Learning content">
        <Tab className={({ selected }) => `rounded-xl border p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1762a7] ${selected ? "border-[#1762a7] bg-[#eff6ff]" : "border-[var(--line)] bg-white hover:bg-[var(--hover)]"}`}><span className="block text-lg font-semibold">Quizzes</span><span className="mt-1 block text-sm text-muted">Create, add answer options, mark the correct answer and publish.</span></Tab>
        <Tab className={({ selected }) => `rounded-xl border p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1762a7] ${selected ? "border-[#1762a7] bg-[#eff6ff]" : "border-[var(--line)] bg-white hover:bg-[var(--hover)]"}`}><span className="block text-lg font-semibold">Articles</span><span className="mt-1 block text-sm text-muted">Add internal reading or an external link, then publish it.</span></Tab>
      </TabList>
      <TabPanels className="mt-6"><TabPanel unmount={false} className="app-card min-w-0"><QuizManager /></TabPanel><TabPanel unmount={false} className="app-card min-w-0"><ArticleManager /></TabPanel></TabPanels>
    </TabGroup>
  </section>;
}

export function QuizManager() {
  const quizzes = useLearningQuizzes();
  const createQuiz = useCreateLearningQuiz();
  const createVersion = useCreateLearningVersion();
  const addQuestion = useAddLearningQuestion();
  const publish = usePublishLearningVersion();
  const save = useSaveLearningQuestion();
  const [quizPage, setQuizPage] = useState(0);
  const [questionPage, setQuestionPage] = useState(0);
  const [versionId, setVersionId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<QuestionInput | null>(null);
  const [quizDraft, setQuizDraft] = useState<QuizInput>(emptyQuiz);
  const [showQuizForm, setShowQuizForm] = useState(false);
  const [status, setStatus] = useState("");
  const [lifecycleError, setLifecycleError] = useState("");
  const [publishReason, setPublishReason] = useState("");
  const [versionReason, setVersionReason] = useState("");
  const questions = useLearningQuestions(versionId);

  const quizPages = quizzes.data?.pages ?? [];
  const allQuizItems = quizPages.flatMap((page) => page.items);
  const [quizSearch, setQuizSearch] = useState("");
  const [quizCategory, setQuizCategory] = useState("all");
  const [quizStatus, setQuizStatus] = useState("all");
  const filteredQuizzes = allQuizItems.filter((quiz) => (!quizSearch || `${quiz.title} ${quiz.category} ${quiz.objective}`.toLowerCase().includes(quizSearch.toLowerCase())) && (quizCategory === "all" || quiz.categoryCode === quizCategory) && (quizStatus === "all" || (quizStatus === "published") === Boolean(quiz.published)));
  const quizItems = filteredQuizzes.slice(quizPage * 10, quizPage * 10 + 10);
  const selectedQuiz = allQuizItems.find((quiz) => quiz.versionId === versionId);
  const questionItems = questions.data ?? [];
  const visibleQuestions = questionItems.slice(questionPage * 10, questionPage * 10 + 10);
  const readOnly = !selectedQuiz || !!selectedQuiz.published;
  function selectVersion(id: number | null) {
    setVersionId(id);
    setQuestionPage(0);
    setSelectedId(null);
    setDraft(null);
    setStatus("");
    setLifecycleError("");
    setPublishReason("");
    setVersionReason("");
    save.reset();
    addQuestion.reset();
  }
  async function nextQuizPage() {
    if (quizPage + 1 < quizPages.length) {
      setQuizPage(quizPage + 1); selectVersion(null);
    } else if (quizzes.hasNextPage && !quizzes.isFetchingNextPage) {
      const next = await quizzes.fetchNextPage();
      if ((next.data?.pages.length ?? 0) > quizPage + 1) {
        setQuizPage(quizPage + 1); selectVersion(null);
      }
    }
  }
  function selectQuestion(question: AdminLearningQuestion) {
    setSelectedId(question.id);
    setDraft({
      prompt: question.prompt, topic: question.topic, sortOrder: question.sortOrder,
      points: question.points, reason: "",
      options: question.options.map(({ optionKey, label, sortOrder, isCorrect }) => ({ optionKey, label, sortOrder, isCorrect })),
    });
    setStatus("");
    save.reset();
    addQuestion.reset();
  }
  async function saveQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || selectedId === null || versionId === null || readOnly || !validQuestion(draft)) return;
    setStatus("");
    try {
      await save.mutateAsync({ id: selectedId, versionId, input: { ...draft, reason: draft.reason.trim() } });
      setDraft({ ...draft, reason: "" });
      setStatus("Question saved and audited.");
    } catch { /* Mutation error is displayed below. */ }
  }
  async function createQuizSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quizDraft.title.trim() || !quizDraft.categoryCode.trim() || !quizDraft.level.trim() || !quizDraft.objective.trim() || !quizDraft.reason.trim()) return;
    setStatus("");
    try {
      const created = await createQuiz.mutateAsync({
        ...quizDraft, title: quizDraft.title.trim(), categoryCode: quizDraft.categoryCode.trim(),
        level: quizDraft.level.trim(), objective: quizDraft.objective.trim(), reason: quizDraft.reason.trim(),
      });
      setQuizPage(0);
      selectVersion(created.versionId);
      setQuizDraft(emptyQuiz);
      setShowQuizForm(false);
      setStatus("Quiz and draft version created. Add the planned questions, then publish.");
    } catch { /* Mutation error is displayed below. */ }
  }
  async function addQuestionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (versionId === null || selectedId !== null || readOnly || !draft || !validQuestion(draft)) return;
    setStatus("");
    try {
      await addQuestion.mutateAsync({ versionId, input: { ...draft, prompt: draft.prompt.trim(), topic: draft.topic.trim(), reason: draft.reason.trim() } });
      setDraft(null);
      setStatus("Question added and audited.");
    } catch { /* Mutation error is displayed below. */ }
  }
  async function newVersion() {
    if (!selectedQuiz?.published || !versionReason.trim() || versionReason.trim().length > 500) return;
    setLifecycleError("");
    try {
      const created = await createVersion.mutateAsync({ quizId: selectedQuiz.id, reason: versionReason.trim() });
      selectVersion(created.id);
      setStatus("New draft version created with a copy of the published questions.");
    } catch (cause) { setLifecycleError(message(cause)); }
  }
  async function publishVersion() {
    if (!selectedQuiz || selectedQuiz.published || versionId === null || !publishReason.trim() || publishReason.trim().length > 500) return;
    setLifecycleError("");
    try {
      await publish.mutateAsync({ versionId, reason: publishReason.trim() });
      setPublishReason("");
      setDraft(null);
      setSelectedId(null);
      setStatus("Quiz version published and locked.");
    } catch (cause) { setLifecycleError(message(cause)); }
  }

  if (quizzes.isPending) return <p role="status" aria-busy="true">Loading quizzes…</p>;
  if (quizzes.isError && !quizzes.data) return <div role="alert">Quizzes unavailable: {message(quizzes.error)} <button type="button" className="btn" onClick={() => void quizzes.refetch()}>Try again</button></div>;

  return <div className="min-w-0 space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Quizzes</h2><p className="mt-1 text-sm text-muted">Create a draft, add the planned questions, then publish for employees.</p></div><button className="btn-primary" type="button" onClick={() => { setShowQuizForm((value) => !value); createQuiz.reset(); }}>
      {showQuizForm ? "Close form" : "+ Create quiz"}
    </button></div>
    <div className="grid gap-2 text-xs text-muted sm:grid-cols-3"><p className="rounded-lg bg-[var(--hover)] p-3"><b className="block text-[var(--text)]">1 · Create draft</b>Set the audience and pass mark.</p><p className="rounded-lg bg-[var(--hover)] p-3"><b className="block text-[var(--text)]">2 · Add questions</b>Choose one correct answer per question.</p><p className="rounded-lg bg-[var(--hover)] p-3"><b className="block text-[var(--text)]">3 · Publish</b>Employees can then take the quiz.</p></div>
    <AdminDrawer open={showQuizForm} onClose={() => setShowQuizForm(false)} title="Create quiz" description="Create a draft version, then add questions and publish.">
    {showQuizForm && <form className="grid min-w-0 gap-3 sm:grid-cols-2" onSubmit={(event) => void createQuizSubmit(event)}>
      <h3 className="font-medium sm:col-span-2">New quiz and draft version</h3>
      <label className="min-w-0 text-sm">Quiz title<input className={field} required maxLength={240} value={quizDraft.title} onChange={(event) => setQuizDraft({ ...quizDraft, title: event.target.value })} placeholder="For example: Banking security essentials" /></label>
      <label className="min-w-0 text-sm">Category<select className={field} value={quizDraft.categoryCode} onChange={(event) => setQuizDraft({ ...quizDraft, categoryCode: event.target.value })}>{quizCategories.map(category => <option key={category.code} value={category.code}>{category.label}</option>)}</select></label>
      <label className="min-w-0 text-sm">Level<select className={field} value={quizDraft.level} onChange={(event) => setQuizDraft({ ...quizDraft, level: event.target.value })}>{quizLevels.map(level => <option key={level} value={level}>{level[0].toUpperCase() + level.slice(1)}</option>)}</select></label>
      <label className="min-w-0 text-sm">What will employees learn?<textarea className={`${field} min-h-20`} required maxLength={2000} value={quizDraft.objective} onChange={(event) => setQuizDraft({ ...quizDraft, objective: event.target.value })} /></label>
      <label className="text-sm">Pass mark (%)<input className={field} type="number" min="1" max="100" required value={quizDraft.passMark} onChange={(event) => setQuizDraft({ ...quizDraft, passMark: Number(event.target.value) })} /></label>
      <label className="text-sm">Planned questions<input className={field} type="number" min="1" max="100" required value={quizDraft.questionCount} onChange={(event) => setQuizDraft({ ...quizDraft, questionCount: Number(event.target.value) })} /></label>
      <label className="text-sm">Points per question<input className={field} type="number" min="1" max="10000" required value={quizDraft.pointsPerQuestion} onChange={(event) => setQuizDraft({ ...quizDraft, pointsPerQuestion: Number(event.target.value) })} /></label>
      <label className="text-sm">Time limit (seconds, at least 30)<input className={field} type="number" min="30" max="86400" value={quizDraft.timeLimitSeconds ?? ""} onChange={(event) => setQuizDraft({ ...quizDraft, timeLimitSeconds: event.target.value ? Number(event.target.value) : null })} /></label>
      <label className="text-sm sm:col-span-2">Audited reason<textarea className={`${field} min-h-16`} maxLength={500} required value={quizDraft.reason} onChange={(event) => setQuizDraft({ ...quizDraft, reason: event.target.value })} /></label>
      <button className="btn-primary sm:col-span-2" disabled={createQuiz.isPending}>{createQuiz.isPending ? "Creating…" : "Create draft quiz"}</button>
      {createQuiz.isError && <p role="alert" className="text-pink sm:col-span-2">Create failed: {message(createQuiz.error)}</p>}
    </form>}
    </AdminDrawer>

    <div><h3 className="font-medium">Existing quizzes</h3><p className="mt-1 text-xs text-muted">Select a quiz to add questions or review a published version. Published questions are locked; create a new draft version to edit them.</p></div>
    <div className="grid gap-2 sm:grid-cols-3">
      <input className={searchField} type="search" aria-label="Search quizzes" placeholder="Search quizzes" value={quizSearch} onChange={(event) => { setQuizSearch(event.target.value); setQuizPage(0); selectVersion(null); }} />
      <select className={searchField} aria-label="Filter quizzes by category" value={quizCategory} onChange={(event) => { setQuizCategory(event.target.value); setQuizPage(0); selectVersion(null); }}><option value="all">All categories</option>{quizCategories.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select>
      <select className={searchField} aria-label="Filter quizzes by status" value={quizStatus} onChange={(event) => { setQuizStatus(event.target.value); setQuizPage(0); selectVersion(null); }}><option value="all">All statuses</option><option value="draft">Draft</option><option value="published">Published</option></select>
    </div>
    {!quizItems.length ? <p className="rounded-xl border border-dashed border-[var(--line)] p-5 text-sm text-muted">{allQuizItems.length ? "No quizzes match these filters." : "No quizzes yet. Use “Create quiz” to add the first one."}</p> : <>
      <div className="overflow-x-auto rounded-xl border border-[var(--line)]"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-[var(--hover)] text-xs text-muted"><tr><th className="px-3 py-2">Quiz</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Level</th><th className="px-3 py-2">Questions</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Version</th><th className="px-3 py-2">Action</th></tr></thead><tbody>{quizItems.map(quiz => <tr key={`${quiz.id}-${quiz.versionId}`} className="border-t border-[var(--line)]"><td className="max-w-xs truncate px-3 py-3 font-medium" title={quiz.title}>{quiz.title}</td><td className="px-3 py-3">{quiz.category}</td><td className="px-3 py-3">{quiz.level ?? "—"}</td><td className="px-3 py-3">{quiz.questionCount}/{quiz.plannedQuestionCount}</td><td className="px-3 py-3"><span className={`pill ${quiz.published ? "text-teal" : "text-sand"}`}>{quiz.published ? "Published" : "Draft"}</span></td><td className="px-3 py-3">{quiz.version ?? "—"}</td><td className="px-3 py-3"><button className="btn btn-small" type="button" disabled={quiz.versionId === null} onClick={() => selectVersion(quiz.versionId)}>Manage</button></td></tr>)}</tbody></table></div>
      <AdminPagination label="Quizzes" page={quizPage + 1} pageSize={10} total={filteredQuizzes.length + (quizzes.hasNextPage && !quizSearch && quizCategory === "all" && quizStatus === "all" ? 10 : 0)} busy={quizzes.isFetchingNextPage} onPageChange={(page) => { setQuizPage(page - 1); selectVersion(null); if (page > quizPages.length && quizzes.hasNextPage) void nextQuizPage(); }} />
      {quizzes.isFetchNextPageError && <p role="alert" className="text-pink">Could not load the next quiz page. Select Next to retry.</p>}
    </>}

    <AdminDrawer open={Boolean(selectedQuiz)} onClose={() => selectVersion(null)} title={selectedQuiz?.title ?? "Quiz authoring"} description={selectedQuiz ? `Version ${selectedQuiz.version} · ${selectedQuiz.published ? "Published" : "Draft"}` : undefined}>
    {selectedQuiz && <div className="space-y-3 rounded-xl border p-3">
      <div><h3 className="font-semibold">{selectedQuiz.title}</h3><p className="mt-1 text-sm text-muted">Version {selectedQuiz.version} · {questions.isPending ? "Loading questions" : `${questionItems.length} of ${selectedQuiz.plannedQuestionCount} planned questions`} · {selectedQuiz.published ? "Published" : "Draft"}</p></div>
      {selectedQuiz.published ? <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-sm">Reason for new draft<input className={field} maxLength={500} value={versionReason} onChange={(event) => setVersionReason(event.target.value)} /></label>
        <button className="btn" type="button" onClick={() => void newVersion()} disabled={createVersion.isPending || !versionReason.trim()}>{createVersion.isPending ? "Creating…" : "Create draft version"}</button>
      </div> : <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-sm">Reason for publishing<input className={field} maxLength={500} value={publishReason} onChange={(event) => setPublishReason(event.target.value)} /></label>
        <button className="btn" type="button" onClick={() => void publishVersion()} disabled={publish.isPending || questions.isPending || questions.isError || questionItems.length !== selectedQuiz.plannedQuestionCount || !publishReason.trim()}>{publish.isPending ? "Publishing…" : "Publish version"}</button>
      </div>}
      {!selectedQuiz.published && <p className="text-xs text-muted">{questions.isPending ? "Checking questions…" : questionItems.length > selectedQuiz.plannedQuestionCount ? "This draft has more questions than planned and cannot be published." : questionItems.length < selectedQuiz.plannedQuestionCount ? `Add ${selectedQuiz.plannedQuestionCount - questionItems.length} more question${selectedQuiz.plannedQuestionCount - questionItems.length === 1 ? "" : "s"} before publishing. You can add extra questions too.` : "All planned questions are present. Publish now or add another question to extend the plan."}</p>}
    </div>}
    {lifecycleError && <p role="alert" className="text-pink">{lifecycleError}</p>}
    {status && <p role="status" className="text-teal">{status}</p>}

    {versionId !== null && (!selectedQuiz ? <p role="status">Refreshing selected quiz…</p> : questions.isPending ? <p role="status" aria-busy="true">Loading questions…</p> : questions.isError ? <div role="alert">Questions unavailable: {message(questions.error)} <button type="button" className="btn" onClick={() => void questions.refetch()}>Try again</button></div> : <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(180px,.65fr)_minmax(0,1.35fr)]">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Questions <span className="font-normal text-muted">{questionItems.length}/{selectedQuiz.plannedQuestionCount}</span></p>
          {!readOnly && questionItems.length < 100 && <button type="button" className="btn-primary" disabled={addQuestion.isPending} onClick={() => {
            const used = new Set(questionItems.map((question) => question.sortOrder));
            const order = Array.from({ length: 1001 }, (_, index) => index).find((value) => !used.has(value)) ?? 0;
            setSelectedId(null); setDraft(emptyQuestion(order)); setStatus(""); save.reset(); addQuestion.reset();
          }}>{addQuestion.isPending ? "Saving…" : "+ Add question"}</button>}
        </div>
        <div className="max-h-[28rem] space-y-2 overflow-y-auto overflow-x-hidden pr-1">
          {visibleQuestions.map((question) => <button key={question.id} type="button" className="btn w-full min-w-0 break-words text-left" aria-pressed={selectedId === question.id} onClick={() => selectQuestion(question)}>{question.sortOrder + 1}. {question.prompt}</button>)}
        </div>
        {!questionItems.length && <p className="text-sm text-muted">No questions in this version yet. Add the first question to begin authoring.</p>}
        {questionItems.length > 10 && <AdminPagination label="Quiz questions" page={questionPage + 1} pageSize={10} total={questionItems.length} onPageChange={(page) => setQuestionPage(page - 1)} />}
        {!readOnly && questionItems.length >= 100 && <p className="mt-2 text-xs text-muted">This quiz has reached the 100-question limit.</p>}
      </div>
      {!draft && <div className="flex min-h-44 items-center rounded-xl border border-dashed border-[var(--line)] p-5 text-sm text-muted">{readOnly ? "Select a question to review its answer options." : "Select a question to edit it, or use Add question to create the next one."}</div>}
      {draft && <form className="min-w-0 space-y-3" onSubmit={(event) => void (selectedId === null ? addQuestionSubmit(event) : saveQuestion(event))}>
        <label className="block text-sm">Question<textarea className={`${field} min-h-20`} value={draft.prompt} maxLength={3000} required disabled={readOnly} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} /></label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Topic<input className={field} value={draft.topic} maxLength={120} required disabled={readOnly} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} /></label>
          <label className="text-sm">Order<input className={field} type="number" min="0" max="1000" required value={draft.sortOrder} disabled={readOnly} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} /></label>
          <label className="text-sm">Points<input className={field} type="number" min="1" max="10000" required value={draft.points} disabled={readOnly} onChange={(event) => setDraft({ ...draft, points: Number(event.target.value) })} /></label>
        </div>
        <fieldset disabled={readOnly} className="min-w-0">
          <legend className="font-medium">Answers · choose one correct</legend>
          {draft.options.map((option, index) => <div key={`${option.optionKey}-${index}`} className="mt-2 flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap">
            <input type="radio" name="correct-answer" aria-label={`Mark option ${option.optionKey} correct`} checked={option.isCorrect} onChange={() => setDraft({ ...draft, options: draft.options.map((item, i) => ({ ...item, isCorrect: i === index })) })} />
            <span className="w-5 text-sm">{option.optionKey}</span>
            <input className={`${field} mt-0 flex-1`} aria-label={`Option ${option.optionKey} answer`} value={option.label} maxLength={500} required onChange={(event) => setDraft({ ...draft, options: draft.options.map((item, i) => i === index ? { ...item, label: event.target.value } : item) })} />
            {!readOnly && <button type="button" className="btn btn-small" aria-label={`Remove option ${option.optionKey}`} disabled={draft.options.length <= 2} onClick={() => {
              const options = draft.options.filter((_, i) => i !== index);
              if (!options.some((item) => item.isCorrect)) options[0] = { ...options[0], isCorrect: true };
              setDraft({ ...draft, options: options.map((item, i) => ({ ...item, sortOrder: i })) });
            }}>Remove</button>}
          </div>)}
          {!readOnly && <button type="button" className="btn btn-small mt-3" disabled={draft.options.length >= 10} onClick={() => setDraft(nextOption(draft))}>Add answer option</button>}
        </fieldset>
        {!readOnly && <>
          <label className="block text-sm">Audited reason<textarea className={`${field} min-h-20`} value={draft.reason} maxLength={500} required onChange={(event) => setDraft({ ...draft, reason: event.target.value })} /></label>
          <button className="btn-primary" type="submit" disabled={save.isPending || addQuestion.isPending || !validQuestion(draft)}>{save.isPending || addQuestion.isPending ? "Saving…" : selectedId === null ? "Add question" : "Save question"}</button>
        </>}
        {(save.isError || addQuestion.isError) && <p role="alert" className="text-pink">Save failed: {message(save.error ?? addQuestion.error)}</p>}
      </form>}
    </div>)}
    </AdminDrawer>
  </div>;
}

export function ArticleManager() {
  const articles = useLearningArticles();
  const save = useSaveLearningArticle();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [articlePage, setArticlePage] = useState(0);
  const [draft, setDraft] = useState<ArticleInput>(emptyArticle);
  const [editorOpen, setEditorOpen] = useState(false);
  const [status, setStatus] = useState("");
  const articlePages = articles.data?.pages ?? [];
  const allArticleItems = articlePages.flatMap((page) => page.items);
  const [articleSearch, setArticleSearch] = useState("");
  const [articleCategory, setArticleCategory] = useState("all");
  const [articleStatus, setArticleStatus] = useState("all");
  const filteredArticles = allArticleItems.filter((article) => (!articleSearch || `${article.title} ${article.summary} ${article.category} ${article.topic ?? ""}`.toLowerCase().includes(articleSearch.toLowerCase())) && (articleCategory === "all" || article.categoryCode === articleCategory) && (articleStatus === "all" || (articleStatus === "published") === article.published));
  const articleItems = filteredArticles.slice(articlePage * 10, articlePage * 10 + 10);

  function changeArticlePage(page: number) {
    setArticlePage(page);
    setSelectedId(null);
    setDraft(emptyArticle);
    setEditorOpen(false);
    setStatus("");
    save.reset();
  }
  async function nextArticlePage() {
    if (articlePage + 1 < articlePages.length) changeArticlePage(articlePage + 1);
    else if (articles.hasNextPage && !articles.isFetchingNextPage) {
      const next = await articles.fetchNextPage();
      if ((next.data?.pages.length ?? 0) > articlePage + 1) changeArticlePage(articlePage + 1);
    }
  }
  function changeFilter(setter: (value: string) => void, value: string) {
    setter(value);
    changeArticlePage(0);
  }
  function select(article: AdminLearningArticle) {
    setSelectedId(article.id);
    setDraft({
      title: article.title, summary: article.summary, body: article.body,
      category: article.category, categoryCode: article.categoryCode,
      topic: article.topic, publisher: article.publisher, difficulty: article.difficulty,
      readingMinutes: article.readingMinutes, publishedLabel: article.publishedLabel,
      url: article.url, published: article.published, contentType: article.contentType,
      reason: "",
    });
    setEditorOpen(true);
    setStatus("");
    save.reset();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.reason.trim() || draft.reason.trim().length > 500 || !validLink(draft)) return;
    setStatus("");
    try {
      const wasNew = selectedId === null;
      const saved = await save.mutateAsync({ id: selectedId, input: {
        ...draft, title: draft.title.trim(), summary: draft.summary.trim(), body: draft.body.trim(),
        category: draft.category.trim(), categoryCode: draft.categoryCode.trim(), publisher: draft.publisher.trim(),
        difficulty: draft.difficulty.trim(), reason: draft.reason.trim(),
        url: draft.contentType === "internal" ? null : draft.url?.trim() ?? null,
      } });
      setSelectedId(saved.id);
      setDraft({ ...draft, reason: "" });
      if (wasNew) setArticlePage(0);
      setStatus(`Article “${saved.title}” saved and audited.`);
    } catch { /* Mutation error is displayed below. */ }
  }

  if (articles.isPending) return <p role="status" aria-busy="true">Loading articles…</p>;
  if (articles.isError && !articles.data) return <div role="alert">Articles unavailable: {message(articles.error)} <button type="button" className="btn" onClick={() => void articles.refetch()}>Try again</button></div>;

  return <div className="min-w-0 space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Articles</h2><p className="mt-1 text-sm text-muted">Write an article here or add a reviewed HTTPS link for employees to read.</p></div>
      <button className="btn-primary" type="button" onClick={() => { setSelectedId(null); setDraft(emptyArticle); setEditorOpen(true); setStatus(""); save.reset(); }}>+ Add article</button>
    </div>
    <div><h3 className="font-medium">Existing articles</h3><p className="mt-1 text-xs text-muted">Select an article to edit or publish it. Drafts are visible only to administrators.</p></div>
    <div className="grid gap-2 sm:grid-cols-3">
      <input className={searchField} type="search" aria-label="Search articles" placeholder="Search articles" value={articleSearch} onChange={(event) => changeFilter(setArticleSearch, event.target.value)} />
      <select className={searchField} aria-label="Filter articles by category" value={articleCategory} onChange={(event) => changeFilter(setArticleCategory, event.target.value)}><option value="all">All categories</option>{quizCategories.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}<option value="other">Other</option></select>
      <select className={searchField} aria-label="Filter articles by status" value={articleStatus} onChange={(event) => changeFilter(setArticleStatus, event.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="published">Published</option></select>
    </div>
    {!articleItems.length ? <p className="rounded-xl border border-dashed border-[var(--line)] p-5 text-sm text-muted">{allArticleItems.length ? "No articles match these filters." : "No articles yet. Use “Add article” to create the first one."}</p> : <div className="overflow-x-auto rounded-xl border border-[var(--line)]"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-[var(--hover)] text-xs text-muted"><tr><th className="px-3 py-2">Article</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Reading</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Action</th></tr></thead><tbody>{articleItems.map((article) => <tr key={article.id} className="border-t border-[var(--line)]"><td className="max-w-xs truncate px-3 py-3 font-medium" title={article.title}>{article.title}</td><td className="px-3 py-3">{article.category}</td><td className="px-3 py-3">{article.contentType === "external" ? "External link" : "Internal"}</td><td className="px-3 py-3">{article.readingMinutes} min</td><td className="px-3 py-3"><span className={`pill ${article.published ? "text-teal" : "text-sand"}`}>{article.published ? "Published" : "Draft"}</span></td><td className="px-3 py-3"><button className="btn btn-small" type="button" onClick={() => select(article)}>Edit</button></td></tr>)}</tbody></table></div>}
    <AdminPagination label="Articles" page={articlePage + 1} pageSize={10} total={filteredArticles.length + (articles.hasNextPage && !articleSearch && articleCategory === "all" && articleStatus === "all" ? 10 : 0)} busy={articles.isFetchingNextPage} onPageChange={(page) => { if (page > articlePages.length && articles.hasNextPage) void nextArticlePage(); else changeArticlePage(page - 1); }} />
    {articles.isFetchNextPageError && <p role="alert" className="text-pink">Could not load the next article page. Select Next to retry.</p>}
    <AdminDrawer open={editorOpen} onClose={() => { setEditorOpen(false); setStatus(""); save.reset(); }} title={selectedId === null ? "Add article" : `Edit ${draft.title}`} description="Save as a draft or publish it for employees. Every change needs an audited reason.">
    {status && <p role="status" className="mb-3 text-teal">{status}</p>}
    {editorOpen && <form className="min-w-0 space-y-4" onSubmit={(event) => void submit(event)}>
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-lg font-semibold">{selectedId === null ? "Add article" : `Edit ${draft.title}`}</h3><p className="mt-1 text-xs text-muted">Save as a draft or publish it for employees. Every change needs an audited reason.</p></div><button type="button" className="btn btn-small" onClick={() => { setEditorOpen(false); setStatus(""); save.reset(); }}>Close editor</button></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block min-w-0 text-sm sm:col-span-2">Title<input className={field} required maxLength={240} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="For example: Protecting customer data" /></label>
        <label className="block min-w-0 text-sm sm:col-span-2">Short summary<textarea className={`${field} min-h-20`} required maxLength={2000} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} placeholder="What will the reader learn?" /></label>
        <label className="block min-w-0 text-sm">Content type<select className={field} value={draft.contentType} onChange={(event) => setDraft({ ...draft, contentType: event.target.value as ArticleInput["contentType"], url: null })}><option value="internal">Write the article here</option><option value="external">Link to an article</option></select></label>
        <label className="block min-w-0 text-sm">Category<select className={field} value={quizCategories.some((item) => item.code === draft.categoryCode) ? draft.categoryCode : "other"} onChange={(event) => { const category = quizCategories.find((item) => item.code === event.target.value); setDraft({ ...draft, categoryCode: category?.code ?? "other", category: category?.label ?? "Other" }); }}>{quizCategories.map((category) => <option key={category.code} value={category.code}>{category.label}</option>)}<option value="other">Other</option></select></label>
        {draft.contentType === "external" && <label className="block min-w-0 text-sm sm:col-span-2">HTTPS article URL<input className={field} type="url" pattern="https://.*" required maxLength={2048} value={draft.url ?? ""} onChange={(event) => setDraft({ ...draft, url: event.target.value })} placeholder="https://example.com/article" />{draft.url && !validLink(draft) && <span className="text-xs text-pink">Use a valid HTTPS URL without credentials.</span>}</label>}
        {draft.contentType === "external" && draft.url && validLink(draft) && <a className="btn inline-flex sm:col-span-2" href={draft.url} target="_blank" rel="noopener noreferrer">Open link to check</a>}
        <label className="block min-w-0 text-sm sm:col-span-2">{draft.contentType === "internal" ? "Article text" : "Description of linked article"}<textarea className={`${field} min-h-40`} required maxLength={30000} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} /></label>
        <label className="block min-w-0 text-sm">Topic (optional)<input className={field} maxLength={120} value={draft.topic ?? ""} onChange={(event) => setDraft({ ...draft, topic: event.target.value || null })} /></label>
        <label className="block min-w-0 text-sm">Reading time in minutes<input className={field} type="number" min="1" max="600" required value={draft.readingMinutes} onChange={(event) => setDraft({ ...draft, readingMinutes: Number(event.target.value) })} /></label>
      </div>
      <details className="rounded-lg border border-[var(--line)] p-3"><summary className="cursor-pointer text-sm font-medium">More details</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block min-w-0 text-sm">Publisher<input className={field} required maxLength={200} value={draft.publisher} onChange={(event) => setDraft({ ...draft, publisher: event.target.value })} /></label>
        <label className="block min-w-0 text-sm">Difficulty<input className={field} required maxLength={60} value={draft.difficulty} onChange={(event) => setDraft({ ...draft, difficulty: event.target.value })} /></label>
        <label className="block min-w-0 text-sm">Published label (optional)<input className={field} maxLength={100} value={draft.publishedLabel ?? ""} onChange={(event) => setDraft({ ...draft, publishedLabel: event.target.value || null })} /></label>
        {draft.categoryCode === "other" && <label className="block min-w-0 text-sm">Category name<input className={field} required maxLength={100} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label>}
      </div></details>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} />Publish for employees when saved</label>
      <label className="block text-sm">Reason for this change<textarea className={`${field} min-h-16`} maxLength={500} required value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} placeholder="For example: Reviewed by the learning team" /></label>
      <button className="btn-primary" type="submit" disabled={save.isPending || !draft.reason.trim() || !validLink(draft)}>{save.isPending ? "Saving…" : draft.published ? "Save and publish article" : "Save draft article"}</button>
      {save.isError && <p role="alert" className="text-pink">Save failed: {message(save.error)}</p>}
    </form>}
    </AdminDrawer>
  </div>;
}

export default AdminLearningContent;
