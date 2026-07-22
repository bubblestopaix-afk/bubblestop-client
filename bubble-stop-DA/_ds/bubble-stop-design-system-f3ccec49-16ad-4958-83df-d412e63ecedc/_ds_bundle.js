/* @ds-bundle: {"format":3,"namespace":"BubbleStopDesignSystem_f3ccec","components":[{"name":"Sparkle","sourcePath":"components/brand/Decorations.jsx"},{"name":"Bubble","sourcePath":"components/brand/Decorations.jsx"},{"name":"Wave","sourcePath":"components/brand/Decorations.jsx"},{"name":"Decorations","sourcePath":"components/brand/Decorations.jsx"},{"name":"Logo","sourcePath":"components/brand/Logo.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"CategoryHeading","sourcePath":"components/menu/CategoryHeading.jsx"},{"name":"FlavorList","sourcePath":"components/menu/FlavorList.jsx"},{"name":"MenuItem","sourcePath":"components/menu/MenuItem.jsx"},{"name":"PricePill","sourcePath":"components/menu/PricePill.jsx"},{"name":"SizeSelector","sourcePath":"components/menu/SizeSelector.jsx"},{"name":"SugarLevel","sourcePath":"components/menu/SugarLevel.jsx"},{"name":"ToppingChip","sourcePath":"components/menu/ToppingChip.jsx"}],"sourceHashes":{"components/brand/Decorations.jsx":"5c2d32846928","components/brand/Logo.jsx":"e3517d0adbfd","components/core/Badge.jsx":"0fa4bebc7cd8","components/core/Button.jsx":"ade7ff0893ab","components/core/Card.jsx":"4925dbf71314","components/menu/CategoryHeading.jsx":"82718520923e","components/menu/FlavorList.jsx":"631e65f9b6fb","components/menu/MenuItem.jsx":"cd8202705d70","components/menu/PricePill.jsx":"6b575d2d4303","components/menu/SizeSelector.jsx":"f885ca0f9394","components/menu/SugarLevel.jsx":"ab323394e90b","components/menu/ToppingChip.jsx":"9a59612f76ba"},"inlinedExternals":[],"unexposedExports":[{"name":"euro","sourcePath":"components/menu/PricePill.jsx"}]} */

