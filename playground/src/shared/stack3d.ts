import type { Grid } from '../../../src/grid.js'
import { hexToRgb } from '../../../src/oklch.js'
import { FLOATS_PER_TILE, fitDistance, layoutOf, pickTile, poseOf, rayThrough, tileData, TILE, type Layout3d, type Rgb } from './stack3d-math.js'

/* A stack of grids drawn in 3D with WebGPU: one flat tile for each item, one plate for each layer.
   No library: a cube, one instanced draw call, and a camera that orbits the stack. */

export type Stack3dModel = {
  /** `#rrggbb`, one for each tile, in order. */
  colors: string[]
  /** Tiles that look like a neighbour, shown lifted. */
  alike: ReadonlySet<number>
  grid: Grid
  /** How many steps away still counts as a neighbour. */
  steps: number
  /** The page colour: tiles that are not neighbours fade toward it. */
  surface: string
}

export type Stack3d = {
  update(model: Stack3dModel): void
  destroy(): void
}

export type Stack3dEvents = {
  /** The tile under the pointer, or null. */
  onHover(index: number | null): void
  /** The GPU went away, so the caller can fall back to the flat view. */
  onLost(): void
}

const unitRgb = (hex: string): Rgb => {
  const [r, g, b] = hexToRgb(hex)
  return [r / 255, g / 255, b / 255]
}

export const webgpuAvailable = (): boolean => typeof navigator !== 'undefined' && 'gpu' in navigator

const SHADER = /* wgsl */ `
struct Scene {
  viewProj: mat4x4<f32>,
  light: vec4<f32>,
  surface: vec4<f32>,
  extent: vec4<f32>,
}
@group(0) @binding(0) var<uniform> scene: Scene;

struct Vertex {
  @location(0) corner: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) offset: vec3<f32>,
  @location(3) scale: f32,
  @location(4) color: vec3<f32>,
  @location(5) dim: f32,
}
struct Varying {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec3<f32>,
}

@vertex fn vs(v: Vertex) -> Varying {
  var out: Varying;
  out.position = scene.viewProj * vec4<f32>(v.offset + v.corner * scene.extent.xyz * v.scale, 1.0);
  let light = max(dot(v.normal, scene.light.xyz), 0.0);
  let lit = v.color * (0.68 + 0.36 * light);
  let faded = mix(lit, scene.surface.rgb, clamp(v.dim, 0.0, 1.0));
  out.color = mix(faded, vec3<f32>(1.0), clamp(-v.dim, 0.0, 1.0));
  return out;
}

@fragment fn fs(v: Varying) -> @location(0) vec4<f32> {
  return vec4<f32>(v.color, 1.0);
}
`

/** A box from -1 to 1, with a normal on every vertex so each face is lit on its own. */
function cube(): { vertices: Float32Array; indices: Uint16Array } {
  // Each face: its normal, then two edges whose cross product is the normal, so the corners wind counter-clockwise.
  const faces: Array<[number[], number[], number[]]> = [
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ]
  const vertices: number[] = []
  const indices: number[] = []
  faces.forEach(([normal, u, v], face) => {
    ;[[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => {
      vertices.push(...[0, 1, 2].map(axis => normal[axis]! + u[axis]! * a! + v[axis]! * b!), ...normal)
    })
    const start = face * 4
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3)
  })
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) }
}

const LIGHT = (() => {
  const raw = [-0.4, 0.9, 0.35]
  const length = Math.hypot(...raw)
  return raw.map(value => value / length)
})()

const SAMPLES = 4
const PITCH = { min: -0.15, max: 1.35 }

