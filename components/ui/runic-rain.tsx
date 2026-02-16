"use client"

import { useRef, useEffect, useCallback } from "react"

// Elder Futhark + Younger Futhark + Medieval runes
const RUNES: string[] = [
  "ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ", "ᚺ", "ᚾ",
  "ᛁ", "ᛃ", "ᛈ", "ᛇ", "ᛉ", "ᛊ", "ᛏ", "ᛒ", "ᛖ", "ᛗ",
  "ᛚ", "ᛜ", "ᛞ", "ᛟ", "ᛠ", "ᛣ", "ᛤ", "ᛥ", "ᛦ", "ᛧ",
  "ᚠ", "ᚡ", "ᚢ", "ᚣ", "ᚤ", "ᚥ", "ᚦ", "ᚧ", "ᚨ", "ᚩ",
  "ᚪ", "ᚫ", "ᚬ", "ᚭ", "ᚮ", "ᚯ", "ᚰ", "ᚱ", "ᚳ", "ᚴ",
]

function randomRune(): string {
  return RUNES[Math.floor(Math.random() * RUNES.length)]
}

interface Column {
  x: number
  y: number
  chars: string[]
  length: number
  speed: number
}

function createColumn(x: number, canvasH: number): Column {
  const length = 8 + Math.floor(Math.random() * 18)
  return {
    x,
    y: -Math.floor(Math.random() * canvasH),
    chars: Array.from({ length }, randomRune),
    length,
    speed: 0.12 + Math.random() * 0.22,
  }
}

// Heimdall palette — mint green on deep dark
const BG = "hsl(0, 0%, 8%)"
const MINT = { h: 131, s: 100, l: 85 }

export interface RunicRainProps {
  className?: string
}

export function RunicRain({ className = "" }: RunicRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const columnsRef = useRef<Column[]>([])
  const animRef = useRef<number | null>(null)
  const dimsRef = useRef({ w: 0, h: 0 })

  const FONT_SIZE = 22
  const COL_GAP = 36

  const setup = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const w = rect.width
    const h = rect.height

    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    dimsRef.current = { w, h }

    const cols: Column[] = []
    for (let x = 0; x < w; x += COL_GAP) {
      cols.push(createColumn(x, h))
    }
    columnsRef.current = cols

    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)
  }, [])

  const animate = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { w, h } = dimsRef.current

    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)

    const columns = columnsRef.current
    ctx.textBaseline = "top"
    ctx.font = `${FONT_SIZE}px sans-serif`

    for (const col of columns) {
      col.y += col.speed

      if (col.y - col.length * FONT_SIZE > h) {
        Object.assign(col, createColumn(col.x, h))
      }

      for (let i = 0; i < col.length; i++) {
        const charY = Math.round(col.y + i * FONT_SIZE)
        if (charY < -FONT_SIZE || charY > h + FONT_SIZE) continue

        const distFromHead = col.length - 1 - i
        const normFade = distFromHead / col.length

        if (i === col.length - 1) {
          ctx.shadowColor = `hsla(${MINT.h}, ${MINT.s}%, 60%, 0.3)`
          ctx.shadowBlur = 12
          ctx.fillStyle = `hsla(${MINT.h}, 50%, 78%, 0.45)`
          ctx.fillText(col.chars[i], col.x, charY)
          ctx.shadowBlur = 0
        } else {
          const alpha = Math.max(0.02, 0.18 * (1 - normFade))
          const lightness = MINT.l - normFade * 10
          ctx.fillStyle = `hsla(${MINT.h}, ${MINT.s}%, ${lightness}%, ${alpha})`
          ctx.fillText(col.chars[i], col.x, charY)
        }
      }
    }

    animRef.current = requestAnimationFrame(animate)
  }, [])

  useEffect(() => {
    setup()
    animRef.current = requestAnimationFrame(animate)

    const onResize = () => setup()
    window.addEventListener("resize", onResize)

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      window.removeEventListener("resize", onResize)
    }
  }, [setup, animate])

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ background: BG }}
      aria-hidden="true"
    />
  )
}