(() => {

const __ds_ns = (window.BubbleStopDesignSystem_f3ccec = window.BubbleStopDesignSystem_f3ccec || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/Decorations.jsx
try { (() => {
/**
 * Bubble Stop graphic motifs — the brand "univers".
 * Charter-defined simple shapes: sparkles (étoiles), bubbles (cercles /
 * tapioca pearls) and the wave (vague). Drawn as plain geometry — no
 * representational illustration. Use sparingly & harmoniously.
 */

/* ---- Single 4-point sparkle / twinkle ---- */
function Sparkle({
  size = 20,
  color = 'currentColor',
  variant = 'solid',
  strokeWidth = 2,
  style = {},
  className = ''
}) {
  const solid = variant === 'solid';
  return /*#__PURE__*/React.createElement("svg", {
    className: `bs-sparkle ${className}`,
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    style: {
      display: 'block',
      ...style
    },
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 .8c.6 6 5.2 10.6 11.2 11.2C17.2 12.6 12.6 17.2 12 23.2 11.4 17.2 6.8 12.6 .8 12 6.8 11.4 11.4 6.8 12 .8Z",
    fill: solid ? color : 'none',
    stroke: solid ? 'none' : color,
    strokeWidth: strokeWidth,
    strokeLinejoin: "round"
  }));
}

/* ---- Single bubble / tapioca pearl ---- */
function Bubble({
  size = 18,
  color = 'currentColor',
  variant = 'outline',
  strokeWidth = 2.5,
  style = {},
  className = ''
}) {
  const solid = variant === 'solid';
  const r = solid ? 11 : 11 - strokeWidth / 2;
  return /*#__PURE__*/React.createElement("svg", {
    className: `bs-bubble ${className}`,
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    style: {
      display: 'block',
      ...style
    },
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: r,
    fill: solid ? color : 'none',
    stroke: solid ? 'none' : color,
    strokeWidth: strokeWidth
  }));
}

/* ---- Soft wave band (vague) — a divider/edge for the violet field ---- */
function Wave({
  color = 'var(--bs-violet-deep)',
  height = 28,
  flip = false,
  style = {},
  className = ''
}) {
  return /*#__PURE__*/React.createElement("svg", {
    className: `bs-wave ${className}`,
    viewBox: "0 0 120 20",
    preserveAspectRatio: "none",
    width: "100%",
    height: typeof height === 'number' ? `${height}px` : height,
    style: {
      display: 'block',
      transform: flip ? 'scaleY(-1)' : 'none',
      ...style
    },
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M0 11 C 15 1, 25 1, 40 11 S 65 21, 80 11 S 105 1, 120 11 L120 20 L0 20 Z",
    fill: color
  }));
}

/* ---- Ambient scatter layer — sprinkles sparkles + bubbles across a parent.
        Parent must be position:relative. Recreates the menu's corner flourishes. ---- */
const SCATTER = [{
  x: 4,
  y: 10,
  t: 'bubble',
  s: 26,
  v: 'outline'
}, {
  x: 9,
  y: 26,
  t: 'bubble',
  s: 16,
  v: 'outline'
}, {
  x: 15,
  y: 6,
  t: 'sparkle',
  s: 22,
  v: 'solid'
}, {
  x: 2,
  y: 60,
  t: 'sparkle',
  s: 16,
  v: 'solid'
}, {
  x: 91,
  y: 14,
  t: 'sparkle',
  s: 26,
  v: 'solid'
}, {
  x: 96,
  y: 30,
  t: 'sparkle',
  s: 16,
  v: 'solid'
}, {
  x: 88,
  y: 6,
  t: 'bubble',
  s: 14,
  v: 'outline'
}, {
  x: 6,
  y: 88,
  t: 'sparkle',
  s: 20,
  v: 'solid'
}, {
  x: 12,
  y: 80,
  t: 'bubble',
  s: 13,
  v: 'outline'
}, {
  x: 94,
  y: 84,
  t: 'bubble',
  s: 22,
  v: 'outline'
}];
function Decorations({
  color = 'rgba(255,255,255,0.85)',
  opacity = 1,
  items = SCATTER,
  style = {},
  className = ''
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `bs-decorations ${className}`,
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      opacity,
      overflow: 'hidden',
      ...style
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      position: 'absolute',
      left: `${it.x}%`,
      top: `${it.y}%`,
      transform: 'translate(-50%,-50%)'
    }
  }, it.t === 'sparkle' ? /*#__PURE__*/React.createElement(Sparkle, {
    size: it.s,
    color: color,
    variant: it.v
  }) : /*#__PURE__*/React.createElement(Bubble, {
    size: it.s,
    color: color,
    variant: it.v,
    strokeWidth: 2.5
  }))));
}
Object.assign(__ds_scope, { Sparkle, Bubble, Wave, Decorations });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Decorations.jsx", error: String((e && e.message) || e) }); }

