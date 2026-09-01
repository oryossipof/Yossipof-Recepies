/**
 * The app's coloured icons, drawn here rather than taken from an icon set.
 *
 * They are solid shapes filled with a gradient that runs light at the top to
 * dark at the bottom, which is what gives them the look of an object catching
 * the light rather than a symbol. Every one is drawn in code and not set as an
 * emoji, so a Samsung and an iPhone show the same picture — the same reason
 * the folder on the category tiles is drawn.
 *
 * The gradients themselves live once, in `<IconGradients/>`, which the app
 * mounts at the root. An SVG gradient is referenced by id from anywhere in the
 * document, so eleven icons share five definitions instead of carrying their
 * own copies; without that element in the tree every icon renders black.
 */

const GRADIENTS = [
  ["gi-amber", "#FBC96A", "#DE871A"],
  ["gi-blue", "#84D2F3", "#2B8CCC"],
  ["gi-green", "#A9DDAB", "#5C9E65"],
  ["gi-coral", "#F8B28C", "#DC6842"],
  ["gi-steel", "#B2BFCC", "#74849A"],
  ["gi-violet", "#A98BEE", "#6B45C9"],
  ["gi-gold", "#FFD97A", "#E9A400"],
  ["gi-red", "#F49A9A", "#D23B3B"],
] as const;

/** Mounted once at the root. Renders nothing a person can see. */
export function IconGradients() {
  return (
    <svg
      aria-hidden
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        {GRADIENTS.map(([id, from, to]) => (
          <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        ))}
      </defs>
    </svg>
  );
}

/**
 * Every icon shares this frame. The size is left to the button that holds it,
 * which is why there is no width here: the header buttons set one size and the
 * recipe screen's another, and both do it through the same `[&_svg]` rule that
 * sized the outline icons before.
 */
function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      {children}
    </svg>
  );
}

/* ── The view switch ─────────────────────────────────────────────────── */

/** A folder: the categories view. Its tab is on the right, as the page reads. */
export function GFolder() {
  return (
    <Icon>
      <path
        d="M2.4 9a2 2 0 0 1 2-2h6.4l1.9-2.5h7.1a2 2 0 0 1 2 2v12.5a2 2 0 0 1-2 2H4.4a2 2 0 0 1-2-2Z"
        fill="url(#gi-amber)"
      />
      {/* The front panel, lifted a shade so the folder has a near edge. */}
      <path d="M2.4 11.6h19.4V19a2 2 0 0 1-2 2H4.4a2 2 0 0 1-2-2Z" fill="#FFFFFF" opacity="0.24" />
    </Icon>
  );
}

/** Four tiles: the flat list of recipes, coloured like four photographs. */
export function GGrid() {
  return (
    <Icon>
      <rect x="3.2" y="3.2" width="8" height="8" rx="2.4" fill="url(#gi-coral)" />
      <rect x="12.8" y="3.2" width="8" height="8" rx="2.4" fill="url(#gi-blue)" />
      <rect x="3.2" y="12.8" width="8" height="8" rx="2.4" fill="url(#gi-green)" />
      <rect x="12.8" y="12.8" width="8" height="8" rx="2.4" fill="url(#gi-amber)" />
    </Icon>
  );
}

/* ── The size steppers ───────────────────────────────────────────────── */

function Magnifier({ plus }: { plus: boolean }) {
  return (
    <Icon>
      <path
        d="M15.4 15.4 20.6 20.6"
        stroke="url(#gi-steel)"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <circle cx="10.3" cy="10.3" r="7.4" fill="url(#gi-blue)" />
      {/* The rim catches the light, which is what makes it read as glass. */}
      <circle cx="10.3" cy="10.3" r="7.4" stroke="#FFFFFF" strokeWidth="1.3" opacity="0.55" />
      <rect x="6.9" y="9.35" width="6.8" height="1.9" rx="0.95" fill="#FFFFFF" />
      {plus && <rect x="9.35" y="6.9" width="1.9" height="6.8" rx="0.95" fill="#FFFFFF" />}
    </Icon>
  );
}

export function GZoomOut() {
  return <Magnifier plus={false} />;
}

export function GZoomIn() {
  return <Magnifier plus />;
}

/* ── Categories ──────────────────────────────────────────────────────── */

