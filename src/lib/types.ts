export type Role = "STUDENT" | "FACULTY" | "ADMIN" | "SUPER_ADMIN" | "TIMETABLE_COORDINATOR";

export type LabCategory =
  | "IDEATION"
  | "ELECTRONICS"
  | "CHEMISTRY"
  | "PHYSICS"
  | "BIOTECH"
  | "MECHANICAL"
  | "COMPUTING"
  | "MATERIALS"
  | "ROBOTICS"
  | "OPTICS"
  | "FABRICATION"
  | "MULTIDISCIPLINARY";

export type SafetyLevel = "BSL0" | "BSL1" | "BSL2" | "CHEM_HAZARD" | "RADIATION" | "HIGH_VOLTAGE" | "LASER" | "CLEANROOM";

export type EquipmentStatus = "AVAILABLE" | "IN_USE" | "MAINTENANCE" | "RETIRED" | "QUARANTINED" | "BORROWED" | "RESERVED";

export type AssetUnitStatus = "AVAILABLE" | "IN_USE" | "BORROWED" | "RESERVED" | "MAINTENANCE" | "QUARANTINED" | "RETIRED";

export type UsageType = "IN_LAB" | "BORROW";

export type BorrowPurpose = "PERSONAL_PROJECT" | "COLLEGE_PROJECT" | "COMPETITION";

export type BookingStatus =
  | "DRAFT"
  | "PENDING"
  | "AI_REVIEW"
  | "NEEDS_INFO"
  | "APPROVED"
  | "REJECTED"
  | "READY_FOR_COLLECTION"
  | "ACTIVE"
  | "BORROWED"
  | "RETURN_INSPECTION"
  | "COMPLETED"
  | "CLOSED"
  | "CANCELLED"
  | "NO_SHOW"
  | "OVERDUE";

export type IncidentType = "LOST" | "BROKEN" | "DAMAGED" | "MISSING_PARTS" | "CONTAMINATED";

export type FineStatus = "PENDING" | "PARTIAL" | "PAID" | "WAIVED" | "DISPUTED";

export type TrainingStatus = "NONE" | "REQUESTED" | "IN_PROGRESS" | "CERTIFIED" | "EXPIRED";

export type TimetableEventType = "CLASS" | "SPECIAL" | "EXAM" | "MAINTENANCE" | "HOLIDAY";

export type CompetitionVerification = "PENDING" | "VERIFIED" | "UNABLE_TO_VERIFY" | "NOT_APPLICABLE";

export type VerificationEngine = "HEURISTIC" | "GEMINI";

export type AcademicStanding = "ACTIVE" | "BACKLOG" | "DEFERRED" | "TRANSFERRED" | "DISCONTINUED";

export type AuditEventType =
  | "IMPORT"
  | "TIMETABLE_EDIT"
  | "APPROVAL"
  | "REJECT"
  | "OVERRIDE"
  | "HANDOVER"
  | "RETURN"
  | "MARK_EDIT"
  | "PUBLICATION"
  | "POLICY_CHANGE"
  | "PROGRESSION"
  | "EXAM_EDIT"
  | "SAVED_RESOURCE";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  year?: number;
  programme?: string;
  programmeId?: string;
  semester?: number;
  section?: string;
  batch?: string;
  rollNumber?: string;
  /** Lab teachers / lab admins: only these labs. Ignored for SUPER_ADMIN & STUDENT. */
  managedLabIds?: string[];
  academicStanding?: AcademicStanding;
  backlogSemesters?: number[];
  avatarColor: string;
  certifications: string[];
  fineBalance: number;
  createdAt: string;
}

export interface Lab {
  id: string;
  name: string;
  code: string;
  category: LabCategory;
  building: string;
  floor: string;
  capacity: number;
  openHour: number;
  closeHour: number;
  safetyLevels: SafetyLevel[];
  requiredTrainings: string[];
  description: string;
  managerId: string;
  utilizationPct: number;
  imageHue: number;
}

export interface AssetUnit {
  id: string;
  serial: string;
  tag: string;
  status: AssetUnitStatus;
  condition: string;
  notes?: string;
}

export interface AccessoryItem {
  id: string;
  label: string;
  required: boolean;
}

