"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import type { User } from "@/lib/types";
import { cn, ROLE_LABEL } from "@/lib/format";

type NavLink = { href: string; label: string };
type NavGroup = { id: string; label: string; items: NavLink[] };

const STUDENT_PRIMARY: NavLink[] = [
  { href: "/student", label: "Home" },
  { href: "/student/discover", label: "Explore" },
  { href: "/student/notifications", label: "Notifications" },
];

const STUDENT_GROUPS: NavGroup[] = [
  {
    id: "workspace",
    label: "My workspace",
    items: [
      { href: "/student/saved", label: "Saved Resources" },
      { href: "/student/bookings", label: "My Bookings" },
      { href: "/student/requests", label: "My Requests" },
    ],
  },
  {
    id: "academics",
    label: "Academics",
    items: [
      { href: "/student/exams", label: "My Examinations" },
      { href: "/student/results", label: "My Results" },
    ],
  },
];

function staffLinks(user: User): NavLink[] {
  if (user.role === "TIMETABLE_COORDINATOR") {
    return [
      { href: "/admin", label: "Ops Hub" },
      { href: "/admin/timetable", label: "Timetable desk" },
      { href: "/admin/utilization", label: "Utilization" },
    ];
  }
  return [
    { href: "/admin", label: "Ops Hub" },
    { href: "/admin/approvals", label: "Approvals" },
    { href: "/admin/ai", label: "Equipment AI" },
    { href: "/admin/exams", label: "Exams" },
    { href: "/admin/incidents", label: "Incidents & Fines" },
    { href: "/admin/conflicts", label: "Conflicts" },
    { href: "/admin/timetable", label: "Lab Timetable" },
    { href: "/admin/overdue", label: "Overdue" },
    { href: "/admin/utilization", label: "Utilization" },
    ...(user.role === "SUPER_ADMIN"
      ? [
          { href: "/admin/import", label: "Student import" },
          { href: "/admin/policies", label: "Policies" },
          { href: "/admin/audit", label: "Audit log" },
        ]
      : []),
  ];
}

