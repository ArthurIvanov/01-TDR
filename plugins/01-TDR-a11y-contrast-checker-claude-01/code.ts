// WCAG contrast checker: scans text and icon layers in the selection (or the
// current page when nothing is selected), reports AA / AAA compliance and lets
// the user recolor foreground / background right from the plugin UI.

figma.showUI(__html__, { width: 380, height: 660, themeColors: true })

type Kind = 'text' | 'icon'

// A colour pair of the element in another mode of a variable collection.
interface ModeColors {
  label: string
  fg: string
  bg: string
}

interface Result {
  id: string
  kind: Kind
  name: string
  text: string
  // Raw foreground colour (before opacity) and the opacity applied to it.
  fg: string
  fgAlpha: number
  // Effective backdrop colour.
  bg: string
  // WCAG ratio; null = could not be measured. Levels are judged in the UI.
  ratio: number | null
  large: boolean
  fontSize: number
  fgBound: boolean
  // Foreground is bound to a variable (so it can be edited at the source).
  fgVar: boolean
  bgBound: boolean
  bgEditable: boolean
  modes?: ModeColors[]
  note?: string
  // Pair mode: name of the layer used as the backdrop.
  pairBg?: string
}

interface Settings {
  method: 'wcag' | 'apca'
  pair: boolean
  swap: boolean
  highlight: boolean
}

// What the plugin needs to write a colour back to the document.
interface Meta {
  fgKind: 'fill' | 'stroke'
  range?: [number, number]
  bgNodeId?: string
  fgVarId?: string
}

// Notices follow the language the UI reports (Russian or English).
let lang: 'ru' | 'en' = 'en'
const L = (ru: string, en: string): string => (lang === 'ru' ? ru : en)

let cfg: Settings = { method: 'wcag', pair: false, swap: false, highlight: false }

const metaById = new Map<string, Meta>()

const toHex = (c: RGB): string =>
  '#' +
  [c.r, c.g, c.b]
    .map((v) => Math.round(v * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()

const fromHex = (hex: string): RGB | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

const lin = (v: number): number =>
  v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)

const luminance = (c: RGB): number =>
  0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)