export interface Equipment {
  id: string;
  labId: string;
  name: string;
  tag: string;
  category: string;
  manufacturer: string;
  model: string;
  status: EquipmentStatus;
  requiresApproval: boolean;
  requiresTrainingIds: string[];
  bookingSlotMinutes: number;
  maxConcurrent: number;
  quantity: number;
  borrowable: boolean;
  replacementCost: number;
  depositAmount: number;
  description: string;
  specs: Record<string, string>;
  tags: string[];
  conditionNotes: string;
  /** Individual asset units when quantity > 1 (or always for trackable fleets). */
  units?: AssetUnit[];
  /** Default accessory checklist for handover/return. */
  accessoryChecklist?: AccessoryItem[];
}

export interface ChecklistLine {
  accessoryId: string;
  label: string;
  present: boolean;
  notes?: string;
}

export interface Project {
  id: string;
  title: string;
  studentId: string;
  facultyMentorId?: string;
  department: string;
  deadline: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  neededCapabilities: string[];
  status: "DRAFT" | "ACTIVE" | "COMPLETED";
}

export interface CompetitionDetails {
  name: string;
  organiser: string;
  date: string;
  website?: string;
  selectionEvidenceNote?: string;
  projectDescription?: string;
  verificationStatus: CompetitionVerification;
  verificationNotes?: string;
  verificationEngine?: VerificationEngine;
  verificationConfidence?: number;
  verificationSources?: string[];
  verificationLevel?: string;
  aiPriorityReason?: string;
  participationProofRequested?: boolean;
  participationProofSubmitted?: boolean;
}

export interface Booking {
  id: string;
  equipmentId: string;
  labId: string;
  studentId: string;
  projectId?: string;
  usageType: UsageType;
  start: string;
  end: string;
  status: BookingStatus;
  purpose: string;
  notes?: string;
  borrowPurpose?: BorrowPurpose;
  expectedReturnAt?: string;
  competition?: CompetitionDetails;
  facultyApproverId?: string;
  approvalNote?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  handoverAt?: string;
  returnCondition?: "GOOD" | "FAIR" | "DAMAGED" | "LOST";
  conflictResolvedBy?: string;
  /** Assigned asset unit when equipment has multiple units. */
  assignedUnitId?: string;
  /** Number of units reserved (exams / multi-kit). */
  quantityReserved?: number;
  handoverChecklist?: ChecklistLine[];
  returnChecklist?: ChecklistLine[];
  handoverPhotoUrls?: string[];
  returnPhotoUrls?: string[];
  handoverConditionNotes?: string;
  returnConditionNotes?: string;
  createdAt: string;
}

export interface TimetableEvent {
  id: string;
  labId: string;
  dayOfWeek: number;
  startHour: number;
  endHour: number;
  title: string;
  subject: string;
  cohort: string;
  facultyId?: string;
  eventType: TimetableEventType;
  notes?: string;
  published?: boolean;
  /** YYYY-MM-DD for one-off sessions; omit for recurring day-of-week slots. */
  eventDate?: string;
  /**
   * Stable class membership key: `${labId}|${subject}|${cohort}`.
   * Used for My Lab Timetable visibility (enrolled students + assigned faculty).
   * General / campus sessions use cohort "All" and still appear on lab booking views.
   */
  classKey?: string;
}

export interface ClassEnrollment {
  id: string;
  studentId: string;
  labId: string;
  subject: string;
  cohort: string;
  facultyId: string;
  academicYear: string;
  semester: number;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  kind: string;
  createdAt: string;
  read: boolean;
  relatedBookingId?: string;
}

export interface Incident {
  id: string;
  bookingId: string;
  equipmentId: string;
  studentId: string;
  reportedById: string;
  type: IncidentType;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  createdAt: string;
  resolvedAt?: string;
}

export interface Fine {
  id: string;
  incidentId: string;
  studentId: string;
  equipmentId: string;
  amount: number;
  reason: string;
  status: FineStatus;
  setById: string;
  paidAmount: number;
  createdAt: string;
  dueDate: string;
}

export interface TrainingRecord {
  id: string;
  userId: string;
  trainingId: string;
  status: TrainingStatus;
  certifiedAt?: string;
  expiresAt?: string;
}

export interface TrainingCatalog {
  id: string;
  name: string;
  labCategories: LabCategory[];
  validityMonths: number;
  description: string;
}

export interface WaitlistEntry {
  id: string;
  equipmentId: string;
  studentId: string;
  projectId?: string;
  preferredStart: string;
  preferredEnd: string;
  createdAt: string;
}

