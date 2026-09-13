import * as THREE from 'three'
import { SCREEN } from './dimensions'

/* ==================================================================
   The display, painted into a canvas.

   Design space is 1440 units wide, the same 1440 used in the CSS layer.
   One unit is 1440/393 = 3.664 pt, so every metric below is a real iOS
   metric converted rather than invented: 17 pt body = 62 units, a 38 pt
   notification icon = 139 units, an 84 pt notification = 330 units. That
   is what keeps the close-up in the screen fold from looking like a
   drawing of an interface.
   ================================================================== */

const VW = 1440
const VH = Math.round((VW * SCREEN.height) / SCREEN.width) // 8717
const PT = VW / 393

/** The lock screen's clock. */
const CLOCK_TIME = '1:00'
/** 9月10日 is a Sunday if 9月12日 is a Tuesday, which the sheet had. */
const CLOCK_DATE = '9月10日 星期日'

const FONT =
  'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif'

const CARD = {
  x: 90,
  w: 1260,
  r: 56,
  /** Top of the list, below the clock and the date. */
  first: 1980,
  /** The list is laid out to end here, just above the home controls. */
  bottom: 8400,
}

/** Minimum and maximum card height, in design units (90 pt to 142 pt). */
const CARD_MIN = 300
const CARD_MAX = 520

/** Line height for a wrapped body. */
const BODY_LINE = 84
/** How many body lines a card will show before it truncates. */
const BODY_LINES = 2

/**
 * The Now Playing widget. It is not a notification and does not share its
 * metrics: iOS draws it taller, with the artwork, a scrubber and a row of
 * transport controls.
 */
const NOW_PLAYING = {
  h: 860,
  pad: 62,
  art: 280,
}

interface Metrics {
  h: number
  gap: number
}

/**
 * Card height and gap for however many notifications there happen to be.
 *
 * These were tuned by hand twice and were wrong twice: eighteen items
 * needed 330 and 52, eleven needed 460 and 92, and with fourteen the
 * hand-picked numbers run 350 units off the bottom of the panel. Rather
 * than keep guessing, the pair is solved so the list always ends at
 * CARD.bottom: the gap is a fixed fraction of the card, and the card is
 * whatever is left over. The bounds stop it from going silly at the
 * extremes — a very short list would otherwise give 140 pt cards with the
 * text floating in the middle of them.
 */
function cardMetrics(count: number, extraLines: number): Metrics {
  const avail = CARD.bottom - CARD.first - NOW_PLAYING.h - extraLines * BODY_LINE
  // 1.2 = one card plus its 0.2 gap, per item.
  let h = avail / (1.2 * count)
  h = Math.min(CARD_MAX, Math.max(CARD_MIN, h))
  let gap = Math.round(h * 0.2)
  const need = count * h + count * gap + extraLines * BODY_LINE
  if (need > avail) {
    // Clamped at the floor and still too tall: take the rest out of the gap.
    gap = Math.max(16, gap - Math.ceil((need - avail) / count))
  }
  return { h: Math.round(h), gap }
}

interface Notice {
  app: string
  color: string
  glyph: Glyph
  time: string
  title: string
  body: string
}

type Glyph =
  | 'bubble'
  | 'check'
  | 'heart'
  | 'cam'
  | 'bolt'
  | 'sun'
  | 'card'
  | 'pin'
  | 'play'
  | 'mail'
  | 'bag'
  | 'house'
  | 'note'
  | 'book'
  | 'news'
  | 'chart'
  | 'cal'
  | 'flower'
  | 'mic'
  | 'find'

/* The lock screen is a 6:1 panel, and everything on it fits at once
   without scrolling, which is the entire argument the section is making.

   Timestamps all sit between 00:00 and 01:00 because the clock above them
   reads 1:00. */
const NOTICES: Notice[] = [
  { app: '超信', color: '#07c160', glyph: 'bubble', time: '现在', title: '诺澜', body: '「我等你」等 7 条新消息' },
  { app: '图书', color: '#ff5b2e', glyph: 'book', time: '00:56', title: '《爱情三脚猫》', body: '您订阅的漫画更新了' },
  { app: '新闻', color: '#ff375f', glyph: 'news', time: '00:50', title: '独家揭秘「蟑螂鼠」之谜', body: '热点 · 阅读 12 万' },
  { app: '新闻', color: '#ff375f', glyph: 'news', time: '00:44', title: '黄宝强登顶首富', body: '财经 · 阅读 8.6 万' },
  { app: '提醒事项', color: '#ff9500', glyph: 'check', time: '00:38', title: '今日有一项日程', body: '20:00 终极泳池派对' },
  { app: '天气', color: '#007aff', glyph: 'sun', time: '00:33', title: '今日晴', body: '宜观赏流星雨' },
  { app: '钱包', color: '#1c1c1e', glyph: 'card', time: '00:28', title: '最近交易', body: '《飞跃创界山（开天辟地之裂变的大地）》桌游 RMB 321' },
  { app: '地图', color: '#007aff', glyph: 'pin', time: '00:23', title: '前方 400 米直行', body: '文化佳园' },
  { app: '邮件', color: '#007aff', glyph: 'mail', time: '00:18', title: '未读 1 封', body: '发信人：拒绝者' },
  { app: 'App Store', color: '#007aff', glyph: 'bag', time: '00:14', title: '今日推荐', body: '小龙虾' },
  { app: '备忘录', color: '#ffcc00', glyph: 'note', time: '00:09', title: '新备忘录', body: '请记住，天使与你同在，你本来就很美' },
  { app: '照片', color: '#ff2d55', glyph: 'flower', time: '00:05', title: '回忆', body: '一起去看流星雨' },
  { app: '播客', color: '#af52de', glyph: 'mic', time: '00:02', title: '新单集', body: '《桃花侠大战菊花怪》' },
]

