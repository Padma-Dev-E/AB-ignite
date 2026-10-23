'use client';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { signOut } from 'next-auth/react';
import { Button, Card } from '../../components/ui';
import { apiFetch } from '../../lib/api/client';
import { useEmployeeProfile } from '../employee/profile-hooks';
import { usePointsSummary } from '../points/hooks';
import { useIdeas } from '../ideas/hooks';
import { EmployeeIdeaDetailPage } from '../ideas/components/employee-idea-flow';
import { useFeedbackCampaign } from '../employee/engagement-hooks';
import { EmployeeFeedbackCampaignForm } from '../employee/employee-engagement';
import { useChangePassword } from './hooks';
import { passwordInput, passwordPolicyHint } from './password-policy';

type Page = 'community' | 'new' | 'learn';
function State({ query }: { query: { isPending: boolean; isError: boolean; refetch: () => unknown } }) {
  return query.isPending ? <p role="status" className="py-6 text-muted">Loading…</p> : query.isError ? <div role="alert" className="py-4"><p>Unable to load this section.</p><Button className="mt-2" onClick={() => void query.refetch()}>Try again</Button></div> : null;
}
export function AccountOverview({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [selectedIdea, setSelectedIdea] = useState<number | null>(null);
  const profile = useEmployeeProfile();
  const rewards = usePointsSummary();
  const [ideaPage, setIdeaPage] = useState(1);
  const ideas = useIdeas({ mine: true, page: ideaPage, pageSize: 10 });
  const feedback = useFeedbackCampaign();
  const [showFeedback, setShowFeedback] = useState(false);
  const [statementPage, setStatementPage] = useState(1);
  const statement = useQuery({ queryKey: ['account', 'statement', profile.data?.id, statementPage], enabled: !!profile.data, queryFn: () => apiFetch<{ items: Array<{ id: number; amount: number; activity: string; createdAt: string }>; hasMore: boolean }>(`/api/account/password/statement?page=${statementPage}`) });
  const change = useChangePassword();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [formError, setFormError] = useState('');
  const p = profile.data;
  const demo = p?.email.endsWith('@demo.abignite.invalid');
  async function save(event: React.FormEvent) {
    event.preventDefault(); setFormError('');
    if (!passwordInput.safeParse({ currentPassword, newPassword }).success) { setFormError(`${passwordPolicyHint} Choose a password different from your current password.`); return; }
    try { await change.mutateAsync({ currentPassword, newPassword }); setCurrent(''); setNew(''); } catch { /* Render mutation error. */ }
  }
  async function leave() {
    await fetch('/api/auth/refresh', { method: 'DELETE', credentials: 'same-origin' });
    await signOut({ callbackUrl: '/login' });
  }
  if (selectedIdea !== null) return <EmployeeIdeaDetailPage ideaId={selectedIdea} onBack={() => setSelectedIdea(null)} />;
  return <div className="stack">
    <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#102d7b] to-[#205bff] p-6 text-white sm:p-9">
      <div aria-hidden="true" className="pointer-events-none absolute -right-6 top-6 h-48 w-48 rounded-full bg-white/15" />
      <State query={profile} />
      {p && <div className="relative"><div className="flex flex-wrap items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 text-xl font-semibold">{p.name.charAt(0).toUpperCase()}</span><h1 className="break-words text-3xl font-semibold sm:text-4xl">{p.name}</h1>{demo && <span className="rounded-full border border-white/50 px-3 text-sm">Demo profile</span>}</div><p className="mt-2 text-white/80">{p.jobTitle || (demo ? 'Demo participant' : 'Employee')} · {p.department}</p></div>}
      <State query={rewards} />
      <div className="relative mt-5 flex flex-wrap gap-3">{rewards.data && <span className="rounded-xl border border-white/30 bg-white/10 px-4 py-3">💡 {rewards.data.balance.balance.toLocaleString()} points</span>}<span className="rounded-xl border border-white/30 bg-white/10 px-4 py-3">🏅 {typeof p?.rank === 'number' ? `Rank ${p.rank}` : 'Rank not available'}</span>{ideas.data && <span className="rounded-xl border border-white/30 bg-white/10 px-4 py-3">💡 {ideas.data.total} ideas</span>}</div>
      {rewards.data && <p className="relative mt-5 text-sm">Current level: <strong>{rewards.data.level?.name ?? 'Ignite Starter'}</strong></p>}
    </section>
    <div className="grid gap-5 lg:grid-cols-2">
      <Card><h2 className="text-xl font-semibold">My ideas</h2><p className="mt-1 text-sm text-muted">{ideas.data?.total ?? 'Your ideas'} registered to you. Follow their progress.</p><State query={ideas} />{ideas.data && (ideas.data.items.length ? <ul className="mt-5 divide-y">{ideas.data.items.map(idea => <li className="py-3" key={idea.id}><button className="block text-left font-semibold text-blue underline" onClick={() => setSelectedIdea(idea.id)}>{idea.title}</button><span className="text-sm text-muted">{idea.reference} · {idea.status.replaceAll('_', ' ')}</span><p className="mt-1 text-sm">{idea.summary}</p></li>)}</ul> : <p className="py-10 text-center text-muted">No ideas yet. <button className="text-blue underline" onClick={() => onNavigate('new')}>Share your first</button></p>)}{ideas.data && ideas.data.totalPages > 1 && <div className="mt-4 flex gap-2"><Button disabled={ideaPage === 1} onClick={() => setIdeaPage(n => n - 1)}>Previous ideas</Button><Button disabled={ideaPage >= ideas.data.totalPages} onClick={() => setIdeaPage(n => n + 1)}>Next ideas</Button></div>}</Card>
      <Card><h2 className="text-xl font-semibold">Badges</h2><State query={rewards} /><div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3">{rewards.data?.badges.map(badge => <div key={badge.id} className={`text-center ${badge.awarded ? '' : 'text-muted'}`}><span aria-hidden="true" className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border text-2xl">{String(badge.emoji ?? '🏅')}</span><h3 className="font-semibold">{badge.name}</h3><p className="mt-1 text-xs leading-5">{badge.description}</p><span className="text-xs">{badge.awarded ? 'Earned' : 'Locked'}</span></div>)}</div>{rewards.data?.badges.length === 0 && <p className="py-6 text-muted">No badges available yet.</p>}</Card>
    </div>
    <Card><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-semibold">Learning</h2><p className="mt-2 text-sm text-muted">Your personal learning journey, with topic scores and recommended reading, lives under Ignite Your Knowledge.</p></div><Button onClick={() => onNavigate('learn')}>Open my journey</Button></div></Card>
    <Card><h2 className="text-xl font-semibold">Points activity</h2><p className="mt-1 text-sm text-muted">Your earned points and related account activity.</p><State query={statement} />{statement.data && <><div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Points activity</caption><thead><tr className="border-b"><th scope="col" className="py-3">Date</th><th scope="col">Activity</th><th scope="col" className="text-right">Points</th></tr></thead><tbody>{statement.data.items.map(row => <tr key={row.id} className="border-b"><td className="py-3 pr-3 whitespace-nowrap">{new Date(row.createdAt).toLocaleDateString()}</td><td>{row.activity.replaceAll('_', ' ')}</td><td className="text-right">{row.amount > 0 ? '+' : ''}{row.amount}</td></tr>)}{!statement.data.items.length && <tr><td colSpan={3} className="py-8 text-center text-muted">No activity yet.</td></tr>}</tbody></table></div><div className="mt-3 flex gap-2"><Button disabled={statementPage === 1} onClick={() => setStatementPage(n => n - 1)}>Previous</Button><Button disabled={!statement.data.hasMore} onClick={() => setStatementPage(n => n + 1)}>Next</Button></div></>}</Card>
    <Card><div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-semibold">My Feedback</h2><Button onClick={() => setShowFeedback(v => !v)}>{showFeedback ? 'Close feedback form' : 'Share feedback'}</Button></div><p className="mt-2 text-sm text-muted">Feedback you shared about AB Ignite and responses from the platform team. Only you can see this.</p><State query={feedback} />{feedback.data && (!feedback.data.responses.length ? <p className="py-10 text-center text-muted">You have not shared feedback in the current campaign yet.</p> : <ul className="mt-4 divide-y">{feedback.data.responses.map(item => { const response = item as typeof item & { response?: string | null }; return <li key={item.id} className="py-4"><p className="text-xs text-muted">Feedback #{item.id} · {item.category} · {new Date(item.createdAt).toLocaleDateString()} · {response.response ? 'Answered' : 'Awaiting response'}</p><p className="mt-2 whitespace-pre-wrap">{item.message}</p>{response.response && <p className="mt-3 rounded-xl bg-blue-50 p-3">Platform team: {response.response}</p>}</li>; })}</ul>)}{showFeedback && <div className="mt-5"><EmployeeFeedbackCampaignForm /></div>}</Card>
    <Card><h2 className="text-xl font-semibold">Account</h2>{p && <p className="mt-2 break-all text-sm text-muted">{p.email}{demo && ' · Demo profile'}</p>}<details className="mt-5"><summary className="cursor-pointer font-medium text-blue focus-visible:outline focus-visible:outline-2">Change password</summary>{demo ? <p className="mt-4 text-sm text-muted">This demo profile is separate from employee records and has no password. Sign in with an employee account to change its password.</p> : <form className="mt-5 max-w-lg space-y-4" onSubmit={save}><label className="block"><span className="field-label">Current password</span><input type="password" autoComplete="current-password" className="input" required maxLength={1024} value={currentPassword} onChange={e => setCurrent(e.target.value)} disabled={change.isPending || change.isSuccess} /></label><label className="block"><span className="field-label">New password</span><input type="password" autoComplete="new-password" aria-describedby="password-policy" className="input" minLength={10} maxLength={128} required value={newPassword} onChange={e => setNew(e.target.value)} disabled={change.isPending || change.isSuccess} /></label><p id="password-policy" className="text-sm text-muted">{passwordPolicyHint} Saving signs you out on all devices.</p>{(formError || change.isError) && <p role="alert">{formError || change.error?.message}</p>}{change.isSuccess && <p role="status">Password changed. All sessions revoked. <a className="text-blue underline" href="/login">Sign in again</a></p>}<Button type="submit" variant="primary" disabled={change.isPending || change.isSuccess || !p}>{change.isPending ? 'Saving…' : 'Save password'}</Button></form>}</details><Button className="mt-5" onClick={() => void leave()}>Sign out</Button></Card>
  </div>;
}