// components/brand/Logo.jsx
try { (() => {
/**
 * Bubble Stop wordmark.
 * Renders the official extracted logo (raster). Use `variant` for the two
 * ready surfaces, or pass an explicit `src`. The charter forbids recolouring,
 * deforming, inclining or shadowing the mark — so this component only ever
 * scales it and optionally sets the straight tagline beneath.
 */
const LOGO_SRC = {
  ink: 'assets/logo/bubble-stop-logo-ink.png',
  // violet wordmark — for light surfaces
  white: 'assets/logo/bubble-stop-logo-white.png' // white wordmark — for violet / photo surfaces
};
function Logo({
  variant = 'ink',
  src,
  height = 56,
  tagline = false,
  alt = 'Bubble Stop',
  className = '',
  style = {}
}) {
  const resolved = src || LOGO_SRC[variant] || LOGO_SRC.ink;
  const h = typeof height === 'number' ? `${height}px` : height;
  const onViolet = variant === 'white';
  const tagColor = onViolet ? 'var(--bs-lavender)' : 'var(--bs-violet)';
  const tagSize = `calc(${h} * 0.165)`;
  return /*#__PURE__*/React.createElement("span", {
    className: `bs-logo ${className}`,
    style: {
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: `calc(${h} * 0.12)`,
      lineHeight: 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: resolved,
    alt: alt,
    style: {
      height: h,
      width: 'auto',
      display: 'block'
    }
  }), tagline && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontWeight: 700,
      fontSize: tagSize,
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      color: tagColor,
      paddingLeft: '0.2em'
    }
  }, "Fresh\xA0Tea\xA0and\xA0Boba"));
}
Object.assign(__ds_scope, { Logo });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Logo.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Small label / marker. Use `star` for the carte's ✱ "froid uniquement"
 * marker, or `color`/`fg` to key a badge to a product family.
 */
function Badge({
  variant = 'solid',
  color,
  fg,
  star = false,
  className = '',
  style = {},
  children,
  ...rest
}) {
  const cls = ['bs-badge', variant !== 'solid' && `bs-badge--${variant}`, className].filter(Boolean).join(' ');
  const st = {
    ...style
  };
  if (color) st['--badge-bg'] = color;
  if (fg) st['--badge-fg'] = fg;
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls,
    style: st
  }, rest), star && /*#__PURE__*/React.createElement("span", {
    className: "bs-badge__star",
    "aria-hidden": "true"
  }, "\u2731"), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Bubble Stop button. Rounded "candy" pill with a chunky violet drop and a
 * springy press. Use `primary` (violet) for the main action, `secondary`
 * (green) for the fresh/positive action, `outline`/`ghost` for the rest.
 */
function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  href,
  as,
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  const Tag = href ? 'a' : as || 'button';
  const cls = ['bs-btn', `bs-btn--${variant}`, size !== 'md' && `bs-btn--${size}`, block && 'bs-btn--block', className].filter(Boolean).join(' ');
  const extra = Tag === 'button' ? {
    type
  } : {};
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: cls,
    href: href
  }, extra, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Bubble Stop card. The default `paper` surface is the carte's signature
 * white grid-paper (flat, no shadow). Pass `accent` (a product colour) for a
 * coloured top edge, or `interactive` for a hover-lift.
 */
function Card({
  surface = 'paper',
  accent,
  interactive = false,
  as = 'div',
  className = '',
  style = {},
  children,
  ...rest
}) {
  const Tag = as;
  const cls = ['bs-card', surface === 'paper' && 'bs-card--paper', accent && 'bs-card--accent', interactive && 'bs-card--interactive', className].filter(Boolean).join(' ');
  const st = accent ? {
    '--accent': accent,
    ...style
  } : style;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: cls,
    style: st
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/menu/FlavorList.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Grouped flavour lists, the carte way: an underlined sub-head
 * ("Thé noir" / "Thé vert") above a multi-column run of flavour names.
 */
function FlavorList({
  groups = [],
  columns = 3,
  className = '',
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `bs-flavors ${className}`,
    style: style
  }, rest), groups.map((g, i) => /*#__PURE__*/React.createElement("div", {
    className: "bs-flavors__group",
    key: i
  }, g.label && /*#__PURE__*/React.createElement("span", {
    className: "bs-flavors__head"
  }, g.label), /*#__PURE__*/React.createElement("div", {
    className: "bs-flavors__items",
    style: {
      '--cols': g.columns || columns
    }
  }, g.items.map((it, j) => /*#__PURE__*/React.createElement("span", {
    key: j
  }, it))))));
}
Object.assign(__ds_scope, { FlavorList });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/menu/FlavorList.jsx", error: String((e && e.message) || e) }); }

