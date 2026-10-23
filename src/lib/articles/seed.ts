import { and, eq } from "drizzle-orm";
import { db } from "../../db/connection";
import { articles, feedbackCampaigns, pointRules } from "../../db/schema";

export function ensureArticleCatalogue() {
  return db.transaction((tx) => {
    const examples = [
      { title: "Building a culture of continuous improvement", summary: "Practical ways to identify friction and improve everyday banking work.", body: "Continuous improvement starts by observing a process, listening to colleagues and customers, and testing small changes with clear controls. Measure the baseline, involve the people who do the work, and review outcomes before scaling.", category: "transformation", topic: "transformation-fundamentals", publisher: "AB Ignite Learning", difficulty: "beginner", readingMinutes: 5, contentType: "internal" as const },
      { title: "Designing safer digital services", summary: "A guide to balancing customer experience, resilience and responsible controls.", body: "Safe digital services make controls part of the design. Map data flows, limit access, test failure modes and provide clear recovery paths. Validate changes with representative users and monitor outcomes after release.", category: "technology", topic: "technology-fundamentals", publisher: "AB Ignite Learning", difficulty: "intermediate", readingMinutes: 7, contentType: "internal" as const },
    ];
    for (const item of examples) {
      const [existing] = tx.select({ id: articles.id }).from(articles).where(and(eq(articles.title, item.title), eq(articles.publisher, item.publisher))).limit(1).all();
      if (!existing) tx.insert(articles).values({ ...item, published: true, publishedLabel: "Curated learning", updatedAt: new Date() }).run();
    }
    const [campaign] = tx.select({ id: feedbackCampaigns.id }).from(feedbackCampaigns).where(eq(feedbackCampaigns.title, "Improve AB Ignite")).limit(1).all();
    if (!campaign) tx.insert(feedbackCampaigns).values({ title: "Improve AB Ignite", description: "Tell us what is working well and what would make the platform better.", active: true, pinned: true }).run();
    const [rule] = tx.select({ id: pointRules.id }).from(pointRules).where(eq(pointRules.code, "article_read")).limit(1).all();
    if (!rule) tx.insert(pointRules).values({ code: "article_read", name: "Article completed", points: 10, active: true, description: "Complete an article", updatedAt: new Date() }).run();
    return { articles: examples.length, feedbackCampaign: true };
  });
}
