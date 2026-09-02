"use client";

/**
 * Calendar — three faces of the same month: a stay, a day, a moment.
 *
 * Every calendar in a library gives you a grid and an `onSelect`. What a trip,
 * a booking or a report actually asks for is something the grid doesn't say on
 * its own: the thing *between* two dates, or the day plus the hour. So the
 * subject here is the answer and not the grid, and the grid is one of the ways
 * to say it. The other two are the summary fields at the top —which one am I
 * filling in?— and the presets at the bottom, which for most people is the
 * fastest answer of the three.
 *
 * There are three exports and one implementation:
 *
 *   `RangeCalendar`     a stay. Two ends, the band between them, a counter
 *                       that says how many nights.
 *   `DatePicker`        one day. One end, no band, and the counter says what
 *                       the day *is* — today, tomorrow, a Saturday.
 *   `DateTimePicker`    a moment. The same day, and the second field takes the
 *                       plane over to three columns: the hour, the minutes and
 *                       the half of the day.
 *
 * They're one component and not three because the split would force the same
 * anatomy —the travelling marks, the month crossover, the keyboard, the two
 * planes, the shape and size ladders— to be maintained three times, only to
 * end up choosing by the outermost thing: how many ends the answer has. Here
 * that's a prop.
 *
 * Eight decisions worth not undoing without looking at the rest:
 *
 * 1. **The band is per week row, not per day.** The obvious implementation
 *    paints a background on each selected cell and rounds the two ends. That
 *    can't animate: a range that grows by one day is a new element appearing,
 *    not a shape stretching. Here each row paints a single pill positioned by
 *    percentage —`left` and `width` over seven columns—, so extending the
 *    range makes it *grow*, and the growth starts at the check-in end because
 *    the entry state anchors there.
 *
 * 2. **The endpoints travel, they don't blink.** The filled circle carries a
 *    `layoutId`, so moving the check-in glides it across the month instead of
 *    switching one circle off and another on. The neutral circle under the
 *    pointer is the same trick with a faster tier: it chases the cursor, which
 *    is what makes hovering the grid feel like dragging one object rather than
 *    lighting up cells. The time slots use the same two marks, which is why
 *    picking an hour reads like picking a day.
 *
 * 3. **Hovering *is* the preview.** While the check-out is the field being
 *    filled, the band reaches the hovered day and the counter reads that many
 *    nights. Nothing is committed —the click commits— but the answer to "how
 *    long would this be?" is already on screen, which is the whole question.
 *
 * 4. **The `layoutId`s are scoped to the month and to the instance.** Travel
 *    within a month is the point; travel across a month change would be a
 *    circle flying over a grid that's sliding the other way. Folding the month
 *    key into the id ends the animation at the month boundary — and folding in
 *    a `useId` keeps two calendars on the same screen from being read as one
 *    object in two places.
 *
 * 5. **It's two planes, not one.** The month sits on its own raised plane and
 *    the fields, the counter and the presets sit on the card under it. That's
 *    not decoration: the grid is the part you point at, and the rest is what
 *    it produced. `Elevated` gives them the two steps and publishes the level
 *    inwards, so this works just as well inside a dialog.
 *
 * 6. **The plane's height is measured, not guessed.** A 5-row month next to a
 *    6-row one is a 40px jump, and the hour's columns are a different height
 *    again. The container animates to the measured height of whatever is
 *    coming in —`useMeasuredHeight`, same as any crossover in this system— so
 *    the card resizes *with* the slide instead of after it.
 *
 * 7. **The fields say what the plane is for.** In `DateTimePicker` the second
 *    field doesn't open a popup of its own: it turns the plane into the hour's
 *    three columns, and picking the day advances to them exactly as picking
 *    the check-in advances to the check-out. One state —which field is open—
 *    drives the underline and the plane, so the two can't disagree.
 *
 * 8. **A moment is one `Date`, not a date plus a time.** `DateTimePicker`
 *    hands back a single `Date` carrying both. The cost is one ambiguity —a
 *    value at exactly midnight reads as a day whose hour hasn't been picked
 *    yet— and it's worth it: the alternative is two props and a caller who has
 *    to reassemble a moment that was never apart.
 *
 * There are no arrows in the mock this was drawn from, and there are here: a
 * month you can only reach by typing isn't reachable. They're the quietest
 * thing on the plane and they sit at the end of the month's line.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMeasuredHeight } from "@/hooks/use-measured-height";
import { Elevated } from "@/lib/elevated";
import { useShape } from "@/lib/shape-context";
import { useSizeVariant, useTypeScale } from "@/lib/size-context";
import { spring } from "@/lib/springs";
import { cn } from "@/lib/utils";

/* ── Dates ─────────────────────────────────────────────────────────────────
   Plain `Date` at local midnight, no library. Everything here is calendar
   arithmetic —which day, how many days— and the one place that would go wrong
   with milliseconds (counting nights across a DST change) counts in UTC. */

const MS_PER_DAY = 86_400_000;

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

const addMonths = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth() + n, 1);

const sameDay = (a: Date | null, b: Date | null) =>
  !!a &&
  !!b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const sameMonth = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

/** Nights from `a` to `b`. In UTC because a DST change inside the range makes
 *  one of the days 23 or 25 hours long, and a local subtraction would return
 *  2.96 nights where the calendar says 3. */
const nightsBetween = (a: Date, b: Date) =>
  Math.round(
    (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
      Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) /
      MS_PER_DAY
  );

/** Minutes since midnight — how a time is carried around in here, because an
 *  hour with no day attached isn't a `Date`. */
const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** That day, at that many minutes past midnight. */
const atMinutes = (day: Date, minutes: number) =>
  new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Math.floor(minutes / 60),
    minutes % 60
  );

const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * The month as rows of seven. Only this month's days: the leading blanks are
 * empty cells, and there are no trailing ones from the next month. Days that
 * belong to another month and are shown anyway are a second calendar drawn
 * inside the first — you can click them, but the header says the wrong thing
 * about them.
 */
function monthWeeks(month: Date, weekStartsOn: number): (Date | null)[][] {
  const first = startOfMonth(month);
  const lead = (first.getDay() - weekStartsOn + 7) % 7;
  const length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from(
      { length },
      (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)
    ),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return Array.from({ length: cells.length / 7 }, (_, i) =>
    cells.slice(i * 7, i * 7 + 7)
  );
}

/* ── Types ─────────────────────────────────────────────────────────────── */

interface DateRange {
  start: Date | null;
  end: Date | null;
}

/** A shortcut at the foot of a `RangeCalendar`. It gets the day to count from
 *  —the current check-in, or today— and returns the whole range: "a weekend"
 *  means something different in March than it does on a Friday. */
interface RangePreset {
  label: string;
  range: (from: Date) => DateRange;
}

/** The same idea for the one-day faces: it returns the day, not the range. */
interface DayPreset {
  label: string;
  date: (from: Date) => Date;
}

const EMPTY_RANGE: DateRange = { start: null, end: null };

/** The next Friday, or today if today is one. */
const nextFriday = (from: Date) => addDays(from, (5 - from.getDay() + 7) % 7);

