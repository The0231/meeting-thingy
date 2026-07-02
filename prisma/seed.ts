// Sample data that demonstrates the smart-interval behaviour end to end.
// Run with: npm run db:seed   (or it runs as part of `npm run setup`).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NOON = 12;
function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(NOON, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n: number): Date {
  return daysAgo(-n);
}

async function main() {
  // The app is in real use now — demo data must be opted into explicitly.
  if (process.env.SEED_DEMO !== "1") {
    console.log(
      "Skipping demo seed (the app now holds real data). Set SEED_DEMO=1 to load example data.",
    );
    return;
  }
  console.log("Clearing existing data…");
  await prisma.meeting.deleteMany();
  await prisma.client.deleteMany();

  console.log("Seeding clients & meetings…");

  // 1) Steady monthly client, currently due soon.
  await prisma.client.create({
    data: {
      clientName: "Acme Pasta Co",
      businessName: "Acme Pasta Co Ltd",
      contactName: "Maria Rossi",
      phone: "+44 20 7946 0011",
      email: "maria@acmepasta.example",
      tags: "wholesale,london",
      intervalMode: "automatic",
      setupCompleted: true,
      expectedIntervalDays: 30,
      annualValue: 45000,
      valueSource: "manual",
      notes: "Reliable monthly order. Likes a quick catch-up over coffee.",
      meetings: {
        create: [
          { meetingDate: daysAgo(118), meetingType: "in_person", status: "completed", manualNotes: "Reviewed Q1 volumes." },
          { meetingDate: daysAgo(88), meetingType: "in_person", status: "completed", manualNotes: "New gnocchi line discussed." },
          { meetingDate: daysAgo(58), meetingType: "phone", status: "completed", manualNotes: "Quick check-in." },
          {
            meetingDate: daysAgo(28),
            meetingType: "in_person",
            status: "completed",
            manualNotes: "Tasting of seasonal range.",
            aiSummary:
              "Maria is happy with current supply. Interested in the new seasonal range and asked for samples before the next order.",
            actionItems: JSON.stringify([
              "Send seasonal samples",
              "Prepare updated price list",
            ]),
            followUpRequired: true,
          },
          // a scheduled future meeting (shows blue on the calendar)
          { meetingDate: daysFromNow(5), meetingType: "in_person", status: "scheduled" },
        ],
      },
    },
  });

  // 2) Rhythm slowing down: was monthly, last gap stretched → flags "interval changed".
  await prisma.client.create({
    data: {
      clientName: "Bella Foods",
      businessName: "Bella Foods Distribution",
      contactName: "Tom Clarke",
      email: "tom@bellafoods.example",
      tags: "distributor",
      intervalMode: "automatic",
      setupCompleted: true,
      expectedIntervalDays: 30,
      annualValue: 85000,
      valueSource: "manual",
      notes: "Used to be monthly; meetings have been getting further apart.",
      meetings: {
        create: [
          { meetingDate: daysAgo(190), meetingType: "in_person", status: "completed" },
          { meetingDate: daysAgo(160), meetingType: "in_person", status: "completed" },
          { meetingDate: daysAgo(130), meetingType: "phone", status: "completed" },
          { meetingDate: daysAgo(100), meetingType: "in_person", status: "completed" },
          { meetingDate: daysAgo(40), meetingType: "in_person", status: "completed", manualNotes: "Busy period, pushed the catch-up back." },
        ],
      },
    },
  });

  // 3) Monthly client, now overdue.
  await prisma.client.create({
    data: {
      clientName: "Corner Deli",
      contactName: "Priya Patel",
      phone: "+44 161 496 0022",
      tags: "retail,manchester",
      intervalMode: "automatic",
      setupCompleted: true,
      expectedIntervalDays: 30,
      annualValue: 7000,
      valueSource: "manual",
      notes: "Small but loyal. Don't let this one slip.",
      meetings: {
        create: [
          { meetingDate: daysAgo(120), meetingType: "in_person", status: "completed" },
          { meetingDate: daysAgo(90), meetingType: "in_person", status: "completed" },
          { meetingDate: daysAgo(60), meetingType: "in_person", status: "completed", manualNotes: "Reordered olive oil and fresh pasta." },
        ],
      },
    },
  });

  // 4) Fortnightly client, well overdue.
  await prisma.client.create({
    data: {
      clientName: "Sunrise Catering",
      businessName: "Sunrise Catering Group",
      contactName: "Dan Webb",
      email: "dan@sunrise.example",
      tags: "catering,high-value",
      intervalMode: "automatic",
      setupCompleted: true,
      expectedIntervalDays: 14,
      annualValue: 120000,
      valueSource: "manual",
      notes: "High value — usually every couple of weeks.",
      meetings: {
        create: [
          { meetingDate: daysAgo(70), meetingType: "site_visit", status: "completed" },
          { meetingDate: daysAgo(56), meetingType: "in_person", status: "completed" },
          { meetingDate: daysAgo(42), meetingType: "phone", status: "completed" },
          { meetingDate: daysAgo(28), meetingType: "in_person", status: "completed", followUpRequired: true },
        ],
      },
    },
  });

  // 5) Brand-new client, single meeting → uses default 30-day interval.
  await prisma.client.create({
    data: {
      clientName: "Trattoria Verde",
      contactName: "Luca Bianchi",
      tags: "restaurant,new",
      intervalMode: "automatic",
      notes: "First meeting went well. Trial order placed.",
      meetings: {
        create: [
          {
            meetingDate: daysAgo(10),
            meetingType: "in_person",
            status: "completed",
            transcript:
              "Luca is opening a second site in the autumn and wants a reliable fresh pasta supplier. He placed a small trial order and will decide after tasting.",
            aiSummary:
              "Promising new restaurant client opening a second location in autumn. Trial order placed; decision expected after tasting.",
            actionItems: JSON.stringify([
              "Follow up after the tasting",
              "Send wholesale rate card",
            ]),
            followUpRequired: true,
          },
        ],
      },
    },
  });

  // 6) No meetings yet → "no history".
  await prisma.client.create({
    data: {
      clientName: "Northside Grocers",
      contactName: "Sam Okafor",
      tags: "retail,prospect",
      intervalMode: "automatic",
      notes: "New prospect from the trade show. Not yet visited.",
    },
  });

  // 7) Manual interval (every 14 days) — currently overdue.
  await prisma.client.create({
    data: {
      clientName: "Quick Bites",
      businessName: "Quick Bites Ltd",
      contactName: "Ella Stone",
      tags: "qsr",
      intervalMode: "manual",
      manualIntervalDays: 14,
      notes: "We agreed to check in every two weeks regardless of the pattern.",
      meetings: {
        create: [
          { meetingDate: daysAgo(20), meetingType: "phone", status: "completed" },
        ],
      },
    },
  });

  // 8) Custom next date — due in a few days.
  await prisma.client.create({
    data: {
      clientName: "Harbour Catering",
      contactName: "Owen Hughes",
      tags: "catering",
      intervalMode: "custom_date",
      customNextDate: daysFromNow(3),
      notes: "Owen asked us to come back specifically after their summer event.",
      meetings: {
        create: [
          { meetingDate: daysAgo(35), meetingType: "in_person", status: "completed" },
        ],
      },
    },
  });

  // 9) Paused client — no reminders.
  await prisma.client.create({
    data: {
      clientName: "Old Mill Bistro",
      contactName: "Grace Lee",
      tags: "restaurant",
      intervalMode: "paused",
      notes: "Closed for refurbishment until next year. Reminders paused.",
      meetings: {
        create: [
          { meetingDate: daysAgo(95), meetingType: "in_person", status: "completed" },
          { meetingDate: daysAgo(65), meetingType: "in_person", status: "completed" },
        ],
      },
    },
  });

  const clientCount = await prisma.client.count();
  const meetingCount = await prisma.meeting.count();
  console.log(`Done. Seeded ${clientCount} clients and ${meetingCount} meetings.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