// components/menu/PricePill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Format a number as a Bubble Stop price: 3.5 → "3,5€", 6 → "6€". Strings pass through. */
function euro(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'string') return v;
  const s = (Math.round(v * 100) / 100).toString().replace('.', ',');
  return s + '€';
}
const SIZE_COLOR = {
  S: 'var(--size-s)',
  M: 'var(--size-m)',
  L: 'var(--size-l)'
};

/**
 * The carte's candy size-price pill. Auto-coloured by `size`
 * (S=green · M=sky · L=pink); override with `color`, or pass a ready
 * `label` for one-offs (e.g. specials priced at a single size).
 */
function PricePill({
  size,
  price,
  label,
  color,
  small = false,
  className = '',
  style = {},
  ...rest
}) {
  const bg = color || SIZE_COLOR[size] || 'var(--size-m)';
  const text = label != null ? label : `${size ? size + ' : ' : ''}${euro(price)}`;
  const cls = ['bs-pricepill', small && 'bs-pricepill--sm', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls,
    style: {
      '--pill-bg': bg,
      ...style
    }
  }, rest), text);
}
Object.assign(__ds_scope, { euro, PricePill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/menu/PricePill.jsx", error: String((e && e.message) || e) }); }

// components/menu/CategoryHeading.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * A drink-family heading: Paytone One title (+ optional ✱ cold marker),
 * a one-line description, the S/M/L price pills, and an optional note line
 * (e.g. "supplément lait d'avoine : +0,60€"). `accent` colours the title.
 */
function CategoryHeading({
  title,
  description,
  prices = [],
  note,
  cold = false,
  accent,
  align = 'left',
  className = '',
  style = {},
  children,
  ...rest
}) {
  const st = {
    ...style,
    textAlign: align === 'center' ? 'center' : 'left'
  };
  if (accent) st['--accent'] = accent;
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `bs-cat ${className}`,
    style: st
  }, rest), /*#__PURE__*/React.createElement("h3", {
    className: "bs-cat__title"
  }, title, cold && /*#__PURE__*/React.createElement("span", {
    className: "bs-badge__star",
    style: {
      fontSize: '.5em',
      verticalAlign: 'super',
      marginLeft: '.12em'
    },
    "aria-hidden": "true"
  }, "\u2731")), description && /*#__PURE__*/React.createElement("p", {
    className: "bs-cat__desc"
  }, description), prices.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "bs-cat__prices",
    style: align === 'center' ? {
      justifyContent: 'center'
    } : undefined
  }, prices.map((p, i) => /*#__PURE__*/React.createElement(__ds_scope.PricePill, {
    key: i,
    size: p.size,
    price: p.price,
    label: p.label,
    color: p.color
  }))), note && /*#__PURE__*/React.createElement("p", {
    className: "bs-cat__note"
  }, note), children);
}
Object.assign(__ds_scope, { CategoryHeading });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/menu/CategoryHeading.jsx", error: String((e && e.message) || e) }); }

// components/menu/MenuItem.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * A single named drink — used for the carte's specials (Mango Punch, Crème
 * Brûlée, Tiger Sugar, Matcha Mousse…): Paytone One name (+ optional ✱),
 * a one-line recipe, and a single price pill.
 */