/** The next Monday, always a different day from `from`. */
const nextMonday = (from: Date) => addDays(from, ((1 - from.getDay() + 7) % 7) || 7);

const DEFAULT_RANGE_PRESETS: RangePreset[] = [
  {
    label: "Weekend",
    range: (from) => {
      const friday = nextFriday(from);
      return { start: friday, end: addDays(friday, 2) };
    },
  },
  { label: "3 nights", range: (from) => ({ start: from, end: addDays(from, 3) }) },
  { label: "1 week", range: (from) => ({ start: from, end: addDays(from, 7) }) },
  { label: "2 weeks", range: (from) => ({ start: from, end: addDays(from, 14) }) },
];

const DEFAULT_DAY_PRESETS: DayPreset[] = [
  { label: "Today", date: (from) => startOfDay(from) },
  { label: "Tomorrow", date: (from) => addDays(from, 1) },
  { label: "Next Monday", date: nextMonday },
  { label: "In a week", date: (from) => addDays(from, 7) },
];

/** What the counter says for a single day. Near days get named, the rest get
 *  their weekday: "next Thursday" is what the date means, and the date itself
 *  is already in the field right below. */
const defaultDayLabel = (
  day: Date,
  today: Date,
  weekday: (d: Date) => string
) => {
  const distance = nightsBetween(today, day);
  if (distance === 0) return "Today";
  if (distance === 1) return "Tomorrow";
  if (distance === -1) return "Yesterday";
  return weekday(day);
};

/** What every face takes, whatever its answer is shaped like. */
interface CalendarSharedProps {
  /** The card's title. Without it the header —title and counter— doesn't
   *  render and the calendar starts at the fields. */
  title?: string;
  /** The summary fields. Turn them off for a bare month grid. Ignored by
   *  `DateTimePicker`: the time field is how the hours are reached. */
  fields?: boolean;
  clearLabel?: string;
  month?: Date;
  defaultMonth?: Date;
  onMonthChange?: (month: Date) => void;
  /** Days outside these bounds can't be picked. `minDate` defaults to today:
   *  the common case is something that hasn't happened yet. Pass `null` for a
   *  calendar that reaches backwards. */
  minDate?: Date | null;
  maxDate?: Date | null;
  /** 0 = Sunday … 1 = Monday, the default. */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  locale?: string;
  className?: string;
}

interface RangeCalendarProps extends CalendarSharedProps {
  value?: DateRange;
  defaultValue?: DateRange;
  onValueChange?: (range: DateRange) => void;
  startLabel?: string;
  endLabel?: string;
  /** What an empty field says. */
  placeholder?: string;
  /** `false` drops the whole foot, presets and Clear alike. */
  presets?: RangePreset[] | false;
  /** The counter next to the title, and the sentence a screen reader gets for
   *  the range. Take the plural —and the unit: nights, days, whatever the
   *  domain counts— from whoever uses this. */
  countLabel?: (nights: number) => string;
}

interface DatePickerProps extends CalendarSharedProps {
  value?: Date | null;
  defaultValue?: Date | null;
  onValueChange?: (day: Date | null) => void;
  label?: string;
  placeholder?: string;
  presets?: DayPreset[] | false;
  /** The counter next to the title. Gets the day, today, and a locale-aware
   *  weekday formatter, so an override doesn't have to build one. */
  dayLabel?: (
    day: Date,
    today: Date,
    weekday: (d: Date) => string
  ) => string | null;
  /** The second field and the hour's three columns. `DateTimePicker` is this,
   *  on. */
  time?: boolean;
  timeLabel?: string;
  timePlaceholder?: string;
  /** The captions over the two columns of numbers. They exist because at rest
   *  the hours and the minutes are two identical columns of two digits; the
   *  half of the day says what it is by itself and gets none. */
  hourLabel?: string;
  minuteLabel?: string;
  /** Minutes between one pickable minute and the next: every minute by
   *  default, 15 for quarter-hour bookings. The column still shows 00 to 59
   *  and greys what falls off the step. */
  timeStep?: number;
  /** The window of the day that can be picked, in minutes from midnight.
   *  Defaults to the whole day — the component can't know the domain, and a
   *  booking that only runs 9 to 18 says so here. */
  timeRange?: [number, number];
  /** The times outright, in minutes from midnight, when they aren't a regular
   *  step: departures, showings, the four times a doctor is in. Everything
   *  else on the clock is shown greyed. */
  times?: number[];
}

/* ── The component ─────────────────────────────────────────────────────── */

/** Steps each plane climbs: the card over the page, the month over the card. */
const CARD_RISE = 1;
const MONTH_RISE = 2;

/** The accent. One variable for the marks that carry it —the band, the
 *  endpoint circles, the chosen hour and the field's underline— so retheming
 *  moves all of them at once: `style={{ "--calendar-accent": "#10b981" }}` on
 *  the calendar or on anything above it. The default is the registry's blue,
 *  the same one `Badge` paints. */
const ACCENT = "var(--calendar-accent, #3b82f6)";
/** The band's fill. It's derived from the accent —12% of it over the page, the
 *  same recipe `Badge` uses for a colored pill— but it gets its own variable
 *  because the derivation isn't always right: a dark theme with a saturated
 *  accent may want more of it, and that's a decision for whoever themes this,
 *  not one to be recompiled. */
const ACCENT_TINT = `var(--calendar-band, color-mix(in srgb, ${ACCENT} 12%, var(--background)))`;

/** The presets, normalized: whatever the face's shortcut returns, the core
 *  reads a range. */
interface CorePreset {
  label: string;
  range: (from: Date) => DateRange;
}

interface CalendarCoreProps extends CalendarSharedProps {
  /** How many ends the answer has. `single` never draws a band and never
   *  advances to a second day. */
  mode: "range" | "single";
  /** `single` only: the second field is the hour, and it takes the plane. */
  withTime: boolean;
  value?: DateRange;
  defaultValue?: DateRange;
  onValueChange?: (range: DateRange) => void;
  startLabel: string;
  endLabel: string;
  placeholder: string;
  timePlaceholder: string;
  hourLabel: string;
  minuteLabel: string;
  presets: CorePreset[] | false;
  /** The counter, given the range *as drawn* — the hovered preview included,
   *  which is what makes it read live. */
  badge: (
    range: DateRange,
    context: { today: Date; weekday: (d: Date) => string }
  ) => string | null;
  times: number[];
}

