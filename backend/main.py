from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import websockets
import asyncio
import os
from dotenv import load_dotenv

# Load environment variables from .env file for local development
# In production, these would be provided by the environment
load_dotenv()

from shell_manager import shell_manager

app = FastAPI()

# Configure CORS to allow connections from your frontend
origins = [
    "http://localhost:3000", # Adjust this to your frontend's URL
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
    # Add your Vercel deployment URL here if applicable
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def get():
    return HTMLResponse("<h1>Prompt-UI-Toolbox Backend Running</h1>")

@app.websocket("/ws-shell/{session_key}")
async def websocket_endpoint(websocket: WebSocket, session_key: str):
    await websocket.accept()
    print(f"Frontend WebSocket connected for session: {session_key}")

    try:
        ttyd_url = shell_manager.get_ttyd_url(session_key)
        print(f"Attempting to connect to ttyd at: {ttyd_url}")

        async with websockets.connect(ttyd_url) as ttyd_ws:
            print(f"Connected to ttyd for session: {session_key}")

            # Task to forward messages from frontend to ttyd
            async def frontend_to_ttyd():
                try:
                    while True:
                        data = await websocket.receive_text()
                        await ttyd_ws.send(data)
                except WebSocketDisconnect:
                    print(f"Frontend disconnected from {session_key}")
                except Exception as e:
                    print(f"Error in frontend_to_ttyd for {session_key}: {e}")

            # Task to forward messages from ttyd to frontend
            async def ttyd_to_frontend():
                try:
                    while True:
                        data = await ttyd_ws.recv()
                        await websocket.send_text(data)
                except websockets.exceptions.ConnectionClosedOK:
                    print(f"ttyd connection closed for {session_key}")
                except Exception as e:
                    print(f"Error in ttyd_to_frontend for {session_key}: {e}")

            # Run both tasks concurrently
            await asyncio.gather(frontend_to_ttyd(), ttyd_to_frontend())

    except websockets.exceptions.ConnectionRefusedError:
        await websocket.send_text(f"Error: Could not connect to ttyd for session '{session_key}'. Is the ttyd service running?")
        print(f"Connection refused by ttyd for session: {session_key}")
    except ValueError as e:
        await websocket.send_text(f"Error: {e}")
        print(f"Error getting ttyd URL: {e}")
    except Exception as e:
        await websocket.send_text(f"An unexpected error occurred: {e}")
        print(f"Unexpected error for session {session_key}: {e}")
    finally:
        if not websocket.closed:
            await websocket.close()
        print(f"WebSocket connection closed for session: {session_key}")
