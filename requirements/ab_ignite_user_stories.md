# AB Ignite — Main User Stories
**Oct 22, 2026 • @Maya**

Five journeys cover what the AB Ignite demo does today: sharing an idea, taking quizzes, reading articles, redeeming rewards, and running the back office. Each story is written as *As a..., I want..., so that...* with its acceptance criteria, taken from the application as built (v10).

## 1. Ideation journey
An employee turns a rough thought into a registered, scored idea in five phases; only ideas that pass the AI check and reach the minimum priority score go to the transformation team.

| ID | User story | Acceptance criteria |
| :--- | :--- | :--- |
| **ID-01** | As an employee, I want to describe my idea or a problem in my own words, so that I do not need a template to start. | Share an idea opens with "An idea / A problem" and one free-text box; "Develop with AI" continues. |
| **ID-02** | As an employee, I want the platform to check originality before I invest effort, so that I do not duplicate a colleague's idea. | Similar registered ideas are shown; a near-duplicate is stopped unless I open the original or explain how mine differs (at least 20 characters); the original author keeps credit and is notified. |
| **ID-03** | As an employee, I want AI to structure my idea into title, summary, problem, solution, benefits and risks, so that reviewers get a complete picture. | Fields are pre-filled and editable; without AI the structure is still shown for manual completion. |
| **ID-04** | As an employee, I want to answer a few direct questions about my idea, so that my case is stronger. | Five short questions (who benefits, what happens today, what is needed, what could go wrong, how success is measured); answers are stored with the idea and shown to reviewers. |
| **ID-05** | As an employee, I want a pass-or-fail check before submission, so that weak ideas are improved rather than rejected later. | AI validation returns pass or fail with reasons; a failed idea cannot be submitted until improved and re-validated. |
| **ID-06** | As an employee, I want to give three numbers (turnaround time, volume, expected savings or revenue) with an optional explanation each, so that priority is transparent. | All three are required; each has a hint and an optional explanation box; the score updates live (weights 30 / 30 / 40, bands Watch / Quality / Priority). |
| **ID-07** | As an employee, I want to know the minimum score before submitting, so that I can strengthen my case. | Submit is disabled below the minimum (2.00 of 3.00 by default); the server rejects lower scores and returns the breakdown; the minimum is an admin setting. |
| **ID-08** | As an employee, I want a reference number and confirmation when I submit, so that I can track my idea. | Reference `ABI-YYYY-NNNNN`, category, final priority and the scoring breakdown are shown; 50 Ignite Points are credited (milestone 1). |
| **ID-09** | As an employee, I want to follow my idea through the workflow, so that I know where it stands. | Track shows Submitted -> Business review -> Control review -> Confirmation -> Proof of concept -> Implementation -> Impact; a notification is sent at every step. |
| **ID-10** | As an employee, I want to be told when my idea is accepted, so that I can celebrate and prepare for the proof of concept. | After the business owner approves and the transformation team confirms, the status becomes "Accepted: proof of concept" and the notification "Congratulations, ABI-... has been accepted" is sent. |
| **ID-11** | As an employee, I want to support and comment on colleagues' ideas on the Community wall, so that good ideas gain visibility. | Supports and comments are counted; the commenter earns 5 points and the author 2 per support. |

**Screens:** Describe (ID-01) -> Develop with originality check (ID-02, ID-03) -> Numbers with live score and the 2.00 minimum (ID-06, ID-07).

---

## 2. Quizzes journey (Ignite Your Knowledge)
Quizzes measure knowledge by topic, pay points on the first attempt, and feed the personal learning journey with reading recommendations.