function linkActive(pathname: string, href: string) {
  if (href === "/student" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupForPath(pathname: string) {
  return STUDENT_GROUPS.find((g) => g.items.some((item) => linkActive(pathname, item.href))) ?? null;
}

/** Keep menu open through the click so Next.js Link can navigate. */
function keepMenuForClick(e: ReactMouseEvent) {
  e.preventDefault();
}

function NavDropdown({
  label,
  items,
  open,
  onToggle,
  onClose,
  pathname,
}: {
  label: string;
  items: NavLink[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  pathname: string;
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const childActive = items.some((item) => linkActive(pathname, item.href));

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    // Use click (not mousedown) so Link navigation isn't raced by an early unmount.
    document.addEventListener("click", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-[var(--ink-soft)] hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
          (open || childActive) && "bg-white text-[var(--ink)] shadow-sm"
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${label} menu`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!open) onToggle();
            queueMicrotask(() => {
              const first = rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
              first?.focus();
            });
          }
        }}
      >
        {label}
        <span aria-hidden className="text-[0.65rem] opacity-70">
          ▾
        </span>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="panel absolute left-0 top-[calc(100%+0.4rem)] z-[60] min-w-[12.5rem] rounded-2xl p-1.5 shadow-lg"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              tabIndex={0}
              onMouseDown={keepMenuForClick}
              onClick={onClose}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  onClose();
                }
              }}
              className={cn(
                "block rounded-xl px-3 py-2 text-sm font-medium text-[var(--ink-soft)] hover:bg-white/80 hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
                linkActive(pathname, item.href) && "bg-white text-[var(--ink)] shadow-sm"
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const initials = (user.name || "?")
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("") || "?";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative z-[60]" ref={rootRef}>
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white ring-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        style={{ background: user.avatarColor }}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {initials}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="panel absolute right-0 top-[calc(100%+0.45rem)] z-[60] w-56 rounded-2xl p-2 shadow-lg"
        >
          <div className="border-b border-[var(--line)] px-3 pb-2 pt-1">
            <div className="text-sm font-semibold">{user.name}</div>
            <div className="text-xs text-[var(--ink-soft)]">
              {ROLE_LABEL[user.role] || user.role} · {user.department}
            </div>
          </div>
          <Link
            href={user.role === "STUDENT" ? "/student/profile" : "/admin"}
            role="menuitem"
            onMouseDown={keepMenuForClick}
            onClick={() => setOpen(false)}
            className="mt-1 block rounded-xl px-3 py-2 text-sm font-medium text-[var(--ink-soft)] hover:bg-white/80 hover:text-[var(--ink)]"
          >
            {user.role === "STUDENT" ? "Profile & Settings" : "Ops Hub"}
          </Link>
          <Link
            href="/login"
            role="menuitem"
            onMouseDown={keepMenuForClick}
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm font-medium text-[var(--ink-soft)] hover:bg-white/80 hover:text-[var(--ink)]"
          >
            Switch account
          </Link>
        </div>
      )}
    </div>
  );
}

function FlatLinks({ links, pathname, className }: { links: NavLink[]; pathname: string; className?: string }) {
  return (
    <>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            className ??
              "rounded-full px-3 py-1.5 text-sm font-medium text-[var(--ink-soft)] hover:bg-white/70",
            linkActive(pathname, l.href) &&
              (className
                ? "bg-[var(--ink)] text-white"
                : "bg-white text-[var(--ink)] shadow-sm")
          )}
        >
          {l.label}
        </Link>
      ))}
    </>
  );
}

function SecondaryBar({ items, pathname }: { items: NavLink[]; pathname: string }) {
  return (
    <div className="border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--panel)_92%,transparent)]">
      <div className="shell flex flex-wrap gap-2 py-2" role="navigation" aria-label="Section">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--ink-soft)] hover:bg-white/80 hover:text-[var(--ink)]",
              linkActive(pathname, item.href) && "border-transparent bg-[var(--ink)] text-white"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function MobileStudentNav({
  pathname,
  openGroup,
  setOpenGroup,
}: {
  pathname: string;
  openGroup: string | null;
  setOpenGroup: (id: string | null) => void;
}) {
  const routeGroup = groupForPath(pathname);
  const visibleGroupId = openGroup ?? routeGroup?.id ?? null;
  const visibleGroup = STUDENT_GROUPS.find((g) => g.id === visibleGroupId) ?? null;

  return (
    <div className="lg:hidden">
      <div className="shell flex gap-2 overflow-x-auto pb-3">
        <FlatLinks
          links={STUDENT_PRIMARY}
          pathname={pathname}
          className="whitespace-nowrap rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold"
        />
        {STUDENT_GROUPS.map((group) => {
          const childActive = group.items.some((item) => linkActive(pathname, item.href));
          const open = visibleGroupId === group.id;
          return (
            <button
              key={group.id}
              type="button"
              className={cn(
                "whitespace-nowrap rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold",
                (open || childActive) && "bg-[var(--ink)] text-white"
              )}
              aria-haspopup="true"
              aria-expanded={open}
              onClick={() => setOpenGroup(open && openGroup === group.id ? null : group.id)}
            >
              {group.label} ▾
            </button>
          );
        })}
      </div>
      {visibleGroup && (
        <div className="border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--panel)_92%,transparent)]">
          <div className="shell flex flex-wrap gap-2 py-2">
            {visibleGroup.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onMouseDown={keepMenuForClick}
                onClick={() => setOpenGroup(null)}
                className={cn(
                  "rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--ink-soft)] hover:bg-white/80",
                  linkActive(pathname, item.href) && "border-transparent bg-[var(--ink)] text-white"
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Nav({ user }: { user: User | null }) {
  const pathname = usePathname();
  const isStudent = user?.role === "STUDENT";
  const flatLinks = user && !isStudent ? staffLinks(user) : [];
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const activeGroup = isStudent ? groupForPath(pathname) : null;

  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  let desktopNav: ReactNode = null;
  if (isStudent) {
    desktopNav = (
      <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
        <FlatLinks links={STUDENT_PRIMARY} pathname={pathname} />
        {STUDENT_GROUPS.map((group) => (
          <NavDropdown
            key={group.id}
            label={group.label}
            items={group.items}
            open={openMenu === group.id}
            onToggle={() => setOpenMenu((cur) => (cur === group.id ? null : group.id))}
            onClose={() => setOpenMenu(null)}
            pathname={pathname}
          />
        ))}
      </nav>
    );
  } else if (flatLinks.length > 0) {
    desktopNav = (
      <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
        <FlatLinks links={flatLinks} pathname={pathname} />
      </nav>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--paper)_88%,transparent)] backdrop-blur-md">
      <div className="shell relative z-[50] flex items-center justify-between gap-4 py-3">
        <Link href="/" className="brand text-xl font-semibold tracking-tight">
          Lab<span className="text-[var(--accent)]">Link</span>
        </Link>
        {desktopNav}
        <div className="flex items-center gap-3">
          {user ? (
            <ProfileMenu user={user} />
          ) : (
            <Link href="/login" className="btn btn-primary">
              Enter campus
            </Link>
          )}
        </div>
      </div>
      {isStudent && (
        <MobileStudentNav pathname={pathname} openGroup={openMenu} setOpenGroup={setOpenMenu} />
      )}
      {isStudent && activeGroup && (
        <div className="hidden lg:block">
          <SecondaryBar items={activeGroup.items} pathname={pathname} />
        </div>
      )}
      {!isStudent && flatLinks.length > 0 && (
        <div className="shell flex gap-2 overflow-x-auto pb-3 lg:hidden">
          <FlatLinks
            links={flatLinks}
            pathname={pathname}
            className="whitespace-nowrap rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold"
          />
        </div>
      )}
    </header>
  );
}