/* --- primitives --------------------------------------------------- */

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.lineTo(x + w - rad, y)
  ctx.arcTo(x + w, y, x + w, y + rad, rad)
  ctx.lineTo(x + w, y + h - rad)
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad)
  ctx.lineTo(x + rad, y + h)
  ctx.arcTo(x, y + h, x, y + h - rad, rad)
  ctx.lineTo(x, y + rad)
  ctx.arcTo(x, y, x + rad, y, rad)
  ctx.closePath()
}

/** Truncate to one line, the way iOS clips a long notification body. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let out = text
  while (out.length > 1 && ctx.measureText(out + '…').width > max) out = out.slice(0, -1)
  return out + '…'
}

/** Characters that may not start a line in Chinese typesetting. */
const NO_LINE_START = '，。、；：！？）］｝〉》」』】…％℃'
/** Characters that may not end one. */
const NO_LINE_END = '（［｛〈《「『【'

/**
 * Wrap to at most `maxLines` lines.
 *
 * Character by character rather than by word: Chinese has no spaces, so
 * there is nothing else to break on. The two punctuation sets are the
 * real rule from Chinese typesetting and they earn their keep here — the
 * wallet body wraps around 《…（…）》 and without them the line break lands
 * between the 》 and the 桌 rather than in a place a reader accepts.
 *
 * A short last line is rebalanced against the one above it. Sixteen
 * characters and then a lone 美 on the second line is technically correct
 * wrapping and looks like a bug.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  max: number,
  maxLines: number
): string[] {
  const lines: string[] = []
  let line = ''
  for (const ch of text) {
    if (line && ctx.measureText(line + ch).width > max) {
      if (NO_LINE_START.includes(ch) && line.length > 1) {
        lines.push(line + ch)
        line = ''
        continue
      }
      if (NO_LINE_END.includes(line[line.length - 1]) && line.length > 1) {
        lines.push(line.slice(0, -1))
        line = line[line.length - 1] + ch
        continue
      }
      lines.push(line)
      line = ch
    } else {
      line += ch
    }
  }
  if (line) lines.push(line)

  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    const rest = lines.slice(maxLines).join('')
    kept[maxLines - 1] = fit(ctx, kept[maxLines - 1] + rest, max)
    return kept
  }

  while (
    lines.length > 1 &&
    lines[lines.length - 1].length < 4 &&
    lines[lines.length - 2].length > 6
  ) {
    const prev = lines[lines.length - 2]
    lines[lines.length - 1] = prev.slice(-1) + lines[lines.length - 1]
    lines[lines.length - 2] = prev.slice(0, -1)
  }
  return lines
}

/* --- status bar glyphs --------------------------------------------

   iOS metrics, in points, converted through PT: the cellular indicator
   is about 17.5 x 11.5 pt, wi-fi 17 x 11.5, the battery 27 x 12, and the
   gaps between them are 8. The first version drew all three at roughly
   half that, which is why they read as specks next to a 17 pt clock, and
   it also stacked them on three different vertical centres: the bars grow
   UP from their `y`, the wi-fi arcs hang BELOW it, and the battery is
   centred ON it, so passing one shared `y` to all three put the battery
   a good 15 units low. Everything below is placed by its optical centre.
   ------------------------------------------------------------------ */

/** Optical centre of the status bar row, measured down from the screen's top. */
const STATUS_CY = 100

function signalBars(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const heights = [0.38, 0.56, 0.76, 1]
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 4; i++) {
    const h = s * heights[i]
    rr(ctx, x + i * (s * 0.42), y - h, s * 0.26, h, s * 0.1)
    ctx.fill()
  }
}

/** Total width of a signalBars() call of size s. */
const BARS_W = (s: number) => 3 * (s * 0.42) + s * 0.26
/** Total height, i.e. the tall bar. */
const BARS_H = (s: number) => s

