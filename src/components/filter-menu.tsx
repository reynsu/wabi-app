"use client";

/**
 * FilterMenu — the filter menu of a data view.
 *
 * A button opens the list of attributes you can filter by; picking one slides
 * the same panel across to that attribute's values. Two levels inside one panel
 * and not a side submenu: a submenu forces you to cross it diagonally without
 * slipping off, and with eight attributes it no longer fits beside the first
 * one. Here the panel stays put on its anchor and what travels is the content.
 *
 * Four decisions worth not undoing without looking at the rest:
 *
 * 1. **The search box doesn't unmount when the level changes.** It's the same
 *    `<input>` in both: the placeholder and the text change, but the node is
 *    the same, so focus isn't lost going in or coming back. You can filter,
 *    step in and keep typing without touching the mouse or refocusing.
 *
 * 2. **Focus stays in the search box; what moves is a highlight.** The rows
 *    aren't focusable: the field is a `combobox` and points at the active row
 *    with `aria-activedescendant`. If focus travelled row by row, every arrow
 *    would pull it out of the field being typed into.
 *
 * 3. **Picking a value doesn't close the panel.** A filter is almost never a
 *    single one: you tick two statuses and three companies in one sitting. The
 *    panel closes with Escape, with a click outside or with the ×. The
 *    exception is a `single` attribute, where after picking there's nothing
 *    left to do in there, which is why it returns to the first level on its
 *    own.
 *
 * 4. **The right-hand column says what happens if you activate the row.** On
 *    the first level a chevron, which promises another level; on the second a
 *    tick, which promises a value set. It's the same column in both, so the
 *    promise is read without changing line.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Popover } from "@base-ui/react/popover";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Plus,
  Search,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProximityHover } from "@/hooks/use-proximity-hover";
import { Elevated } from "@/lib/elevated";
import type { IconComponent } from "@/lib/icon-context";
import { shapeMap } from "@/lib/shape-context";
import {
  SizeProvider,
  useSize,
  useSizeVariant,
  useTypeScale,
  type SizeVariant,
} from "@/lib/size-context";
import { exitFallbackMs, spring } from "@/lib/springs";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

interface FilterOption {
  value: string;
  label: string;
  /** The value's icon. Statuses and labels usually have one of their own. */
  icon?: IconComponent;
  /** Secondary text to the right of the name: how many records that value has,
   *  where it comes from, whatever helps you choose without leaving the
   *  panel. */
  hint?: string;
}

interface FilterAttribute {
  id: string;
  label: string;
  icon: IconComponent;
  /**
   * How the value is picked.
   *   "select" — from a closed list of `options` (default)
   *   "text"   — free text: whatever is typed into the search box is added as a
   *              term with Enter. Names and descriptions have no list.
   */
  type?: "select" | "text";
  /** The attribute's values, for `type: "select"`. */
  options?: FilterOption[];
  /** One value at a time. Picking one replaces the previous and returns to the
   *  first level. */
  single?: boolean;
  /** Placeholder for the search box inside this attribute. Without it one is
   *  built from the label. */
  searchPlaceholder?: string;
}

interface FilterGroup {
  label: string;
  attributes: FilterAttribute[];
}

/**
 * What's filtered: attribute id → chosen values.
 *
 * An attribute with no values **isn't in the map**, never as an empty array.
 * That way `Object.keys(selection).length` is the number of filtered attributes
 * and nobody has to remember to drop the empties when counting or when painting
 * the chips outside.
 */
type FilterSelection = Record<string, string[]>;

