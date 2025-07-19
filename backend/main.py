from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import subprocess
import os
import sys
import time
from typing import Dict, Set
import re

app = FastAPI(title="Ter-Mamal MCP Communication Tool", version="1.0.0")

# Configure CORS
origins = [
    "http://localhost:3000",
    "http://localhost:3001",  # Add the new port
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",  # Add the new port
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for command handling
command_buffers: Dict[str, str] = {}
active_connections: Set[WebSocket] = set()

# AI Agent commands that are specifically allowed
ALLOWED_AGENT_COMMANDS = [
    "npx https://github.com/google-gemini/gemini-cli",
    "npm install -g @anthropic-ai/claude-code",
    "gemini",
    "claude-code",
    "claude"
]

# Built-in commands
BUILTIN_COMMANDS = {
    "help": "Show available commands",
    "dir": "List directory contents",
    "ls": "List directory contents",
    "echo": "Echo text",
    "date": "Show current date/time",
    "clear": "Clear terminal",
    "pwd": "Show current directory",
    "whoami": "Show current user"
}

def is_allowed_command(command: str) -> bool:
    """Check if command is allowed for AI agent workflows"""
    command_lower = command.lower().strip()
    
    # Allow built-in commands
    if command_lower in BUILTIN_COMMANDS:
        return True
    
    # Allow AI agent commands
    for allowed in ALLOWED_AGENT_COMMANDS:
        if allowed.lower() in command_lower:
            return True
    
    # Allow basic system commands
    basic_commands = ["whoami", "pwd", "ls", "dir", "echo", "date", "clear", "mkdir", "cd"]
    for basic in basic_commands:
        if command_lower.startswith(basic):
            return True
    
    return False

@app.get("/")
async def get():
    return HTMLResponse("<h1>Ter-Mamal MCP Communication Tool Backend Running</h1>")

@app.websocket("/ws-shell/{session_key}")
async def websocket_endpoint(websocket: WebSocket, session_key: str):
    await websocket.accept()
    active_connections.add(websocket)
    print(f"Frontend WebSocket connected for session: {session_key}")
    
    # Initialize command buffer for this session
    if session_key not in command_buffers:
        command_buffers[session_key] = ""
    
    try:
        while True:
            data = await websocket.receive_text()
            print(f"[{session_key}] Received: '{data}'")
            
            # Handle special characters
            if data == '\r':  # Enter key
                command = command_buffers[session_key].strip()
                if command:
                    print(f"[{session_key}] Executing command: {command}")
                    await execute_command(websocket, session_key, command)
                command_buffers[session_key] = ""
                # Send new prompt after command execution
                await websocket.send_text("\r\n$ ")
            elif data == '\x7f':  # Backspace
                command_buffers[session_key] = command_buffers[session_key][:-1]
                # Send backspace to move cursor back
                await websocket.send_text('\b \b')
            else:
                command_buffers[session_key] += data
                # Echo the character back to display it in terminal
                await websocket.send_text(data)
                
    except WebSocketDisconnect:
        print(f"Frontend disconnected from {session_key}")
    except Exception as e:
        print(f"Error in websocket for {session_key}: {e}")
    finally:
        active_connections.discard(websocket)
        print(f"WebSocket connection closed for session: {session_key}")

async def execute_command(websocket: WebSocket, session_key: str, command: str):
    """Execute a command and send output back to frontend"""
    try:
        command_lower = command.lower().strip()
        
        # Check if command is allowed
        if not is_allowed_command(command):
            await websocket.send_text(f"\r\n❌ Command blocked: {command}\r\n")
            await websocket.send_text("💡 Try: npx https://github.com/google-gemini/gemini-cli\r\n")
            return
        
        # Handle built-in commands
        if command_lower in BUILTIN_COMMANDS:
            await handle_builtin_command(websocket, session_key, command_lower)
            return
        
        # Handle AI agent commands
        if any(agent_cmd.lower() in command_lower for agent_cmd in ALLOWED_AGENT_COMMANDS):
            await websocket.send_text(f"\r\n🚀 Executing AI agent command: {command}\r\n")
            await run_system_command(websocket, session_key, command)
            return
        
        # Handle other allowed commands
        await run_system_command(websocket, session_key, command)
        
    except Exception as e:
        await websocket.send_text(f"\r\n❌ Error executing command: {e}\r\n")

async def handle_builtin_command(websocket: WebSocket, session_key: str, command: str):
    """Handle built-in commands"""
    if command == "help":
        help_text = "\r\n📋 Available Commands:\r\n"
        for cmd, desc in BUILTIN_COMMANDS.items():
            help_text += f"  {cmd}: {desc}\r\n"
        help_text += "\r\n🤖 AI Agent Commands:\r\n"
        for cmd in ALLOWED_AGENT_COMMANDS:
            help_text += f"  {cmd}\r\n"
        await websocket.send_text(help_text)
    
    elif command in ["dir", "ls"]:
        print(f"[{session_key}] Running dir command")
        result = subprocess.run("dir", shell=True, capture_output=True, text=True, timeout=10)
        output = result.stdout if result.stdout else "Directory listing completed"
        print(f"[{session_key}] dir output: {repr(output)}")
        await websocket.send_text(f"\r\n{output}\r\n")
        print(f"[{session_key}] Sent dir output")
    
    elif command == "clear":
        await websocket.send_text("\r\n" + "\n" * 50)  # Clear screen
    
    elif command == "echo":
        await websocket.send_text("\r\nUsage: echo <text>\r\n")
    
    elif command == "date":
        from datetime import datetime
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        await websocket.send_text(f"\r\n📅 {now}\r\n")
    
    elif command == "pwd":
        pwd = os.getcwd()
        await websocket.send_text(f"\r\n📁 {pwd}\r\n")
    
    elif command == "whoami":
        result = subprocess.run("whoami", shell=True, capture_output=True, text=True, timeout=5)
        user = result.stdout.strip() if result.stdout else "Unknown user"
        await websocket.send_text(f"\r\n👤 {user}\r\n")

async def run_system_command(websocket: WebSocket, session_key: str, command: str):
    """Run a system command with timeout"""
    try:
        print(f"[{session_key}] Running system command: {command}")
        
        # Run command with timeout
        process = await asyncio.wait_for(
            asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            ),
            timeout=60.0  # 60 second timeout for AI agent commands
        )
        
        stdout, stderr = await process.communicate()
        
        # Send output
        if stdout:
            await websocket.send_text(f"\r\n{stdout.decode()}\r\n")
        if stderr:
            await websocket.send_text(f"\r\n⚠️  {stderr.decode()}\r\n")
        
        print(f"[{session_key}] Command stdout: {repr(stdout.decode())}")
        print(f"[{session_key}] Command stderr: {repr(stderr.decode())}")
        await websocket.send_text("✅ Command completed\r\n")
        print(f"[{session_key}] Sent execution confirmation")
        
    except asyncio.TimeoutError:
        await websocket.send_text("\r\n⏰ Command timed out after 60 seconds\r\n")
        print(f"[{session_key}] Command timed out")
    except Exception as e:
        await websocket.send_text(f"\r\n❌ Error: {str(e)}\r\n")
        print(f"[{session_key}] Command error: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
