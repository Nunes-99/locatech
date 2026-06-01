"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Eraser } from "lucide-react"

/**
 * Pad de assinatura simples (canvas puro, sem dep).
 *
 * Suporta mouse e touch. Emite o data URL (PNG base64) via `onChange` toda vez
 * que o usuário levanta o dedo/mouse. `onChange(null)` quando o pad está vazio.
 *
 * Optei por não usar `react-signature-canvas` pra evitar mais uma dep — o canvas
 * nativo cobre o caso de uso sem perder qualidade.
 */
export function SignaturePad({
  onChange,
  height = 180,
  className,
}: {
  onChange: (dataUrl: string | null) => void
  height?: number
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // High-DPI: redimensiona pro pixel ratio
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#111827"
  }, [])

  const getPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }, [])

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    drawing.current = true
    const ctx = canvas.getContext("2d")!
    const { x, y } = getPoint(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext("2d")!
    const { x, y } = getPoint(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function end() {
    if (!drawing.current) return
    drawing.current = false
    setEmpty(false)
    const canvas = canvasRef.current!
    onChange(canvas.toDataURL("image/png"))
  }

  function clear() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // Re-apply dpr scale após clear
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#111827"
    setEmpty(true)
    onChange(null)
  }

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-white">
        <canvas
          ref={canvasRef}
          style={{ height: `${height}px`, width: "100%", touchAction: "none" }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            Assine aqui com o dedo ou mouse
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
      >
        <Eraser className="h-3.5 w-3.5" /> Limpar
      </button>
    </div>
  )
}