/** Set up WebGPU on a canvas. Resolves to null when this browser or machine cannot. */
export async function createStack3d(canvas: HTMLCanvasElement, events: Stack3dEvents): Promise<Stack3d | null> {
  const adapter = await navigator.gpu?.requestAdapter()
  if (!adapter) return null
  const device = await adapter.requestDevice()
  const context = canvas.getContext('webgpu')
  if (!context) {
    device.destroy()
    return null
  }
  const format = navigator.gpu.getPreferredCanvasFormat()
  context.configure({ device, format, alphaMode: 'premultiplied' })

  const geometry = cube()
  const vertexBuffer = device.createBuffer({ size: geometry.vertices.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST })
  device.queue.writeBuffer(vertexBuffer, 0, geometry.vertices)
  const indexBuffer = device.createBuffer({ size: geometry.indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST })
  device.queue.writeBuffer(indexBuffer, 0, geometry.indices)
  const sceneBuffer = device.createBuffer({ size: 112, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })

  const module = device.createShaderModule({ code: SHADER })
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs',
      buffers: [
        { arrayStride: 24, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }] },
        {
          arrayStride: FLOATS_PER_TILE * 4,
          stepMode: 'instance',
          attributes: [
            { shaderLocation: 2, offset: 0, format: 'float32x3' },
            { shaderLocation: 3, offset: 12, format: 'float32' },
            { shaderLocation: 4, offset: 16, format: 'float32x3' },
            { shaderLocation: 5, offset: 28, format: 'float32' },
          ],
        },
      ],
    },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list', cullMode: 'back' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
    multisample: { count: SAMPLES },
  })
  const sceneGroup = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: sceneBuffer } }] })

  let tileBuffer: GPUBuffer | null = null
  let colorTexture: GPUTexture | null = null
  let depthTexture: GPUTexture | null = null

  let model: Stack3dModel | null = null
  let layout: Layout3d = { centres: [], radius: 1 }
  let colors: Rgb[] = []
  let surface: Rgb = [0, 0, 0]
  let hover: number | null = null

  let yaw = 0.6
  let pitch = 0.5
  let distance = 10
  let aspect = 1
  let touched = false
  let visible = true
  let alive = true
  let frame = 0
  let last = 0

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const spinning = () => alive && visible && !touched && hover === null && !reduceMotion && !document.hidden

  function writeTiles() {
    if (!model) return
    const data = tileData(layout, colors, model.alike, model.grid, model.steps, hover)
    if (!tileBuffer || tileBuffer.size < data.byteLength) {
      tileBuffer?.destroy()
      tileBuffer = device.createBuffer({ size: Math.max(data.byteLength, 4 * FLOATS_PER_TILE), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST })
    }
    device.queue.writeBuffer(tileBuffer, 0, data)
  }

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio))
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio))
    if (colorTexture && canvas.width === width && canvas.height === height) return
    canvas.width = width
    canvas.height = height
    colorTexture?.destroy()
    depthTexture?.destroy()
    colorTexture = device.createTexture({ size: [width, height], format, sampleCount: SAMPLES, usage: GPUTextureUsage.RENDER_ATTACHMENT })
    depthTexture = device.createTexture({ size: [width, height], format: 'depth24plus', sampleCount: SAMPLES, usage: GPUTextureUsage.RENDER_ATTACHMENT })
    aspect = width / height
    distance = fitDistance(layout.radius, aspect)
  }

  function draw(now: number) {
    frame = 0
    if (!alive) return
    resize()
    if (spinning()) yaw += Math.min(0.05, (now - last) / 1000) * 0.22
    last = now
    if (colorTexture && depthTexture && tileBuffer && layout.centres.length) {
      const pose = poseOf(yaw, pitch, distance, aspect)
      const uniforms = new Float32Array(28)
      uniforms.set(pose.viewProj, 0)
      uniforms.set([LIGHT[0]!, LIGHT[1]!, LIGHT[2]!, 0], 16)
      uniforms.set([...surface, 1], 20)
      uniforms.set([...TILE, 0], 24)
      device.queue.writeBuffer(sceneBuffer, 0, uniforms)
      const encoder = device.createCommandEncoder()
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: colorTexture.createView(), resolveTarget: context!.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'discard' }],
        depthStencilAttachment: { view: depthTexture.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard' },
      })
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, sceneGroup)
      pass.setVertexBuffer(0, vertexBuffer)
      pass.setVertexBuffer(1, tileBuffer)
      pass.setIndexBuffer(indexBuffer, 'uint16')
      pass.drawIndexed(geometry.indices.length, layout.centres.length)
      pass.end()
      device.queue.submit([encoder.finish()])
    }
    if (spinning()) schedule()
  }

  function schedule() {
    if (!frame && alive) frame = requestAnimationFrame(draw)
  }

  function setHover(index: number | null) {
    if (index === hover) return
    hover = index
    writeTiles()
    events.onHover(index)
    schedule()
  }

  function pick(event: PointerEvent): number | null {
    const box = canvas.getBoundingClientRect()
    const x = ((event.clientX - box.left) / box.width) * 2 - 1
    const y = 1 - ((event.clientY - box.top) / box.height) * 2
    const pose = poseOf(yaw, pitch, distance, aspect)
    return pickTile(pose.eye, rayThrough(pose, x, y, aspect), layout.centres)
  }

  let drag: { x: number; y: number } | null = null
  const down = (event: PointerEvent) => {
    drag = { x: event.clientX, y: event.clientY }
    touched = true
    canvas.setPointerCapture(event.pointerId)
    canvas.classList.add('turning')
    setHover(null)
  }
  const move = (event: PointerEvent) => {
    if (drag) {
      yaw -= (event.clientX - drag.x) * 0.008
      pitch = Math.min(PITCH.max, Math.max(PITCH.min, pitch + (event.clientY - drag.y) * 0.006))
      drag = { x: event.clientX, y: event.clientY }
      schedule()
    } else if (event.pointerType !== 'touch') {
      setHover(pick(event))
    }
  }
  const up = (event: PointerEvent) => {
    if (drag && event.pointerType === 'touch' && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) setHover(pick(event))
    drag = null
    canvas.classList.remove('turning')
  }
  const leave = () => {
    if (!drag) setHover(null)
    schedule()
  }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)
  canvas.addEventListener('pointerleave', leave)

  const resizer = new ResizeObserver(schedule)
  resizer.observe(canvas)
  const watcher = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting)
    schedule()
  })
  watcher.observe(canvas)
  document.addEventListener('visibilitychange', schedule)

  void device.lost.then(info => {
    if (!alive || info.reason === 'destroyed') return
    console.warn('huehash: the GPU was lost, falling back to the flat view.', info.message)
    events.onLost()
  })

  return {
    update(next) {
      const resized = !model || model.colors.length !== next.colors.length || model.grid.columns !== next.grid.columns || model.grid.rows !== next.grid.rows
      model = next
      colors = next.colors.map(unitRgb)
      surface = unitRgb(next.surface)
      layout = layoutOf(next.colors.length, next.grid)
      if (resized) {
        hover = null
        distance = fitDistance(layout.radius, aspect)
      }
      writeTiles()
      schedule()
    },
    destroy() {
      alive = false
      cancelAnimationFrame(frame)
      resizer.disconnect()
      watcher.disconnect()
      document.removeEventListener('visibilitychange', schedule)
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('pointerleave', leave)
      tileBuffer?.destroy()
      colorTexture?.destroy()
      depthTexture?.destroy()
      device.destroy()
    },
  }
}