interface FilterMenuProps {
  groups: FilterGroup[];
  /** The button's label and the panel's accessible name. */
  label?: string;
  /** Drops the word from the button and leaves the glyph. The label doesn't go
   *  away —it becomes the button's `aria-label`— so what changes is what's
   *  drawn, not what the button says it is.
   *
   *  For toolbars where the word is dead weight: a header that already has a
   *  search field and another icon button next to it, and where the filter
   *  funnel is the only glyph that means "narrow this down". The counter stays
   *  when something is filtered — that's the whole reason it exists, and
   *  without it there'd be no way to tell a filtered list from a full one. */
  labelHidden?: boolean;
  value?: FilterSelection;
  defaultValue?: FilterSelection;
  onValueChange?: (value: FilterSelection) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Pins the panel and the button to a step of the size ladder. Without this
   *  they follow the surrounding SizeProvider. */
  size?: SizeVariant;
  /** Which side of the button the panel aligns to. */
  align?: "start" | "end";
  /** How loud the button is in the toolbar it lives in. The panel is the same
   *  either way; what changes is whether the trigger reads as a quiet control
   *  —the default— or as a filled one next to other filled controls. */
  variant?: "primary" | "secondary" | "tertiary" | "ghost";
  /** Goes on the button, which is the only thing this component leaves in the
   *  layout. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Shape and measurements
// ---------------------------------------------------------------------------

/* Like the registry's `dropdown`, the panel steps off the shape system and
   stays on the `rounded` radii for good. At this scale the pill shape's
   bulging distorts the padding you perceive and unbalances the corners'
   shadow; a popover reads better with the small radius even if the rest of the
   app is rounded. */
const shape = shapeMap.rounded;

/** The panel's width. Fixed and tied neither to the button nor to the density:
 *  the button says one word and the list has to make room for labels like
 *  "Email addresses". */
const PANEL_WIDTH = 288;

/** The panel's air: between the edge and the search box, the rows and the
 *  footer. */
const PANEL_PAD = 6;

/** How many rows are visible before the list scrolls. The height comes from
 *  multiplying by the ladder's step, so in compact you see the same seven rows
 *  and not seven and a half. */
const VISIBLE_ROWS = 7;

/** How far a view shifts on the way in and on the way out. Short on purpose:
 *  it's a change of level inside the same panel, not a change of screen. */
const VIEW_TRAVEL = 18;

const viewVariants = {
  enter: (direction: number) => ({ x: direction * VIEW_TRAVEL, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  // The outgoing view leaves the flow as soon as it starts to go, so the
  // frame's height becomes the incoming one's and the two sit on top of each
  // other instead of stacked.
  //
  // And it leaves with the fast step's exit, not the moderate one's: while the
  // crossover lasts there are two copies of the attribute's name —the one on
  // the row that's leaving and the one travelling to the header— on top of each
  // other. The sooner the bottom one goes out, the cleaner the trip reads.
  exit: (direction: number) => ({
    x: direction * -VIEW_TRAVEL,
    opacity: 0,
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    transition: spring.fast.exit,
  }),
} satisfies Variants;

/**
 * The attribute's name doesn't appear in the header: it flies in from its row.
 *
 * The row and the header share a `layoutId` per piece —the glyph and the
 * label—, so when the list leaves and the header assembles itself, framer
 * recognizes they're the same thing in two places and carries it from one
 * position to the other instead of switching it off here and on over there.
 * That's what ties the new level to the row that opened it: you see *where* it
 * came from.
 *
 * It goes with `layout="position"`: the label's box changes width between the
 * two places, and a full layout animation corrects that change by scaling,
 * which on text looks like rubber. Animating only the position, the text
 * travels without distorting.
 *
 * **One way only.** On the way back, what's recovered is the whole list and not
 * one row: a name dropping on its own towards its line, separate from the list
 * it belongs to, reads as a jump and not as a link. On top of that the list
 * scrolls and clips, so half of that trip would happen under the search box,
 * invisible. That's why the id carries the trip number, which goes up on every
 * return: the rows coming back no longer share an id with the header that's
 * leaving and framer doesn't pair them.
 *
 * The `scope` is the menu's `useId`: two FilterMenus on the same page can't
 * share ids or one's name would fly off towards the other.
 */
const travelId = (
  scope: string,
  trip: number,
  part: "icon" | "label",
  attributeId: string,
) => `${scope}-${trip}-${part}-${attributeId}`;

/** The header's title only crosses over in opacity. The outgoing one leaves the
 *  flow —`inset` and not `top`, so it stays centred while it fades— and fades
 *  fast, for the same reason as the list: underneath it there's a copy of the
 *  name travelling. */
const titleVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: {
    opacity: 0,
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    transition: spring.fast.exit,
  },
} satisfies Variants;

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** No capitals and no accents: "descripcion" has to find "Descripción".
 *  Whoever is filtering types fast and doesn't accent. */
const normalize = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

const matches = (text: string, query: string) =>
  normalize(text).includes(normalize(query.trim()));

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

const valuesOf = (selection: FilterSelection, id: string) => selection[id] ?? [];

/** Switches a value on or off and leaves the map free of empty arrays (see
 *  `FilterSelection`). A `single` attribute replaces instead of adding. */
function toggleValue(
  selection: FilterSelection,
  attribute: FilterAttribute,
  value: string,
): FilterSelection {
  const current = valuesOf(selection, attribute.id);
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : attribute.single
      ? [value]
      : [...current, value];

  const result = { ...selection };
  if (next.length) result[attribute.id] = next;
  else delete result[attribute.id];
  return result;
}

function clearAttribute(
  selection: FilterSelection,
  id: string,
): FilterSelection {
  const result = { ...selection };
  delete result[id];
  return result;
}

/** How many values are set in total — it's what the button and the panel's
 *  footer count, because "3 filters" is three values and not three
 *  attributes. */
const totalValues = (selection: FilterSelection) =>
  Object.values(selection).reduce((sum, values) => sum + values.length, 0);

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/** The counter on a row and on the button.
 *
 *  It goes with `bg-active`, one step stronger than the `bg-hover` the row
 *  lights up with: with the same one, the number would dissolve exactly when
 *  the cursor is on it, which is when it gets looked at.
 *
 *  `inline-flex` and not `flex`: inside the button this counter travels as a
 *  child, and the Button puts its children into the label's span. In there a
 *  block box drops to the next line on its own and splits the button in two. */
function Count({ children }: { children: ReactNode }) {
  // It's measured against the ladder's glyph and not against a height of its
  // own: the counter is a sibling of the row's icon, and when the region drops
  // to compact it has to drop with it.
  const { icon } = useSize();
  const scale = useTypeScale();
  const box = icon + 4;

  return (
    <span
      style={{ height: box, minWidth: box, fontSize: scale.caption }}
      className={cn(
        "inline-flex items-center justify-center bg-active px-1 align-middle font-medium tabular-nums text-foreground",
        shape.item,
      )}
    >
      {children}
    </span>
  );
}

interface PanelRowProps {
  id: string;
  active: boolean;
  /** The row signs up with the highlight's measurer, which needs its box to
   *  know how far to travel. The index and the function are passed —and not a
   *  ready-made ref— because a new callback on every render would make React
   *  unmount and remount the ref, and each round trip invalidates the
   *  measurement: the highlight would end up flickering a frame at a time. It's
   *  how the registry's `dropdown` items sign up. */
  index: number;
  registerItem: (index: number, element: HTMLElement | null) => void;
  icon?: IconComponent;
  label: string;
  /** Ids of the element shared with the header (see `travelId`). Only the first
   *  level's rows carry them: they're the only ones that open a level to travel
   *  to. */
  travelIconId?: string;
  travelLabelId?: string;
  hint?: string;
  trailing?: ReactNode;
  /** Only for rows that are a value: whether it's set or not. The first level's
   *  don't select anything, they navigate, which is why they leave it
   *  `undefined`. */
  selected?: boolean;
  onActivate: () => void;
}

function PanelRow({
  id,
  active,
  index,
  registerItem,
  icon: Icon,
  label,
  travelIconId,
  travelLabelId,
  hint,
  trailing,
  selected,
  onActivate,
}: PanelRowProps) {
  // The row resolves its own density from context instead of taking it through
  // props: the `SizeProvider` the menu sets up crosses the portal, so the row
  // reads the same thing as the button that opened it — which is exactly why
  // `control` is a single token for controls and menu rows.
  const classes = useSize();
  const scale = useTypeScale();
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerItem(index, rowRef.current);
    return () => registerItem(index, null);
  }, [index, registerItem]);

