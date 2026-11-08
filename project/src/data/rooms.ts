// Fictional room catalog. Read-only: nothing in the app may change it (AC5).
// Times are minutes after midnight on the same fixed day as NOW (540 = 09:00).

export interface Booking {
  readonly start: number;
  readonly end: number;
}

export interface Room {
  readonly id: string;
  readonly name: string;
  readonly capacity: number;
  readonly equipment: readonly string[];
  readonly blocked: boolean;
  readonly bookings: readonly Booking[];
}

export const ROOMS: readonly Room[] = [
  {
    // Projector room, booked 10:00–11:00 (same booking as the original demo)
    id: 'b-204',
    name: 'B-204 · Engineering Block',
    capacity: 12,
    equipment: ['projector', 'whiteboard'],
    blocked: false,
    bookings: [{ start: 600, end: 660 }], // 10:00–11:00
  },
  {
    // Projector room, free 10:00–11:00
    id: 'a-301',
    name: 'A-301 · Lecture Hall',
    capacity: 40,
    equipment: ['projector'],
    blocked: false,
    bookings: [{ start: 840, end: 900 }], // 14:00–15:00
  },
  {
    // Capacity exactly 8 (boundary for F1: 8 attendees OK, 9 not)
    id: 'c-110',
    name: 'C-110 · Seminar Room',
    capacity: 8,
    equipment: ['whiteboard'],
    blocked: false,
    bookings: [],
  },
  {
    // Blocked room: never available (AC3 / F3)
    id: 'b-105',
    name: 'B-105 · Maker Lab',
    capacity: 20,
    equipment: ['whiteboard'],
    blocked: true,
    bookings: [],
  },
  {
    // No equipment: fails F2 whenever any equipment is selected
    id: 'd-002',
    name: 'D-002 · Study Pod',
    capacity: 4,
    equipment: [],
    blocked: false,
    bookings: [],
  },
];