function MenuItem({
  name,
  recipe,
  price,
  size,
  label,
  cold = false,
  accent,
  className = '',
  style = {},
  children,
  ...rest
}) {
  const st = {
    ...style
  };
  if (accent) st['--accent'] = accent;
  const hasPrice = price != null || label != null || size != null;
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `bs-item ${className}`,
    style: st
  }, rest), /*#__PURE__*/React.createElement("h4", {
    className: "bs-item__name"
  }, name, cold && /*#__PURE__*/React.createElement("span", {
    className: "bs-badge__star",
    style: {
      fontSize: '.5em',
      verticalAlign: 'super',
      marginLeft: '.12em'
    },
    "aria-hidden": "true"
  }, "\u2731")), recipe && /*#__PURE__*/React.createElement("p", {
    className: "bs-item__recipe"
  }, recipe), hasPrice && /*#__PURE__*/React.createElement("div", {
    className: "bs-item__price"
  }, /*#__PURE__*/React.createElement(__ds_scope.PricePill, {
    size: size,
    price: price,
    label: label
  })), children);
}
Object.assign(__ds_scope, { MenuItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/menu/MenuItem.jsx", error: String((e && e.message) || e) }); }

// components/menu/SizeSelector.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* A simple takeaway-cup glyph: domed lid, straw, tapered body (outline). */
function CupGlyph({
  h = 60,
  color = 'currentColor',
  fill = 'none',
  stroke = 3.4
}) {
  const w = Math.round(h * 0.74);
  return /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: h,
    viewBox: "0 -14 74 110",
    fill: "none",
    "aria-hidden": "true",
    style: {
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("rect", {
    x: "46",
    y: "-12",
    width: "8",
    height: "42",
    rx: "4",
    transform: "rotate(15 50 9)",
    fill: color
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 19 Q37 0 65 19 Z",
    fill: color
  }), /*#__PURE__*/React.createElement("rect", {
    x: "6",
    y: "17",
    width: "62",
    height: "11",
    rx: "5",
    fill: color
  }), /*#__PURE__*/React.createElement("path", {
    d: "M11 31 L63 31 L56 92 Q55 97 50 97 L24 97 Q19 97 18 92 Z",
    fill: fill,
    stroke: color,
    strokeWidth: stroke,
    strokeLinejoin: "round"
  }));
}
const DEFAULT_SIZES = [{
  id: 'S',
  vol: '360ml',
  h: 52
}, {
  id: 'M',
  vol: '500ml',
  h: 66
}, {
  id: 'L',
  vol: '700ml',
  h: 82
}];

/**
 * The carte's TAILLE selector — three takeaway cups (S/M/L) with volumes.
 * Static legend by default; pass `selectable` + `value`/`onChange` to use it
 * as a picker (selected cup fills with `selectedColor`).
 */
function SizeSelector({
  value,
  onChange,
  sizes = DEFAULT_SIZES,
  color = 'var(--bs-violet)',
  selectedColor = 'var(--bs-green)',
  selectable = false,
  className = '',
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `bs-sizesel ${className}`,
    style: {
      display: 'inline-flex',
      alignItems: 'flex-end',
      gap: 20,
      ...style
    }
  }, rest), sizes.map(it => {
    const sel = selectable && value === it.id;
    const Tag = selectable ? 'button' : 'div';
    const c = sel ? selectedColor : color;
    return /*#__PURE__*/React.createElement(Tag, {
      key: it.id,
      type: selectable ? 'button' : undefined,
      "aria-pressed": selectable ? sel : undefined,
      onClick: selectable ? () => onChange && onChange(it.id) : undefined,
      className: ['bs-sizeopt', selectable && 'bs-sizeopt--selectable'].filter(Boolean).join(' ')
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'relative',
        display: 'inline-block',
        color: c
      }
    }, /*#__PURE__*/React.createElement(CupGlyph, {
      h: it.h,
      color: c,
      fill: sel ? 'color-mix(in srgb, currentColor 16%, transparent)' : 'none'
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        inset: '18% 0 0 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        color: c,
        fontSize: it.h * 0.34,
        lineHeight: 1
      }
    }, it.id)), /*#__PURE__*/React.createElement("span", {
      className: "bs-sizeopt__vol",
      style: {
        color: c
      }
    }, it.vol));
  }));
}
Object.assign(__ds_scope, { SizeSelector });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/menu/SizeSelector.jsx", error: String((e && e.message) || e) }); }

// components/menu/SugarLevel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const DEFAULT_LEVELS = [{
  id: 'normal',
  label: 'Normal (dose par défaut)',
  amount: 1
}, {
  id: 'moyen',
  label: 'Moyen',
  amount: 0.58
}, {
  id: 'none',
  label: 'Sans sucre ajouté',
  amount: 0.2
}];