| ID | User story | Acceptance criteria |
| :--- | :--- | :--- |
| **QZ-01** | As an employee, I want to see the quizzes available to me by category and level, so that I can pick where to start. | Three categories (banking, transformation, technology) × four levels, 12 quizzes; each shows title, difficulty, objective, pass mark and time limit. |
| **QZ-02** | As an employee, I want to take a quiz with a time limit, so that the result reflects what I know. | Questions are shown one at a time; the timer counts down when a limit is set; the attempt is graded on the server. |
| **QZ-03** | As an employee, I want an immediate result with the pass mark, so that I know whether I passed. | Score in %, pass/fail against the quiz's pass mark, and the comparison with my previous attempt. |
| **QZ-04** | As an employee, I want to earn Ignite Points for correct answers, so that learning counts towards my level. | Points per correct answer are paid on the first attempt only; retakes update the score but pay nothing. |
| **QZ-05** | As an employee, I want to see my topic strengths and gaps, so that I know what to study. | My journey shows a score per topic and category, the trend across attempts and the next recommended step. |
| **QZ-06** | As an employee, I want reading recommended for the topics I scored low on, so that I can improve. | A topic below the threshold (70% by default, configurable per rule) creates an open recommendation with a reason; a notification points me to it. |
| **QZ-07** | As an employee, I want to see the ranking, so that I can compare with the whole bank or my department. | Innovation Champions ranks by Ignite Points, with a whole-bank and a my-department view. |
| **QZ-08** | As an employee, I want challenges to join, so that I can contribute to themes the bank cares about. | Open challenges show question, deadline and participants; joining pays 20 points once. |

**Screen:** Ignite Your Knowledge, My journey (QZ-01, QZ-05) with the three categories and the next recommended quiz.

---

## 3. Articles journey (Library)
The Library holds curated reading; recommended items come from quiz results, and finishing an article closes the recommendation and pays points once.

| ID | User story | Acceptance criteria |
| :--- | :--- | :--- |
| **AR-01** | As an employee, I want to browse the library by category, so that I can find relevant reading. | Published articles show publisher, title, source and a short description; filters by category. |
| **AR-02** | As an employee, I want a "Recommended" view, so that I see what was picked for my gaps. | Recommended tab lists open recommendations with the reason (topic and score); empty state explains how to get recommendations. |
| **AR-03** | As an employee, I want to open an article in the platform or at its source, so that I can read it where it lives. | In-app content renders for internal articles; external links open in a new tab. |
| **AR-04** | As an employee, I want to mark an article as read, so that my journey and points are updated. | "Mark as read" closes the open recommendation, pays reading points once, and may unlock a badge; a second completion pays nothing. |
| **AR-05** | As an employee, I want AI insight on how a reading relates to my results, so that I understand why it was recommended. | When AI is connected, a short explanation accompanies the recommendation; without AI the rule's message is shown. |

**Screen:** Library with category filters and the Recommended tab (AR-01, AR-02).

---

## 4. Rewards redeem journey
Ignite Points are spent on rewards; the back office fulfils or cancels each request, and a cancellation refunds the points.

| ID | User story | Acceptance criteria |
| :--- | :--- | :--- |
| **RW-01** | As an employee, I want to see my points balance and the rewards catalogue, so that I know what I can afford. | Rewards page shows the balance, each reward's name, description and cost; earned-only recognitions are listed separately. |
| **RW-02** | As an employee, I want to redeem a reward, so that my contribution is recognised. | Confirmation dialog states the cost; on confirm the points are deducted immediately and a request is created with status "requested". |
| **RW-03** | As an employee, I want to be stopped if I cannot afford a reward, so that my balance never goes negative. | The server refuses a redemption above the balance with a clear message. |
| **RW-04** | As an employee, I want to see the status of my redemptions, so that I know when to expect them. | My redemptions list shows date, reward, cost and status (requested, fulfilled, cancelled). |
| **RW-05** | As a back-office user, I want to fulfil or cancel a redemption, so that the innovation team can deliver rewards. | Only "requested" items can be handled; cancelling refunds the points to the employee; the action is written to the audit log. |
| **RW-06** | As an administrator, I want to manage the rewards catalogue, so that it stays relevant. | Create and edit name, description, cost, kind (redeem or earned) and active flag. |