function wifi(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.strokeStyle = '#ffffff'
  ctx.lineCap = 'round'
  for (let i = 0; i < 3; i++) {
    const r = s * (0.38 + i * 0.3)
    ctx.lineWidth = s * 0.15
    ctx.beginPath()
    ctx.arc(x, y, r, Math.PI * 1.24, Math.PI * 1.76)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(x, y, s * 0.1, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
}

/** Total width of a wifi() call of size s. */
const WIFI_W = (s: number) => 2 * 0.73 * 0.98 * s
/** Distance from the arc centre down to the optical centre. */
const WIFI_DROP = (s: number) => 0.49 * s * 0.98

function battery(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = h * 0.09
  rr(ctx, x, y - h / 2, w, h, h * 0.32)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  rr(ctx, x + w + h * 0.1, y - h * 0.16, h * 0.14, h * 0.32, h * 0.07)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  rr(ctx, x + h * 0.16, y - h / 2 + h * 0.16, (w - h * 0.32) * 0.87, h * 0.68, h * 0.2)
  ctx.fill()
}

/** Total width of a battery() call, nub included. */
const BATTERY_W = (w: number, h: number) => w + h * 0.24

/* --- app icon glyphs ---------------------------------------------- */

function glyph(ctx: CanvasRenderingContext2D, kind: Glyph, cx: number, cy: number, s: number) {
  ctx.save()
  ctx.strokeStyle = '#ffffff'
  ctx.fillStyle = '#ffffff'
  ctx.lineWidth = s * 0.17
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const L = -s / 2

  switch (kind) {
    case 'bubble':
      rr(ctx, cx - s * 0.55, cy - s * 0.46, s * 1.1, s * 0.78, s * 0.3)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(cx - s * 0.16, cy + s * 0.3)
      ctx.lineTo(cx - s * 0.16, cy + s * 0.62)
      ctx.lineTo(cx + s * 0.2, cy + s * 0.3)
      ctx.closePath()
      ctx.fill()
      break
    case 'check':
      ctx.beginPath()
      ctx.arc(cx, cy, s * 0.58, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx - s * 0.28, cy + s * 0.02)
      ctx.lineTo(cx - s * 0.06, cy + s * 0.24)
      ctx.lineTo(cx + s * 0.3, cy - s * 0.24)
      ctx.stroke()
      break
    case 'heart':
      ctx.beginPath()
      ctx.moveTo(cx, cy + s * 0.5)
      ctx.bezierCurveTo(cx - s * 0.95, cy - s * 0.05, cx - s * 0.5, cy - s * 0.75, cx, cy - s * 0.24)
      ctx.bezierCurveTo(cx + s * 0.5, cy - s * 0.75, cx + s * 0.95, cy - s * 0.05, cx, cy + s * 0.5)
      ctx.fill()
      break
    case 'cam':
      rr(ctx, cx - s * 0.62, cy - s * 0.44, s * 1.24, s * 0.88, s * 0.22)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx, cy, s * 0.24, 0, Math.PI * 2)
      ctx.fill()
      rr(ctx, cx - s * 0.22, cy - s * 0.62, s * 0.44, s * 0.2, s * 0.08)
      ctx.fill()
      break
    case 'bolt':
      ctx.beginPath()
      ctx.moveTo(cx + s * 0.18, cy - s * 0.6)
      ctx.lineTo(cx - s * 0.36, cy + s * 0.08)
      ctx.lineTo(cx - s * 0.02, cy + s * 0.08)
      ctx.lineTo(cx - s * 0.18, cy + s * 0.6)
      ctx.lineTo(cx + s * 0.36, cy - s * 0.1)
      ctx.lineTo(cx + s * 0.02, cy - s * 0.1)
      ctx.closePath()
      ctx.fill()
      break
    case 'sun':
      ctx.beginPath()
      ctx.arc(cx, cy, s * 0.28, 0, Math.PI * 2)
      ctx.fill()
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * s * 0.44, cy + Math.sin(a) * s * 0.44)
        ctx.lineTo(cx + Math.cos(a) * s * 0.62, cy + Math.sin(a) * s * 0.62)
        ctx.stroke()
      }
      break
    case 'card':
      rr(ctx, cx - s * 0.62, cy - s * 0.42, s * 1.24, s * 0.84, s * 0.16)
      ctx.stroke()
      ctx.fillRect(cx - s * 0.62, cy - s * 0.18, s * 1.24, s * 0.18)
      break
    case 'pin':
      ctx.beginPath()
      ctx.arc(cx, cy - s * 0.16, s * 0.36, Math.PI, 0)
      ctx.lineTo(cx, cy + s * 0.6)
      ctx.closePath()
      ctx.fill()
      break
    case 'play':
      ctx.beginPath()
      ctx.moveTo(cx - s * 0.3, cy - s * 0.5)
      ctx.lineTo(cx + s * 0.48, cy)
      ctx.lineTo(cx - s * 0.3, cy + s * 0.5)
      ctx.closePath()
      ctx.fill()
      break
    case 'mail':
      rr(ctx, cx - s * 0.62, cy - s * 0.4, s * 1.24, s * 0.8, s * 0.14)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx - s * 0.58, cy - s * 0.3)
      ctx.lineTo(cx, cy + s * 0.1)
      ctx.lineTo(cx + s * 0.58, cy - s * 0.3)
      ctx.stroke()
      break
    case 'bag':
      rr(ctx, cx - s * 0.5, cy - s * 0.18, s, s * 0.74, s * 0.14)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx, cy - s * 0.2, s * 0.26, Math.PI, 0)
      ctx.stroke()
      break
    case 'house':
      ctx.beginPath()
      ctx.moveTo(cx, cy - s * 0.58)
      ctx.lineTo(cx + s * 0.6, cy - s * 0.06)
      ctx.lineTo(cx + s * 0.42, cy - s * 0.06)
      ctx.lineTo(cx + s * 0.42, cy + s * 0.56)
      ctx.lineTo(cx - s * 0.42, cy + s * 0.56)
      ctx.lineTo(cx - s * 0.42, cy - s * 0.06)
      ctx.lineTo(cx - s * 0.6, cy - s * 0.06)
      ctx.closePath()
      ctx.fill()
      break
    case 'note':
      rr(ctx, cx - s * 0.52, cy - s * 0.6, s * 1.04, s * 1.2, s * 0.14)
      ctx.stroke()
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.moveTo(cx - s * 0.3, cy - s * 0.24 + i * s * 0.3)
        ctx.lineTo(cx + (i === 2 ? s * 0.02 : s * 0.3), cy - s * 0.24 + i * s * 0.3)
        ctx.stroke()
      }
      break
    case 'book':
      // An open book: two slanted pages with a spine gap between them.
      // A filled rectangle reads as a card, not a book, at this size.
      for (const dir of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(cx + dir * s * 0.05, cy - s * 0.44)
        ctx.lineTo(cx + dir * s * 0.54, cy - s * 0.62)
        ctx.lineTo(cx + dir * s * 0.54, cy + s * 0.44)
        ctx.lineTo(cx + dir * s * 0.05, cy + s * 0.62)
        ctx.closePath()
        ctx.fill()
      }
      break
    case 'news':
      ctx.lineWidth = s * 0.13
      rr(ctx, cx - s * 0.6, cy - s * 0.62, s * 1.2, s * 1.24, s * 0.12)
      ctx.stroke()
      ctx.fillRect(cx - s * 0.38, cy - s * 0.4, s * 0.46, s * 0.44)
      ctx.fillRect(cx + s * 0.18, cy - s * 0.4, s * 0.2, s * 0.44)
      ctx.fillRect(cx - s * 0.38, cy + s * 0.18, s * 0.76, s * 0.1)
      ctx.fillRect(cx - s * 0.38, cy + s * 0.38, s * 0.48, s * 0.1)
      break
    case 'chart':
      for (let i = 0; i < 3; i++) {
        const h = s * (0.34 + i * 0.22)
        rr(ctx, cx - s * 0.52 + i * s * 0.38, cy + s * 0.56 - h, s * 0.24, h, s * 0.08)
        ctx.fill()
      }
      break
    case 'cal':
      rr(ctx, cx - s * 0.6, cy - s * 0.52, s * 1.2, s * 1.06, s * 0.14)
      ctx.stroke()
      ctx.fillRect(cx - s * 0.6, cy - s * 0.52, s * 1.2, s * 0.26)
      ctx.beginPath()
      ctx.arc(cx, cy + s * 0.16, s * 0.12, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'flower':
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        ctx.beginPath()
        ctx.ellipse(
          cx + Math.cos(a) * s * 0.32,
          cy + Math.sin(a) * s * 0.32,
          s * 0.26,
          s * 0.26,
          0,
          0,
          Math.PI * 2
        )
        ctx.fill()
      }
      break
    case 'mic':
      rr(ctx, cx - s * 0.2, cy - s * 0.6, s * 0.4, s * 0.72, s * 0.2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx, cy - s * 0.04, s * 0.42, 0, Math.PI)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx, cy + s * 0.38)
      ctx.lineTo(cx, cy + s * 0.62)
      ctx.stroke()
      break
    case 'find':
      ctx.beginPath()
      ctx.arc(cx, cy, s * 0.5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx - s * 0.7, cy)
      ctx.lineTo(cx + s * 0.7, cy)
      ctx.moveTo(cx, cy - s * 0.7)
      ctx.lineTo(cx, cy + s * 0.7)
      ctx.stroke()
      break
  }
  void L
  ctx.restore()
}