const contrast = (a: RGB, b: RGB): number => {
  const l1 = luminance(a)
  const l2 = luminance(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

const blend = (top: RGB, alpha: number, bottom: RGB): RGB => ({
  r: top.r * alpha + bottom.r * (1 - alpha),
  g: top.g * alpha + bottom.g * (1 - alpha),
  b: top.b * alpha + bottom.b * (1 - alpha),
})

// Index of the topmost visible fill, or -1 when there are none.
function topFillIndex(fills: readonly Paint[] | typeof figma.mixed): number {
  if (fills === figma.mixed) return -1
  for (let i = fills.length - 1; i >= 0; i--) {
    if (fills[i].visible !== false && (fills[i].opacity ?? 1) > 0) return i
  }
  return -1
}

function topFill(fills: readonly Paint[] | typeof figma.mixed): Paint | null {
  const i = topFillIndex(fills)
  return i < 0 ? null : (fills as readonly Paint[])[i]
}

const isBound = (p: Paint): boolean =>
  p.type === 'SOLID' && !!p.boundVariables && !!p.boundVariables.color

function hasFills(node: SceneNode): node is SceneNode & MinimalFillsMixin {
  return 'fills' in node
}

function contains(outer: Rect | null, inner: Rect | null): boolean {
  if (!outer || !inner) return false
  const eps = 0.5
  return (
    outer.x <= inner.x + eps &&
    outer.y <= inner.y + eps &&
    outer.x + outer.width >= inner.x + inner.width - eps &&
    outer.y + outer.height >= inner.y + inner.height - eps
  )
}

interface Stop {
  color: RGB
  alpha: number
}

interface Layer {
  nodeId: string
  color: RGB
  alpha: number
  bound: boolean
  varId?: string
  // Gradient fill: every stop is a candidate backdrop colour.
  stops?: Stop[]
}

interface Backdrop {
  layers: Layer[]
  unknown: boolean
  // Product of ancestor opacities that also fade the element itself.
  groupOpacity: number
}

const isGradient = (p: Paint): p is GradientPaint =>
  p.type === 'GRADIENT_LINEAR' ||
  p.type === 'GRADIENT_RADIAL' ||
  p.type === 'GRADIENT_ANGULAR' ||
  p.type === 'GRADIENT_DIAMOND'

type Probe = { layer: Layer; terminal: boolean } | 'unknown' | null

// What `n` paints as a backdrop: a solid / gradient layer, `unknown` for
// images and video, null when it paints nothing.
function probe(n: SceneNode): Probe {
  if (!n.visible || !hasFills(n)) return null
  const fill = topFill(n.fills)
  if (!fill) return null
  const nodeOpacity = 'opacity' in n ? n.opacity : 1
  if (fill.type === 'SOLID') {
    const alpha = (fill.opacity ?? 1) * nodeOpacity
    const bound = isBound(fill) || ('fillStyleId' in n && n.fillStyleId !== '')
    const varId = fill.boundVariables?.color?.id
    return { layer: { nodeId: n.id, color: fill.color, alpha, bound, varId }, terminal: alpha >= 0.999 }
  }
  if (isGradient(fill)) {
    const k = (fill.opacity ?? 1) * nodeOpacity
    const stops = fill.gradientStops.map((s) => ({
      color: { r: s.color.r, g: s.color.g, b: s.color.b },
      alpha: s.color.a * k,
    }))
    return { layer: { nodeId: n.id, color: stops[0].color, alpha: 1, bound: false, stops }, terminal: true }
  }
  return 'unknown'
}

// Collects layers behind `target` (nearest first) until an opaque one.
// `unknown` is set when an image / video sits behind it.
function backdrop(target: SceneNode): Backdrop {
  const layers: Layer[] = []
  const box = target.absoluteBoundingBox
  let unknown = false
  let groupOpacity = 1

  const consider = (n: SceneNode): boolean => {
    const p = probe(n)
    if (!p) return false
    if (p === 'unknown') {
      unknown = true
      return true
    }
    layers.push(p.layer)
    return p.terminal
  }

  let cur: SceneNode = target
  while (cur.parent && cur.parent.type !== 'DOCUMENT' && cur.parent.type !== 'PAGE') {
    const parent = cur.parent as SceneNode & ChildrenMixin
    // Walk only siblings below `cur` (lower z-order = lower index).
    const siblings = parent.children
    for (let i = siblings.indexOf(cur) - 1; i >= 0; i--) {
      const s = siblings[i]
      // Other text layers are never a backdrop.
      if (s.type !== 'TEXT' && contains(s.absoluteBoundingBox, box) && consider(s)) {
        return { layers, unknown, groupOpacity }
      }
    }
    if ('opacity' in parent) groupOpacity *= parent.opacity
    if (consider(parent)) return { layers, unknown, groupOpacity }
    cur = parent
  }
  return { layers, unknown, groupOpacity }
}

const isLarge = (size: number, weight: number): boolean =>
  size >= 24 || (size >= 18.66 && weight >= 700)

// Composite backdrop over white (canvas default), farthest layer first.
function flatten(layers: Layer[]): RGB {
  let bg: RGB = { r: 1, g: 1, b: 1 }
  for (let i = layers.length - 1; i >= 0; i--) {
    bg = blend(layers[i].color, layers[i].alpha, bg)
  }
  return bg
}

// Backdrop colours to test: one, or one per stop when a gradient is behind.
function backdropColors(layers: Layer[]): RGB[] {
  const gi = layers.findIndex((l) => l.stops)
  if (gi < 0) return [flatten(layers)]
  return layers[gi].stops!.map((s) =>
    flatten(layers.map((l, i) => (i === gi ? { ...l, color: s.color, alpha: s.alpha, stops: undefined } : l))),
  )
}

function emptyResult(node: SceneNode, kind: Kind, label: string): Result {
  return {
    id: node.id,
    kind,
    name: node.name,
    text: label,
    fg: '',
    fgAlpha: 1,
    bg: '',
    ratio: null,
    large: false,
    fontSize: 0,
    fgBound: false,
    fgVar: false,
    bgBound: false,
    bgEditable: false,
  }
}

// Only a single opaque layer can be edited without changing the composite.
function bgInfo(layers: Layer[]): Pick<Result, 'bgBound' | 'bgEditable'> & { bgNodeId?: string } {
  const only = layers.length === 1 && layers[0].alpha >= 0.999 && !layers[0].stops ? layers[0] : null
  return { bgBound: !!only && only.bound, bgEditable: !!only, bgNodeId: only?.nodeId }
}

function backdropNote(layers: Layer[]): string | undefined {
  if (layers.length === 0) return L('Фон не найден — принят белый', 'No backdrop found — white assumed')
  if (layers.some((l) => l.stops)) return L('Фон — градиент: взято худшее значение по опорным цветам', 'Gradient backdrop: the worst of its stop colors is used')
  return undefined
}

/* ---------- variables ---------- */

const varCache = new Map<string, Variable | null>()
const colCache = new Map<string, VariableCollection | null>()

async function getVar(id: string): Promise<Variable | null> {
  if (!varCache.has(id)) varCache.set(id, await figma.variables.getVariableByIdAsync(id))
  return varCache.get(id) ?? null
}

async function getCol(id: string): Promise<VariableCollection | null> {
  if (!colCache.has(id)) colCache.set(id, await figma.variables.getVariableCollectionByIdAsync(id))
  return colCache.get(id) ?? null
}

const isAlias = (v: VariableValue | undefined): v is VariableAlias =>
  !!v && typeof v === 'object' && 'type' in v && v.type === 'VARIABLE_ALIAS'

const isRgba = (v: VariableValue | undefined): v is RGBA =>
  !!v && typeof v === 'object' && 'r' in v && 'a' in v

// Resolves a colour variable in `modeId`. Variables of other collections
// fall back to their default mode.
async function resolveColor(v: Variable, modeId: string, depth = 0): Promise<RGBA | null> {
  if (depth > 8) return null
  const col = await getCol(v.variableCollectionId)
  if (!col) return null
  const mode = col.modes.some((m) => m.modeId === modeId) ? modeId : col.defaultModeId
  const val = v.valuesByMode[mode]
  if (isAlias(val)) {
    const next = await getVar(val.id)
    return next ? resolveColor(next, mode, depth + 1) : null
  }
  return isRgba(val) ? val : null
}

// The same element in every mode of the collections its colours come from.
async function modeVariants(fgVarId: string | undefined, fgColor: RGB, layers: Layer[]): Promise<ModeColors[]> {
  const ids = [fgVarId, ...layers.map((l) => l.varId)].filter((x): x is string => !!x)
  if (!ids.length || layers.some((l) => l.stops)) return []

  const vars = new Map<string, Variable>()
  for (const id of ids) {
    const v = await getVar(id)
    if (v) vars.set(id, v)
  }
  const colIds = [...new Set([...vars.values()].map((v) => v.variableCollectionId))]
  const out: ModeColors[] = []
  for (const cid of colIds) {
    const col = await getCol(cid)
    if (!col || col.modes.length < 2) continue
    for (const m of col.modes) {
      const pick = async (id: string | undefined, fallback: RGB): Promise<RGB> => {
        const v = id ? vars.get(id) : undefined
        const c = v ? await resolveColor(v, m.modeId) : null
        return c ? { r: c.r, g: c.g, b: c.b } : fallback
      }
      const fg = await pick(fgVarId, fgColor)
      const swapped: Layer[] = []
      for (const l of layers) swapped.push({ ...l, color: await pick(l.varId, l.color) })
      out.push({ label: `${col.name}: ${m.name}`, fg: toHex(fg), bg: toHex(flatten(swapped)) })
    }
  }
  return out
}

/* ---------- analysis ---------- */

// Analyzes every style run of the text and keeps the worst one.
async function analyzeText(text: TextNode, forced?: Backdrop): Promise<Result | null> {
  if (!text.characters.trim()) return null

  const base = emptyResult(text, 'text', text.characters.slice(0, 60))
  const segments = text.getStyledTextSegments(['fontSize', 'fontWeight', 'fills'])
  const { layers, unknown, groupOpacity } = forced ?? backdrop(text)
  const bgs = backdropColors(layers)
  const info = bgInfo(layers)

  let worst: Result | null = null
  let worstMeta: Meta | null = null
  let worstFill: SolidPaint | null = null
  for (const seg of segments) {
    const large = isLarge(seg.fontSize, seg.fontWeight)
    const fill = topFill(seg.fills)
    if (!fill || fill.type !== 'SOLID') {
      return { ...base, large, fontSize: seg.fontSize, note: L('Цвет текста не сплошной (градиент/изображение)', 'Text color is not solid (gradient / image)') }
    }
    if (unknown) {
      return { ...base, large, fontSize: seg.fontSize, note: L('Под текстом изображение — проверьте вручную', 'There is an image behind the text — check manually') }
    }
    const alpha = (fill.opacity ?? 1) * text.opacity * groupOpacity
    for (const bg of bgs) {
      const ratio = contrast(blend(fill.color, alpha, bg), bg)
      if (worst && ratio >= (worst.ratio ?? Infinity)) continue
      worst = {
        ...base,
        fg: toHex(fill.color),
        fgAlpha: alpha,
        bg: toHex(bg),
        ratio,
        large,
        fontSize: seg.fontSize,
        fgBound: isBound(fill) || text.getRangeFillStyleId(seg.start, seg.end) !== '',
        fgVar: !!fill.boundVariables?.color,
        bgBound: info.bgBound,
        bgEditable: info.bgEditable,
        note: backdropNote(layers),
      }
      worstFill = fill
      worstMeta = {
        fgKind: 'fill',
        range: [seg.start, seg.end],
        bgNodeId: info.bgNodeId,
        fgVarId: fill.boundVariables?.color?.id,
      }
    }
  }
  if (worst && worstMeta && worstFill) {
    worst.modes = await modeVariants(worstMeta.fgVarId, worstFill.color, layers)
    metaById.set(text.id, worstMeta)
  }
  return worst
}

type IconNode = VectorNode | BooleanOperationNode | StarNode | PolygonNode | LineNode
type Paintable = SceneNode & MinimalFillsMixin & MinimalStrokesMixin & MinimalBlendMixin

const ICON_TYPES = ['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'POLYGON', 'LINE']
const ICON_MAX = 64

function isIcon(n: SceneNode): n is IconNode {
  if (!ICON_TYPES.includes(n.type)) return false
  const b = n.absoluteBoundingBox
  return !!b && b.width <= ICON_MAX && b.height <= ICON_MAX
}

const isPaintable = (n: SceneNode): n is Paintable => 'fills' in n && 'strokes' in n && 'opacity' in n

// Icons are checked against the 3:1 non-text contrast (WCAG 1.4.11).
async function analyzeIcon(icon: Paintable, forced?: Backdrop): Promise<Result> {
  const base = emptyResult(icon, 'icon', icon.name)
  let kind: 'fill' | 'stroke' = 'fill'
  let paint = topFill(icon.fills)
  if (!paint) {
    kind = 'stroke'
    paint = topFill(icon.strokes)
  }
  if (!paint || paint.type !== 'SOLID') {
    return { ...base, note: L('Цвет слоя не сплошной или отсутствует', 'Layer color is not solid or missing') }
  }
  const { layers, unknown, groupOpacity } = forced ?? backdrop(icon)
  if (unknown) {
    return { ...base, note: L('Под слоем изображение — проверьте вручную', 'There is an image behind the layer — check manually') }
  }
  const info = bgInfo(layers)
  const alpha = (paint.opacity ?? 1) * icon.opacity * groupOpacity
  const styleId = kind === 'fill' ? icon.fillStyleId : icon.strokeStyleId
  const fgVarId = paint.boundVariables?.color?.id

  let worst = Infinity
  let bgHex = ''
  for (const bg of backdropColors(layers)) {
    const ratio = contrast(blend(paint.color, alpha, bg), bg)
    if (ratio < worst) {
      worst = ratio
      bgHex = toHex(bg)
    }
  }

  metaById.set(icon.id, { fgKind: kind, bgNodeId: info.bgNodeId, fgVarId })
  return {
    ...base,
    fg: toHex(paint.color),
    fgAlpha: alpha,
    bg: bgHex,
    ratio: worst,
    fgBound: isBound(paint) || (typeof styleId === 'string' && styleId !== ''),
    fgVar: !!fgVarId,
    bgBound: info.bgBound,
    bgEditable: info.bgEditable,
    modes: await modeVariants(fgVarId, paint.color, layers),
    note: backdropNote(layers),
  }
}

async function analyze(node: SceneNode): Promise<Result | null> {
  if (node.type === 'TEXT') return analyzeText(node)
  if (isIcon(node) && isPaintable(node)) return analyzeIcon(node)
  return null
}

// Pair mode: the text / icon / shape that sits on top is the foreground,
// the other layer is its backdrop. Text wins, then icons, then z-order.
function pairOrder(a: SceneNode, b: SceneNode, swap: boolean): [SceneNode, SceneNode] {
  const rank = (n: SceneNode) => (n.type === 'TEXT' ? 2 : isIcon(n) ? 1 : 0)
  let top = a
  let bottom = b
  if (rank(b) > rank(a)) {
    top = b
    bottom = a
  } else if (rank(b) === rank(a) && a.parent && a.parent === b.parent) {
    const kids = (a.parent as ChildrenMixin).children
    if (kids.indexOf(b) > kids.indexOf(a)) {
      top = b
      bottom = a
    }
  }
  return swap ? [bottom, top] : [top, bottom]
}

async function analyzePair(a: SceneNode, b: SceneNode): Promise<Result | null> {
  const [top, bottom] = pairOrder(a, b, cfg.swap)
  const p = probe(bottom)
  if (!p) {
    return { ...emptyResult(top, 'icon', top.name), note: L('У фонового слоя нет видимой заливки', 'The background layer has no visible fill') }
  }
  const forced: Backdrop =
    p === 'unknown' ? { layers: [], unknown: true, groupOpacity: 1 } : { layers: [p.layer], unknown: false, groupOpacity: 1 }
  const r = top.type === 'TEXT' ? await analyzeText(top, forced) : isPaintable(top) ? await analyzeIcon(top, forced) : null
  if (r) return { ...r, pairBg: bottom.name }
  return { ...emptyResult(top, 'icon', top.name), note: L('У слоя нет заливки или обводки', 'The layer has no fill or stroke') }
}

// Visible text and icon layers only; hidden subtrees are skipped entirely.
function collectTargets(roots: readonly SceneNode[]): SceneNode[] {
  const out: SceneNode[] = []
  const walk = (n: SceneNode) => {
    if (!n.visible) return
    if (n.type === 'TEXT' || isIcon(n)) out.push(n)
    else if ('children' in n) n.children.forEach(walk)
  }
  roots.forEach(walk)
  return out
}

const CHUNK = 100
let scanToken = 0

async function scan() {
  const token = ++scanToken
  const sel = figma.currentPage.selection
  metaById.clear()
  varCache.clear()
  colCache.clear()

  if (cfg.pair) {
    const results: Result[] = []
    if (sel.length === 2) {
      try {
        const r = await analyzePair(sel[0], sel[1])
        if (r) results.push(r)
      } catch (_e) {
        figma.notify(L('Не удалось проверить пару слоёв', 'Could not check this pair'))
      }
    }
    figma.ui.postMessage({ type: 'results', scope: 'pair', autoOpen: true, results, failed: 0, selected: sel.length })
    return
  }

  // Marker frames drawn by the plugin itself are never a scan target.
  const scope = sel.length ? sel : figma.currentPage.children.filter((n) => !markers.includes(n))
  const targets = collectTargets(scope)
  const results: Result[] = []
  let failed = 0

  for (let i = 0; i < targets.length; i++) {
    try {
      const r = await analyze(targets[i])
      if (token !== scanToken) return
      if (r) results.push(r)
    } catch (_e) {
      // Deleted node, missing font, etc. — don't abort the whole scan.
      failed++
    }
    if ((i + 1) % CHUNK === 0) {
      figma.ui.postMessage({ type: 'progress', done: i + 1, total: targets.length })
      // Yield so the UI stays responsive and a newer scan can supersede this one.
      await new Promise((r) => setTimeout(r, 0))
      if (token !== scanToken) return
    }
  }

  figma.ui.postMessage({
    type: 'results',
    scope: sel.length ? 'selection' : 'page',
    // Open the editor for the first element only when the user picked something.
    autoOpen: sel.length > 0,
    results,
    failed,
    selected: sel.length,
  })
}

/* ---------- writing colours back ---------- */

// Replaces the colour of the topmost visible solid paint, keeping its opacity.
// A fresh paint object drops any variable binding unless `variable` is given.
function recolor(
  paints: readonly Paint[] | typeof figma.mixed,
  color: RGB,
  variable?: Variable,
): Paint[] | null {
  const i = topFillIndex(paints)
  if (i < 0) return null
  const list = [...(paints as readonly Paint[])]
  const old = list[i]
  if (old.type !== 'SOLID') return null
  const next: SolidPaint = { type: 'SOLID', color, opacity: old.opacity, visible: old.visible, blendMode: old.blendMode }
  list[i] = variable ? figma.variables.setBoundVariableForPaint(next, 'color', variable) : next
  return list
}

async function writeColors(id: string, fgHex?: string, bgHex?: string, tokenId?: string): Promise<SceneNode | null> {
  const node = await figma.getNodeByIdAsync(id)
  const meta = metaById.get(id)
  if (!node || !meta || node.type === 'DOCUMENT' || node.type === 'PAGE') return null
  const fg = fgHex ? fromHex(fgHex) : null
  const bg = bgHex ? fromHex(bgHex) : null
  const token = tokenId ? await getVar(tokenId) : null

  if (fg) {
    if (node.type === 'TEXT' && meta.range) {
      const [start, end] = meta.range
      const next = recolor(node.getRangeFills(start, end), fg, token ?? undefined)
      if (next) node.setRangeFills(start, end, next)
    } else if ('fills' in node && 'strokes' in node) {
      const key = meta.fgKind === 'fill' ? 'fills' : 'strokes'
      const next = recolor(node[key], fg, token ?? undefined)
      if (next) node[key] = next
    }
  }

  if (bg && meta.bgNodeId) {
    const bgNode = await figma.getNodeByIdAsync(meta.bgNodeId)
    if (bgNode && 'fills' in bgNode) {
      const next = recolor(bgNode.fills, bg)
      if (next) bgNode.fills = next
    }
  }
  return node as SceneNode
}

async function applyColors(id: string, fgHex?: string, bgHex?: string, tokenId?: string) {
  const node = await writeColors(id, fgHex, bgHex, tokenId)
  if (!node) {
    figma.notify(L('Слой не найден — выполните проверку заново', 'Layer not found — rescan'))
    return
  }
  figma.commitUndo()
  const updated = await analyze(node)
  if (updated) figma.ui.postMessage({ type: 'updated', result: updated })
}

// Bulk fix: one undo step for the whole batch, then a fresh scan.
async function applyMany(items: { id: string; fg: string }[]) {
  let done = 0
  for (const it of items) {
    try {
      if (await writeColors(it.id, it.fg)) done++
    } catch (_e) {
      // Skip a node that can't be written (deleted, locked library, …).
    }
  }
  figma.commitUndo()
  figma.notify(L(`Исправлено: ${done} из ${items.length}`, `Fixed ${done} of ${items.length}`))
  await scan()
}

// Edits the variable behind the foreground (following aliases to the source)
// so every consumer of the token changes together.
async function applyVariable(id: string, fgHex: string) {
  const node = await figma.getNodeByIdAsync(id)
  const meta = metaById.get(id)
  const color = fromHex(fgHex)
  if (!node || !meta || !meta.fgVarId || !color || node.type === 'DOCUMENT' || node.type === 'PAGE') {
    figma.notify(L('Переменная не найдена — выполните проверку заново', 'Variable not found — rescan'))
    return
  }
  const modes = (node as SceneNode).resolvedVariableModes
  let cur = await getVar(meta.fgVarId)
  for (let i = 0; cur && i < 8; i++) {
    const col = await getCol(cur.variableCollectionId)
    if (!col) break
    const modeId = modes[cur.variableCollectionId] ?? col.defaultModeId
    const val = cur.valuesByMode[modeId]
    if (isAlias(val)) {
      cur = await getVar(val.id)
      continue
    }
    if (cur.remote) {
      figma.notify(L(`Переменная «${cur.name}» из библиотеки — изменить её нельзя`, `Variable “${cur.name}” comes from a library and can’t be edited`))
      return
    }
    cur.setValueForMode(modeId, { r: color.r, g: color.g, b: color.b, a: isRgba(val) ? val.a : 1 })
    figma.commitUndo()
    figma.notify(L(`Обновлена переменная «${cur.name}»`, `Updated variable “${cur.name}”`))
    await scan()
    return
  }
  figma.notify(L('Не удалось найти исходную переменную', 'Could not find the source variable'))
}

// Local colour variables that may be used for this element, resolved in the
// modes the element actually sees. The UI ranks them.
async function sendTokens(id: string) {
  const node = await figma.getNodeByIdAsync(id)
  if (!node || node.type === 'DOCUMENT' || node.type === 'PAGE') return
  const isText = node.type === 'TEXT'
  const scopeOk = (v: Variable) =>
    v.scopes.some((s) => s === 'ALL_SCOPES' || s === 'ALL_FILLS' || s === (isText ? 'TEXT_FILL' : 'SHAPE_FILL'))
  const tokens: { id: string; name: string; hex: string }[] = []
  for (const v of await figma.variables.getLocalVariablesAsync('COLOR')) {
    if (!scopeOk(v)) continue
    try {
      const { value } = v.resolveForConsumer(node as SceneNode)
      if (isRgba(value) && value.a >= 0.999) tokens.push({ id: v.id, name: v.name, hex: toHex(value) })
    } catch (_e) {
      // Unresolvable alias — not a usable token.
    }
  }
  figma.ui.postMessage({ type: 'tokens', id, tokens })
}

/* ---------- canvas markers ---------- */

const MARK = 'a11yContrastMarker'
const MARK_MAX = 500
let markers: SceneNode[] = []

function clearMarkers() {
  for (const m of markers) if (!m.removed) m.remove()
  markers = []
}

// Red outlines around failing layers, inside one locked frame on the page.
async function drawMarkers(ids: string[]) {
  clearMarkers()
  const frame = figma.createFrame()
  frame.name = 'A11y contrast markers'
  frame.fills = []
  frame.clipsContent = false
  frame.resize(1, 1)
  frame.setPluginData(MARK, '1')
  let count = 0
  for (const id of ids.slice(0, MARK_MAX)) {
    const n = await figma.getNodeByIdAsync(id)
    const box = n && n.type !== 'DOCUMENT' && n.type !== 'PAGE' ? (n as SceneNode).absoluteBoundingBox : null
    if (!box) continue
    const r = figma.createRectangle()
    r.name = 'marker'
    r.x = box.x - 2
    r.y = box.y - 2
    r.resize(Math.max(box.width + 4, 1), Math.max(box.height + 4, 1))
    r.fills = []
    r.strokes = [{ type: 'SOLID', color: { r: 0.95, g: 0.28, b: 0.13 } }]
    r.strokeWeight = 2
    frame.appendChild(r)
    count++
  }
  if (!count) {
    frame.remove()
    return
  }
  frame.locked = true
  markers = [frame]
}

function removeStaleMarkers() {
  for (const n of figma.currentPage.findChildren((c) => c.getPluginData(MARK) === '1')) n.remove()
}

function pageOf(node: BaseNode): PageNode | null {
  let n: BaseNode | null = node
  while (n && n.type !== 'PAGE') n = n.parent
  return n
}

interface Msg {
  type: string
  lang?: string
  id?: string
  fg?: string
  bg?: string
  token?: string
  cfg?: Settings
  ids?: string[]
  items?: { id: string; fg: string }[]
}

figma.ui.onmessage = async (msg: Msg) => {
  if (msg.type === 'ready') {
    lang = msg.lang === 'ru' ? 'ru' : 'en'
    removeStaleMarkers()
    try {
      const saved = await figma.clientStorage.getAsync('settings')
      if (saved) cfg = { ...cfg, ...saved }
    } catch (_e) {
      // Storage unavailable — keep defaults.
    }
    figma.ui.postMessage({ type: 'init', cfg })
    await scan()
  } else if (msg.type === 'settings' && msg.cfg) {
    const rescan = msg.cfg.pair !== cfg.pair || msg.cfg.swap !== cfg.swap
    cfg = msg.cfg
    figma.clientStorage.setAsync('settings', cfg).catch(() => undefined)
    if (rescan) await scan()
  } else if (msg.type === 'scan') {
    await scan()
  } else if (msg.type === 'apply' && msg.id) {
    try {
      await applyColors(msg.id, msg.fg, msg.bg, msg.token)
    } catch (_e) {
      figma.notify(L('Не удалось применить цвет', 'Could not apply the color'))
    }
  } else if (msg.type === 'applyMany' && msg.items) {
    await applyMany(msg.items)
  } else if (msg.type === 'applyVariable' && msg.id && msg.fg) {
    try {
      await applyVariable(msg.id, msg.fg)
    } catch (_e) {
      figma.notify(L('Не удалось изменить переменную', 'Could not change the variable'))
    }
  } else if (msg.type === 'tokens' && msg.id) {
    try {
      await sendTokens(msg.id)
    } catch (_e) {
      figma.ui.postMessage({ type: 'tokens', id: msg.id, tokens: [] })
    }
  } else if (msg.type === 'markers') {
    if (msg.ids && msg.ids.length) await drawMarkers(msg.ids)
    else clearMarkers()
  } else if (msg.type === 'focus' && msg.id) {
    const node = await figma.getNodeByIdAsync(msg.id)
    if (!node || node.type === 'DOCUMENT' || node.type === 'PAGE') {
      figma.notify(L('Слой не найден — выполните проверку заново', 'Layer not found — rescan'))
      return
    }
    const page = pageOf(node)
    if (page && page !== figma.currentPage) await figma.setCurrentPageAsync(page)
    selfSelected = node.id
    figma.currentPage.selection = [node as SceneNode]
    figma.viewport.scrollAndZoomIntoView([node as SceneNode])
  }
}

// Re-check automatically when the user picks something else. Selections made
// by the plugin itself (click in the list) are ignored so the list stays put.
let selfSelected: string | null = null
let selTimer = 0

figma.on('selectionchange', () => {
  const sel = figma.currentPage.selection
  if (selfSelected && sel.length === 1 && sel[0].id === selfSelected) {
    selfSelected = null
    return
  }
  selfSelected = null
  clearTimeout(selTimer)
  selTimer = setTimeout(scan, 150) as unknown as number
})
figma.on('currentpagechange', () => {
  clearMarkers()
  figma.ui.postMessage({ type: 'pagechange' })
  scan()
})
figma.on('close', clearMarkers)
