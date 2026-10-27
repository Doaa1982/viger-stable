/* Demo data for Viger Stable. Run with: npm run db:seed  (wipes existing data) */
import bcrypt from "bcryptjs";
import { db, schema as s } from "./index";

const day = 86_400_000;
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const at = (offsetDays: number, hour = 9, min = 0) => new Date(today.getTime() + offsetDays * day + hour * 3_600_000 + min * 60_000);

async function wipe() {
  const order = [
    s.assistantMessages, s.applications, s.jobs, s.bookings, s.messages, s.comments, s.likes, s.posts,
    s.invoices, s.transactions, s.gaitAnalyses, s.breedingRecords, s.horseConflicts, s.feedPlans,
    s.healthRecords, s.timeEntries, s.shifts, s.tasks, s.trialRequests, s.trialSlots, s.savedHorses,
    s.horses, s.clients, s.stalls, s.staff, s.follows, s.users,
  ];
  for (const t of order) await db.delete(t);
}

async function main() {
  await wipe();
  const pw = await bcrypt.hash("password123", 10);

  // ── Users ──
  const [stable, rider, vet, farrier, fan, coach] = await db
    .insert(s.users)
    .values([
      { email: "demo@vigerstable.com", passwordHash: pw, name: "Viger Stable", role: "STABLE", city: "Giza", bio: "Show jumping and Arabian horses near the Pyramids. Livery, training and sales." },
      { email: "rider@demo.com", passwordHash: pw, name: "Nour Hassan", role: "RIDER", city: "Cairo", bio: "Amateur show jumper competing at 1.20m." },
      { email: "vet@demo.com", passwordHash: pw, name: "Dr. Karim Adel", role: "PROFESSIONAL", trade: "VET", city: "Giza", credentials: "DVM Cairo University, 12 years equine practice", rates: "Visit 800 EGP, vaccination 650 EGP", serviceArea: "Giza, Cairo, 6th of October", bio: "Equine vet - sport horses and Arabians." },
      { email: "farrier@demo.com", passwordHash: pw, name: "Ahmed Mostafa", role: "PROFESSIONAL", trade: "FARRIER", city: "Cairo", credentials: "Certified farrier, 15 years", rates: "Full set 1,200 EGP, trim 400 EGP", serviceArea: "Greater Cairo", bio: "Corrective and sport shoeing." },
      { email: "fan@demo.com", passwordHash: pw, name: "Laila Samir", role: "FAN", city: "Alexandria", bio: "Love show jumping!" },
      { email: "coach@demo.com", passwordHash: pw, name: "Omar Fathy", role: "PROFESSIONAL", trade: "COACH", city: "Cairo", credentials: "National show jumping coach", rates: "Private lesson 900 EGP", serviceArea: "Cairo, Giza", bio: "Coaching riders from first jumps to 1.40m." },
    ])
    .returning();

  await db.insert(s.follows).values([
    { followerId: rider.id, followingId: stable.id },
    { followerId: fan.id, followingId: stable.id },
    { followerId: fan.id, followingId: rider.id },
  ]);

  // ── Stalls ──
  const stallRows = await db
    .insert(s.stalls)
    .values([
      ...Array.from({ length: 8 }, (_, i) => ({ ownerId: stable.id, name: `Box ${i + 1}`, building: i < 4 ? "Main barn" : "New barn" })),
      { ownerId: stable.id, name: "Paddock A", building: "Fields", kind: "PADDOCK", capacity: 3 },
    ])
    .returning();

  // ── Clients (livery owners) ──
  const [clientA, clientB] = await db
    .insert(s.clients)
    .values([
      { ownerId: stable.id, name: "Mona Farouk", phone: "+20 100 555 1234", email: "mona@example.com" },
      { ownerId: stable.id, name: "Tarek El Sayed", phone: "+20 122 555 9876" },
    ])
    .returning();

  // ── Horses ──
  const horses = await db
    .insert(s.horses)
    .values([
      { ownerId: stable.id, name: "Sultan", breed: "KWPN", sex: "GELDING", color: "Bay", birthYear: 2015, heightCm: 170, weightKg: 580, discipline: "Show jumping", level: "1.40m", temperament: "Brave, forward", feiId: "106AB12", sire: "Cornet Obolensky", dam: "Ula", damSire: "Indoctro", description: "Experienced jumper, careful and scopey.", stallId: stallRows[0].id },
      { ownerId: stable.id, name: "Zahra", breed: "Arabian", sex: "MARE", color: "Grey", birthYear: 2016, heightCm: 152, weightKg: 430, discipline: "Breeding", temperament: "Sweet, intelligent", sire: "Ansata Hejazi", dam: "Ansata Samira", damSire: "Ansata Halim Shah", description: "Straight Egyptian broodmare.", stallId: stallRows[1].id },
      { ownerId: stable.id, name: "Bahr", breed: "Holsteiner", sex: "GELDING", color: "Chestnut", birthYear: 2017, heightCm: 168, weightKg: 560, discipline: "Show jumping", level: "1.20m", temperament: "Calm, honest", sire: "Casall", dam: "Lady B", damSire: "Cassini I", description: "Safe schoolmaster for amateurs. Lovely to handle.", listingType: "SALE", price: 1_400_000, showPrice: false, budgetStars: 4, stallId: stallRows[2].id },
      { ownerId: stable.id, name: "Layla", breed: "Arabian", sex: "MARE", color: "Bay", birthYear: 2019, heightCm: 150, weightKg: 410, discipline: "Endurance", temperament: "Energetic", sire: "Ansata Hejazi", dam: "Moniet El Nefous II", description: "Promising endurance mare.", stallId: stallRows[3].id, clientId: clientA.id },
      { ownerId: stable.id, name: "Faris", breed: "Arabian", sex: "STALLION", color: "Grey", birthYear: 2013, heightCm: 154, weightKg: 450, discipline: "Breeding", temperament: "Proud but kind", sire: "Ansata Sinan", dam: "Hanan", damSire: "Alaa El Din", description: "Straight Egyptian stallion standing at stud.", stallId: stallRows[4].id },
      { ownerId: stable.id, name: "Nada", breed: "Thoroughbred", sex: "MARE", color: "Dark bay", birthYear: 2012, heightCm: 163, weightKg: 500, discipline: "Polo", temperament: "Quick, sensitive", description: "Polo mare, available for lease.", listingType: "LEASE", price: 25_000, showPrice: true, stallId: stallRows[8].id, clientId: clientB.id },
      { ownerId: rider.id, name: "Cleo", breed: "Selle Français", sex: "MARE", color: "Bay", birthYear: 2014, heightCm: 166, weightKg: 540, discipline: "Show jumping", level: "1.20m", temperament: "Kind, a little spooky", sire: "Diamant de Semilly", dam: "Oria", description: "My competition mare." },
      { ownerId: rider.id, name: "Rio", breed: "Warmblood", sex: "GELDING", color: "Grey", birthYear: 2010, heightCm: 165, weightKg: 550, discipline: "Show jumping", level: "1.10m", temperament: "Very calm, quiet", description: "Calm and quiet schoolmaster, perfect first jumper. Ready for a new home.", listingType: "SALE", price: 650_000, showPrice: true },
      { ownerId: coach.id, name: "Shadow", breed: "Arabian", sex: "STALLION", color: "Black", birthYear: 2011, heightCm: 153, weightKg: 445, discipline: "Breeding", sire: "Ansata Hejazi", dam: "Ansata Nile Mist", temperament: "Gentle", description: "Black straight Egyptian stallion." },
    ])
    .returning();
  const [sultan, zahra, bahr, layla, faris, nada, cleo, rio] = horses;

  await db.insert(s.horseConflicts).values({ horseAId: faris.id, horseBId: sultan.id, reason: "Faris kicks at Sultan over the partition - keep apart" });

  // ── Staff ──
  const staffRows = await db
    .insert(s.staff)
    .values([
      { ownerId: stable.id, name: "Mahmoud", role: "Head groom", phone: "+201001112233", skills: "feeding, first aid, clipping" },
      { ownerId: stable.id, name: "Saeed", role: "Groom", phone: "+201002223344", skills: "mucking out, turnout, tack care" },
      { ownerId: stable.id, name: "Youssef", role: "Rider", phone: "+201003334455", skills: "flatwork, jumping, young horses" },
      { ownerId: stable.id, name: "Hana", role: "Yard manager", phone: "+201004445566", skills: "planning, clients, invoicing" },
    ])
    .returning();
  const [mahmoud, saeed, youssef, hana] = staffRows;

  // Shifts for this week (Sat-Fri)
  const shifts: (typeof s.shifts.$inferInsert)[] = [];
  for (let d = -1; d < 6; d++) {
    shifts.push({ ownerId: stable.id, staffId: mahmoud.id, start: at(d, 6), end: at(d, 14) });
    shifts.push({ ownerId: stable.id, staffId: saeed.id, start: at(d, 12), end: at(d, 20) });
    if (d !== 3) shifts.push({ ownerId: stable.id, staffId: youssef.id, start: at(d, 7), end: at(d, 13) });
    if (d >= 0 && d <= 4) shifts.push({ ownerId: stable.id, staffId: hana.id, start: at(d, 9), end: at(d, 17) });
  }
  await db.insert(s.shifts).values(shifts);
  await db.insert(s.timeEntries).values([
    { staffId: mahmoud.id, clockIn: at(-1, 6, 2), clockOut: at(-1, 14, 5) },
    { staffId: mahmoud.id, clockIn: at(0, 5, 58) },
  ]);

  // ── Tasks ──
  await db.insert(s.tasks).values([
    { ownerId: stable.id, title: "Morning feed - all horses", category: "CARE", priority: 1, dueAt: at(0, 6), staffId: mahmoud.id, done: true, doneAt: at(0, 6, 40) },
    { ownerId: stable.id, title: "Flatwork session", horseId: sultan.id, category: "TRAINING", priority: 2, dueAt: at(0, 8), staffId: youssef.id },
    { ownerId: stable.id, title: "Cold hose left fore - 15 min", horseId: layla.id, category: "HEALTH", priority: 1, dueAt: at(0, 10), staffId: saeed.id },
    { ownerId: stable.id, title: "Clean and oil all tack", category: "CARE", priority: 3, dueAt: at(0, 15), staffId: saeed.id },
    { ownerId: stable.id, title: "Send livery invoices", category: "OTHER", priority: 2, dueAt: at(-2, 12), staffId: hana.id },
    { ownerId: stable.id, title: "Order 40 bales of berseem hay", category: "CARE", priority: 1, dueAt: at(-1, 10), staffId: hana.id },
    { ownerId: stable.id, title: "Jumping grid", horseId: bahr.id, category: "TRAINING", priority: 2, dueAt: at(1, 8), staffId: youssef.id },
    { ownerId: stable.id, title: "Prepare Bahr for trial", horseId: bahr.id, category: "TRIAL", priority: 1, dueAt: at(2, 9), staffId: mahmoud.id },
    { ownerId: rider.id, title: "Lesson with coach", horseId: cleo.id, category: "TRAINING", priority: 2, dueAt: at(1, 17) },
  ]);

  // ── Health ──
  await db.insert(s.healthRecords).values([
    { horseId: sultan.id, type: "VACCINATION", date: at(-340), nextDue: at(25), provider: "Dr. Karim Adel", cost: 650, notes: "Equine influenza + tetanus booster" },
    { horseId: sultan.id, type: "FARRIER", date: at(-40), nextDue: at(2), provider: "Ahmed Mostafa", cost: 1200, notes: "Full set, pads in front" },
    { horseId: sultan.id, type: "WORMING", date: at(-95), nextDue: at(-5), cost: 180, notes: "Ivermectin" },
    { horseId: zahra.id, type: "VET_VISIT", date: at(-20), provider: "Dr. Karim Adel", cost: 800, notes: "Pre-breeding check, cycling normally" },
    { horseId: zahra.id, type: "VACCINATION", date: at(-200), nextDue: at(165), provider: "Dr. Karim Adel", cost: 650, notes: "Influenza + tetanus" },
    { horseId: bahr.id, type: "DENTAL", date: at(-300), nextDue: at(65), provider: "Dr. Karim Adel", cost: 900, notes: "Routine float" },
    { horseId: bahr.id, type: "VACCINATION", date: at(-100), nextDue: at(265), cost: 650 },
    { horseId: layla.id, type: "INJURY", date: at(-3), notes: "Small swelling left fore after endurance training, sound at walk" },
    { horseId: layla.id, type: "INJURY", date: at(-60), notes: "Heat in left fore tendon, rested 10 days" },
    { horseId: layla.id, type: "TREATMENT", date: at(-58), provider: "Dr. Karim Adel", cost: 1500, notes: "Anti-inflammatory course, cold hosing" },
    { horseId: faris.id, type: "BLOOD_TEST", date: at(-30), provider: "Dr. Karim Adel", cost: 1100, notes: "Fertility panel normal" },
    { horseId: nada.id, type: "FARRIER", date: at(-50), nextDue: at(-1), provider: "Ahmed Mostafa", cost: 1200, notes: "Polo shoes" },
    { horseId: cleo.id, type: "VACCINATION", date: at(-360), nextDue: at(5), cost: 650, notes: "Influenza booster" },
  ]);

  // ── Feeding ──
  await db.insert(s.feedPlans).values([
    { horseId: sultan.id, name: "Competition season", morning: "4 kg berseem hay + 2 kg performance cubes", midday: "3 kg hay", evening: "5 kg hay + 2 kg cubes + 0.5 kg beet pulp", supplements: "Electrolytes after work, joint supplement" },
    { horseId: zahra.id, name: "Broodmare", morning: "3 kg berseem + 1 kg stud mix", midday: "Grazing", evening: "4 kg hay + 1 kg stud mix", supplements: "Mineral balancer" },
    { horseId: bahr.id, name: "Maintenance", morning: "4 kg hay + 1.5 kg cubes", midday: "2 kg hay", evening: "5 kg hay + 1.5 kg cubes" },
  ]);

  // ── Breeding ──
  await db.insert(s.breedingRecords).values([
    { mareId: zahra.id, stallionName: "Faris", status: "COVERED", coverDate: at(-12), expectedFoaling: at(-12 + 340), notes: "Natural cover, scan due in 2 days" },
  ]);

  // ── Trials ──
  await db.insert(s.trialSlots).values([
    { horseId: bahr.id, start: at(2, 10), end: at(2, 12) },
    { horseId: bahr.id, start: at(4, 16), end: at(4, 18) },
    { horseId: rio.id, start: at(3, 9), end: at(3, 11) },
  ]);
  await db.insert(s.trialRequests).values([{ horseId: bahr.id, requesterId: rider.id, date: at(2, 10), message: "Hi! I'd love to try Bahr - looking for a 1.20m horse to step up." }]);
  await db.insert(s.savedHorses).values([{ userId: rider.id, horseId: bahr.id, folder: "Next horse" }]);

  // ── Finance ──
  const tx: (typeof s.transactions.$inferInsert)[] = [
    { ownerId: stable.id, kind: "INCOME", category: "Livery", amount: 12000, date: at(-15), description: "Layla - monthly livery (Mona Farouk)" },
    { ownerId: stable.id, kind: "INCOME", category: "Livery", amount: 12000, date: at(-15), description: "Nada - monthly livery (Tarek El Sayed)" },
    { ownerId: stable.id, kind: "INCOME", category: "Lessons", amount: 7200, date: at(-8), description: "8 private lessons" },
    { ownerId: stable.id, kind: "INCOME", category: "Stud fees", amount: 30000, date: at(-12), description: "Faris cover - external mare" },
    { ownerId: stable.id, kind: "EXPENSE", category: "Feed", amount: 18500, date: at(-10), description: "Berseem hay and cubes" },
    { ownerId: stable.id, kind: "EXPENSE", category: "Salaries", amount: 32000, date: at(-5), description: "Monthly staff salaries" },
    { ownerId: stable.id, kind: "EXPENSE", category: "Farrier", amount: 1200, date: at(-40), horseId: sultan.id, description: "Full set" },
    { ownerId: stable.id, kind: "EXPENSE", category: "Vet", amount: 1500, date: at(-58), horseId: layla.id, description: "Tendon treatment" },
    { ownerId: stable.id, kind: "EXPENSE", category: "Bedding", amount: 4200, date: at(-6), description: "Wood shavings" },
  ];
  await db.insert(s.transactions).values(tx);
  await db.insert(s.invoices).values([
    { ownerId: stable.id, clientId: clientA.id, number: "VS-0001", clientName: "Mona Farouk", items: JSON.stringify([{ description: "Full livery - Layla", quantity: 1, unitPrice: 12000 }, { description: "Treatment - Layla", quantity: 1, unitPrice: 1500 }]), total: 13500, status: "PAID", issuedAt: at(-30), dueAt: at(-16) },
    { ownerId: stable.id, clientId: clientB.id, number: "VS-0002", clientName: "Tarek El Sayed", items: JSON.stringify([{ description: "Full livery - Nada", quantity: 1, unitPrice: 12000 }]), total: 12000, status: "SENT", issuedAt: at(-5), dueAt: at(9) },
  ]);

  // ── Community ──
  const posts = await db
    .insert(s.posts)
    .values([
      { authorId: stable.id, horseId: sultan.id, tag: "COMPETITION", content: "Sultan and Youssef clear in the 1.40m at the weekend show! Proud of the team.", createdAt: at(-2, 18) },
      { authorId: rider.id, horseId: cleo.id, tag: "HOME", content: "Lovely gridwork session with Cleo this morning before the heat.", createdAt: at(-1, 9) },
      { authorId: stable.id, horseId: bahr.id, tag: "SALE", content: "Bahr is available - the kindest 1.20m schoolmaster. Trials open this week, book in the app.", createdAt: at(-1, 12) },
      { authorId: coach.id, tag: "UPDATE", content: "Summer clinic dates are out: gymnastic jumping for riders of all levels in Giza.", createdAt: at(0, 7) },
    ])
    .returning();
  await db.insert(s.likes).values([
    { postId: posts[0].id, userId: rider.id },
    { postId: posts[0].id, userId: fan.id },
    { postId: posts[1].id, userId: stable.id },
  ]);
  await db.insert(s.comments).values([{ postId: posts[0].id, authorId: fan.id, content: "Amazing round!" }]);
  await db.insert(s.messages).values([
    { senderId: rider.id, receiverId: stable.id, horseId: bahr.id, content: "Hi, is Bahr still available? What is his price range?", createdAt: at(-1, 13) },
    { senderId: stable.id, receiverId: rider.id, content: "Yes he is! He is 4 stars on budget - happy to share details. Come try him on the trial slot.", createdAt: at(-1, 14) },
  ]);

  // ── Professionals ──
  await db.insert(s.bookings).values([
    { proId: vet.id, clientId: stable.id, horseId: layla.id, service: "Lameness check", date: at(1, 11), status: "CONFIRMED", notes: "Swelling left fore" },
    { proId: farrier.id, clientId: stable.id, horseId: sultan.id, service: "Full set of shoes", date: at(2, 9), status: "PENDING" },
    { proId: vet.id, clientId: rider.id, horseId: cleo.id, service: "Vaccination", date: at(4, 10), status: "PENDING" },
  ]);

  // ── Jobs ──
  const [job] = await db
    .insert(s.jobs)
    .values([
      { posterId: stable.id, title: "Experienced groom", role: "Groom", location: "Giza", salary: "9,000-11,000 EGP/month + accommodation", type: "FULL_TIME", description: "Care for 10 sport horses: feeding, mucking out, turnout, preparing horses for shows. Experience with show jumpers and basic first aid needed." },
      { posterId: coach.id, title: "Assistant coach (part-time)", role: "Coach", location: "Cairo", salary: "Per lesson", type: "PART_TIME", description: "Help teach beginner and intermediate lessons on weekends." },
    ])
    .returning();
  await db.insert(s.applications).values([
    { jobId: job.id, applicantId: fan.id, message: "I have ridden for 5 years and helped at my club on weekends, keen to learn." },
    { jobId: job.id, applicantId: rider.id, message: "Groomed at shows for 3 years for a show jumping yard in Giza, experienced with first aid, bandaging and travelling horses." },
  ]);

  console.log("Seeded demo data.\nLog in with demo@vigerstable.com / password123 (stable)");
  console.log("Other demo users: rider@demo.com, vet@demo.com, farrier@demo.com, coach@demo.com, fan@demo.com (same password)");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