  return (
    <div
      id={id}
      ref={rowRef}
      role="option"
      aria-selected={selected}
      data-active={active || undefined}
      // The click mustn't take focus out of the search box, which is where all
      // the keyboard navigation lives.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onActivate}
      // `relative`: the highlight is an absolute layer that comes earlier in
      // the DOM, and without positioning the row the background would run over
      // the text. The row doesn't paint that background — the travelling layer
      // does.
      className={cn(
        "relative flex cursor-default select-none items-center",
        shape.item,
        classes.control,
        classes.itemPx,
        classes.gap,
      )}
    >
      {Icon && (
        <motion.span
          layoutId={travelIconId}
          layout={travelIconId ? "position" : undefined}
          transition={spring.moderate}
          className="shrink-0 text-muted-foreground"
        >
          <Icon size={classes.icon} strokeWidth={1.75} />
        </motion.span>
      )}
      <motion.span
        layoutId={travelLabelId}
        layout={travelLabelId ? "position" : undefined}
        transition={spring.moderate}
        className={cn("min-w-0 flex-1 truncate text-foreground", classes.text)}
      >
        {label}
      </motion.span>
      {hint && (
        <span
          style={{ fontSize: scale.caption }}
          className="shrink-0 text-muted-foreground"
        >
          {hint}
        </span>
      )}
      {trailing}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Views
//
// Both levels' rows are built in a single pass and come out numbered
// consecutively: the keyboard's highlight is an index into that flat array, and
// the group titles stay out of the numbering because they can't be activated.
// ---------------------------------------------------------------------------

type Row =
  | { kind: "attribute"; key: string; index: number; attribute: FilterAttribute }
  | {
      kind: "option";
      key: string;
      index: number;
      attribute: FilterAttribute;
      option: FilterOption;
      checked: boolean;
    }
  | { kind: "term"; key: string; index: number; attribute: FilterAttribute; term: string }
  | { kind: "add"; key: string; index: number; attribute: FilterAttribute; term: string };

interface RowSection {
  key: string;
  label?: string;
  rows: Row[];
}

function buildSections(
  groups: FilterGroup[],
  attribute: FilterAttribute | null,
  query: string,
  selection: FilterSelection,
): RowSection[] {
  let cursor = 0;
  const sections: RowSection[] = [];

  if (!attribute) {
    for (const group of groups) {
      const rows = group.attributes
        .filter((a) => matches(a.label, query))
        .map<Row>((a) => ({
          kind: "attribute",
          key: a.id,
          index: cursor++,
          attribute: a,
        }));
      if (rows.length) sections.push({ key: group.label, label: group.label, rows });
    }
    return sections;
  }

  if (attribute.type === "text") {
    const term = query.trim();
    const terms = valuesOf(selection, attribute.id);
    const rows: Row[] = [];
    // Only if it isn't set already: repeating a term adds nothing and the row
    // would offer something that changes nothing.
    if (term && !terms.includes(term)) {
      rows.push({ kind: "add", key: `add:${term}`, index: cursor++, attribute, term });
    }
    // Terms already set aren't filtered by whatever is being typed: while a new
    // one is typed, hiding the old ones would make it look like they'd been
    // deleted.
    for (const t of terms) {
      rows.push({ kind: "term", key: `term:${t}`, index: cursor++, attribute, term: t });
    }
    return rows.length ? [{ key: attribute.id, rows }] : [];
  }

  const chosen = valuesOf(selection, attribute.id);
  const rows = (attribute.options ?? [])
    .filter((option) => matches(option.label, query))
    .map<Row>((option) => ({
      kind: "option",
      key: option.value,
      index: cursor++,
      attribute,
      option,
      checked: chosen.includes(option.value),
    }));
  return rows.length ? [{ key: attribute.id, rows }] : [];
}

// ---------------------------------------------------------------------------
// PanelList
//
// One level's list: the scrolling frame, the rows and the highlight that
// travels between them.
//
// It's a separate component and not a chunk of the panel for a reason that
// costs dearly if undone: **each level needs its own measurer**. The rows sign
// up with `useProximityHover` by index, and during the crossover both views are
// mounted at once; with a shared measurer the two sets of indices tread on each
// other, and when the outgoing one unmounts its cleanup wipes the rows of the
// one that just came in — the highlight disappears and never comes back. One
// measurer per view can't collide, and as a bonus the new level's highlight
// appears with an opacity of its own instead of travelling in from the previous
// level.
// ---------------------------------------------------------------------------

interface PanelListProps {
  listId: string;
  trip: number;
  rowId: (index: number) => string;
  ariaLabel: string;
  multiselectable?: boolean;
  sections: RowSection[];
  isEmpty: boolean;
  emptyMessage: string;
  selection: FilterSelection;
  /** The marked row, in this list's indices. It lives above because the search
   *  box —which is outside— announces it through `aria-activedescendant` and
   *  Enter activates it. */
  highlighted: number;
  onHighlight: (index: number) => void;
  onActivate: (row: Row) => void;
}

function PanelList({
  listId,
  trip,
  rowId,
  ariaLabel,
  multiselectable,
  sections,
  isEmpty,
  emptyMessage,
  selection,
  highlighted,
  onHighlight,
  onActivate,
}: PanelListProps) {
  const classes = useSize();
  const scale = useTypeScale();
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * The highlight, with the same mechanism as the registry's sidebar and
   * dropdown: the hook measures the rows and picks the one *closest* to the
   * pointer, not the one literally underneath it. That's what keeps it from
   * going out when passing over the air left between two rows.
   */
  const { activeIndex, itemRects, isMeasured, handlers, registerItem } =
    useProximityHover(containerRef);

  // The wire upwards: the hook picks the row in here and the index has to get
  // out of this list so the search box can announce it and Enter can use it.
  // There's no way to derive it during render — the choice is made by the hook
  // in its own state, a frame after the mouse moves.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    if (activeIndex !== null) onHighlight(activeIndex);
  }, [activeIndex, onHighlight]);