function appIcon(ctx: CanvasRenderingContext2D, color: string, kind: Glyph, x: number, y: number, size: number) {
  rr(ctx, x, y, size, size, size * 0.235)
  ctx.fillStyle = color
  ctx.fill()
  glyph(ctx, kind, x + size / 2, y + size / 2, size * 0.6)
}

/* --- wallpaper ----------------------------------------------------
   The display's background, from the supplied art if it loaded and from a
   procedural fallback if it did not.

   The art is a phone-shaped 1080 x 2347; this panel is 6:1. Stretching it
   would turn every squircle in it into a tall ellipse, which reads as a
   mistake rather than as a design, so it is tiled down the panel with
   every other tile flipped. Mirroring makes the seams match by
   construction, and the art is near-symmetric about its own middle, so
   the repeat reads as one very long design rather than as three copies of
   a phone wallpaper.
   ------------------------------------------------------------------ */

/** Where the supplied art lives. Swap by replacing the file in public/. */
const WALLPAPER_URL = '/wallpaper.jpg'
const ALBUM_URL = '/album.jpg'

export const loadWallpaper = () => loadImage(WALLPAPER_URL)
export const loadAlbumArt = () => loadImage(ALBUM_URL)

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    let settled = false
    const done = (v: HTMLImageElement | null) => {
      if (settled) return
      settled = true
      resolve(v)
    }
    // Boot must not wait on the network. The phone can be built without
    // either image: the wallpaper falls back to a procedural gradient and
    // the album tile to a grey square, and a hung request would otherwise
    // leave the page with no 3D at all.
    window.setTimeout(() => done(null), 3000)
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => done(img)
    img.onerror = () => done(null)
    img.src = url
  })
}

