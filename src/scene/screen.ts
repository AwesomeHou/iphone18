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

const FONT =
  'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif'

const CARD = {
  x: 90,
  w: 1260,
  h: 330,
  /* 364, not 352. The bezels came in by 9.5 mm between them, which is
     212 units of extra panel height, and the list has to grow into it:
     eighteen cards at the old pitch left a visibly empty strip above the
     home indicator. */
  pitch: 348,
  first: 1980,
  r: 48,
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
  | 'chart'
  | 'cal'
  | 'flower'
  | 'mic'
  | 'find'

/* The screen is 6:1. Eighteen notifications fit at once without
   scrolling, which is the entire argument the section is making. */
const NOTICES: Notice[] = [
  { app: '信息', color: '#34c759', glyph: 'bubble', time: '现在', title: '你的手机太长了', body: '我够不到顶部。' },
  { app: '提醒事项', color: '#ff9500', glyph: 'check', time: '15:02', title: '「把 iPhone 18 放进裤袋」', body: '测试结果：失败' },
  { app: '健康', color: '#ff2d55', glyph: 'heart', time: '15:04', title: '今日步数 0 步', body: '你一直站在原地找手机的上半部分' },
  { app: '相机', color: '#8e8e93', glyph: 'cam', time: '15:05', title: '已识别', body: '一根 432 毫米的金属棒' },
  { app: '电池', color: '#34c759', glyph: 'bolt', time: '15:08', title: '电量 87%', body: '预计可用 41 小时' },
  { app: '天气', color: '#007aff', glyph: 'sun', time: '15:10', title: '今日晴', body: '手机上方 20 厘米处有云' },
  { app: '钱包', color: '#1c1c1e', glyph: 'card', time: '15:12', title: '最近交易', body: '「裤袋扩容服务」RMB 199' },
  { app: '地图', color: '#007aff', glyph: 'pin', time: '15:15', title: '前方 400 米直行', body: '你还在看屏幕底部' },
  { app: '音乐', color: '#ff3b30', glyph: 'play', time: '15:18', title: '正在播放', body: '《再长一点》' },
  { app: '邮件', color: '#007aff', glyph: 'mail', time: '15:22', title: '未读 1 封', body: '主题：关于你的设备高度' },
  { app: 'App Store', color: '#007aff', glyph: 'bag', time: '15:25', title: '今日推荐', body: '适合更高屏幕的应用' },
  { app: '家庭', color: '#ff9500', glyph: 'house', time: '15:30', title: '客厅的灯已关闭', body: '下午 3:30' },
  { app: '备忘录', color: '#ffcc00', glyph: 'note', time: '15:33', title: '新备忘录', body: '「别买」' },
  { app: '屏幕使用时间', color: '#5856d6', glyph: 'chart', time: '15:40', title: '本周日均 4 小时 12 分', body: '较上周持平' },
  { app: '日历', color: '#ff3b30', glyph: 'cal', time: '15:45', title: '今天 15:00', body: '「与裤袋的会议」已取消' },
  { app: '照片', color: '#ff2d55', glyph: 'flower', time: '15:50', title: '回忆', body: '「那部很长的手机」共 1 张' },
  { app: '播客', color: '#af52de', glyph: 'mic', time: '15:55', title: '新单集', body: '《为什么它这么长》第 1 集' },
  { app: '设置', color: '#8e8e93', glyph: 'find', time: '16:00', title: '完成设置', body: '还剩 4 项，其中 3 项需要两只手' },
  { app: '超信', color: '#07c160', glyph: 'bubble', time: '16:04', title: '诺澜', body: '「我等你」等 7 条新消息' },
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
   A few very large, very soft colour fields over black, the way Apple's
   own dark wallpapers are built.

   The previous version was the sheet's: a flat #3C4045 with a pale grey
   sweep walked along a bezier. It matched the reference's measured
   values and it still read as frosted plastic, because that is what a
   mid-grey field with a soft white streak through it IS — the eye calls
   it a backlit panel with a light leak across it, and no amount of cover
   glass drawn on top changes that. An OLED is black; everything it shows
   is light added to black. So the base is black and the colour is added,
   which is also what makes the cover glass's own reflection legible: a
   reflection can only be seen against a dark panel.

   Radial gradients are inherently soft, so this needs no ctx.filter,
   which Safari did not ship until 16.4. Elliptical rather than circular:
   the panel is 6:1, and circular fields on it read as spotlights.
   ------------------------------------------------------------------ */

function wallpaper(ctx: CanvasRenderingContext2D) {
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

  // Scrims top and bottom, so the clock and the home indicator always
  // have something to sit on and the panel is darkest at its edges, which
  // is where the cover glass's own reflection is strongest.
  const top = ctx.createLinearGradient(0, 0, 0, 1100)
  top.addColorStop(0, 'rgba(0,0,0,0.5)')
  top.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, VW, 1100)

  const bottom = ctx.createLinearGradient(0, VH - 1300, 0, VH)
  bottom.addColorStop(0, 'rgba(0,0,0,0)')
  bottom.addColorStop(1, 'rgba(0,0,0,0.6)')
  ctx.fillStyle = bottom
  ctx.fillRect(0, VH - 1300, VW, 1300)
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
  ctx.fillText('9:41', 140, cy + Math.round(17 * PT * 0.35))

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
  ctx.fillText('9:41', VW / 2, 1500)

  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.font = `400 110px ${FONT}`
  ctx.fillText('9月12日 星期二', VW / 2, 1700)
}

function notification(ctx: CanvasRenderingContext2D, n: Notice, top: number) {
  const { x, w, h, r } = CARD
  rr(ctx, x, top, w, h, r)
  ctx.fillStyle = 'rgba(255,255,255,0.10)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth = 2
  ctx.stroke()

  const icon = 146
  appIcon(ctx, n.color, n.glyph, x + 40, top + 32, icon)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = 'rgba(255,255,255,0.80)'
  ctx.font = `500 ${Math.round(15 * PT)}px ${FONT}`
  ctx.fillText(n.app, x + 40 + icon + 28, top + 96)

  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,0.52)'
  ctx.font = `400 ${Math.round(13 * PT)}px ${FONT}`
  ctx.fillText(n.time, x + w - 40, top + 96)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font = `600 ${Math.round(17 * PT)}px ${FONT}`
  ctx.fillText(fit(ctx, n.title, w - 80), x + 40, top + 214)

  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.font = `400 ${Math.round(17 * PT)}px ${FONT}`
  ctx.fillText(fit(ctx, n.body, w - 80), x + 40, top + 294)
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
  const filter = `contrast(3) blur(${Math.max(2, Math.round(gw * 0.014))}px)`
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
  ctx.globalAlpha = 0.3
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(glow, 0, 0, w, h)
  ctx.restore()
}

/* --- entry point -------------------------------------------------- */

export function createScreenCanvas(targetWidth: number, bloom = true): HTMLCanvasElement {
  const scale = targetWidth / VW
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = Math.round(VH * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.textBaseline = 'alphabetic'

  wallpaper(ctx)
  statusBar(ctx)
  lockGlyph(ctx, 1080)
  clockAndDate(ctx)
  NOTICES.forEach((n, i) => notification(ctx, n, CARD.first + i * CARD.pitch))
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

export function createScreenTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = createScreenCanvas(screenTextureWidth())
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = Math.min(maxAnisotropy, 16)
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}
