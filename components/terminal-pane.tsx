"use client"

import { useEffect, useRef } from "react"
import { Terminal } from "xterm"
import { FitAddon } from "xterm-addon-fit"
import "xterm/css/xterm.css"

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_BASE_DELAY = 1000 // 1 second

interface TerminalPaneProps {
  sessionKey: "pm" | "frontend" | "backend"
  title: string
}

export function TerminalPane({ sessionKey, title }: TerminalPaneProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const term = useRef<Terminal | null>(null)
  const fitAddon = useRef<FitAddon | null>(null)
  const ws = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!terminalRef.current || term.current) return

    // ------------- xterm init -------------
    term.current = new Terminal({
      fontFamily: '"Cascadia Code", Menlo, monospace',
      fontSize: 14,
      cursorBlink: true,
      theme: {
        background: "#1e1e1e",
        foreground: "#cccccc",
        cursor: "#cccccc",
        selectionBackground: "#5f5f5f",
      },
    })
    fitAddon.current = new FitAddon()
    term.current.loadAddon(fitAddon.current)
    term.current.open(terminalRef.current)
    fitAddon.current.fit()

    const resizeObserver = new ResizeObserver(() => fitAddon.current?.fit())
    resizeObserver.observe(terminalRef.current)

    // ------------- helper functions -------------
    const buildWsUrl = (key: string) => {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
      const host = window.location.hostname
      const localPort =
        host === "localhost" || host === "127.0.0.1" ? `:${process.env.NEXT_PUBLIC_BACKEND_PORT ?? "8000"}` : ""
      return `${proto}//${host}${localPort}/ws-shell/${key}`
    }

    let reconnectAttempts = 0
    let reconnectTimer: NodeJS.Timeout | null = null

    const connect = () => {
      const url = buildWsUrl(sessionKey)
      term.current?.write(`\r\nConnecting to ${title} (${url}) …\r\n`)
      ws.current = new WebSocket(url)

      ws.current.onopen = () => {
        reconnectAttempts = 0
        term.current?.write("✅ Connected!\r\n")
      }

      ws.current.onmessage = (evt) => term.current?.write(evt.data)

      ws.current.onclose = () => scheduleReconnect("Connection closed")
      ws.current.onerror = () => scheduleReconnect("WebSocket error")
    }

    const scheduleReconnect = (reason: string) => {
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        term.current?.write(`\r\n❌ ${reason}. Max reconnect attempts reached.\r\n`)
        return
      }
      const delay = RECONNECT_BASE_DELAY * 2 ** reconnectAttempts
      term.current?.write(`\r\n⚠️  ${reason}. Reconnecting in ${delay} ms…\r\n`)
      reconnectAttempts += 1
      reconnectTimer = setTimeout(connect, delay)
    }

    connect()

    // ------------- cleanup -------------
    return () => {
      resizeObserver.disconnect()
      reconnectTimer && clearTimeout(reconnectTimer)
      term.current?.dispose()
      ws.current?.close()
    }
  }, [sessionKey, title])

  return (
    <div className="flex flex-col h-full w-full border rounded-lg overflow-hidden bg-[#1e1e1e]">
      <div className="flex items-center justify-between p-2 border-b border-gray-700 bg-gray-800 text-white">
        <h2 className="text-sm font-medium">{title}</h2>
        {/* Add terminal controls here if needed */}
      </div>
      <div ref={terminalRef} className="flex-1" />
    </div>
  )
}
