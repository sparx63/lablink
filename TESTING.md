# LabLink testing

## Commands

```bash
npm test                 # all suites (exit non-zero on first failure)
npm run lint             # Next.js ESLint
npm run build            # production TypeScript + Next build
```

## Suites

| File | Covers |
|---|---|
| `src/lib/validate.test.ts` | Zod schemas, sanitizeText, ValidationError |
| `src/lib/scope.test.ts` | Faculty lab scope, SUPER_ADMIN campus-wide, coordinator timetable rights |
| `src/lib/ai.test.ts` | Fair allocation ranking, lab lock, fine conflict surfacing |
| `src/lib/store.booking.test.ts` | Create booking, scoped approvals list, decide, timetable publish visibility, exam generate/save |

`store.booking.test.ts` uses an isolated temp `LABLINK_DATA_DIR` so it does not clobber your local `.data/` demo store.

## Manual demo checks

1. Student Explore → Use in Lab / Borrow → appears on that lab’s faculty Approvals  
2. Faculty Approve / Reject / Needs info / Handover → student Bookings + Notifications  
3. Generate list + Start test → student My Examinations (LIVE only)  
4. Coordinator publish → enrolled My Lab Timetable; other students only via Explore lab timetable  
