import Link from "next/link";
import { Nav } from "@/components/Nav";

const pillars = [
  {
    title: "Campus-wide discovery",
    body: "Students browse every department and lab typology — ideation, wet labs, HPC, fab, optics — then book in-lab use or borrow with competition evidence.",
  },
  {
    title: "Faculty approvals & GenAI fairness",
    body: "Lab teachers approve only their assigned labs. Staff AI Allocate scores deadlines, credentials, utilization, and concurrent holds (students never get AI).",
  },
  {
    title: "Dual dashboards, full lifecycle",
    body: "Student workspace (bookings, requests, timetable, exams) vs Ops Hub (approvals, conflicts, incidents/fines, utilization) with check-in, handover, and return.",
  },
];

const psMap = [
  { label: "Discovery", detail: "Explore every campus lab" },
  { label: "Booking", detail: "Use in Lab + Borrow flows" },
  { label: "Approvals", detail: "Faculty / admin gates" },
  { label: "Fair allocation", detail: "Heuristic + optional Gemini" },
  { label: "Conflicts", detail: "Detect · keep / shift / cancel" },
  { label: "Utilization", detail: "Scoped analytics" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Nav user={null} />
      <main>
        <section className="shell grid-labs relative overflow-hidden pb-16 pt-14 md:pb-24 md:pt-20">
          <div className="fade-up max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
              <span className="pulse-dot" aria-hidden /> PromptWars · Cynergy Coding Club
            </div>
            <h1 className="brand text-5xl leading-[0.95] text-[var(--ink)] md:text-7xl">
              Lab<span className="text-[var(--accent)]">Link</span>
            </h1>
            <p className="fade-up-delay mt-5 max-w-xl text-lg text-[var(--ink-soft)] md:text-xl">
              GenAI-powered laboratory resource sharing — making every campus lab accessible with discovery, intelligent
              booking, faculty gates, and fair allocation across universal lab typologies.
            </p>
            <div className="fade-up-delay-2 mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="btn btn-primary">
                Open dashboards
              </Link>
              <Link href="/login?role=STUDENT" className="btn btn-ghost">
                Student dashboard
              </Link>
              <Link href="/login?role=STAFF" className="btn btn-accent">
                Teacher / Admin ops
              </Link>
            </div>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {pillars.map((p, i) => (
              <article
                key={p.title}
                className="panel rounded-2xl p-5"
                style={{ animationDelay: `${180 + i * 80}ms` }}
              >
                <h2 className="text-xl font-semibold">{p.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{p.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-[var(--line)] bg-white/50" aria-labelledby="ps-map-heading">
          <div className="shell py-12">
            <h2 id="ps-map-heading" className="text-2xl font-semibold md:text-3xl">
              Problem statement → product map
            </h2>
            <p className="mt-2 max-w-2xl text-[var(--ink-soft)]">
              LabLink is built to the PromptWars LabLink brief: shared campus labs, dual personas, GenAI allocation for
              staff, and operational accountability.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {psMap.map((item) => (
                <li key={item.label} className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3">
                  <div className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">{item.label}</div>
                  <div className="mt-1 text-sm text-[var(--ink-soft)]">{item.detail}</div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-b border-[var(--line)] bg-white/50">
          <div className="shell grid gap-8 py-14 md:grid-cols-[1.1fr_0.9fr] md:items-center">
            <div>
              <h2 className="text-3xl font-semibold md:text-4xl">Built for every lab typology</h2>
              <p className="mt-3 max-w-prose text-[var(--ink-soft)]">
                Training gates, containment levels, and approval rules for shared facilities — plus GenAI recommendations
                for fair, feasible slots against deadlines.
              </p>
            </div>
            <ul className="grid grid-cols-2 gap-2 text-sm font-semibold sm:grid-cols-3">
              {[
                "Ideation",
                "Electronics",
                "Chemistry",
                "Physics",
                "Biotech",
                "Mechanical",
                "Computing",
                "Materials",
                "Robotics",
                "Optics",
                "Fabrication",
                "Cross-lab",
              ].map((lab) => (
                <li key={lab} className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-3 text-center">
                  {lab}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
