// Viger Stable - data model (Drizzle ORM)
// Local development uses a SQLite file through libSQL. In production you can point
// DATABASE_URL at a hosted libSQL/Turso database, or port this schema to Postgres.
// Columns commented "enum:" hold one of the listed values.

import { relations, sql } from "drizzle-orm";
import { integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);
const ts = (name: string) => integer(name, { mode: "timestamp" });
const bool = (name: string) => integer(name, { mode: "boolean" });

// ─────────────────────────── Accounts ───────────────────────────

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("STABLE"), // enum: STABLE | RIDER | PROFESSIONAL | FAN
  bio: text("bio"),
  city: text("city"),
  country: text("country").default("Egypt"),
  phone: text("phone"),
  // Professional profile
  trade: text("trade"), // enum: VET | FARRIER | COACH | GROOM | TRANSPORTER | BODYWORKER | OTHER
  credentials: text("credentials"),
  rates: text("rates"),
  serviceArea: text("service_area"),
  createdAt: createdAt(),
});

export const follows = sqliteTable(
  "follows",
  {
    followerId: text("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    followingId: text("following_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followingId] })],
);

// ─────────────────────────── Horses ───────────────────────────

export const horses = sqliteTable("horses", {
  id: id(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  breed: text("breed"),
  sex: text("sex"), // enum: MARE | STALLION | GELDING
  color: text("color"),
  birthYear: integer("birth_year"),
  heightCm: integer("height_cm"),
  weightKg: integer("weight_kg"),
  discipline: text("discipline"),
  level: text("level"),
  temperament: text("temperament"),
  feiId: text("fei_id"),
  microchip: text("microchip"),
  sire: text("sire"),
  dam: text("dam"),
  damSire: text("dam_sire"),
  description: text("description"),
  photoUrl: text("photo_url"),
  // Marketplace
  listingType: text("listing_type").notNull().default("NONE"), // enum: NONE | SALE | LEASE
  price: real("price"), // EGP
  showPrice: bool("show_price").notNull().default(false),
  budgetStars: integer("budget_stars"), // 1-5 bracket shown when the price is hidden
  isPublic: bool("is_public").notNull().default(true),
  aiValuationLow: real("ai_valuation_low"),
  aiValuationHigh: real("ai_valuation_high"),
  // Yard
  stallId: text("stall_id").references(() => stalls.id, { onDelete: "set null" }),
  clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const savedHorses = sqliteTable(
  "saved_horses",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    horseId: text("horse_id").notNull().references(() => horses.id, { onDelete: "cascade" }),
    folder: text("folder").notNull().default("Shortlist"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.horseId] })],
);

export const trialSlots = sqliteTable("trial_slots", {
  id: id(),
  horseId: text("horse_id").notNull().references(() => horses.id, { onDelete: "cascade" }),
  start: ts("start").notNull(),
  end: ts("end").notNull(),
});