/**
 * The carte's SUCRE legend — descending bars (Normal → Moyen → Sans sucre).
 * Static by default; pass `selectable` + `value`/`onChange` to use it as a
 * picker. `color` sets the bar colour (use #fff on the violet field).
 */
function SugarLevel({
  value,
  onChange,
  options = DEFAULT_LEVELS,
  color = 'var(--bs-violet)',
  selectedColor = 'var(--bs-green)',
  labelColor,
  trackWidth = 76,
  selectable = false,
  className = '',
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `bs-sugar ${className}`,
    style: style
  }, rest), options.map(it => {
    const sel = selectable && value === it.id;
    const Tag = selectable ? 'button' : 'div';
    const barColor = sel ? selectedColor : color;
    return /*#__PURE__*/React.createElement(Tag, {
      key: it.id,
      type: selectable ? 'button' : undefined,
      "aria-pressed": selectable ? sel : undefined,
      onClick: selectable ? () => onChange && onChange(it.id) : undefined,
      className: ['bs-sugar__row', selectable && 'bs-sugar__row--selectable'].filter(Boolean).join(' ')
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-block',
        width: trackWidth,
        flex: 'none'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        height: 11,
        borderRadius: 6,
        width: `${Math.round(it.amount * 100)}%`,
        background: barColor,
        transition: 'width var(--dur-base) var(--ease-out), background var(--dur-fast)'
      }
    })), /*#__PURE__*/React.createElement("span", {
      className: "bs-sugar__label",
      style: {
        fontWeight: sel ? 700 : 500,
        color: labelColor || color
      }
    }, it.label));
  }));
}
Object.assign(__ds_scope, { SugarLevel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/menu/SugarLevel.jsx", error: String((e && e.message) || e) }); }

// components/menu/ToppingChip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Topping chip — a rounded pill for the carte's toppings (perles de saveur,
 * jellies, tapioca…). Decorative by default; pass `selectable` to make it a
 * toggle (e.g. in an ordering flow). `dot` adds a small flavour dot.
 */
function ToppingChip({
  children,
  label,
  dot = false,
  dotColor,
  selectable = false,
  selected = false,
  onClick,
  className = '',
  style = {},
  ...rest
}) {
  const st = {
    ...style
  };
  if (dotColor) st['--chip-dot'] = dotColor;
  const cls = ['bs-chip', selectable && 'bs-chip--selectable', className].filter(Boolean).join(' ');
  const content = label != null ? label : children;
  const inner = /*#__PURE__*/React.createElement(React.Fragment, null, dot && /*#__PURE__*/React.createElement("span", {
    className: "bs-chip__dot",
    "aria-hidden": "true"
  }), content);
  if (selectable) {
    return /*#__PURE__*/React.createElement("button", _extends({
      type: "button",
      className: cls,
      style: st,
      "aria-pressed": selected,
      onClick: onClick
    }, rest), inner);
  }
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls,
    style: st
  }, rest), inner);
}
Object.assign(__ds_scope, { ToppingChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/menu/ToppingChip.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Sparkle = __ds_scope.Sparkle;

__ds_ns.Bubble = __ds_scope.Bubble;

__ds_ns.Wave = __ds_scope.Wave;

__ds_ns.Decorations = __ds_scope.Decorations;

__ds_ns.Logo = __ds_scope.Logo;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.CategoryHeading = __ds_scope.CategoryHeading;

__ds_ns.FlavorList = __ds_scope.FlavorList;

__ds_ns.MenuItem = __ds_scope.MenuItem;

__ds_ns.PricePill = __ds_scope.PricePill;

__ds_ns.SizeSelector = __ds_scope.SizeSelector;

__ds_ns.SugarLevel = __ds_scope.SugarLevel;

__ds_ns.ToppingChip = __ds_scope.ToppingChip;

})();