function photoWallpaper(ctx: CanvasRenderingContext2D, photo: HTMLImageElement) {
  const tileH = photo.height * (VW / photo.width)
  let y = 0
  let flip = false
  while (y < VH) {
    ctx.save()
    if (flip) {
      ctx.translate(0, y + tileH)
      ctx.scale(1, -1)
    } else {
      ctx.translate(0, y)
    }
    ctx.drawImage(photo, 0, 0, photo.width, photo.height, 0, 0, VW, tileH)
    ctx.restore()
    y += tileH
    flip = !flip
  }
}

/** Scrims top and bottom, so the clock and the home indicator have
    something to sit on and the panel is darkest at its edges, which is
    where the cover glass's own reflection is strongest. */
function wallpaperScrims(ctx: CanvasRenderingContext2D) {
  const top = ctx.createLinearGradient(0, 0, 0, 1100)
  top.addColorStop(0, 'rgba(0,0,0,0.45)')
  top.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, VW, 1100)

  const bottom = ctx.createLinearGradient(0, VH - 1300, 0, VH)
  bottom.addColorStop(0, 'rgba(0,0,0,0)')
  bottom.addColorStop(1, 'rgba(0,0,0,0.6)')
  ctx.fillStyle = bottom
  ctx.fillRect(0, VH - 1300, VW, 1300)
}

/**
 * The fallback, used only if the art fails to load: a few very large, very
 * soft colour fields over black, the way Apple's own dark wallpapers are
 * built. An OLED is black; everything it shows is light added to black,
 * and only a black panel lets the cover glass's reflection be seen.

 * Radial gradients are inherently soft, so this needs no ctx.filter,
 * which Safari did not ship until 16.4. Elliptical rather than circular:
 * the panel is 6:1, and circular fields on it read as spotlights.
 */
function proceduralWallpaper(ctx: CanvasRenderingContext2D) {
  // Not quite #000. An OLED's off state is black, but the panel is behind
  // glass that is never perfectly clean, and a floor of 3 or 4 keeps the
  // display from looking like a hole cut in the page.
  ctx.fillStyle = '#04050a'
  ctx.fillRect(0, 0, VW, VH)

  // Added like light rather than painted over: overlapping fields mix the
  // way two coloured lamps do, instead of the second hiding the first.
  ctx.globalCompositeOperation = 'lighter'

  const field = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    tint: string,
    alpha: number
  ) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(rx, ry)
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
    g.addColorStop(0, `rgba(${tint},${alpha})`)
    g.addColorStop(0.45, `rgba(${tint},${alpha * 0.55})`)
    g.addColorStop(1, `rgba(${tint},0)`)
    ctx.fillStyle = g
    ctx.fillRect(-1, -1, 2, 2)
    ctx.restore()
  }

  // Alphas stay low. These overlap, and additive compositing accumulates:
  // at 0.9 each the middle of the panel saturates to a light blue and the
  // wallpaper reads as a backlight again.
  field(170, 850, 1500, 1900, '26,62,224', 0.5)
  field(1160, 2500, 1400, 1750, '104,38,214', 0.46)
  field(-260, 4600, 1500, 1850, '0,158,180', 0.4)
  field(1340, 6800, 1500, 2000, '30,50,186', 0.46)
  field(560, 8350, 1500, 1450, '116,30,162', 0.32)

  ctx.globalCompositeOperation = 'source-over'
}

function wallpaper(ctx: CanvasRenderingContext2D, photo: HTMLImageElement | null) {
  if (photo) photoWallpaper(ctx, photo)
  else proceduralWallpaper(ctx)
  wallpaperScrims(ctx)
}

/* --- layers ------------------------------------------------------- */