  const highlightRect = highlighted >= 0 ? itemRects[highlighted] : undefined;

  return (
    <ScrollArea
      className="scroll-divider [--scroll-divider-inset:6px]"
      style={
        {
          "--filter-list-max": `${classes.controlHeight * VISIBLE_ROWS}px`,
          "--scroll-fade-size": `${classes.controlHeight}px`,
        } as CSSProperties
      }
      viewportClassName="scroll-fade max-h-[var(--filter-list-max)]"
    >
      <div
        id={listId}
        ref={containerRef}
        role="listbox"
        aria-label={ariaLabel}
        aria-multiselectable={multiselectable}
        onMouseEnter={handlers.onMouseEnter}
        onMouseMove={handlers.onMouseMove}
        // No `onMouseLeave`: when the pointer leaves, the highlight stays where
        // it was. Here it isn't a hover mark but the keyboard's cursor —it's the
        // row Enter is going to activate— and switching it off would leave it
        // with no destination.
        //
        // The air goes in here and not on the scrolling viewport, so the
        // container that measures proximity also covers the edges: the highlight
        // doesn't go out when passing over the list's border.
        className="relative p-1.5"
      >
        {/* A single layer travelling from row to row, instead of one background
            per row switching on and off. It travels with the fast step, which is
            hover's, and appears with an 80ms opacity so it isn't seen arriving
            from another row the first time.

            It comes before the rows in the DOM: both layers are positioned, so
            document order rules, and that keeps the text on top.

            `isMeasured` is the condition and not a detail: while the
            measurements don't describe what's on screen, a layer mounted against
            them would correct itself after appearing, and that correction looks
            like a slide in from another row. */}
        {isMeasured && highlightRect && (
          <motion.div
            aria-hidden="true"
            className={cn("pointer-events-none absolute bg-hover", shape.item)}
            initial={{
              opacity: 0,
              top: highlightRect.top,
              left: highlightRect.left,
              width: highlightRect.width,
              height: highlightRect.height,
            }}
            animate={{
              opacity: 1,
              top: highlightRect.top,
              left: highlightRect.left,
              width: highlightRect.width,
              height: highlightRect.height,
            }}
            transition={{ ...spring.fast, opacity: { duration: 0.08 } }}
          />
        )}

        {sections.map((section) => (
          <div key={section.key} className="flex flex-col">
            {section.label && (
              <p
                style={{ fontSize: scale.caption }}
                className="px-2 pb-1 pt-1.5 text-muted-foreground"
              >
                {section.label}
              </p>
            )}
            {section.rows.map((row) => {
              const shared = {
                id: rowId(row.index),
                active: row.index === highlighted,
                index: row.index,
                registerItem,
                onActivate: () => onActivate(row),
              };

              if (row.kind === "attribute") {
                const count = valuesOf(selection, row.attribute.id).length;
                return (
                  <PanelRow
                    key={row.key}
                    {...shared}
                    icon={row.attribute.icon}
                    label={row.attribute.label}
                    travelIconId={travelId(
                      listId,
                      trip,
                      "icon",
                      row.attribute.id,
                    )}
                    travelLabelId={travelId(
                      listId,
                      trip,
                      "label",
                      row.attribute.id,
                    )}
                    trailing={
                      <span
                        className={cn(
                          "flex shrink-0 items-center",
                          classes.gap,
                        )}
                      >
                        {count > 0 && <Count>{count}</Count>}
                        <ChevronRight
                          size={classes.icon}
                          strokeWidth={1.75}
                          className="text-muted-foreground"
                        />
                      </span>
                    }
                  />
                );
              }

              if (row.kind === "option") {
                return (
                  <PanelRow
                    key={row.key}
                    {...shared}
                    icon={row.option.icon}
                    label={row.option.label}
                    hint={row.option.hint}
                    selected={row.checked}
                    trailing={
                      <Check
                        size={classes.icon}
                        strokeWidth={2}
                        aria-hidden="true"
                        className={cn(
                          "shrink-0 text-foreground transition-opacity duration-80",
                          row.checked ? "opacity-100" : "opacity-0",
                        )}
                      />
                    }
                  />
                );
              }

              if (row.kind === "add") {
                return (
                  <PanelRow
                    key={row.key}
                    {...shared}
                    icon={Plus}
                    label={`Add "${row.term}"`}
                  />
                );
              }

              return (
                <PanelRow
                  key={row.key}
                  {...shared}
                  label={row.term}
                  selected
                  trailing={
                    <X
                      size={classes.icon}
                      strokeWidth={1.75}
                      aria-hidden="true"
                      className="shrink-0 text-muted-foreground"
                    />
                  }
                />
              );
            })}
          </div>
        ))}

        {isEmpty && (
          <p
            className={cn(
              "flex items-center px-2 text-muted-foreground",
              classes.control,
              classes.text,
            )}
          >
            {emptyMessage}
          </p>
        )}
      </div>
    </ScrollArea>
  );
}