export const trialRequests = sqliteTable("trial_requests", {
  id: id(),
  horseId: text("horse_id").notNull().references(() => horses.id, { onDelete: "cascade" }),
  requesterId: text("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: ts("date").notNull(),
  message: text("message"),
  status: text("status").notNull().default("PENDING"), // enum: PENDING | APPROVED | DECLINED
  createdAt: createdAt(),
});

// ─────────────────────────── Yard management ───────────────────────────

export const staff = sqliteTable("staff", {
  id: id(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role").notNull(),
  phone: text("phone"),
  skills: text("skills"),
  vacationDays: integer("vacation_days").notNull().default(21),
  createdAt: createdAt(),
});

export const tasks = sqliteTable("tasks", {
  id: id(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  horseId: text("horse_id").references(() => horses.id, { onDelete: "set null" }),
  staffId: text("staff_id").references(() => staff.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  category: text("category").notNull().default("CARE"), // enum: CARE | HEALTH | TRAINING | TRIAL | OTHER
  priority: integer("priority").notNull().default(2), // 1 high, 2 normal, 3 low
  dueAt: ts("due_at").notNull(),
  done: bool("done").notNull().default(false),
  doneAt: ts("done_at"),
  createdAt: createdAt(),
});

export const shifts = sqliteTable("shifts", {
  id: id(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  staffId: text("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  start: ts("start").notNull(),
  end: ts("end").notNull(),
  note: text("note"),
});

export const timeEntries = sqliteTable("time_entries", {
  id: id(),
  staffId: text("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  clockIn: ts("clock_in").notNull(),
  clockOut: ts("clock_out"),
});

export const healthRecords = sqliteTable("health_records", {
  id: id(),
  horseId: text("horse_id").notNull().references(() => horses.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // enum: VACCINATION | WORMING | DENTAL | FARRIER | TREATMENT | BLOOD_TEST | VET_VISIT | INJURY | OTHER
  date: ts("date").notNull(),
  nextDue: ts("next_due"),
  provider: text("provider"),
  cost: real("cost"),
  notes: text("notes"),
  attachmentUrl: text("attachment_url"),
  source: text("source").notNull().default("MANUAL"), // enum: MANUAL | SMART_SCAN | PRO_VISIT | ASSISTANT
  createdAt: createdAt(),
});

export const feedPlans = sqliteTable("feed_plans", {
  id: id(),
  horseId: text("horse_id").notNull().references(() => horses.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Standard"),
  morning: text("morning"),
  midday: text("midday"),
  evening: text("evening"),
  supplements: text("supplements"),
  notes: text("notes"),
  aiGenerated: bool("ai_generated").notNull().default(false),
  active: bool("active").notNull().default(true),
  createdAt: createdAt(),
});

export const stalls = sqliteTable("stalls", {
  id: id(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  building: text("building").notNull().default("Main barn"),
  kind: text("kind").notNull().default("STALL"), // enum: STALL | PADDOCK
  capacity: integer("capacity").notNull().default(1),
});

export const horseConflicts = sqliteTable("horse_conflicts", {
  id: id(),
  horseAId: text("horse_a_id").notNull().references(() => horses.id, { onDelete: "cascade" }),
  horseBId: text("horse_b_id").notNull().references(() => horses.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
});

export const breedingRecords = sqliteTable("breeding_records", {
  id: id(),
  mareId: text("mare_id").notNull().references(() => horses.id, { onDelete: "cascade" }),
  stallionName: text("stallion_name").notNull(),
  status: text("status").notNull().default("PLANNED"), // enum: PLANNED | COVERED | IN_FOAL | FOALED | EMPTY
  coverDate: ts("cover_date"),
  scanDate: ts("scan_date"),
  expectedFoaling: ts("expected_foaling"),
  foaledAt: ts("foaled_at"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const gaitAnalyses = sqliteTable("gait_analyses", {
  id: id(),
  horseId: text("horse_id").notNull().references(() => horses.id, { onDelete: "cascade" }),
  imageUrls: text("image_urls").notNull(), // JSON array
  result: text("result").notNull(),
  createdAt: createdAt(),
});

// ─────────────────────────── Finance ───────────────────────────

export const clients = sqliteTable("clients", {
  id: id(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
});

export const transactions = sqliteTable("transactions", {
  id: id(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  horseId: text("horse_id").references(() => horses.id, { onDelete: "set null" }),
  kind: text("kind").notNull(), // enum: INCOME | EXPENSE
  category: text("category").notNull(),
  amount: real("amount").notNull(), // EGP
  date: ts("date").notNull(),
  description: text("description"),
  createdAt: createdAt(),
});

export const invoices = sqliteTable("invoices", {
  id: id(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
  number: text("number").notNull(),
  clientName: text("client_name").notNull(),
  items: text("items").notNull(), // JSON array of { description, quantity, unitPrice }
  total: real("total").notNull(), // EGP
  status: text("status").notNull().default("DRAFT"), // enum: DRAFT | SENT | PAID | OVERDUE
  issuedAt: ts("issued_at").notNull(),
  dueAt: ts("due_at").notNull(),
  notes: text("notes"),
});

// ─────────────────────────── Community ───────────────────────────

export const posts = sqliteTable("posts", {
  id: id(),
  authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  horseId: text("horse_id").references(() => horses.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  tag: text("tag").notNull().default("UPDATE"), // enum: COMPETITION | HOME | SALE | UPDATE
  createdAt: createdAt(),
});

export const likes = sqliteTable(
  "likes",
  {
    postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })],
);

export const comments = sqliteTable("comments", {
  id: id(),
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: createdAt(),
});

export const messages = sqliteTable("messages", {
  id: id(),
  senderId: text("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  receiverId: text("receiver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  horseId: text("horse_id").references(() => horses.id, { onDelete: "set null" }), // horse card
  content: text("content").notNull(),
  readAt: ts("read_at"),
  createdAt: createdAt(),
});

// ─────────────────────────── Professionals ───────────────────────────

export const bookings = sqliteTable("bookings", {
  id: id(),
  proId: text("pro_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  horseId: text("horse_id").references(() => horses.id, { onDelete: "set null" }),
  service: text("service").notNull(),
  date: ts("date").notNull(),
  status: text("status").notNull().default("PENDING"), // enum: PENDING | CONFIRMED | DECLINED | COMPLETED
  notes: text("notes"),
  findings: text("findings"),
  fee: real("fee"),
  createdAt: createdAt(),
});

// ─────────────────────────── Jobs ───────────────────────────

export const jobs = sqliteTable("jobs", {
  id: id(),
  posterId: text("poster_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  role: text("role").notNull(),
  location: text("location"),
  salary: text("salary"),
  type: text("type").notNull().default("FULL_TIME"), // enum: FULL_TIME | PART_TIME | SEASONAL | FREELANCE
  description: text("description").notNull(),
  open: bool("open").notNull().default(true),
  createdAt: createdAt(),
});

export const applications = sqliteTable(
  "applications",
  {
    id: id(),
    jobId: text("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    applicantId: text("applicant_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    status: text("status").notNull().default("APPLIED"), // enum: APPLIED | SHORTLISTED | ACCEPTED | DECLINED
    aiScore: integer("ai_score"),
    aiReason: text("ai_reason"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("applications_job_applicant").on(t.jobId, t.applicantId)],
);

// ─────────────────────────── AI ───────────────────────────

export const assistantMessages = sqliteTable("assistant_messages", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // enum: user | assistant
  content: text("content").notNull(),
  createdAt: createdAt(),
});

// ─────────────────────────── Uploaded files ───────────────────────────
// Photos and documents are stored in the database (base64) so the app works on
// serverless hosting with no separate file storage. Served at /files/<id>.
export const files = sqliteTable("files", {
  id: id(),
  mimeType: text("mime_type").notNull(),
  data: text("data").notNull(), // base64
  size: integer("size").notNull(),
  createdAt: createdAt(),
});

// ─────────────────────────── Public booking (customers) ───────────────────────────

/** The stable's public booking page settings. One row per stable owner. */
export const bookingSettings = sqliteTable("booking_settings", {
  id: id(),
  ownerId: text("owner_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(), // public address: /s/<slug>
  displayName: text("display_name").notNull(),
  tagline: text("tagline"),
  about: text("about"),
  address: text("address"),
  mapUrl: text("map_url"),
  whatsapp: text("whatsapp"), // international format, e.g. +201001234567
  email: text("email"),
  timeSlots: text("time_slots").notNull().default("07:00,08:30,10:00,15:30,17:00"), // comma separated, Egypt time
  closedDays: text("closed_days").default(""), // comma separated weekday numbers 0=Sun..6=Sat
  usdRate: real("usd_rate").notNull().default(50), // EGP per 1 USD (used when a service has no USD price)
  payOnArrival: bool("pay_on_arrival").notNull().default(true),
  payByTransfer: bool("pay_by_transfer").notNull().default(true),
  transferDetails: text("transfer_details"), // InstaPay / bank details shown after booking
  isPublished: bool("is_published").notNull().default(true),
  createdAt: createdAt(),
});

/** Bookable services: rides, lessons, camel rides, livery. */
export const services = sqliteTable("services", {
  id: id(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().default("RIDE"), // enum: RIDE | LESSON | CAMEL | LIVERY
  description: text("description"),
  durationMin: integer("duration_min"), // null for livery
  priceEgp: real("price_egp").notNull(),
  priceUsd: real("price_usd"),
  priceUnit: text("price_unit").notNull().default("PERSON"), // enum: PERSON | GROUP | MONTH
  maxGuests: integer("max_guests").notNull().default(6), // per time slot
  minAge: integer("min_age"),
  imageUrl: text("image_url"),
  active: bool("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

/** A booking request from a member of the public (no account needed). */
export const customerBookings = sqliteTable("customer_bookings", {
  id: id(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: text("service_id").references(() => services.id, { onDelete: "set null" }),
  reference: text("reference").notNull().unique(), // shown to the customer, e.g. VS-7KQ2MD
  serviceName: text("service_name").notNull(), // kept even if the service is later deleted
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  country: text("country"),
  guests: integer("guests").notNull().default(1),
  date: ts("date").notNull(), // start date/time (Egypt time); livery = start date
  experience: text("experience"), // enum: NONE | SOME | CONFIDENT
  notes: text("notes"),
  paymentMethod: text("payment_method").notNull().default("ARRIVAL"), // enum: ARRIVAL | TRANSFER
  status: text("status").notNull().default("REQUESTED"), // enum: REQUESTED | CONFIRMED | PAID | COMPLETED | CANCELLED
  totalEgp: real("total_egp").notNull(),
  totalUsd: real("total_usd"),
  createdAt: createdAt(),
});

// ─────────────────────────── Team, riders & accounts ───────────────────────────

/**
 * A person's role at a stable. Staff (manager, coach, groom, staff rider) and riders
 * (students, customers, horse owners) all have a membership. `userId` is filled once
 * they accept an invite or sign up. Links connect the membership to existing records.
 */
export const memberships = sqliteTable("memberships", {
  id: id(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }), // the stable
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  role: text("role").notNull(), // enum: MANAGER | COACH | GROOM | STAFF_RIDER | STUDENT | CUSTOMER | HORSE_OWNER
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  status: text("status").notNull().default("INVITED"), // enum: INVITED | PENDING | ACTIVE | DISABLED
  inviteToken: text("invite_token").unique(),
  inviteExpires: ts("invite_expires"),
  staffId: text("staff_id").references(() => staff.id, { onDelete: "set null" }), // staff roles
  clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }), // horse owners
  studentId: text("student_id").references(() => students.id, { onDelete: "set null" }), // students
  createdAt: createdAt(),
});

/** Riding school students (with or without an account). */
export const students = sqliteTable("students", {
  id: id(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  guardianName: text("guardian_name"), // for children
  birthYear: integer("birth_year"),
  level: text("level").notNull().default("BEGINNER"), // enum: BEGINNER | NOVICE | INTERMEDIATE | ADVANCED
  goals: text("goals"),
  coachStaffId: text("coach_staff_id").references(() => staff.id, { onDelete: "set null" }),
  notes: text("notes"),
  active: bool("active").notNull().default(true),
  createdAt: createdAt(),
});

export const lessonPackages = sqliteTable("lesson_packages", {
  id: id(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "10 beginner lessons"
  lessonsTotal: integer("lessons_total").notNull(),
  priceEgp: real("price_egp").notNull(),
  paid: bool("paid").notNull().default(false),
  purchasedAt: ts("purchased_at").notNull(),
  expiresAt: ts("expires_at"),
});

export const lessons = sqliteTable("lessons", {
  id: id(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  packageId: text("package_id").references(() => lessonPackages.id, { onDelete: "set null" }),
  coachStaffId: text("coach_staff_id").references(() => staff.id, { onDelete: "set null" }),
  horseId: text("horse_id").references(() => horses.id, { onDelete: "set null" }),
  date: ts("date").notNull(),
  durationMin: integer("duration_min").notNull().default(45),
  status: text("status").notNull().default("SCHEDULED"), // enum: SCHEDULED | ATTENDED | NO_SHOW | CANCELLED
  focus: text("focus"), // what the lesson works on
  coachNotes: text("coach_notes"),
  rating: integer("rating"), // 1-5 progress in this lesson
  createdAt: createdAt(),
});

/** Reviews left by customers after a completed booking. */
export const reviews = sqliteTable("reviews", {
  id: id(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bookingId: text("booking_id").references(() => customerBookings.id, { onDelete: "set null" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull(),
  country: text("country"),
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  published: bool("published").notNull().default(true),
  createdAt: createdAt(),
});

// ─────────────────────────── Relations ───────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  horses: many(horses),
  posts: many(posts),
  jobs: many(jobs),
}));

export const horsesRelations = relations(horses, ({ one, many }) => ({
  owner: one(users, { fields: [horses.ownerId], references: [users.id] }),
  stall: one(stalls, { fields: [horses.stallId], references: [stalls.id] }),
  client: one(clients, { fields: [horses.clientId], references: [clients.id] }),
  healthRecords: many(healthRecords),
  feedPlans: many(feedPlans),
  tasks: many(tasks),
  trialSlots: many(trialSlots),
  trialRequests: many(trialRequests),
  breedingRecords: many(breedingRecords),
  gaitAnalyses: many(gaitAnalyses),
  transactions: many(transactions),
}));

export const trialSlotsRelations = relations(trialSlots, ({ one }) => ({
  horse: one(horses, { fields: [trialSlots.horseId], references: [horses.id] }),
}));

export const trialRequestsRelations = relations(trialRequests, ({ one }) => ({
  horse: one(horses, { fields: [trialRequests.horseId], references: [horses.id] }),
  requester: one(users, { fields: [trialRequests.requesterId], references: [users.id] }),
}));

export const savedHorsesRelations = relations(savedHorses, ({ one }) => ({
  horse: one(horses, { fields: [savedHorses.horseId], references: [horses.id] }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  horse: one(horses, { fields: [tasks.horseId], references: [horses.id] }),
  staff: one(staff, { fields: [tasks.staffId], references: [staff.id] }),
}));

export const staffRelations = relations(staff, ({ many }) => ({
  shifts: many(shifts),
  timeEntries: many(timeEntries),
  tasks: many(tasks),
}));

export const shiftsRelations = relations(shifts, ({ one }) => ({
  staff: one(staff, { fields: [shifts.staffId], references: [staff.id] }),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  staff: one(staff, { fields: [timeEntries.staffId], references: [staff.id] }),
}));

export const healthRecordsRelations = relations(healthRecords, ({ one }) => ({
  horse: one(horses, { fields: [healthRecords.horseId], references: [horses.id] }),
}));

export const feedPlansRelations = relations(feedPlans, ({ one }) => ({
  horse: one(horses, { fields: [feedPlans.horseId], references: [horses.id] }),
}));

export const stallsRelations = relations(stalls, ({ many }) => ({
  horses: many(horses),
}));

export const horseConflictsRelations = relations(horseConflicts, ({ one }) => ({
  horseA: one(horses, { fields: [horseConflicts.horseAId], references: [horses.id], relationName: "a" }),
  horseB: one(horses, { fields: [horseConflicts.horseBId], references: [horses.id], relationName: "b" }),
}));

export const breedingRecordsRelations = relations(breedingRecords, ({ one }) => ({
  mare: one(horses, { fields: [breedingRecords.mareId], references: [horses.id] }),
}));

export const gaitAnalysesRelations = relations(gaitAnalyses, ({ one }) => ({
  horse: one(horses, { fields: [gaitAnalyses.horseId], references: [horses.id] }),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  horses: many(horses),
  invoices: many(invoices),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  horse: one(horses, { fields: [transactions.horseId], references: [horses.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  horse: one(horses, { fields: [posts.horseId], references: [horses.id] }),
  likes: many(likes),
  comments: many(comments),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  post: one(posts, { fields: [likes.postId], references: [posts.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, { fields: [comments.postId], references: [posts.id] }),
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, { fields: [messages.senderId], references: [users.id], relationName: "sender" }),
  receiver: one(users, { fields: [messages.receiverId], references: [users.id], relationName: "receiver" }),
  horse: one(horses, { fields: [messages.horseId], references: [horses.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  pro: one(users, { fields: [bookings.proId], references: [users.id], relationName: "pro" }),
  client: one(users, { fields: [bookings.clientId], references: [users.id], relationName: "client" }),
  horse: one(horses, { fields: [bookings.horseId], references: [horses.id] }),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  poster: one(users, { fields: [jobs.posterId], references: [users.id] }),
  applications: many(applications),
}));

export const applicationsRelations = relations(applications, ({ one }) => ({
  job: one(jobs, { fields: [applications.jobId], references: [jobs.id] }),
  applicant: one(users, { fields: [applications.applicantId], references: [users.id] }),
}));

export const servicesRelations = relations(services, ({ many }) => ({
  bookings: many(customerBookings),
}));

export const customerBookingsRelations = relations(customerBookings, ({ one }) => ({
  service: one(services, { fields: [customerBookings.serviceId], references: [services.id] }),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  staff: one(staff, { fields: [memberships.staffId], references: [staff.id] }),
  client: one(clients, { fields: [memberships.clientId], references: [clients.id] }),
  student: one(students, { fields: [memberships.studentId], references: [students.id] }),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  coach: one(staff, { fields: [students.coachStaffId], references: [staff.id] }),
  packages: many(lessonPackages),
  lessons: many(lessons),
}));

export const lessonPackagesRelations = relations(lessonPackages, ({ one, many }) => ({
  student: one(students, { fields: [lessonPackages.studentId], references: [students.id] }),
  lessons: many(lessons),
}));

export const lessonsRelations = relations(lessons, ({ one }) => ({
  student: one(students, { fields: [lessons.studentId], references: [students.id] }),
  package: one(lessonPackages, { fields: [lessons.packageId], references: [lessonPackages.id] }),
  coach: one(staff, { fields: [lessons.coachStaffId], references: [staff.id] }),
  horse: one(horses, { fields: [lessons.horseId], references: [horses.id] }),
}));