function statusBar(ctx: CanvasRenderingContext2D) {
  const cy = STATUS_CY

  ctx.fillStyle = '#ffffff'
  ctx.font = `600 ${Math.round(17 * PT)}px ${FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  // 17 pt semibold, sat on the row's optical centre rather than on a
  // baseline that happened to look right on its own.
  ctx.fillText(CLOCK_TIME, 140, cy + Math.round(17 * PT * 0.35))

  // Laid out from the right edge inward, so the trailing inset matches
  // the 140 the clock has on the left.
  const right = VW - 140
  const gap = 8 * PT

  const bw = 88
  const bh = 44
  const bx = right - BATTERY_W(bw, bh)
  battery(ctx, bx, cy, bw, bh)

  const ws = 42
  wifi(ctx, bx - gap - WIFI_W(ws) / 2, cy + WIFI_DROP(ws), ws)

  const bs = 42
  const barsRight = bx - gap - WIFI_W(ws) - gap
  signalBars(ctx, barsRight - BARS_W(bs), cy + BARS_H(bs) / 2, bs)
}

function lockGlyph(ctx: CanvasRenderingContext2D, cy: number) {
  const s = 40
  ctx.save()
  ctx.translate(VW / 2, 0)
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 9
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(0, cy - s * 0.5, s * 0.55, Math.PI, 0)
  ctx.stroke()
  rr(ctx, -s * 0.82, cy - s * 0.5, s * 1.64, s * 1.32, s * 0.28)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fill()
  ctx.restore()
}

function clockAndDate(ctx: CanvasRenderingContext2D) {
  // Sized against the WIDTH, not the height. The sheet's own clock spans
  // about 44% of the display width, and 620 would have run to 82%:
  // scaling a lock screen by the height of a 6:1 panel makes the clock
  // read as a billboard.
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = `600 300px ${FONT}`
  ctx.fillText(CLOCK_TIME, VW / 2, 1500)

  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.font = `400 110px ${FONT}`
  ctx.fillText(CLOCK_DATE, VW / 2, 1700)
}

/**
 * One notification.
 *
 * Icon at the left, then a title with the timestamp trailing on the same
 * baseline, then the body. The app's NAME is not drawn: it is carried by
 * the icon's colour and glyph, which is what the reference does and what
 * iOS's own compact banner does. An earlier version put the app name on
 * the first line and pushed the title down, which cost the card its
 * subject — the title is the notification.
 *
 * The icon is centred on the card's height rather than aligned to the
 * first line, so it sits between the two lines the way the reference
 * does.
 */
function notification(
  ctx: CanvasRenderingContext2D,
  n: Notice,
  top: number,
  baseH: number
): number {
  const { x, w, r } = CARD

  const icon = 146
  const pad = 40
  const textX = x + pad + icon + 30
  const bodyMax = x + w - pad - textX
  const bodyFont = `400 ${Math.round(17 * PT)}px ${FONT}`
  const titleFont = `600 ${Math.round(17 * PT)}px ${FONT}`
  const timeFont = `400 ${Math.round(13 * PT)}px ${FONT}`

  // Vertical positions ride the card's height, so the type stays put
  // relative to the card when cardMetrics() changes it.
  const titleY = Math.round(baseH * 0.452)
  const bodyY = Math.round(baseH * 0.8)

  // Measure before drawing: the card's height depends on how many lines
  // the body needs, and the icon centres on that height.
  ctx.textBaseline = 'alphabetic'
  ctx.font = bodyFont
  const lines = wrapText(ctx, n.body, bodyMax, BODY_LINES)
  const cardH = baseH + (lines.length - 1) * BODY_LINE

  rr(ctx, x, top, w, cardH, r)
  ctx.fillStyle = 'rgba(255,255,255,0.10)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth = 2
  ctx.stroke()

  appIcon(ctx, n.color, n.glyph, x + pad, top + (cardH - icon) / 2, icon)

  // The timestamp is placed first so the title can be truncated to what is
  // actually left for it, rather than to a guess.
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,0.52)'
  ctx.font = timeFont
  ctx.fillText(n.time, x + w - pad, top + titleY)
  const timeW = ctx.measureText(n.time).width

  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font = titleFont
  ctx.fillText(fit(ctx, n.title, x + w - pad - timeW - 28 - textX), textX, top + titleY)

  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.font = bodyFont
  lines.forEach((ln, i) => {
    ctx.fillText(ln, textX, top + bodyY + i * BODY_LINE)
  })

  return cardH
}

/* --- Now Playing --------------------------------------------------
   Drawn from the supplied artwork rather than an SF Symbol set: the
   artwork is a real image, the transport glyphs are shapes, and the
   scrubber is a rounded track with a knob, which is all the reference has
   in it.
   ------------------------------------------------------------------ */

/** Album art, or a grey tile if the image did not load. */
function albumArt(
  ctx: CanvasRenderingContext2D,
  art: HTMLImageElement | null,
  x: number,
  y: number,
  size: number
) {
  const radius = size * 0.09
  ctx.save()
  rr(ctx, x, y, size, size, radius)
  ctx.clip()
  if (art) {
    // Cover, not fit: the artwork is square and so is the tile, so this
    // only matters if someone swaps in a non-square image.
    const scale = Math.max(size / art.width, size / art.height)
    const dw = art.width * scale
    const dh = art.height * scale
    ctx.drawImage(art, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh)
  } else {
    ctx.fillStyle = '#3a3d44'
    ctx.fillRect(x, y, size, size)
    glyph(ctx, 'play', x + size / 2, y + size / 2, size * 0.42)
  }
  ctx.restore()
  // A hairline, so a light cover does not bleed into a light card.
  ctx.save()
  rr(ctx, x, y, size, size, radius)
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
}

/** The three-bar "now playing" mark that sits at the top right. */
function nowPlayingMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  const heights = [0.45, 1, 0.62, 0.32]
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  for (let i = 0; i < heights.length; i++) {
    const h = s * heights[i]
    rr(ctx, cx + (i - 1.5) * (s * 0.38) - s * 0.09, cy - h / 2, s * 0.19, h, s * 0.08)
    ctx.fill()
  }
}

function transportIcon(
  ctx: CanvasRenderingContext2D,
  kind: 'star' | 'prev' | 'pause' | 'next' | 'phones',
  cx: number,
  cy: number,
  s: number
) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  switch (kind) {
    case 'star': {
      ctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const rad = i % 2 === 0 ? s * 0.5 : s * 0.22
        const px = cx + Math.cos(a) * rad
        const py = cy + Math.sin(a) * rad
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'prev':
    case 'next': {
      // Two triangles, apexes in the direction of travel. `u` flips the
      // whole pair: +1 puts the apexes at negative x (previous), -1 at
      // positive x (next).
      const u = kind === 'prev' ? 1 : -1
      for (const [apex, base] of [
        [-0.86, -0.22],
        [-0.14, 0.5],
      ]) {
        ctx.beginPath()
        ctx.moveTo(cx + apex * u * s, cy)
        ctx.lineTo(cx + base * u * s, cy - s * 0.42)
        ctx.lineTo(cx + base * u * s, cy + s * 0.42)
        ctx.closePath()
        ctx.fill()
      }
      break
    }
    case 'pause': {
      const gap = s * 0.16
      const w = s * 0.24
      const h = s * 0.86
      rr(ctx, cx - gap - w, cy - h / 2, w, h, w * 0.28)
      ctx.fill()
      rr(ctx, cx + gap, cy - h / 2, w, h, w * 0.28)
      ctx.fill()
      break
    }
    case 'phones': {
      ctx.lineWidth = s * 0.13
      ctx.beginPath()
      ctx.arc(cx, cy - s * 0.06, s * 0.42, Math.PI * 1.05, Math.PI * 1.95)
      ctx.stroke()
      rr(ctx, cx - s * 0.5, cy - s * 0.06, s * 0.24, s * 0.44, s * 0.09)
      ctx.fill()
      rr(ctx, cx + s * 0.26, cy - s * 0.06, s * 0.24, s * 0.44, s * 0.09)
      ctx.fill()
      break
    }
  }
}

function nowPlaying(ctx: CanvasRenderingContext2D, art: HTMLImageElement | null, top: number) {
  const { x, w } = CARD
  const { h, pad, art: artSize } = NOW_PLAYING

  rr(ctx, x, top, w, h, CARD.r)
  ctx.fillStyle = 'rgba(255,255,255,0.13)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'
  ctx.lineWidth = 2
  ctx.stroke()

  albumArt(ctx, art, x + pad, top + pad, artSize)

  const textX = x + pad + artSize + 38
  const titleY = top + pad + 74
  const artRight = x + w - pad - 90

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#ffffff'
  ctx.font = `600 ${Math.round(19 * PT)}px ${FONT}`
  ctx.fillText(fit(ctx, '我的未来式', artRight - textX), textX, titleY)

  ctx.fillStyle = 'rgba(255,255,255,0.62)'
  ctx.font = `400 ${Math.round(16 * PT)}px ${FONT}`
  ctx.fillText(fit(ctx, '郭采洁', artRight - textX), textX, titleY + 96)

  nowPlayingMark(ctx, x + w - pad - 42, titleY - 24, 72)

  // Scrubber. 0:08 into a 5:46 track, which is what the reference shows
  // and is also the only defensible position: a bar that is obviously
  // wrong at a glance would be worse than one that is merely static.
  const barY = top + 470
  const barX0 = x + pad + 132
  const barX1 = x + w - pad - 132
  const progress = 0.023

  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  rr(ctx, barX0, barY - 5, barX1 - barX0, 10, 5)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  rr(ctx, barX0, barY - 5, (barX1 - barX0) * progress, 10, 5)
  ctx.fill()

  ctx.font = `400 ${Math.round(13 * PT)}px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.textAlign = 'left'
  ctx.fillText('0:08', x + pad, barY + 6)
  ctx.textAlign = 'right'
  ctx.fillText('-5:38', x + w - pad, barY + 6)

  const rowY = top + 700
  const kinds = ['star', 'prev', 'pause', 'next', 'phones'] as const
  kinds.forEach((k, i) => {
    transportIcon(ctx, k, x + w * ((i + 0.5) / kinds.length), rowY, 96)
  })

  return h
}

