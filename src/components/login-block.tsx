"use client";

/**
 * LoginBlock — a product's complete sign-in screen.
 *
 * A block, not a component: it doesn't solve one piece but a whole screen,
 * assembled from the system's pieces. Two halves doing different jobs. On the
 * left a brand plane — gradient, logo and the product's promise — that asks for
 * nothing; on the right the only column where there's anything to do. That
 * asymmetry is what steers the eye: everything actionable lives together.
 *
 * Three decisions worth not undoing without looking at the rest:
 *
 * 1. **It measures its container, not the window.** The layout splits in two
 *    with container queries (`@container` + `@2xl:`), so the same block works
 *    full screen and inside the showcase's narrow frame. With media queries
 *    you'd have to pick one of the two.
 *
 * 2. **It paints itself in its own theme.** The `.light` / `.dark` class goes on
 *    the block's root, not on the <html>, and the tokens cascade inwards.
 *    That's why not a single `dark:` utility is used inside: that variant is
 *    `&:is(.dark *)`, which means a light block inside a dark app would still
 *    match and would paint itself wrong.
 *
 * 3. **The error pushes, it doesn't cover.** It appears inside the frame, above
 *    the card, and shifts the content down. A toast would leave on its own and
 *    a modal would cover the very fields that need fixing.
 */

import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { IconComponentProps } from "@/lib/icon-context";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/springs";

/** The theme the block applies to itself. `system` follows the operating system
 *  and keeps watching it for as long as it's mounted. */
type LoginBlockTheme = "light" | "dark" | "system";

interface LoginBlockProps {
  /** The brand mark on the left-hand plane. It goes as a node and not as a src
   *  so an SVG can be handed over that inherits the theme's colour. */
  logo?: ReactNode;
  /** The plane's headline. Short: it fits in two lines at the panel's width. */
  title: string;
  /** What the product does, in one or two sentences. */
  description: string;
  /** Error message. `null` closes the notice; the text has to name the problem,
   *  not the status code. */
  error?: string | null;
  /** Keeps the controls still while the submit is in flight. */
  pending?: boolean;
  /** Controlled theme. Without this prop the block manages its own. */
  theme?: LoginBlockTheme;
  defaultTheme?: LoginBlockTheme;
  onThemeChange?: (theme: LoginBlockTheme) => void;
  onSubmit?: (credentials: { email: string; password: string }) => void;
  onGitHub?: () => void;
  onForgotPassword?: () => void;
  onSignUp?: () => void;
  className?: string;
}

/* The brand plane. It's a dark surface in both themes — the book's cover — but
   not the same one: in the light theme it takes a raised key, with the base
   several steps above near-black and the highlights brighter, so the details
   read lighter and the plane doesn't compete with a light app by turning into a
   black hole beside it.

   The colour family doesn't change between keys: plum, garnet and violet, in
   the same positions. What changes is the height of the base and the brightness
   of the highlights.

   The key is chosen here, with the theme already resolved, and not with `dark:`
   utilities: that variant is `&:is(.dark *)` and a light block hanging off a
   dark <html> would keep matching it. */
const PANEL_ART = {
  dark: [
    "radial-gradient(120% 78% at 28% 16%, rgba(186, 128, 152, 0.44) 0%, rgba(186, 128, 152, 0) 62%)",
    "radial-gradient(92% 62% at 74% 6%, rgba(154, 84, 92, 0.40) 0%, rgba(154, 84, 92, 0) 58%)",
    "radial-gradient(104% 72% at 10% 54%, rgba(98, 76, 132, 0.30) 0%, rgba(98, 76, 132, 0) 60%)",
    "linear-gradient(180deg, #1d1a1e 0%, #131215 46%, #0c0b0d 100%)",
  ].join(", "),
  light: [
    "radial-gradient(120% 78% at 28% 16%, rgba(228, 178, 200, 0.42) 0%, rgba(228, 178, 200, 0) 62%)",
    "radial-gradient(92% 62% at 74% 6%, rgba(206, 132, 140, 0.34) 0%, rgba(206, 132, 140, 0) 58%)",
    "radial-gradient(104% 72% at 10% 54%, rgba(150, 126, 190, 0.26) 0%, rgba(150, 126, 190, 0) 60%)",
    "linear-gradient(180deg, #3d3038 0%, #2c242b 46%, #211a20 100%)",
  ].join(", "),
} as const;

/* The plane's ink doesn't depend on the app's theme: both keys are dark, so
   whatever sits on top always goes light. A single copy, so the two can't drift
   apart. */
const PANEL_INK = {
  edge: "ring-white/10",
  ink: "text-white",
  // The secondary comes from the plane itself — a white with the gradient's
  // temperature — and not from a neutral grey, which looks dirty over colour.
  body: "text-[rgb(238_226_232_/_0.72)]",
  knobOn: "text-white",
  knobOff: "text-white/45 hover:text-white/80",
  knobBg: "bg-white/12 ring-white/15",
  focus: "focus-visible:ring-white/70",
} as const;

