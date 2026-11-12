import { UserRole } from "@schoolmitra/validators/roleConfig";
import { TourDeck } from "./types";
import { SCHOOL_ADMIN_DECK } from "./adminTour";
import {
  TEACHER_DECK,
  PRINCIPAL_DECK,
  ACCOUNTANT_DECK,
  HR_MANAGER_DECK,
  LIBRARIAN_DECK,
  TRANSPORT_MANAGER_DECK,
  DRIVER_DECK,
} from "./staffTours";
import { PARENT_DECK, STUDENT_DECK } from "./familyTours";
import { SUPER_ADMIN_DECK } from "./superAdminTour";

export const ALL_TOUR_DECKS: Record<UserRole, TourDeck> = {
  SCHOOL_ADMIN: SCHOOL_ADMIN_DECK,
  TEACHER: TEACHER_DECK,
  PRINCIPAL: PRINCIPAL_DECK,
  ACCOUNTANT: ACCOUNTANT_DECK,
  HR_MANAGER: HR_MANAGER_DECK,
  LIBRARIAN: LIBRARIAN_DECK,
  TRANSPORT_MANAGER: TRANSPORT_MANAGER_DECK,
  DRIVER: DRIVER_DECK,
  PARENT: PARENT_DECK,
  STUDENT: STUDENT_DECK,
  SUPER_ADMIN: SUPER_ADMIN_DECK,
};

export function getTourDeckForRole(role: UserRole | string | undefined | null): TourDeck {
  const normalizedRole = (role || "SCHOOL_ADMIN").toUpperCase() as UserRole;
  return ALL_TOUR_DECKS[normalizedRole] || SCHOOL_ADMIN_DECK;
}

