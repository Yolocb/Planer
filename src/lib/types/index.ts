// -------------------------------------------------------------------------
// FamilyCal — core data model (see Design Document §5).
// -------------------------------------------------------------------------

/** The three family members. 'family' (shared) is handled separately. */
export type PersonId = 'christian' | 'janina' | 'feli';

/** Selectable owner of an event, including the shared "family" pseudo-person. */
export type EventOwnerId = PersonId | 'family';

export interface Person {
	id: EventOwnerId;
	name: string;
	color: string;
	initial: string;
	/** Base64 PNG or inline SVG string. Optional. */
	avatar?: string;
}

export type EventCategory =
	'school' | 'sport' | 'medical' | 'birthday' | 'holiday' | 'music' | 'fun' | 'other';

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/** RFC-5545-compatible weekday codes. */
export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

export interface RecurrenceRule {
	frequency: RecurrenceFrequency;
	/** Every N periods (default 1). */
	interval?: number;
	/** For WEEKLY: which weekdays, e.g. ['MO','WE','FR']. */
	byDay?: Weekday[];
	/** ISO date — end of recurrence (inclusive). */
	until?: string;
	/** Number of occurrences (alternative to `until`). */
	count?: number;
}

/** Minutes before the event start to remind. */
export type ReminderMinutes = 15 | 30 | 60 | 1440;

export interface CalendarEvent {
	id: string;
	/** Required, max 100 chars. */
	title: string;
	/** ISO 8601 datetime or date. */
	start: string;
	/** ISO 8601 datetime or date. */
	end: string;
	allDay: boolean;
	/** One or more owners. Order matters — first owner drives the default colour. */
	personIds: EventOwnerId[];
	description?: string;
	location?: string;
	category?: EventCategory;
	recurrence?: RecurrenceRule;
	/** Points to the parent series id (for exceptions / expanded occurrences). */
	recurringEventId?: string;
	isRecurrenceException?: boolean;
	/** Occurrence start ISO strings to skip on the master (recurrence exceptions). */
	exdates?: string[];
	/** Colour override — defaults to first personId's colour. */
	color?: string;
	reminder?: ReminderMinutes;
	createdAt: string;
	updatedAt: string;
}

export interface Chore {
	id: string;
	title: string;
	/** ISO date. */
	dueDate: string;
	personId: PersonId;
	completed: boolean;
	completedAt?: string;
}

export type CalendarViewId = 'week' | 'month' | 'day' | 'agenda';
export type ThemeSetting = 'light' | 'dark' | 'auto';
/** Colour palette, orthogonal to light/dark: each has a light + dark variant. */
export type PaletteSetting = 'frisch' | 'sonne' | 'ozean';

export interface AppSettings {
	defaultView: CalendarViewId;
	/** 0 = Sunday, 1 = Monday. */
	weekStartsOn: 0 | 1;
	timeFormat: '12h' | '24h';
	theme: ThemeSetting;
	/** Active colour palette. */
	palette: PaletteSetting;
	lastVisitedDate?: string;
}