function bottomControls(ctx: CanvasRenderingContext2D) {
  const cy = 8690
  const r = 60
  for (const cx of [300, VW - 300]) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.16)'
    ctx.fill()
  }
  // torch
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  rr(ctx, 300 - 15, cy - 26, 30, 34, 8)
  ctx.fill()
  rr(ctx, 300 - 21, cy - 34, 42, 12, 5)
  ctx.fill()
  // camera
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 8
  rr(ctx, VW - 300 - 30, cy - 22, 60, 44, 10)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(VW - 300, cy, 13, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(VW - 300 - 18, cy - 22)
  ctx.lineTo(VW - 300 - 8, cy - 34)
  ctx.lineTo(VW - 300 + 8, cy - 34)
  ctx.lineTo(VW - 300 + 18, cy - 22)
  ctx.stroke()

  // home indicator
  rr(ctx, VW / 2 - 210, 8840, 420, 13, 7)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.fill()
}

/**
 * Bake the bloom into the panel.
 *
 * A real display bleeds light: the white clock on a black OLED has a
 * visible halo, and its absence is a large part of why a rendered screen
 * reads as a picture of a screen. A post-process bloom pass would cost
 * several full-screen passes on a page whose entire budget is already
 * spent on the phone, so the halo is drawn into the texture instead,
 * where it is free at runtime and costs one blur at boot.
 *
 * The blur runs at a quarter resolution. A halo is by definition
 * low-frequency, and blurring 6 megapixels to get one is a boot cost
 * with nothing to show for it.
 */