**Screens:** employee Rewards page with balance and locked rewards (RW-01, RW-03); back-office Rewards catalogue and redemption requests (RW-05, RW-06).

---

## 5. Admin portal journey
The back office has three profiles: the transformation team works two queues, business owners evaluate what is routed to them, and administrators configure the platform; every permission is enforced by the server.

| ID | User story | Acceptance criteria |
| :--- | :--- | :--- |
| **AD-01** | As a transformation team member, I want a queue of new ideas, so that I can screen them. | Queue 1 lists ideas in screening with reference, title, author, priority and due date; actions: send to a business owner, return to employee, reject, defer. |
| **AD-02** | As a transformation team member, I want a second queue of ideas approved by business owners, so that I can give the final confirmation. | Queue 2 lists owner-approved ideas; "Confirm and accept" moves the idea to proof of concept and notifies the employee. |
| **AD-03** | As a business owner, I want to see only the ideas routed to me, so that I can evaluate them quickly. | Evaluation view shows the idea, the five answers, the AI assessment and the author's explanations; actions: approve and send to the transformation team, return to employee for changes, not recommended. |
| **AD-04** | As a reviewer, I want to see the priority breakdown with the author's notes, so that my decision is informed. | Each KPI shows the answer, score, weight and the author's explanation. |
| **AD-05** | As a management user, I want dashboards, so that I can follow the pipeline. | Counts by status, priority bands, departments, points, learning analytics; CSV exports for ideas, benefits, audit and feedback. |
| **AD-06** | As an administrator, I want to manage users and roles, so that the right people have the right access. | Create users, assign roles (employee, reviewer, business owner, control, management, admin), reset passwords, deactivate. |
| **AD-07** | As an administrator, I want to configure the rules, so that the platform matches the bank's policy. | Settings: priority KPIs (questions, hints, weights, bands), band thresholds, minimum score to submit, points per event, levels, SLA days, required controls, departments, demo access and profiles. |
| **AD-08** | As an administrator, I want to manage learning content, so that quizzes and articles stay current. | Learning Content Management: quizzes and questions, recommendation rules, link check for external articles. |
| **AD-09** | As an administrator, I want to run campaigns, challenges and announcements, so that engagement stays high. | Create and pin announcements, open and close challenges, run the feedback campaign and answer feedback. |
| **AD-10** | As a back-office user, I want an audit trail, so that every decision is traceable. | Every login, transition, setting change and redemption is logged with actor, time, detail and IP; exportable as CSV. |

**Screens:** Transformation queues with the two queues (AD-01, AD-02); Workflow settings including priority KPIs and the minimum score (AD-07).

---

## Cross-cutting stories

| ID | User story | Acceptance criteria |
| :--- | :--- | :--- |
| **CC-01** | As a demo employee, I want to join with my name only, so that I can try the platform in seconds. | Name and department create a profile; the same name later returns to the same profile; demo sessions last 30 days. |
| **CC-02** | As a registered user, I want a secure login, so that my account is protected. | Email and password (hashed), sessions expire after 30 minutes idle or 12 hours, 5 failed attempts lock the account for 15 minutes. |
| **CC-03** | As an employee, I want notifications in the app and by email, so that I never miss a step. | In-app bell with unread count; email when an SMTP relay is configured. |
| **CC-04** | As an employee, I want points and levels, so that progress is visible. | Points for submission (50), screening passed (100), approval (300), implementation (500), validated benefits (500), comments, supports, challenges, quizzes and reading; levels from Ignite Starter (0) to Transformation Champion (5,000). |
| **CC-05** | As an employee, I want badges, so that milestones are recognised. | Badges such as first idea, POC pioneer, impact builder and value creator unlock automatically. |
| **CC-06** | As an employee, I want to give feedback about the platform itself, so that it improves. | The pinned feedback campaign collects feedback by category; the back office responds and the employee is notified. |

**Screen:** login with "Join the demo" (name only) and "I have an account" (CC-01, CC-02).