/* The error's glow: it starts at the frame's top edge and fades out before
   reaching the card, so the red tints the notice and not the form. */
const ERROR_GLOW =
  "radial-gradient(120% 100% at 50% 0%, color-mix(in oklab, var(--destructive) 34%, transparent) 0%, transparent 72%)";

/** GitHub hasn't been in lucide since v1 — they dropped the trademarks — so the
 *  logo is drawn here. It honours the `IconComponentProps` signature so it can
 *  travel through the Button's `leadingIcon` prop, which is the only correct
 *  way to give it an icon: as a child it falls inside the label's span, and
 *  there Tailwind's preflight (`svg { display: block }`) stacks it above the
 *  text instead of leaving it alongside. */
function GitHubMark({ size = 16, className }: IconComponentProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      fill="currentColor"
      className={className}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

/** The notice's icon. A filled circle with the cross knocked out: the hole takes
 *  the frame's colour, so it reads the same in light and in dark. */
function ErrorMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM7.3 6.24a.75.75 0 0 0-1.06 1.06L8.94 10l-2.7 2.7a.75.75 0 1 0 1.06 1.06l2.7-2.7 2.7 2.7a.75.75 0 1 0 1.06-1.06L11.06 10l2.7-2.7a.75.75 0 0 0-1.06-1.06l-2.7 2.7-2.7-2.7Z"
      />
    </svg>
  );
}

/* A form field. The registry's (InputField) hide the border until the cursor
   comes near, which is the right thing inside an app full of controls; here the
   form is the only thing on the screen and the fields have to be visible from
   the first glance. That's why they're drawn. */
function Field({
  id,
  label,
  action,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium text-foreground">
          {label}
        </label>
        {action}
      </div>
      <input
        id={id}
        className={cn(
          "h-9 w-full rounded-[10px] bg-surface-2 px-3 text-[13px] text-foreground",
          "border border-border outline-none transition-colors duration-100",
          "placeholder:text-muted-foreground",
          "hover:border-muted-foreground/70",
          // Border through `border` and focus through `ring`: each in its own
          // property, so the ring adds to the border instead of replacing it.
          // It's how the registry's controls mark focus (see `buttonVariants`).
          "focus:ring-2 focus:ring-[color:var(--focus-ring)]",
          "disabled:opacity-50",
        )}
        {...props}
      />
    </div>
  );
}

const THEME_OPTIONS = [
  { value: "light", icon: Sun, label: "Light theme" },
  { value: "dark", icon: Moon, label: "Dark theme" },
  { value: "system", icon: Monitor, label: "Follow the system" },
] as const;

/** Follows `prefers-color-scheme` and keeps watching it: if the system changes
 *  with the block open, `system` mode has to keep up. */
function useSystemScheme(): "light" | "dark" {
  const [scheme, setScheme] = useState<"light" | "dark">(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) =>
      setScheme(e.matches ? "dark" : "light");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return scheme;
}

