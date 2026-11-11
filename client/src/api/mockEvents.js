// Mock data used when VITE_USE_MOCK=true (npm run dev:mock), so the UI can be
// demoed before the backend GET /api/events endpoint is ready.
// Deliberately includes a cancelled, a draft and a past event: the UI must hide them.

const day = 24 * 60 * 60 * 1000;
const at = (daysFromNow, hour = 10) => {
  const d = new Date(Date.now() + daysFromNow * day);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

export const MOCK_EVENTS = [
  {
    eventId: "e1",
    title: "AI & Data Science Symposium",
    description: "Talks and posters from research groups across Bangalore institutions.",
    category: "Seminar",
    capacity: 200,
    registeredCount: 120,
    date: at(3),
    venue: "Main Auditorium, Bangalore",
    price: 0,
    status: "published",
  },
  {
    eventId: "e2",
    title: "Hack the Campus 24h Hackathon",
    description: "Build something useful in 24 hours. Teams of up to four.",
    category: "Technical",
    capacity: 100,
    registeredCount: 100,
    date: at(5, 9),
    venue: "Innovation Lab, Bangalore",
    price: 200,
    status: "published",
  },
  {
    eventId: "e3",
    title: "Classical Music Evening",
    description: "An evening of Carnatic and Hindustani performances.",
    category: "Cultural",
    capacity: 150,
    registeredCount: 40,
    date: at(8, 18),
    venue: "Open Air Theatre, Mysuru",
    price: 150,
    status: "published",
  },
  {
    eventId: "e4",
    title: "Inter-College Football Cup",
    description: "Knockout tournament, eight teams.",
    category: "Sports",
    capacity: 300,
    registeredCount: 90,
    date: at(12, 8),
    venue: "City Sports Ground, Bangalore",
    price: 0,
    status: "published",
  },
  {
    eventId: "e5",
    title: "React & Node Workshop",
    description: "Hands-on full-stack workshop. Bring a laptop.",
    category: "Workshop",
    capacity: 60,
    registeredCount: 58,
    date: at(15, 10),
    venue: "Computer Lab 2, Bangalore",
    price: 500,
    status: "published",
  },
  {
    eventId: "e6",
    title: "Alumni Meet",
    description: "Reconnect with alumni and faculty.",
    category: "Social",
    capacity: 250,
    registeredCount: 10,
    date: at(20, 17),
    venue: "Convention Centre, Bangalore",
    price: 0,
    status: "published",
  },
  // Must NOT appear in the UI:
  {
    eventId: "x1",
    title: "Cancelled: Robotics Expo",
    category: "Technical",
    capacity: 100,
    registeredCount: 20,
    date: at(6),
    venue: "Hall B, Bangalore",
    price: 0,
    status: "cancelled",
  },
  {
    eventId: "x2",
    title: "Draft: Unpublished Event",
    category: "Other",
    capacity: 50,
    registeredCount: 0,
    date: at(9),
    venue: "TBD",
    price: 0,
    status: "draft",
  },
  {
    eventId: "x3",
    title: "Past: Freshers Welcome 2026",
    category: "Social",
    capacity: 400,
    registeredCount: 380,
    date: at(-10),
    venue: "Main Auditorium, Bangalore",
    price: 0,
    status: "published",
  },
];
