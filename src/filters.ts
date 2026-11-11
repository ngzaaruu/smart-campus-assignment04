// Pure room filters (F1, F2). They never change the rooms they receive.
import type { Room } from './data/rooms';

export interface RoomFilter {
  readonly attendees: number;
  readonly equipment: readonly string[];
}

// F1: the room must seat everyone (exactly equal is OK).
export const meetsCapacity = (room: Pick<Room, 'capacity'>, attendees: number): boolean =>
  room.capacity >= attendees;

// F2: the room must have ALL selected items. Nothing selected => true.
export const hasAllEquipment = (
  room: Pick<Room, 'equipment'>,
  selected: readonly string[]
): boolean => selected.every((item) => room.equipment.includes(item));

// Rooms that pass F1 and F2, in catalog order. Returns a new array.
// Blocked rooms are NOT removed here: F3 is enforced by checkAvailability.
export const filterRooms = (rooms: readonly Room[], filter: RoomFilter): Room[] =>
  rooms.filter(
    (room) => meetsCapacity(room, filter.attendees) && hasAllEquipment(room, filter.equipment)
  );