export function GTag() {
  return (
    <Icon>
      <path
        d="M20.4 13.3 13.3 20.4a2 2 0 0 1-2.83 0L2.4 12.3V2.4h9.9l8.1 8.1a2 2 0 0 1 0 2.8Z"
        fill="url(#gi-amber)"
      />
      <circle cx="7.2" cy="7.2" r="1.6" fill="#FFFFFF" opacity="0.92" />
    </Icon>
  );
}

/* ── The recipe screen ───────────────────────────────────────────────── */

/**
 * The favourite star. Empty it is a steel outline, since a gold outline would
 * read as half-pressed; full it is gold, which is the colour the app has used
 * for favourites since the beginning.
 */
export function GStar({ filled }: { filled: boolean }) {
  const d = "m12 2.6 2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.62 6.12 20.71l1.12-6.55L2.48 9.52l6.58-.96Z";
  return (
    <Icon>
      {filled ? (
        <path d={d} fill="url(#gi-gold)" />
      ) : (
        <path d={d} stroke="url(#gi-steel)" strokeWidth="1.9" strokeLinejoin="round" />
      )}
    </Icon>
  );
}

/** Sending the ingredients to the household shopping list. */
export function GCart() {
  return (
    <Icon>
      <path
        d="M2.4 3.1h1.9a1.4 1.4 0 0 1 1.38 1.16l.4 2.4"
        stroke="url(#gi-green)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6.6 6.4h14.1a1 1 0 0 1 .98 1.2l-1.3 6.4a2.2 2.2 0 0 1-2.16 1.76H9.4a2.2 2.2 0 0 1-2.16-1.8Z"
        fill="url(#gi-green)"
      />
      <circle cx="10" cy="19.4" r="1.9" fill="url(#gi-green)" />
      <circle cx="17.4" cy="19.4" r="1.9" fill="url(#gi-green)" />
    </Icon>
  );
}

/** Sharing the recipe out of the app. */
export function GShare() {
  return (
    <Icon>
      <path
        d="M8.7 10.8 15.3 6.9M8.7 13.2l6.6 3.9"
        stroke="url(#gi-blue)"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <circle cx="17.8" cy="5.4" r="2.9" fill="url(#gi-blue)" />
      <circle cx="6.2" cy="12" r="2.9" fill="url(#gi-blue)" />
      <circle cx="17.8" cy="18.6" r="2.9" fill="url(#gi-blue)" />
    </Icon>
  );
}

/** The recipe as an A4 page, saved to the device. */
export function GDownload() {
  return (
    <Icon>
      <path
        d="M5.4 3.6a2 2 0 0 1 2-2h5.4l5.8 5.8v12.9a2 2 0 0 1-2 2H7.4a2 2 0 0 1-2-2Z"
        fill="url(#gi-violet)"
      />
      {/* The turned-down corner, the one thing that says "a page". */}
      <path d="M12.8 1.6 18.6 7.4h-4.2a1.6 1.6 0 0 1-1.6-1.6Z" fill="#FFFFFF" opacity="0.42" />
      <path
        d="M12 10.6v5.4m0 0-2.3-2.3M12 16l2.3-2.3"
        stroke="#FFFFFF"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

/** A pencil, in a pencil's own colours: eraser, body, point. */
export function GPencil() {
  return (
    <Icon>
      <path
        d="M16.4 3.9a2.1 2.1 0 0 1 2.97 0l.83.83a2.1 2.1 0 0 1 0 2.97l-1.25 1.25-3.8-3.8Z"
        fill="url(#gi-coral)"
      />
      <path d="M14.3 6 18.1 9.8 8.1 19.8l-3.8-3.8Z" fill="url(#gi-amber)" />
      <path d="M4.3 16 8.1 19.8l-5.1 1.3Z" fill="url(#gi-steel)" />
    </Icon>
  );
}

export function GTrash() {
  return (
    <Icon>
      <path
        d="M9.2 2.6h5.6a1.4 1.4 0 0 1 1.4 1.4v.9H7.8V4a1.4 1.4 0 0 1 1.4-1.4Z"
        fill="url(#gi-red)"
      />
      <rect x="3.4" y="4.9" width="17.2" height="2.6" rx="1.3" fill="url(#gi-red)" />
      <path
        d="M5.6 8.6h12.8l-.85 11.1a2 2 0 0 1-2 1.85H8.45a2 2 0 0 1-2-1.85Z"
        fill="url(#gi-red)"
      />
      <path
        d="M10 11.7v6.3M14 11.7v6.3"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.72"
      />
    </Icon>
  );
}