function LoginBlock({
  logo,
  title,
  description,
  error = null,
  pending = false,
  theme: themeProp,
  defaultTheme = "system",
  onThemeChange,
  onSubmit,
  onGitHub,
  onForgotPassword,
  onSignUp,
  className,
}: LoginBlockProps) {
  const [uncontrolledTheme, setUncontrolledTheme] =
    useState<LoginBlockTheme>(defaultTheme);
  const theme = themeProp ?? uncontrolledTheme;
  const systemScheme = useSystemScheme();
  const resolved = theme === "system" ? systemScheme : theme;
  const panelArt = PANEL_ART[resolved];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // useId gives unique ids even with two blocks on the same page — which
  // happens in the showcase, where the normal state and the error one sit side
  // by side.
  const fieldId = useId();

  const selectTheme = (next: LoginBlockTheme) => {
    if (themeProp === undefined) setUncontrolledTheme(next);
    onThemeChange?.(next);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit?.({ email, password });
  };

  return (
    <div
      // The theme's class goes here and not on the <html>: the colour tokens
      // are declared in `:root, .light` and in `.dark`, so they cascade to
      // everything hanging off this node and to nothing else.
      className={cn(
        resolved,
        "@container relative isolate h-full bg-surface-1 text-foreground",
        className,
      )}
    >
      {/* The two-column split goes on a node separate from the `@container`, and
          it isn't a writing detail: a container query measures the container for
          its *descendants*, never for itself. With `@2xl:flex-row` on the same
          node the rule never matches and the two halves end up stacked. */}
      <div className="flex h-full min-h-full flex-col @2xl:flex-row">
        {/* Brand plane. It hides when the container is narrow: in a phone-width
          column it competes with the form instead of accompanying it. */}
        {/* It carries no `aria-hidden`: the plane isn't decoration. It holds the
            headline, the description and the three theme buttons, and marking a
            container with focusable controls as hidden lets the tab key land on
            something the screen reader doesn't announce. */}
        <aside
          className="relative m-2 hidden shrink-0 overflow-hidden rounded-2xl @2xl:flex @2xl:w-[38%] @2xl:flex-col @2xl:justify-between @2xl:p-7"
          style={{ background: panelArt }}
        >
          {/* Inner edge: it separates the plane from the background when both are
            in the same key — two darks or two lights — which is where the
            gradient alone isn't enough. */}
          <span
            className={cn(
              "pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset",
              PANEL_INK.edge,
            )}
          />

          <div className={PANEL_INK.ink}>{logo}</div>

          <div className="flex items-end justify-between gap-6">
            <div className="flex max-w-[26ch] flex-col gap-3">
              <h2
                className={cn(
                  "text-balance font-medium leading-[1.08] tracking-[-0.03em]",
                  PANEL_INK.ink,
                )}
                // Fluid type against the container's width: the same headline
                // has to fit the showcase's frame and fill the whole screen
                // without two sets of classes.
                style={{ fontSize: "clamp(1.375rem, 5.4cqi, 2.5rem)" }}
              >
                {title}
              </h2>
              <p className={cn("text-[13px] leading-relaxed", PANEL_INK.body)}>
                {description}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1 rounded-full p-1">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-label={option.label}
                    aria-pressed={active}
                    onClick={() => selectTheme(option.value)}
                    className={cn(
                      "relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg",
                      "outline-none transition-colors duration-100",
                      "focus-visible:ring-1",
                      PANEL_INK.focus,
                      active ? PANEL_INK.knobOn : PANEL_INK.knobOff,
                    )}
                  >
                    {active && (
                      <motion.span
                        // A single shared background travelling between the
                        // three, instead of one appearing and another
                        // disappearing: that way it reads as a selector and not
                        // as three loose buttons.
                        layoutId={`login-theme-${fieldId}`}
                        transition={spring.moderate}
                        className={cn(
                          "absolute inset-0 rounded-lg ring-1 ring-inset",
                          PANEL_INK.knobBg,
                        )}
                      />
                    )}
                    <Icon className="relative h-[15px] w-[15px]" />
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Sign-in column */}
        <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
          <div className="w-full max-w-[380px]">
            {/* Frame: it wraps the card and the sign-up line, and leaves the
              error notice a place of its own at the top. */}
            <div className="relative overflow-hidden rounded-[18px] bg-surface-2 p-1 shadow-surface-1">
              <AnimatePresence initial={false}>
                {error && (
                  <motion.div
                    key="error"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={spring.moderate}
                    className="overflow-hidden"
                  >
                    <div className="relative flex items-center justify-center gap-2 px-4 py-3">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 -top-8 bottom-0"
                        style={{ background: ERROR_GLOW }}
                      />
                      <ErrorMark className="relative h-4 w-4 shrink-0 text-destructive" />
                      <p
                        role="alert"
                        className="relative text-[13px] font-medium text-destructive"
                      >
                        {error}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form
                onSubmit={handleSubmit}
                className="relative flex flex-col gap-4 rounded-[14px] bg-surface-3 p-6 shadow-surface-1"
              >
                <Field
                  id={`${fieldId}-email`}
                  label="Email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={pending}
                />

                <Field
                  id={`${fieldId}-password`}
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={pending}
                  action={
                    <button
                      type="button"
                      onClick={onForgotPassword}
                      className="cursor-pointer rounded text-[13px] text-muted-foreground outline-none transition-colors duration-100 hover:text-foreground focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)]"
                    >
                      Forgot your password?
                    </button>
                  }
                />

                <Button
                  type="submit"
                  className="mt-1 w-full"
                  disabled={pending}
                >
                  {pending ? "Signing in…" : "Continue"}
                </Button>

                <div className="flex items-center gap-3 py-1">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground">
                    OR
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  leadingIcon={GitHubMark}
                  onClick={onGitHub}
                  disabled={pending}
                >
                  Continue with GitHub
                </Button>
              </form>

              <p className="py-3 text-center text-[13px] text-muted-foreground">
                Don't have an account yet?{" "}
                <button
                  type="button"
                  onClick={onSignUp}
                  className="cursor-pointer rounded font-medium text-foreground outline-none transition-opacity duration-100 hover:opacity-70 focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)]"
                >
                  Sign up
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* The pieces travel to `MobileAuthBlock`, which is this same screen for the
   other shape: the same plane, the same fields, the same notice and the same
   way of resolving the theme. Kept here and exported —rather than moved to a
   third file— because they're this block's anatomy and the mobile one is the
   guest; and exported at all, rather than copied over there, because two
   copies of a form field is exactly how two screens of the same product end up
   looking like two products. */
export {
  LoginBlock,
  Field,
  GitHubMark,
  ErrorMark,
  PANEL_ART,
  PANEL_INK,
  ERROR_GLOW,
  THEME_OPTIONS,
};
// The hook goes with them: resolving `system` means watching the media query
// for as long as the block is mounted, and a second implementation of that is
// a second thing that can stop watching.
// oxlint-disable-next-line react/only-export-components
export { useSystemScheme };
export type { LoginBlockProps, LoginBlockTheme };