function addDisplayBloom(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const w = canvas.width
  const h = canvas.height
  const gw = Math.max(64, Math.round(w / 4))
  const gh = Math.max(64, Math.round(h / 4))

  const glow = document.createElement('canvas')
  glow.width = gw
  glow.height = gh
  const gc = glow.getContext('2d')
  if (!gc) return
  // A high-pass, then a blur, in that order. Blurring first and then
  // adding the result back lifts the whole panel, which is the opposite
  // of what a halo is: the wallpaper came out at nearly twice its
  // intended luminance and the OLED read as frosted plastic. Contrast
  // around mid grey first throws the panel's own black away, so only the
  // text and the clock survive to be blurred.
  const filter = `contrast(3.4) blur(${Math.max(2, Math.round(gw * 0.014))}px)`
  gc.filter = filter
  // Filters are not universally available; if the assignment did not take,
  // compositing the copy back would lift the whole panel instead of
  // blooming its highlights, so do nothing at all.
  if (gc.filter !== filter) return
  gc.drawImage(canvas, 0, 0, w, h, 0, 0, gw, gh)

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  // `lighter` rather than `screen`: the panel is almost black away from
  // the text, so an additive halo adds almost nothing there and only the
  // highlights actually glow.
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.16
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(glow, 0, 0, w, h)
  ctx.restore()
}

/* --- entry point -------------------------------------------------- */

export function createScreenCanvas(
  targetWidth: number,
  photo: HTMLImageElement | null = null,
  album: HTMLImageElement | null = null,
  bloom = true
): HTMLCanvasElement {
  const scale = targetWidth / VW
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = Math.round(VH * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.textBaseline = 'alphabetic'

  wallpaper(ctx, photo)
  statusBar(ctx)
  lockGlyph(ctx, 1080)
  clockAndDate(ctx)
  // How many bodies need a second line decides how much height is left for
  // the cards, and the cards decide the gap, so this has to be measured
  // before anything is drawn.
  const bodyFont = `400 ${Math.round(17 * PT)}px ${FONT}`
  ctx.font = bodyFont
  const bodyMax = CARD.w - 80 - (40 + 146 + 30)
  const extraLines = NOTICES.filter((n) => wrapText(ctx, n.body, bodyMax, 3).length > 1).length
  const metrics = cardMetrics(NOTICES.length, extraLines)

  let notifyY = CARD.first
  // Now Playing sits above the notifications, the way iOS stacks it.
  notifyY += nowPlaying(ctx, album, notifyY) + metrics.gap
  for (const n of NOTICES) {
    notifyY += notification(ctx, n, notifyY, metrics.h) + metrics.gap
  }
  bottomControls(ctx)

  if (bloom) addDisplayBloom(canvas, ctx)

  return canvas
}

/**
 * Viewport-sized choice. At the closest point of the screen fold the
 * camera sees about 110 mm of the body, which is roughly 10.8 px/mm on a
 * 900 px-tall viewport, so 1024 across covers a 2x display. Mobile gets
 * half that and a matching DPR cap.
 */
export function screenTextureWidth(): number {
  const narrow = window.matchMedia('(max-width: 734px)').matches
  return narrow ? 512 : 1024
}

export function createScreenTexture(
  maxAnisotropy: number,
  photo: HTMLImageElement | null = null,
  album: HTMLImageElement | null = null
): THREE.CanvasTexture {
  const canvas = createScreenCanvas(screenTextureWidth(), photo, album)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = Math.min(maxAnisotropy, 16)
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}
