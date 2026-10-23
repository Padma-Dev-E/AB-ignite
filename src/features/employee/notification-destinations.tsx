"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError } from "../../lib/api/client";
import { ArticleList } from "../learning/components/learning-cards";
import { useLearningRecommendations } from "../learning/hooks";
import { useFeedbackCampaign } from "./engagement-hooks";
import { EmployeeFeedbackCampaignForm } from "./employee-engagement";
import { getNotificationAnnouncement } from "./engagement-api";

export function NotificationAnnouncementDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const query = useQuery({
    queryKey: ["employee", "announcement", id],
    queryFn: () => getNotificationAnnouncement(id),
    retry: false,
  });
  return <section className="app-card" aria-labelledby="notification-announcement-title">
    <button type="button" className="btn btn-small mb-5" onClick={onBack}>Back to Community</button>
    {query.isPending ? <p role="status">Loading announcement…</p> : query.isError || !query.data ? <div role="alert"><h1 id="notification-announcement-title" className="text-xl font-semibold">Announcement unavailable</h1><p className="mt-2 text-sm text-muted">{query.error instanceof ApiError && query.error.status === 404 ? "This announcement is no longer available." : "This announcement could not be loaded."}</p>{!(query.error instanceof ApiError && query.error.status === 404) && <button type="button" className="btn mt-4" onClick={() => void query.refetch()}>Try again</button>}</div> : <><h1 id="notification-announcement-title" className="text-2xl font-semibold">{query.data.title}</h1><p className="mt-4 whitespace-pre-wrap leading-7">{query.data.body}</p></>}
  </section>;
}

export function NotificationFeedbackDetail({ onBack }: { onBack: () => void }) {
  const query = useFeedbackCampaign();
  return <div className="stack">
    <button type="button" className="btn btn-small self-start" onClick={onBack}>Back to Community</button>
    <section className="app-card" aria-labelledby="notification-feedback-title">
      <h1 id="notification-feedback-title" className="text-2xl font-semibold">My Feedback</h1>
      <p className="mt-2 text-sm text-muted">Your feedback and responses from the platform team.</p>
      {query.isPending ? <p className="mt-4" role="status">Loading feedback…</p> : query.isError ? <div role="alert" className="mt-4"><p>Feedback could not be loaded.</p><button type="button" className="btn mt-3" onClick={() => void query.refetch()}>Try again</button></div> : query.data.responses.length ? <ul className="mt-4 divide-y">{query.data.responses.map((item) => {
        const response = item as typeof item & { response?: string | null };
        return <li key={item.id} className="py-4"><p className="text-xs text-muted">Feedback #{item.id} · {item.category} · {new Date(item.createdAt).toLocaleDateString()}</p><p className="mt-2 whitespace-pre-wrap">{item.message}</p>{response.response && <p className="mt-3 rounded-xl bg-blue-50 p-3">Platform team: {response.response}</p>}</li>;
      })}</ul> : <p className="mt-4 text-sm text-muted">You have not shared feedback in the current campaign yet.</p>}
    </section>
    <EmployeeFeedbackCampaignForm />
  </div>;
}

export function NotificationRecommendationDetail({ topic, onArticle, onBack }: { topic: string; onArticle: (id: number) => void; onBack: () => void }) {
  const query = useLearningRecommendations();
  const articles = (query.data?.items ?? []).filter((item) => item.recommendation?.topic.toLocaleLowerCase() === topic.toLocaleLowerCase() || item.topic?.toLocaleLowerCase() === topic.toLocaleLowerCase());
  return <div className="stack">
    <button type="button" className="btn btn-small self-start" onClick={onBack}>Back to Library</button>
    <section className="app-card" aria-labelledby="notification-recommendation-title">
      <h1 id="notification-recommendation-title" className="text-2xl font-semibold">Recommended reading: {topic}</h1>
      <p className="mt-2 text-sm text-muted">Reading selected for this topic based on your learning journey.</p>
    </section>
    {query.isPending ? <p role="status">Loading recommended reading…</p> : query.isError ? <div role="alert"><p>Recommended reading could not be loaded.</p><button type="button" className="btn mt-3" onClick={() => void query.refetch()}>Try again</button></div> : articles.length ? <ArticleList articles={articles} onOpen={(article) => onArticle(article.id)} /> : <p role="status" className="app-card">No reading for this topic is available right now. It may have been completed or removed.</p>}
  </div>;
}