// ---------------------------------------------------------------------------
// FilterMenu
// ---------------------------------------------------------------------------

function FilterMenu({
  groups,
  label = "Filters",
  labelHidden = false,
  value,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  size,
  align = "start",
  variant = "tertiary",
  className,
}: FilterMenuProps) {
  const isOpenControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = isOpenControlled ? openProp : internalOpen;
  const actionsRef = useRef<{ unmount: () => void; close: () => void } | null>(null);

  const isValueControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<FilterSelection>(
    defaultValue ?? {},
  );
  const selection = value ?? internalValue;

  /** The marked row. It's moved by the keyboard from here and by the pointer
   *  from the list, which reports through `onHighlight`: one highlight and not
   *  two treading on each other. */
  const [activeIndex, setActiveIndex] = useState(0);

  const [path, setPath] = useState<string | null>(null);
  const [direction, setDirection] = useState(1);
  /** Goes up on every return to the first level — see `travelId`. */
  const [trip, setTrip] = useState(0);
  const [query, setQuery] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const rowId = (index: number) => `${listId}-row-${index}`;

  // The override goes in directly and not through context: these hooks run
  // outside the `SizeProvider` this very component mounts. What's portalled does
  // read it from the provider — React context crosses the portal.
  const classes = useSize(size);
  /* El escalón resuelto, no el que llegó por prop: sin `size`, el botón sigue
     al `SizeProvider` que lo rodea, y el tamaño de ícono de `labelHidden` tiene
     que seguir al mismo. Leyendo sólo la prop, un embudo adentro de una región
     compacta salía del tamaño grande. */
  const escalon = useSizeVariant(size);
  const scale = useTypeScale(size);

  const commit = useCallback(
    (next: FilterSelection) => {
      if (!isValueControlled) setInternalValue(next);
      onValueChange?.(next);
    },
    [isValueControlled, onValueChange],
  );

  const attributes = useMemo(
    () => groups.flatMap((group) => group.attributes),
    [groups],
  );
  const attribute = useMemo(
    () => (path ? (attributes.find((a) => a.id === path) ?? null) : null),
    [attributes, path],
  );

  const sections = useMemo(
    () => buildSections(groups, attribute, query, selection),
    [groups, attribute, query, selection],
  );
  const rows = useMemo(() => sections.flatMap((s) => s.rows), [sections]);

  // The highlight is clamped during render and not corrected in an effect: if
  // the list got shorter than where it was standing — on unticking the last term
  // of a text attribute, say — the good index is computed right here. An effect
  // fixing it afterwards would paint one frame with the mark on a row that no
  // longer exists.
  const highlighted = rows.length ? Math.min(activeIndex, rows.length - 1) : -1;

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!isOpenControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isOpenControlled, onOpenChange],
  );

  /**
   * Base UI defers the unmount while there's an `actionsRef`, so the panel is
   * released only once the exit animation has finished. The navigation state is
   * reset in the same place and not on close: cleared any earlier, the panel
   * would be seen going back to the first level while it fades out.
   */
  useEffect(() => {
    if (open) return;
    const id = window.setTimeout(() => {
      actionsRef.current?.unmount();
      setPath(null);
      setQuery("");
      setActiveIndex(0);
      setDirection(1);
      setTrip(0);
    }, exitFallbackMs(spring.moderate));
    return () => window.clearTimeout(id);
  }, [open, setActiveIndex]);

  /** Changing what's being searched sends the highlight back to the first row:
   *  staying at index 5 after typing three letters leaves the mark on a row that
   *  has nothing to do with what was searched for. All four ways of changing it
   *  go through here — typing, stepping in, coming back and adding a term. */
  const search = useCallback(
    (next: string) => {
      setQuery(next);
      setActiveIndex(0);
    },
    [setActiveIndex],
  );

  const enter = useCallback(
    (next: FilterAttribute) => {
      setDirection(1);
      setPath(next.id);
      search("");
      inputRef.current?.focus();
    },
    [search],
  );

  const back = useCallback(() => {
    setDirection(-1);
    setPath(null);
    setTrip((n) => n + 1);
    search("");
    inputRef.current?.focus();
  }, [search]);

  const activate = useCallback(
    (row: Row) => {
      switch (row.kind) {
        case "attribute":
          enter(row.attribute);
          break;
        case "option":
          commit(toggleValue(selection, row.attribute, row.option.value));
          // With only one value possible, staying inside the attribute means
          // staring at a list where there's nothing left to do.
          if (row.attribute.single) back();
          break;
        case "add":
          commit(toggleValue(selection, row.attribute, row.term));
          search("");
          break;
        case "term":
          commit(toggleValue(selection, row.attribute, row.term));
          break;
      }
    },
    [back, commit, enter, search, selection],
  );

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const row = rows[highlighted];

    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (!rows.length) return;
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        // It wraps around: in a short list, going down from the last to the
        // first is faster than going up seven times.
        const next = (highlighted + step + rows.length) % rows.length;
        setActiveIndex(next);
        // And brings it into view. It has to be asked for by hand: the rows
        // don't take focus, which is what normally drags a list's scroll.
        document
          .getElementById(rowId(next))
          ?.scrollIntoView({ block: "nearest" });
        break;
      }
      case "Enter":
        if (row) {
          event.preventDefault();
          activate(row);
        }
        break;
      case "ArrowRight":
        // Only with the caret at the end of the text: in the middle of what was
        // typed, the arrow belongs to the field and not to the panel.
        if (
          row?.kind === "attribute" &&
          input.selectionStart === input.value.length
        ) {
          event.preventDefault();
          enter(row.attribute);
        }
        break;
      case "ArrowLeft":
      case "Backspace":
        if (attribute && !query) {
          event.preventDefault();
          back();
        }
        break;
      case "Escape":
        // Escape undoes one step at a time: first the search, then the level,
        // and only with both cleared does it close the panel. That last part is
        // Base UI's doing, which listens for the key on the portal's container;
        // to stop it you have to cut the native event's propagation, because
        // React's handler runs first but on the same event.
        if (query) {
          event.preventDefault();
          event.nativeEvent.stopPropagation();
          search("");
        } else if (attribute) {
          event.preventDefault();
          event.nativeEvent.stopPropagation();
          back();
        }
        break;
    }
  };

  // The list's frame animates its height against the one of the view on screen.
  // It's measured with a ResizeObserver on the current view's node and not with
  // framer's `layout`, which animates height by scaling the frame and distorts
  // the rows' text.
  const [viewNode, setViewNode] = useState<HTMLDivElement | null>(null);
  const [viewHeight, setViewHeight] = useState<number | null>(null);

  // The cleanup function is what keeps the outgoing view from taking the
  // incoming one's measurement with it: React 19 doesn't call the ref with
  // `null` when there's a cleanup, so each node clears its own and the late one
  // only wipes if it was still the current node.
  const attachView = useCallback((node: HTMLDivElement) => {
    setViewNode(node);
    return () => setViewNode((current) => (current === node ? null : current));
  }, []);

  useLayoutEffect(() => {
    if (!viewNode) return;
    const measure = () => setViewHeight(viewNode.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewNode);
    return () => observer.disconnect();
  }, [viewNode]);

  const scopeCount = attribute
    ? valuesOf(selection, attribute.id).length
    : totalValues(selection);
  const triggerCount = totalValues(selection);

  const AttributeIcon = attribute?.icon;

  /** The header's square buttons drop with the region: the ladder has a step of
   *  its own for the icon-only button at each rung. */
  const iconButtonSize = classes.variant === "compact" ? "icon-compact" : "icon";

  const placeholder = attribute
    ? (attribute.searchPlaceholder ??
      (attribute.type === "text"
        ? `${attribute.label} contains…`
        : `Search in ${attribute.label.toLowerCase()}…`))
    : "Search attributes…";

  const panel = (
    <Popover.Root
      open={open}
      onOpenChange={(next, details) => {
        // Escape with a search typed or inside an attribute doesn't close:
        // `onKeyDown` handles that. But the key also arrives here when focus is
        // on the × or on the clear button, where the field's handler doesn't run
        // — hence the same cut on Base UI's side.
        if (!next && details.reason === "escape-key" && (query || attribute)) {
          details.cancel();
          if (query) search("");
          else back();
          inputRef.current?.focus();
          return;
        }
        handleOpenChange(next);
      }}
      actionsRef={actionsRef}
      // Not modal: the page keeps scrolling and the positioner follows the
      // button, so the panel travels with its anchor instead of coming loose.
      modal={false}
    >
      {/* The button goes inside an inline container and not loose:
          `Popover.Root` draws nothing, so without this the button ends up a
          direct child of whatever is around it and a flex column stretches it
          end to end. It's the same wrapper `ColorPickerPopover` uses. */}
      <div className="inline-flex">
        <Popover.Trigger
          render={
            <Button
              variant={variant}
              /* Without the word, the glyph stops being a leading icon and
                 becomes the button's whole content — so it goes in as a child
                 and the button takes the square size of the ladder's step. With
                 a counter it can't stay square: the number needs room, so the
                 button falls back to the padded size and draws the two things
                 side by side. Either way the word is gone, which is the point;
                 what a filtered list can't afford to lose is the count. */
              leadingIcon={labelHidden ? undefined : ListFilter}
              size={
                labelHidden && triggerCount === 0
                  ? escalon === "compact"
                    ? "icon-compact"
                    : "icon"
                  : size
              }
              /* The label doesn't disappear, it moves: a button whose only
                 content is a glyph has nothing for a screen reader to read. */
              aria-label={labelHidden ? label : undefined}
              active={open}
              className={className}
            />
          }
        >
          {/* Label and counter go in a single inline box with the ladder's air.
              Putting them as two loose children isn't enough: the Button puts
              all its children into the label's span, and in there its `gap`
              doesn't reach — the number would end up stuck to the word. The box
              is `inline-flex` for the same reason as the counter: a block one
              would drop to the next line. */}
          {triggerCount > 0 ? (
            <span className={cn("inline-flex items-center", classes.gap)}>
              {labelHidden ? <ListFilter aria-hidden /> : label}
              <Count>{triggerCount}</Count>
            </span>
          ) : labelHidden ? (
            <ListFilter aria-hidden />
          ) : (
            label
          )}
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Positioner
            side="bottom"
            align={align}
            sideOffset={6}
            className="z-50 outline-none"
          >
            <motion.div
              initial={{ opacity: 0, y: -4, scaleY: 0.96 }}
              animate={
                open
                  ? { opacity: 1, y: 0, scaleY: 1 }
                  : { opacity: 0, y: -4, scaleY: 0.96 }
              }
              transition={open ? spring.moderate : spring.moderate.exit}
              style={{
                transformOrigin: align === "start" ? "top left" : "top right",
              }}
              onAnimationComplete={() => {
                if (!open) actionsRef.current?.unmount();
              }}
            >
              <Popover.Popup
                // The plane comes from `Elevated`: two steps over the substrate
                // —what any popover climbs— and a shadow fixed at 3, so the
                // panel weighs the same open over the page as inside a dialog,
                // even though its background follows the substrate. Elevated
                // also republishes the level, which is why the rows and the
                // footer in here don't need to know what it opened over.
                render={<Elevated offset={2} shadowLevel={3} />}
                // Focus lands on the search box and not on the panel: it's the
                // only place everything else is driven from.
                initialFocus={inputRef}
                aria-label={label}
                className={cn(
                  "flex flex-col overflow-hidden outline-none",
                  shape.container,
                )}
                style={{ width: PANEL_WIDTH }}
              >
                {/* Header: title, back and close. The back and the × don't
                    travel with the content — they belong to the panel, not to
                    the level. The height is one of the ladder's rows plus the
                    panel's air, so the × falls on the same grid as the rows
                    below. */}
                {/* `z-10`: the name travelling from the row is drawn in the
                    header's DOM, and without this the list —which comes after—
                    would run over it mid-flight. */}
                <div
                  className="relative z-10 flex shrink-0 items-center gap-1 px-1.5"
                  style={{ height: classes.controlHeight + PANEL_PAD * 2 }}
                >
                  {/* The back button appears with its width already set and
                      only reveals itself: if the width grew, the spot in the
                      header the name is aiming at would be moving while the name
                      travels towards it, and it would land off-mark. */}
                  {attribute && (
                    <motion.div
                      key="back"
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={spring.moderate}
                    >
                      <Button
                        variant="ghost"
                        size={iconButtonSize}
                        aria-label="Back to attributes"
                        onClick={back}
                      >
                        <ChevronLeft />
                      </Button>
                    </motion.div>
                  )}

                  {/* The title doesn't shift: at an attribute's level what
                      arrives is the name flying in from its row, and a shift of
                      its own would fight that trip. All the root title does here
                      is cross over in opacity with the one arriving. */}
                  <div className="relative flex min-w-0 flex-1 items-center">
                    <AnimatePresence initial={false}>
                      <motion.div
                        key={attribute?.id ?? "__root__"}
                        variants={titleVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={spring.moderate}
                        className={cn(
                          "flex min-w-0 items-center px-1.5",
                          classes.gap,
                        )}
                      >
                        {attribute && AttributeIcon ? (
                          <>
                            <motion.span
                              layoutId={travelId(
                                listId,
                                trip,
                                "icon",
                                attribute.id,
                              )}
                              layout="position"
                              transition={spring.moderate}
                              className="shrink-0 text-muted-foreground"
                            >
                              <AttributeIcon
                                size={classes.icon}
                                strokeWidth={1.75}
                              />
                            </motion.span>
                            <motion.span
                              layoutId={travelId(
                                listId,
                                trip,
                                "label",
                                attribute.id,
                              )}
                              layout="position"
                              transition={spring.moderate}
                              style={{ fontSize: scale.subtitle }}
                              className="truncate font-medium text-foreground"
                            >
                              {attribute.label}
                            </motion.span>
                          </>
                        ) : (
                          <span
                            style={{ fontSize: scale.subtitle }}
                            className="truncate font-medium text-foreground"
                          >
                            {label}
                          </span>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <Popover.Close
                    render={
                      <Button
                        variant="ghost"
                        size={iconButtonSize}
                        aria-label="Close filters"
                      />
                    }
                  >
                    <X />
                  </Popover.Close>
                </div>

                <span className="h-px shrink-0 bg-border" />

                {/* Search box. It's painted with `bg-hover` —a translucent
                    layer— and not with a fixed step of the ladder: the panel
                    opens over any substrate, and a `bg-surface-2` would end up
                    darker or lighter than its own panel depending on where it
                    lands.

                    It draws no focus ring. While the panel is open focus lives
                    here, so a permanent ring would report nothing; what says
                    where you're standing is the row's highlight, which is what
                    moves. */}
                <div
                  className="relative shrink-0"
                  style={{ margin: PANEL_PAD, marginBottom: 0 }}
                >
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => search(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={placeholder}
                    role="combobox"
                    aria-expanded
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={
                      highlighted >= 0 ? rowId(highlighted) : undefined
                    }
                    aria-label={placeholder}
                    autoComplete="off"
                    spellCheck={false}
                    // The right padding makes room for the magnifier: the
                    // ladder's glyph plus the field's air on both sides.
                    style={{ paddingRight: classes.icon + PANEL_PAD * 2 }}
                    className={cn(
                      "w-full bg-hover text-foreground outline-none",
                      "placeholder:text-muted-foreground",
                      shape.input,
                      classes.control,
                      classes.px,
                      classes.text,
                    )}
                  />
                  <Search
                    size={classes.icon}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    style={{ right: PANEL_PAD * 2 }}
                    className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                </div>

                <motion.div
                  // `initial={false}`: on the first render there's no
                  // measurement yet and the height is `auto`; without this the
                  // panel would open animating from 0 to its height on the
                  // inside, on top of the entry it already does on the
                  // outside.
                  initial={false}
                  animate={{ height: viewHeight ?? "auto" }}
                  transition={spring.moderate}
                  className="relative overflow-hidden"
                >
                  <AnimatePresence initial={false} custom={direction}>
                    <motion.div
                      key={attribute?.id ?? "__root__"}
                      ref={attachView}
                      custom={direction}
                      variants={viewVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={spring.moderate}
                    >
                      {/* The scroll goes through `ScrollArea` with
                          `scroll-fade` on the viewport and `scroll-divider` on
                          the frame: the system's thumb, the content dissolving
                          towards whichever edge still has more, and the line
                          that appears when something is passing above or below.
                          The line can't go on the same node that scrolls — the
                          fade's mask would eat it.

                          The height cap travels as a CSS variable because it
                          comes from the ladder at runtime, and Tailwind only
                          generates classes it can read in the code. */}
                      <PanelList
                        listId={listId}
                        trip={trip}
                        rowId={rowId}
                        ariaLabel={attribute ? attribute.label : label}
                        multiselectable={
                          attribute ? !attribute.single : undefined
                        }
                        sections={sections}
                        isEmpty={!rows.length}
                        emptyMessage={
                          attribute?.type === "text"
                            ? "Type some text and press Enter"
                            : "Nothing by that name"
                        }
                        selection={selection}
                        highlighted={highlighted}
                        onHighlight={setActiveIndex}
                        onActivate={activate}
                      />
                    </motion.div>
                  </AnimatePresence>
                </motion.div>

                {/* Footer: it appears only when something is set at the level
                    you're on, and clears exactly that. */}
                <AnimatePresence initial={false}>
                  {scopeCount > 0 && (
                    <motion.div
                      key="footer"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={spring.moderate}
                      className="shrink-0 overflow-hidden"
                    >
                      <span className="block h-px bg-border" />
                      <div
                        className="flex items-center justify-between pl-3 pr-1.5"
                        style={{ height: classes.controlHeight + PANEL_PAD * 2 }}
                      >
                        <span
                          style={{ fontSize: scale.caption }}
                          className="text-muted-foreground"
                        >
                          {scopeCount === 1
                            ? "1 filter set"
                            : `${scopeCount} filters set`}
                        </span>
                        {/* No `size`: the button follows the panel's
                            SizeProvider like any other control in the region. */}
                        <Button
                          variant="ghost"
                          onClick={() => {
                            commit(
                              attribute
                                ? clearAttribute(selection, attribute.id)
                                : {},
                            );
                            inputRef.current?.focus();
                          }}
                        >
                          Clear
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Popover.Popup>
            </motion.div>
          </Popover.Positioner>
        </Popover.Portal>
      </div>
    </Popover.Root>
  );

  return size ? <SizeProvider size={size}>{panel}</SizeProvider> : panel;
}

export { FilterMenu };
export type {
  FilterMenuProps,
  FilterAttribute,
  FilterGroup,
  FilterOption,
  FilterSelection,
};
