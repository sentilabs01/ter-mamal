"use client"

import { useEffect, useRef, useState } from "react"

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_BASE_DELAY = 1000 // 1 second

interface TerminalPaneProps {
  sessionKey: "pm" | "frontend" | "backend"
  title: string
}

function TerminalPaneInner({ sessionKey, title }: TerminalPaneProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const term = useRef<any>(null)
  const fitAddon = useRef<any>(null)
  const ws = useRef<WebSocket | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("Initializing...")

  useEffect(() => {
    if (!terminalRef.current || term.current || isLoaded || typeof window === 'undefined') return

    // Load xterm CSS dynamically
    const loadXtermCSS = () => {
      if (!document.querySelector('link[href*="xterm"]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css'
        document.head.appendChild(link)
      }
    }

    const initializeTerminal = async () => {
      try {
        loadXtermCSS()
        
        // Dynamic imports to avoid SSR issues
        const xterm = await import("xterm")
        const xtermAddonFit = await import("xterm-addon-fit")

        // ------------- xterm init -------------
        term.current = new xterm.Terminal({
          fontFamily: '"Cascadia Code", Menlo, monospace',
          fontSize: 14,
          cursorBlink: true,
          theme: {
            background: "#1e1e1e",
            foreground: "#cccccc",
            cursor: "#cccccc",
            selectionBackground: "#5f5f5f",
          },
          allowTransparency: true,
          cursorStyle: 'block',
          scrollback: 1000,
          // Add these critical settings for proper rendering
          convertEol: true,
          disableStdin: false,
          screenReaderMode: false,
          windowsMode: true
        })
        
        console.log(`[${sessionKey}] Terminal created:`, term.current)
        
        fitAddon.current = new xtermAddonFit.FitAddon()
        term.current.loadAddon(fitAddon.current)
        term.current.open(terminalRef.current!)
        fitAddon.current.fit()

        console.log(`[${sessionKey}] Terminal opened and fitted`)

        // Focus the terminal immediately
        term.current.focus()
        console.log(`[${sessionKey}] Terminal focused`)
        
        // Test write to verify terminal is working
        term.current.write("Terminal initialized successfully!\r\n")
        console.log(`[${sessionKey}] Test write completed`)
        
        // Force a redraw to ensure terminal is properly rendered
        setTimeout(() => {
          if (term.current) {
            term.current.refresh(0, term.current.rows - 1)
            console.log(`[${sessionKey}] Terminal refreshed`)
            
            // Test direct input handling to verify terminal works
            term.current.write("Testing direct input...\r\n")
            term.current.write("Type something: ")
            
            // Test if terminal can receive direct input
            const testInput = "Hello World!"
            term.current.write(testInput)
            console.log(`[${sessionKey}] Direct test input written:`, testInput)
          }
        }, 100)

        const resizeObserver = new ResizeObserver(() => fitAddon.current?.fit())
        resizeObserver.observe(terminalRef.current!)

        // ------------- keyboard input handling -------------
        term.current.onData((data: string) => {
          console.log(`[${sessionKey}] Sending data:`, JSON.stringify(data))
          
          // Test mode: Echo back immediately without WebSocket
          if (data === '\r') {
            term.current.write('\r\n$ ')
          } else if (data === '\x7f') {
            // Backspace
            term.current.write('\b \b')
          } else {
            // Echo character back immediately for testing
            term.current.write(data)
          }
          
          // Original WebSocket code (commented out for testing)
          // if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          //   ws.current.send(data)
          // }
        })

        // ------------- helper functions -------------
        // Simplify WebSocket URL builder for local development
        const buildWsUrl = (key: string) => `ws://localhost:8000/ws-shell/${key}`

        let reconnectAttempts = 0
        let reconnectTimer: NodeJS.Timeout | null = null

        const connect = () => {
          const url = buildWsUrl(sessionKey)
          setConnectionStatus("Connecting...")
          // Don't write connecting message to avoid conflicts
          ws.current = new WebSocket(url)

          ws.current.onopen = () => {
            reconnectAttempts = 0
            setConnectionStatus("Connected")
            // Clear the terminal and write fresh content
            if (term.current) {
              term.current.clear()
              term.current.write("✅ Connected!\r\n")
              term.current.write("Type 'help' for available commands\r\n")
              term.current.write("$ ")
              
              // Force terminal to update and focus
              setTimeout(() => {
                if (term.current) {
                  term.current.focus()
                  term.current.refresh(0, term.current.rows - 1)
                  console.log(`[${sessionKey}] Terminal ready for input`)
                }
              }, 100)
            }
          }

          ws.current.onmessage = (evt) => {
            console.log(`[${sessionKey}] Received:`, evt.data)
            console.log(`[${sessionKey}] Terminal ref:`, term.current)
            console.log(`[${sessionKey}] Writing to terminal:`, evt.data)
            if (term.current) {
              // Ensure the terminal is focused and ready
              term.current.focus()
              
              // Write data with proper error handling
              try {
                term.current.write(evt.data)
                console.log(`[${sessionKey}] Data written successfully`)
                
                // Force a refresh after writing to ensure visual update
                setTimeout(() => {
                  if (term.current) {
                    term.current.refresh(0, term.current.rows - 1)
                  }
                }, 10)
              } catch (error) {
                console.error(`[${sessionKey}] Error writing to terminal:`, error)
              }
            } else {
              console.error(`[${sessionKey}] Terminal not initialized!`)
            }
          }

          ws.current.onclose = () => {
            setConnectionStatus("Disconnected")
            scheduleReconnect("Connection closed")
          }
          ws.current.onerror = () => {
            setConnectionStatus("Error")
            scheduleReconnect("WebSocket error")
          }
        }

        const scheduleReconnect = (reason: string) => {
          if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            setConnectionStatus("Failed")
            term.current?.write(`\r\n❌ ${reason}. Max reconnect attempts reached.\r\n`)
            return
          }
          const delay = RECONNECT_BASE_DELAY * 2 ** reconnectAttempts
          setConnectionStatus(`Reconnecting...`)
          term.current?.write(`\r\n⚠️  ${reason}. Reconnecting in ${delay} ms…\r\n`)
          reconnectAttempts += 1
          reconnectTimer = setTimeout(connect, delay)
        }

        // connect()  // COMMENTED OUT FOR TESTING - Use local echo mode only
        setIsLoaded(true)

        // ------------- cleanup -------------
        return () => {
          resizeObserver.disconnect()
          reconnectTimer && clearTimeout(reconnectTimer)
          term.current?.dispose()
          ws.current?.close()
        }
      } catch (error) {
        console.error("Failed to initialize terminal:", error)
        setConnectionStatus("Error")
      }
    }

    initializeTerminal()
  }, [sessionKey, title, isLoaded])

  // Handle click to focus
  const handleTerminalClick = () => {
    if (term.current) {
      term.current.focus()
    }
  }

  return (
    <div className="flex flex-col h-full w-full border rounded-lg overflow-hidden bg-[#1e1e1e]">
      <div className="flex items-center justify-between p-2 border-b border-gray-700 bg-gray-800 text-white">
        <h2 className="text-sm font-medium">{title}</h2>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === "Connected" ? "bg-green-500" :
            connectionStatus === "Connecting..." ? "bg-yellow-500" :
            connectionStatus === "Error" || connectionStatus === "Failed" ? "bg-red-500" :
            "bg-gray-500"
          }`}></div>
          <div className="text-xs text-gray-400">{connectionStatus}</div>
        </div>
      </div>
      <div 
        ref={terminalRef} 
        className="flex-1 cursor-text" 
        onClick={handleTerminalClick}
        style={{ minHeight: '200px' }}
      />
    </div>
  )
}

// Client-only wrapper to prevent SSR issues
export function TerminalPane(props: TerminalPaneProps) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return (
      <div className="flex flex-col h-full w-full border rounded-lg overflow-hidden bg-[#1e1e1e]">
        <div className="flex items-center justify-between p-2 border-b border-gray-700 bg-gray-800 text-white">
          <h2 className="text-sm font-medium">{props.title}</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-400">
          Loading terminal...
        </div>
      </div>
    )
  }

  return <TerminalPaneInner {...props} />
}