function CalendarCore({
  mode,
  withTime,
  value,
  defaultValue,
  onValueChange,
  title,
  fields = true,
  startLabel,
  endLabel,
  placeholder,
  timePlaceholder,
  hourLabel,
  minuteLabel,
  presets,
  badge,
  times,
  clearLabel = "Clear",
  month: monthProp,
  defaultMonth,
  onMonthChange,
  minDate,
  maxDate,
  weekStartsOn = 1,
  locale,
  className,
}: CalendarCoreProps) {
  const shape = useShape();
  const compact = useSizeVariant() === "compact";
  const type = useTypeScale();
  const reduceMotion = useReducedMotion();

  // Three tiers, three jobs: the marks and the panes travel (moderate,
  // critically damped, so a growing band lands exactly on the cell edge), the
  // mark under the pointer chases it (fast — any slower and it reads as
  // lagging behind the mouse), and text swaps fade.
  const travel = reduceMotion ? { duration: 0 } : spring.moderate;
  const chase = reduceMotion ? { duration: 0 } : spring.fast;
  const fade = reduceMotion ? { duration: 0 } : spring.fast;

  const uid = useId();
  const titleId = `${uid}-title`;

  const today = useMemo(() => startOfDay(new Date()), []);
  const min = minDate === null ? null : startOfDay(minDate ?? today);
  const max = maxDate ? startOfDay(maxDate) : null;

  const [uncontrolled, setUncontrolled] = useState<DateRange>(
    defaultValue ?? EMPTY_RANGE
  );
  const range = value ?? uncontrolled;

  const commit = useCallback(
    (next: DateRange) => {
      if (value === undefined) setUncontrolled(next);
      onValueChange?.(next);
    },
    [value, onValueChange]
  );

  /* Which field the next click fills — and, when there's an hour to pick, what
     the plane is showing. It's state and not a derivation of the value because
     clicking CHECK-IN on a finished range has to re-open that end without
     throwing the other one away. */
  const [field, setField] = useState<"start" | "end">(
    mode === "range" && range.start && !range.end ? "end" : "start"
  );
  const [hovered, setHovered] = useState<Date | null>(null);

  /* Whether the hour has been answered. Derived where it can be —a value with
     an hour on it was answered by whoever passed it— plus a flag for the one
     case the derivation can't see: picking midnight on purpose. */
  const [timeTouched, setTimeTouched] = useState(false);
  const hasTime =
    !!range.start && (timeTouched || minutesOf(range.start) !== 0);

  const [month, setMonth] = useState(() =>
    startOfMonth(defaultMonth ?? range.start ?? today)
  );
  const shownMonth = monthProp ? startOfMonth(monthProp) : month;
  // Which way the next month change slides. A ref and not state: it's read
  // during the render the change causes, and it never needs one of its own.
  const direction = useRef(1);

  const goToMonth = useCallback(
    (next: Date) => {
      const target = startOfMonth(next);
      if (sameMonth(target, shownMonth)) return;
      direction.current = target > shownMonth ? 1 : -1;
      if (monthProp === undefined) setMonth(target);
      onMonthChange?.(target);
    },
    [shownMonth, monthProp, onMonthChange]
  );

  const isDisabled = useCallback(
    (day: Date) => (!!min && day < min) || (!!max && day > max),
    [min, max]
  );

  /* The range as drawn, which is not always the range as committed: while the
     check-out is open, the hovered day stands in for it. Single-day faces have
     nothing to preview — there's no second end to reach. See decision 3. */
  const previewEnd =
    mode === "single"
      ? null
      : (range.end ??
        (field === "end" &&
        range.start &&
        hovered &&
        !isDisabled(hovered) &&
        nightsBetween(range.start, hovered) > 0
          ? hovered
          : null));

  const select = useCallback(
    (day: Date) => {
      if (isDisabled(day)) return;

      if (mode === "single") {
        // The hour survives a change of day: it was answered separately and
        // moving the day isn't a reason to ask again.
        const next =
          hasTime && range.start ? atMinutes(day, minutesOf(range.start)) : day;
        commit({ start: next, end: null });
        if (withTime) setField("end");
        return;
      }

      const { start, end } = range;
      // A click with the check-in open —or with nothing to extend, or on a
      // finished range— starts over. A day at or before the check-in does too:
      // it reads as "actually, from here", not as an invalid check-out.
      if (field === "start" || !start || end || nightsBetween(start, day) <= 0) {
        commit({ start: day, end: null });
        setField("end");
        return;
      }
      commit({ start, end: day });
      setField("start");
    },
    [mode, withTime, hasTime, range, field, commit, isDisabled]
  );

  const selectTime = useCallback(
    (minutes: number) => {
      const day = range.start ?? (min && min > today ? min : today);
      commit({ start: atMinutes(day, minutes), end: null });
      setTimeTouched(true);
    },
    [range.start, min, today, commit]
  );

  const applyPreset = useCallback(
    (preset: CorePreset) => {
      const from = range.start ?? (min && min > today ? min : today);
      const next = preset.range(from);
      // Same rule as picking the day by hand: an hour already answered isn't
      // asked again by a shortcut that only meant to move the day.
      const start =
        next.start && hasTime && range.start
          ? atMinutes(next.start, minutesOf(range.start))
          : next.start;
      commit({ ...next, start });
      setField(withTime ? "end" : "start");
      setHovered(null);
      if (start) goToMonth(start);
    },
    [range.start, hasTime, withTime, min, today, commit, goToMonth]
  );

  const clear = useCallback(() => {
    commit(EMPTY_RANGE);
    setField("start");
    setTimeTouched(false);
    setHovered(null);
  }, [commit]);

  /* ── Keyboard ──────────────────────────────────────────────────────────
     One tab stop for the whole grid —the focused day— and the arrows move
     inside it, which is what `role="grid"` promises. Crossing a month edge
     pages the month instead of stopping at it. */
  const [focusDay, setFocusDay] = useState<Date | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const wantsFocus = useRef(false);

  const tabbableDay = useMemo(() => {
    if (focusDay && sameMonth(focusDay, shownMonth)) return focusDay;
    if (range.start && sameMonth(range.start, shownMonth)) return range.start;
    if (sameMonth(today, shownMonth)) return today;
    return startOfMonth(shownMonth);
  }, [focusDay, shownMonth, range.start, today]);

  useEffect(() => {
    if (!wantsFocus.current) return;
    wantsFocus.current = false;
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-day="${dayKey(tabbableDay)}"]`)
      ?.focus();
  }, [tabbableDay]);

  const moveFocus = useCallback(
    (next: Date) => {
      wantsFocus.current = true;
      setFocusDay(next);
      if (!sameMonth(next, shownMonth)) goToMonth(next);
    },
    [shownMonth, goToMonth]
  );

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = tabbableDay;
    const jump: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };

    if (event.key in jump) {
      event.preventDefault();
      moveFocus(addDays(from, jump[event.key]));
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const offset = (from.getDay() - weekStartsOn + 7) % 7;
      moveFocus(addDays(from, event.key === "Home" ? -offset : 6 - offset));
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      moveFocus(addMonths(from, event.key === "PageUp" ? -1 : 1));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(from);
    }
  };

  /* ── Formatting ────────────────────────────────────────────────────────
     `Intl` and not a table of month names: the locale belongs to whoever uses
     this, and a table is a translation file nobody remembers to update. */
  const monthName = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long" }).format(shownMonth),
    [locale, shownMonth]
  );
  const dayFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        // A stay is read as two ends of the same month and doesn't need the
        // weekday; a single day usually is a weekday — "Saturday the 5th" is
        // how anyone says it out loud.
        ...(mode === "single" ? { weekday: "short" as const } : null),
        month: "short",
        day: "numeric",
      }),
    [locale, mode]
  );
  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }),
    [locale]
  );
  const fullFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [locale]
  );
  const weekdayFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "long" }),
    [locale]
  );
  const weekdays = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, {
      weekday: "narrow",
      timeZone: "UTC",
    });
    // 2024-01-07 was a Sunday, so `weekStartsOn` indexes straight off it.
    return Array.from({ length: 7 }, (_, i) =>
      format.format(new Date(Date.UTC(2024, 0, 7 + ((weekStartsOn + i) % 7))))
    );
  }, [locale, weekStartsOn]);

  const formatMinutes = useCallback(
    (minutes: number) => timeFormat.format(atMinutes(today, minutes)),
    [timeFormat, today]
  );

  /* Does this locale say the hour in twelve or in twenty-four? It's asked, not
     assumed: the twelve-hour columns —and the AM/PM one next to them— are the
     right shape where the clock has two halves and the wrong one where it
     doesn't. `Intl` already knows, so nobody has to pass a prop. */
  const hour12 = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions()
        .hour12 ?? false,
    [locale]
  );

  /* One time, taken apart into the three things the columns ask for. Through
     `formatToParts` and not by hand: "9", "05" and "AM" are all locale
     business —a. m., 21, ٩— and this is the only way to get each piece the way
     the locale would have written it. */
  /** A two-digit number in the locale's own digits. The clock's columns are
   *  written this way —"00", "09", "45"— because a column of numbers that
   *  changes width as it scrolls reads as jittering, and because a clock is
   *  written with two digits everywhere it's written. */
  const twoDigit = useMemo(() => {
    const format = new Intl.NumberFormat(locale, {
      minimumIntegerDigits: 2,
      useGrouping: false,
    });
    return (value: number) => format.format(value);
  }, [locale]);

  const timeParts = useCallback(
    (minutes: number) => {
      const parts = new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
        hour12,
      }).formatToParts(atMinutes(today, minutes));
      const part = (type: string) =>
        parts.find((p) => p.type === type)?.value ?? "";
      return {
        hour: part("hour"),
        minute: part("minute"),
        meridiem: part("dayPeriod"),
      };
    },
    [locale, hour12, today]
  );

  const weeks = useMemo(
    () => monthWeeks(shownMonth, weekStartsOn),
    [shownMonth, weekStartsOn]
  );

  const cell = compact ? 32 : 40;
  const mk = monthKey(shownMonth);
  // How far the incoming month comes in from, signed by the direction of the
  // change. The linter sees a ref read during render; that's the point — the
  // direction is decided by the click that caused this render and is never a
  // reason to render again on its own.
  // oxlint-disable-next-line react/refs
  const slide = reduceMotion ? 0 : direction.current * 28;
  const [paneRef, paneHeight] = useMeasuredHeight<HTMLDivElement>();

  const rangeStart = range.start;
  const rangeEnd = previewEnd;
  const drawn: DateRange = { start: rangeStart, end: rangeEnd };
  const badgeText = badge(drawn, {
    today,
    weekday: (d) => weekdayFormat.format(d),
  });

  /* The hours live to the right of the month, and the second field is the way
     over. Nothing else switches panes: see decision 7. */
  const pane = withTime && field === "end" && range.start ? "times" : "days";
  const paneSlide = reduceMotion ? 0 : 32;

  const activePreset =
    presets === false
      ? null
      : (presets.find((preset) => {
          const from = range.start ?? today;
          const candidate = preset.range(from);
          return (
            sameDay(candidate.start, range.start) &&
            sameDay(candidate.end, range.end)
          );
        }) ?? null);

  /* The fields, which are one, two or two-with-an-hour depending on the face.
     Same row, same hairline, same travelling underline in all three. */
  const slots: {
    id: "start" | "end";
    label: string;
    text: string;
    filled: boolean;
    enabled: boolean;
  }[] =
    mode === "range"
      ? [
          {
            id: "start",
            label: startLabel,
            text: range.start ? dayFormat.format(range.start) : placeholder,
            filled: !!range.start,
            enabled: true,
          },
          {
            id: "end",
            label: endLabel,
            text: range.end ? dayFormat.format(range.end) : placeholder,
            filled: !!range.end,
            enabled: true,
          },
        ]
      : [
          {
            id: "start",
            label: startLabel,
            text: range.start ? dayFormat.format(range.start) : placeholder,
            filled: !!range.start,
            enabled: true,
          },
          ...(withTime
            ? ([
                {
                  id: "end" as const,
                  label: endLabel,
                  text:
                    hasTime && range.start
                      ? formatMinutes(minutesOf(range.start))
                      : timePlaceholder,
                  filled: hasTime,
                  // Nothing to put an hour on until there's a day.
                  enabled: !!range.start,
                },
              ])
            : []),
        ];

  // The time field is how the hours are reached, so it can't be turned off.
  const showFields = fields || withTime;

  return (
    <Elevated
      offset={CARD_RISE}
      className={cn("flex w-full max-w-md flex-col", shape.container, className)}
    >
      {(title || badgeText) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
          {title && (
            <h3
              id={titleId}
              className="font-medium tracking-tight"
              style={{ fontSize: type.title }}
            >
              {title}
            </h3>
          )}

          {/* The counter. It enters and leaves with the answer, and swaps its
              text in place while the answer changes — the pill doesn't
              re-enter every time a night is added. */}
          <AnimatePresence initial={false}>
            {badgeText && (
              <motion.span
                key="count"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92, transition: fade }}
                transition={chase}
                aria-live="polite"
                className={cn(
                  "ml-auto inline-flex items-center overflow-hidden font-medium whitespace-nowrap",
                  compact ? "h-5 px-2" : "h-6 px-2.5",
                  shape.item
                )}
                style={{
                  fontSize: type.caption,
                  color: ACCENT,
                  background: ACCENT_TINT,
                }}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={badgeText}
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 10, opacity: 0 }}
                    transition={chase}
                  >
                    {badgeText}
                  </motion.span>
                </AnimatePresence>
              </motion.span>
            )}
          </AnimatePresence>
        </header>
      )}

      {/* The month's plane. Everything you point at lives in here. */}
      <Elevated
        offset={MONTH_RISE}
        className={cn(
          "mx-1 flex flex-col",
          // The card's own padding only exists where there's something above or
          // below the plane; without a header or a foot the margin has to come
          // from here, or the plane sits flush against the card's edge.
          !title && !showFields && "mt-1",
          presets === false && "mb-1",
          shape.container
        )}
      >
        {showFields && (
          <div
            className={cn(
              "relative grid",
              slots.length === 2 ? "grid-cols-2" : "grid-cols-1"
            )}
          >
            {/* The hairline between the two fields, inset so it reads as a
                separator and not as a border of either one. */}
            {slots.length === 2 && (
              <span
                aria-hidden
                className="absolute inset-y-3 left-1/2 w-px bg-border"
              />
            )}
            {slots.map((slot) => {
              const active = field === slot.id;
              return (
                <button
                  key={slot.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setField(slot.enabled ? slot.id : "start")}
                  className={cn(
                    "flex cursor-pointer flex-col items-start gap-1 rounded-lg px-4 pt-4 pb-3 text-left outline-none",
                    "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
                  )}
                >
                  <span
                    className="font-medium tracking-[0.08em] text-muted-foreground uppercase"
                    style={{ fontSize: type.caption }}
                  >
                    {slot.label}
                  </span>

                  <span className="relative inline-flex flex-col">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={slot.text}
                        initial={{ y: -8, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 8, opacity: 0 }}
                        transition={chase}
                        className={cn(
                          "font-medium whitespace-nowrap",
                          !slot.filled && "text-muted-foreground"
                        )}
                        style={{ fontSize: type.title }}
                      >
                        {slot.text}
                      </motion.span>
                    </AnimatePresence>

                    {/* The underline is one object that moves between the
                        fields, and it takes the width of whatever it lands
                        under — which is why it's inside the text's box and not
                        drawn across the field. */}
                    {active && (
                      <motion.span
                        layoutId={`${uid}-field-underline`}
                        transition={travel}
                        className="mt-1 h-[2px] w-full rounded-full"
                        style={{ background: ACCENT }}
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className={cn("px-4 pb-3", showFields ? "pt-3" : "pt-4")}>
          {showFields && <div className="mb-3 h-px bg-border" />}

          {/* The plane's line. It says what the body under it is: the month
              when that's a grid, the chosen day when that's the hour. */}
          <div className="flex h-8 items-center justify-between gap-2 px-1">
            <div className="flex items-baseline gap-1.5 overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                {pane === "days" ? (
                  <motion.span
                    key={mk}
                    initial={{ y: reduceMotion ? 0 : 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: reduceMotion ? 0 : -12, opacity: 0 }}
                    transition={travel}
                    className="flex items-baseline gap-1.5"
                  >
                    <span
                      className="font-medium tracking-tight capitalize"
                      style={{ fontSize: type.title }}
                    >
                      {monthName}
                    </span>
                    <span
                      className="text-muted-foreground tabular-nums"
                      style={{ fontSize: type.title }}
                    >
                      {shownMonth.getFullYear()}
                    </span>
                  </motion.span>
                ) : (
                  <motion.span
                    key="times"
                    initial={{ y: reduceMotion ? 0 : 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: reduceMotion ? 0 : -12, opacity: 0 }}
                    transition={travel}
                    className="truncate font-medium tracking-tight"
                    style={{ fontSize: type.title }}
                  >
                    {range.start && fullFormat.format(range.start)}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* The arrows belong to the month, so they leave with it. */}
            <AnimatePresence initial={false}>
              {pane === "days" && (
                <motion.div
                  key="nav"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: fade }}
                  transition={chase}
                  className="flex shrink-0 items-center"
                >
                  <Button
                    variant="ghost"
                    size="icon-compact"
                    aria-label="Previous month"
                    onClick={() => goToMonth(addMonths(shownMonth, -1))}
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-compact"
                    aria-label="Next month"
                    onClick={() => goToMonth(addMonths(shownMonth, 1))}
                  >
                    <ChevronRight />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* The body travels to the measured height of whatever comes in —
              see decision 6. */}
          <motion.div
            animate={{ height: paneHeight ?? "auto" }}
            transition={travel}
            className="relative overflow-hidden"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {pane === "days" ? (
                <motion.div
                  key="days"
                  ref={paneRef}
                  initial={{ opacity: 0, x: -paneSlide }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -paneSlide }}
                  transition={travel}
                >
                  <div
                    ref={gridRef}
                    role="grid"
                    aria-labelledby={title ? titleId : undefined}
                    aria-label={title ? undefined : "Calendar"}
                    onKeyDown={onGridKeyDown}
                    onPointerLeave={() => setHovered(null)}
                  >
                    <div role="row" className="grid grid-cols-7">
                      {weekdays.map((label, i) => (
                        <span
                          key={i}
                          role="columnheader"
                          aria-label={label}
                          className="flex h-8 items-center justify-center text-muted-foreground"
                          style={{ fontSize: type.caption }}
                        >
                          {label}
                        </span>
                      ))}
                    </div>

                    {/* The month's own crossover, inside the pane's: the
                        weekday letters don't slide with it because the columns
                        don't change. */}
                    <div className="relative">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.div
                          key={mk}
                          initial={{ opacity: 0, x: slide }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -slide }}
                          transition={travel}
                        >
                          {weeks.map((week, wi) => {
                            const band = bandFor(week, rangeStart, rangeEnd);
                            return (
                              <div
                                key={wi}
                                role="row"
                                className="relative grid grid-cols-7"
                                style={{ height: cell }}
                              >
                                <AnimatePresence initial={false}>
                                  {band && (
                                    <motion.div
                                      key="band"
                                      initial={{
                                        opacity: 0,
                                        left: `${(band.anchor * 100) / 7}%`,
                                        width: `${100 / 7}%`,
                                      }}
                                      animate={{
                                        opacity: 1,
                                        left: `${(band.from * 100) / 7}%`,
                                        width: `${((band.to - band.from) * 100) / 7}%`,
                                      }}
                                      exit={{ opacity: 0, transition: fade }}
                                      transition={travel}
                                      className="pointer-events-none absolute inset-y-0 rounded-full"
                                      style={{ background: ACCENT_TINT }}
                                    />
                                  )}
                                </AnimatePresence>

                                {week.map((day, di) =>
                                  day ? (
                                    <DayCell
                                      key={dayKey(day)}
                                      day={day}
                                      size={cell}
                                      fontSize={type.subtitle}
                                      label={fullFormat.format(day)}
                                      disabled={isDisabled(day)}
                                      isToday={sameDay(day, today)}
                                      isStart={sameDay(day, rangeStart)}
                                      isEnd={sameDay(day, range.end)}
                                      isPreviewEnd={sameDay(day, rangeEnd)}
                                      inRange={
                                        !!rangeStart &&
                                        !!rangeEnd &&
                                        day > rangeStart &&
                                        day < rangeEnd
                                      }
                                      isHovered={sameDay(day, hovered)}
                                      tabbable={sameDay(day, tabbableDay)}
                                      markId={`${uid}-${mk}`}
                                      travel={travel}
                                      chase={chase}
                                      onSelect={select}
                                      onHover={setHovered}
                                    />
                                  ) : (
                                    <span key={`blank-${di}`} role="gridcell" />
                                  )
                                )}
                              </div>
                            );
                          })}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="times"
                  ref={paneRef}
                  initial={{ opacity: 0, x: paneSlide }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: paneSlide }}
                  transition={travel}
                >
                  <TimeColumns
                    times={times}
                    selected={hasTime && range.start ? minutesOf(range.start) : null}
                    parts={timeParts}
                    twoDigit={twoDigit}
                    hourLabel={hourLabel}
                    minuteLabel={minuteLabel}
                    headingSize={type.caption}
                    hour12={hour12}
                    height={cell * 6 + 32}
                    rowHeight={compact ? 28 : 32}
                    fontSize={type.body}
                    radius={shape.button}
                    markId={`${uid}-time`}
                    travel={travel}
                    chase={chase}
                    onSelect={selectTime}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </Elevated>

      {presets !== false && (
        <footer className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-4">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              variant="tertiary"
              size="compact"
              active={preset === activePreset}
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </Button>
          ))}

          {/* Clear only exists once there's something to clear: an always-on
              control for the empty state is a button that does nothing. */}
          <AnimatePresence initial={false}>
            {(range.start || range.end) && (
              <motion.div
                key="clear"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: fade }}
                transition={chase}
                className="ml-auto"
              >
                <Button variant="ghost" size="compact" onClick={clear}>
                  {clearLabel}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </footer>
      )}
    </Elevated>
  );
}

/**
 * The band's geometry for one week row, in columns: `[from, to)` plus the
 * column it grows out of when it first appears.
 *
 * The anchor is the check-in's column when this row holds it, and the row's
 * leading edge otherwise — a range spilling into a second week grows from the
 * left there, which is the direction it's coming from.
 */
function bandFor(
  week: (Date | null)[],
  start: Date | null,
  end: Date | null
): { from: number; to: number; anchor: number } | null {
  if (!start || !end) return null;

  let from = -1;
  let to = -1;
  week.forEach((day, i) => {
    if (!day || day < start || day > end) return;
    if (from === -1) from = i;
    to = i + 1;
  });
  if (from === -1 || to - from < 1) return null;

  const startColumn = week.findIndex((day) => sameDay(day, start));
  return { from, to, anchor: startColumn === -1 ? from : startColumn };
}

/* ── One day ───────────────────────────────────────────────────────────── */

interface DayCellProps {
  day: Date;
  size: number;
  fontSize: number;
  label: string;
  disabled: boolean;
  isToday: boolean;
  isStart: boolean;
  isEnd: boolean;
  /** The end the range would have if the pointer —or the keyboard— stopped
   *  here. It isn't drawn as an endpoint, but it is part of what's selected:
   *  the span a screen reader reads has to be the span on screen. */
  isPreviewEnd: boolean;
  inRange: boolean;
  isHovered: boolean;
  tabbable: boolean;
  /** Prefix for the two travelling marks, already scoped to the instance and
   *  the month — see decision 4. */
  markId: string;
  travel: object;
  chase: object;
  onSelect: (day: Date) => void;
  onHover: (day: Date | null) => void;
}

function DayCell({
  day,
  size,
  fontSize,
  label,
  disabled,
  isToday,
  isStart,
  isEnd,
  isPreviewEnd,
  inRange,
  isHovered,
  tabbable,
  markId,
  travel,
  chase,
  onSelect,
  onHover,
}: DayCellProps) {
  const endpoint = isStart || isEnd;

  return (
    <button
      type="button"
      role="gridcell"
      data-day={dayKey(day)}
      aria-label={label}
      aria-selected={endpoint || inRange || isPreviewEnd}
      aria-current={isToday ? "date" : undefined}
      disabled={disabled}
      tabIndex={tabbable ? 0 : -1}
      onClick={() => onSelect(day)}
      onPointerEnter={() => !disabled && onHover(day)}
      onFocus={() => !disabled && onHover(day)}
      className={cn(
        "relative flex items-center justify-center rounded-full outline-none",
        "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
        disabled ? "cursor-default text-muted-foreground/50" : "cursor-pointer"
      )}
    >
      {/* The neutral circle under the pointer. One element for the whole grid
          —same `layoutId` in every cell— so it slides from day to day. It
          isn't drawn on an endpoint: the filled circle is already there. */}
      {isHovered && !endpoint && !disabled && (
        <motion.span
          layoutId={`${markId}-hover`}
          transition={chase}
          className="absolute rounded-full bg-hover"
          style={{ width: size, height: size }}
        />
      )}

      {/* The endpoints. Two ids, one per role, so moving the check-in glides
          it there instead of it jumping. */}
      {endpoint && (
        <motion.span
          layoutId={`${markId}-${isStart ? "start" : "end"}`}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={travel}
          className="absolute rounded-full"
          style={{ width: size, height: size, background: ACCENT }}
        />
      )}

      <span
        className={cn(
          "relative tabular-nums transition-colors duration-80",
          endpoint && "font-medium text-white",
          !endpoint && inRange && "font-medium"
        )}
        style={{
          fontSize,
          color: endpoint ? undefined : inRange ? ACCENT : undefined,
        }}
      >
        {day.getDate()}
      </span>

      {/* Today, when it isn't already being said with a circle. */}
      {isToday && !endpoint && (
        <span
          aria-hidden
          className="absolute bottom-1 size-1 rounded-full bg-muted-foreground"
        />
      )}
    </button>
  );
}

/* ── The hours ─────────────────────────────────────────────────────────── */

interface TimeColumnsProps {
  /** The times that can be picked, in minutes from midnight, in order. The
   *  columns show the whole clock whatever this says; what isn't in here is
   *  greyed, the same way a day outside `minDate` stays in the month. */
  times: number[];
  selected: number | null;
  parts: (minutes: number) => { hour: string; minute: string; meridiem: string };
  twoDigit: (value: number) => string;
  hourLabel: string;
  minuteLabel: string;
  headingSize: number;
  hour12: boolean;
  /** The columns' height. It's about the month's height on purpose: the plane
   *  grows and shrinks a little between the two panes, not a lot. */
  height: number;
  rowHeight: number;
  fontSize: number;
  radius: string;
  markId: string;
  travel: object;
  chase: object;
  onSelect: (minutes: number) => void;
}

type Meridiem = "am" | "pm";

const meridiemOf = (minutes: number): Meridiem => (minutes >= 720 ? "pm" : "am");

/**
 * The hours: a column of hours, one of minutes and, where the clock has two
 * halves, one of AM/PM.
 *
 * Four decisions:
 *
 * 1. **The whole clock is on screen, and what can't be picked is greyed.**
 *    Hours run 00 to 12 and minutes 00 to 59 whatever `times` says — the same
 *    deal the month makes with `minDate`, which shows every day of the month
 *    and greys the ones that are gone. A column that only listed what's
 *    available would keep changing length as the other columns move, and the
 *    place you were about to click would be somewhere else.
 *
 * 2. **00 and 12 aren't the same row twice.** On a twelve-hour clock midnight
 *    is `00` and noon is `12`, so `12` is greyed while AM is showing and `00`
 *    is greyed while PM is. That's one row per hour of the day and no pair of
 *    rows meaning the same moment — which is the thing a 12-hour column
 *    usually gets wrong.
 *
 * 3. **Every click commits a whole time.** There's no half-answer sitting in
 *    the columns waiting for an OK: changing the hour keeps the minutes where
 *    they were, and if that exact time isn't offered it takes the nearest one
 *    that hour does offer. That's what lets the field above fill in as you go,
 *    and it's why there's no third state to keep in sync.
 *
 * 4. **Same two marks as the grid.** The accent fill travels inside its column
 *    and the neutral one chases the pointer, so the second half of the answer
 *    is given exactly the way the first half was. The marks are per column:
 *    one flying from the hours to the minutes would be one object claiming to
 *    be two things.
 */
function TimeColumns({
  times,
  selected,
  parts,
  twoDigit,
  hourLabel,
  minuteLabel,
  headingSize,
  hour12,
  height,
  rowHeight,
  fontSize,
  radius,
  markId,
  travel,
  chase,
  onSelect,
}: TimeColumnsProps) {
  if (times.length === 0) return null;

  // Looked up once and read per row: the columns ask about ~75 rows on every
  // render, and a picker with every minute of the day offers 1440 times.
  const allowed = new Set(times);
  const hoursOffered = new Set(times.map((t) => Math.floor(t / 60)));
  const halvesOffered = new Set(times.map(meridiemOf));

  // What the columns are standing on. Before anything is picked that's the
  // first time offered — the position the columns open at — but nothing is
  // painted as chosen: the field above still says "Add time".
  const base = selected ?? times[0];
  const baseHour = Math.floor(base / 60);
  const baseMinute = base % 60;
  const half = meridiemOf(base);

  /** The hour a row stands for, given the half of the day showing. `null` when
   *  the pair doesn't name an hour — see decision 2. */
  const hourOf = (row: number): number | null => {
    if (!hour12) return row;
    if (half === "am") return row === 12 ? null : row;
    return row === 12 ? 12 : row === 0 ? null : row + 12;
  };

  /** The inverse: which row an hour of the day sits on. */
  const rowOf = (hour: number) =>
    !hour12 ? hour : hour === 12 ? 12 : hour % 12;

  const pickHour = (row: number) => {
    const hour = hourOf(row);
    if (hour === null) return;
    // The minutes come along, and settle for the nearest the hour offers —
    // decision 3.
    const keeping = hour * 60 + baseMinute;
    if (allowed.has(keeping)) return onSelect(keeping);
    const nearest = times.find((t) => Math.floor(t / 60) === hour);
    if (nearest !== undefined) onSelect(nearest);
  };

  const pickMinute = (minute: number) => {
    const next = baseHour * 60 + minute;
    if (allowed.has(next)) onSelect(next);
  };

  const pickHalf = (row: number) => {
    const meridiem: Meridiem = row === 1 ? "pm" : "am";
    // The same hour on the other half of the clock. Noon's mirror is midnight
    // and not twelve, which `% 12` already says.
    const mirrored = (baseHour % 12) + (meridiem === "pm" ? 12 : 0);
    const keeping = mirrored * 60 + baseMinute;
    if (allowed.has(keeping)) return onSelect(keeping);
    const sameHour = times.find((t) => Math.floor(t / 60) === mirrored);
    if (sameHour !== undefined) return onSelect(sameHour);
    const anyThere = times.find((t) => meridiemOf(t) === meridiem);
    if (anyThere !== undefined) onSelect(anyThere);
  };

  // Left and right move between columns. It's done on the DOM and not with a
  // piece of state because the answer is "the tab stop of the column next
  // door", and each column already knows which of its rows that is.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const column = (event.target as HTMLElement).closest("[data-column]");
    const group = event.currentTarget;
    if (!column) return;
    const index = Number(column.getAttribute("data-column"));
    const next = group.querySelector<HTMLElement>(
      `[data-column="${index + (event.key === "ArrowRight" ? 1 : -1)}"]`
    );
    const stop = next?.querySelector<HTMLButtonElement>('[tabindex="0"]');
    if (!stop) return;
    event.preventDefault();
    stop.focus();
  };

  const shared = { height, rowHeight, fontSize, radius, travel, chase };

  /* The caption over a column. It's outside the scroller —a heading that
     scrolled away with its own column would be a heading for nothing— and it
     carries the hairline down from the top so the separator is one line and
     not two. Same words in the same case as the fields above: this is the same
     question asked one level in. */
  const heading = (text: string, column: number) => (
    <span
      key={`heading-${column}`}
      className={cn(
        "flex h-6 items-center justify-center font-medium tracking-[0.08em] text-muted-foreground uppercase",
        column > 0 && "border-l border-border"
      )}
      style={{ fontSize: headingSize }}
      aria-hidden
    >
      {text}
    </span>
  );

  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: `repeat(${hour12 ? 3 : 2}, 1fr)` }}
      onKeyDown={onKeyDown}
    >
      {heading(hourLabel, 0)}
      {heading(minuteLabel, 1)}
      {/* The AM/PM column says what it is in its own two rows. */}
      {hour12 && heading("", 2)}

      <TimeColumn
        {...shared}
        index={0}
        label="Hour"
        markId={`${markId}-hour`}
        options={Array.from({ length: hour12 ? 13 : 24 }, (_, row) => {
          const hour = hourOf(row);
          return {
            key: row,
            label: twoDigit(row),
            disabled: hour === null || !hoursOffered.has(hour),
          };
        })}
        selected={selected === null ? null : rowOf(baseHour)}
        current={rowOf(baseHour)}
        onPick={pickHour}
      />
      <TimeColumn
        {...shared}
        index={1}
        label="Minutes"
        markId={`${markId}-minute`}
        options={Array.from({ length: 60 }, (_, minute) => ({
          key: minute,
          label: twoDigit(minute),
          disabled: !allowed.has(baseHour * 60 + minute),
        }))}
        selected={selected === null ? null : baseMinute}
        current={baseMinute}
        onPick={pickMinute}
      />
      {hour12 && (
        <TimeColumn
          {...shared}
          index={2}
          label="AM or PM"
          markId={`${markId}-meridiem`}
          options={[0, 1].map((row) => ({
            key: row,
            label: parts(row === 1 ? 720 : 0).meridiem,
            disabled: !halvesOffered.has(row === 1 ? "pm" : "am"),
          }))}
          selected={selected === null ? null : half === "pm" ? 1 : 0}
          current={half === "pm" ? 1 : 0}
          onPick={pickHalf}
        />
      )}
    </div>
  );
}

interface TimeColumnProps {
  index: number;
  label: string;
  options: { key: number; label: string; disabled: boolean }[];
  selected: number | null;
  /** Where the column opens when nothing is chosen yet. */
  current: number;
  onPick: (key: number) => void;
  /** Fixed, and the same for its two neighbours. */
  height: number;
  rowHeight: number;
  fontSize: number;
  radius: string;
  markId: string;
  travel: object;
  chase: object;
}

/** One column of the clock. It scrolls on its own and opens on whatever it's
 *  standing on — which for the minutes is one row out of sixty, so landing
 *  there rather than at the top is the difference between a column you read
 *  and one you have to search. */
function TimeColumn({
  index,
  label,
  options,
  selected,
  current,
  onPick,
  height,
  rowHeight,
  fontSize,
  radius,
  markId,
  travel,
  chase,
}: TimeColumnProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const wantsFocus = useRef(false);

  const tabbable = focused ?? selected ?? current;

  // The row it's standing on is centred when the column opens. Not
  // `scrollIntoView`: that one walks up every scrollable ancestor, so a column
  // opening inside a page that's already scrolled would drag the page with it.
  useEffect(() => {
    const node = scroller.current;
    const mark = node?.querySelector<HTMLElement>('[data-current="true"]');
    if (!node || !mark) return;
    node.scrollTop = mark.offsetTop - node.clientHeight / 2 + mark.clientHeight / 2;
    // Only on open: afterwards the column belongs to whoever is scrolling it.
  }, []);

  useEffect(() => {
    if (!wantsFocus.current) return;
    wantsFocus.current = false;
    scroller.current
      ?.querySelector<HTMLButtonElement>(`[data-option="${tabbable}"]`)
      ?.focus();
  }, [tabbable]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // The activation is taken here and the native one prevented, so an option
    // commits once and not twice — the same thing the grid does with its days.
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const at = options.find((option) => option.key === tabbable);
      if (at && !at.disabled) onPick(at.key);
      return;
    }

    const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!step) return;
    event.preventDefault();
    // Greyed rows are stepped over: the arrows are for getting somewhere, and
    // stopping on a row that can't be picked isn't getting anywhere.
    let at = options.findIndex((option) => option.key === tabbable) + step;
    while (at >= 0 && at < options.length && options[at].disabled) at += step;
    const next = options[at];
    if (!next) return;
    wantsFocus.current = true;
    setFocused(next.key);
  };

  return (
    <div
      ref={scroller}
      data-column={index}
      role="group"
      aria-label={label}
      onKeyDown={onKeyDown}
      onPointerLeave={() => setHovered(null)}
      className={cn(
        "scroll-fade flex flex-col gap-1 overflow-y-auto px-1.5 pt-1 pb-1",
        // A hairline per column but the first, the same separator the two
        // fields use: three columns of numbers with nothing between them read
        // as one grid of unrelated numbers.
        index > 0 && "border-l border-border"
      )}
      style={{ height, ["--scroll-fade-size" as string]: "24px" }}
    >
      {options.map((option) => {
        const isSelected = option.key === selected;
        return (
          <button
            key={option.key}
            type="button"
            data-option={option.key}
            data-current={option.key === current ? "true" : undefined}
            aria-pressed={isSelected}
            disabled={option.disabled}
            tabIndex={option.key === tabbable ? 0 : -1}
            onClick={() => onPick(option.key)}
            onPointerEnter={() => !option.disabled && setHovered(option.key)}
            onFocus={() => !option.disabled && setHovered(option.key)}
            className={cn(
              "relative flex shrink-0 items-center justify-center outline-none",
              "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
              option.disabled
                ? "cursor-default text-muted-foreground/50"
                : "cursor-pointer",
              radius
            )}
            style={{ height: rowHeight }}
          >
            {hovered === option.key && !isSelected && !option.disabled && (
              <motion.span
                layoutId={`${markId}-hover`}
                transition={chase}
                className={cn("absolute inset-0 bg-hover", radius)}
              />
            )}
            {isSelected && (
              <motion.span
                layoutId={`${markId}-selected`}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={travel}
                className={cn("absolute inset-0", radius)}
                style={{ background: ACCENT }}
              />
            )}
            <span
              className={cn(
                "relative tabular-nums transition-colors duration-80",
                isSelected && "font-medium text-white"
              )}
              style={{ fontSize }}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── The three faces ───────────────────────────────────────────────────── */

/** A stay: two ends, the band between them, and a counter of nights. */
function RangeCalendar({
  value,
  defaultValue,
  onValueChange,
  startLabel = "Check-in",
  endLabel = "Check-out",
  placeholder = "Add date",
  presets = DEFAULT_RANGE_PRESETS,
  countLabel = (n) => `${n} ${n === 1 ? "night" : "nights"}`,
  ...rest
}: RangeCalendarProps) {
  return (
    <CalendarCore
      mode="range"
      withTime={false}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      startLabel={startLabel}
      endLabel={endLabel}
      placeholder={placeholder}
      timePlaceholder=""
      hourLabel=""
      minuteLabel=""
      presets={presets}
      badge={(drawn) =>
        drawn.start && drawn.end
          ? countLabel(nightsBetween(drawn.start, drawn.end))
          : null
      }
      times={[]}
      {...rest}
    />
  );
}

/**
 * A day. Same month, same marks, one end — and the counter says what the day
 * *is* rather than how long it lasts, because a single day has no length and
 * "Tomorrow" is the thing you were checking for.
 *
 * With `time` it's `DateTimePicker`: the second field takes the plane over to
 * the hours.
 */
function DatePicker({
  value,
  defaultValue,
  onValueChange,
  label = "Date",
  placeholder = "Add date",
  presets = DEFAULT_DAY_PRESETS,
  dayLabel = defaultDayLabel,
  time = false,
  timeLabel = "Time",
  timePlaceholder = "Add time",
  hourLabel = "Hour",
  minuteLabel = "Min",
  timeStep = 1,
  timeRange = [0, 24 * 60],
  times: timesProp,
  ...rest
}: DatePickerProps) {
  const times = useMemo(() => {
    if (timesProp) return timesProp;
    const [from, to] = timeRange;
    const out: number[] = [];
    for (let m = from; m < to; m += timeStep) out.push(m);
    return out;
  }, [timesProp, timeRange, timeStep]);

  // The core answers in ranges; a day is a range with one end. Normalizing
  // here —and not with a second implementation— is what keeps the two faces
  // from drifting.
  const asRange = useMemo(
    () => (value === undefined ? undefined : { start: value, end: null }),
    [value]
  );
  const defaultAsRange = useMemo(
    () =>
      defaultValue === undefined ? undefined : { start: defaultValue, end: null },
    [defaultValue]
  );
  const corePresets = useMemo(
    () =>
      presets === false
        ? (false as const)
        : presets.map((preset) => ({
            label: preset.label,
            range: (from: Date) => ({ start: preset.date(from), end: null }),
          })),
    [presets]
  );

  return (
    <CalendarCore
      mode="single"
      withTime={time}
      value={asRange}
      defaultValue={defaultAsRange}
      onValueChange={(next) => onValueChange?.(next.start)}
      startLabel={label}
      endLabel={timeLabel}
      placeholder={placeholder}
      timePlaceholder={timePlaceholder}
      hourLabel={hourLabel}
      minuteLabel={minuteLabel}
      presets={corePresets}
      badge={(drawn, ctx) =>
        drawn.start ? dayLabel(drawn.start, ctx.today, ctx.weekday) : null
      }
      times={times}
      {...rest}
    />
  );
}

/** A moment: the day and the hour, in one `Date`. `DatePicker` with `time` on,
 *  named because that's how it's asked for. */
function DateTimePicker(props: Omit<DatePickerProps, "time">) {
  return <DatePicker time {...props} />;
}

export { RangeCalendar, DatePicker, DateTimePicker };
// The default presets ship with the components and not from a separate file:
// they're the answer to "what does this calendar count in" —nights from a
// Friday, a day from today— and reading them next to the grid they fill is the
// whole point.
// oxlint-disable-next-line react/only-export-components
export { DEFAULT_RANGE_PRESETS as defaultRangePresets, DEFAULT_DAY_PRESETS as defaultDayPresets };
export type {
  RangeCalendarProps,
  DatePickerProps,
  RangePreset,
  DayPreset,
  DateRange,
};