export interface AiAllocationRequest {
  /** Staff-driven: allocate for this student (optional when suggesting inventory). */
  studentId?: string;
  projectId?: string;
  /** Required for staff desk — recommendations scoped to this lab. */
  labId: string;
  /** Selected equipment/component from the lab dropdown (primary need signal). */
  equipmentId: string;
  description?: string;
  deadline?: string;
  preferredLabCategories?: LabCategory[];
  durationHours?: number;
}

export interface AiAllocationSuggestion {
  equipmentId: string;
  labId: string;
  score: number;
  rationale: string;
  suggestedStart: string;
  suggestedEnd: string;
  fairnessNotes: string;
  conflicts: string[];
  alternatives: string[];
}

/** Maps academic year → semesters covered (e.g. "2025-26" → [5, 6]). */
export interface ProgrammeYearMap {
  academicYear: string;
  semesters: number[];
}

export interface ProgrammeStructure {
  id: string;
  name: string;
  department: string;
  totalSemesters: number;
  durationYears: number;
  yearSemesterMap: ProgrammeYearMap[];
  currentAcademicYear: string;
}

export interface PolicyConfig {
  priorityWeights: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
    COMPETITION_BONUS: number;
    PERSONAL_PROJECT_PENALTY: number;
  };
  maxBorrowDurationDays: number;
  evidenceRequirements: {
    competitionWebsiteRequired: boolean;
    selectionEvidenceRequired: boolean;
    projectLinkRequiredForCollege: boolean;
  };
  cancellationRulesSummary: string;
  requireReturnChecklistComplete: boolean;
  overdueGraceHours: number;
}

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  actorId: string;
  actorName: string;
  summary: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface ExperimentBankItem {
  id: string;
  labId: string;
  code: string;
  title: string;
  description: string;
  maxMarks: number;
  durationMinutes: number;
  equipmentIds: string[];
  active: boolean;
}

export type PracticalExamStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "LIVE"
  | "COMPLETED"
  | "PUBLISHED";

export interface PracticalExam {
  id: string;
  labId: string;
  title: string;
  subject: string;
  cohort: string;
  examDate: string;
  startHour: number;
  endHour: number;
  /** LIVE = teacher started the test; students only see experiment assignments while LIVE. */
  status: PracticalExamStatus;
  reservedEquipmentIds: string[];
  reservedUnitCount?: number;
  createdById: string;
  createdAt: string;
  startedAt?: string;
  publishedAt?: string;
}

export interface ExamAllocation {
  id: string;
  examId: string;
  studentId: string;
  experimentId: string;
  groupLabel?: string;
  seat?: string;
}

/** Grouped view of allocations (one experiment per individual or group). */
export interface ExamAllocationGroup {
  studentIds: string[];
  experimentId: string;
  groupLabel?: string;
}

export type ExamGenerateMode = "INDIVIDUAL" | "GROUP";

export interface ExamGenerateRequest {
  examId?: string;
  labId?: string;
  experimentIds: string[];
  mode: ExamGenerateMode;
  groupSize?: number;
  studentIds?: string[];
  /** When true, replace exam allocations in the store. Default false (preview). */
  save?: boolean;
}

export interface MarkRecord {
  id: string;
  examId: string;
  studentId: string;
  experimentId: string;
  marksObtained: number;
  maxMarks: number;
  remarks?: string;
  enteredById: string;
  updatedAt: string;
  published: boolean;
}

export interface SavedResource {
  id: string;
  studentId: string;
  equipmentId?: string;
  labId?: string;
  createdAt: string;
}

export interface StudentImportRow {
  studentId: string;
  name: string;
  email: string;
  department: string;
  programme: string;
  batch: string;
  semester: number;
  section: string;
  labEnrolments: string;
}

export interface AppState {
  users: User[];
  labs: Lab[];
  equipment: Equipment[];
  projects: Project[];
  bookings: Booking[];
  incidents: Incident[];
  fines: Fine[];
  trainings: TrainingCatalog[];
  trainingRecords: TrainingRecord[];
  waitlist: WaitlistEntry[];
  timetable: TimetableEvent[];
  enrollments: ClassEnrollment[];
  notifications: AppNotification[];
  programmes: ProgrammeStructure[];
  policies: PolicyConfig;
  auditLog: AuditEvent[];
  experimentBank: ExperimentBankItem[];
  practicalExams: PracticalExam[];
  examAllocations: ExamAllocation[];
  markRecords: MarkRecord[];
  savedResources: SavedResource[];
  sampleCsv: string;
  sessionUserId: string | null;
}
