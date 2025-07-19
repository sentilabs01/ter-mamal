import { TerminalPane } from "@/components/terminal-pane"

export default function HomePage() {
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white p-4 gap-4">
      <h1 className="text-3xl font-bold text-center mb-4">Prompt-UI-Toolbox Terminal Integration</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
        <TerminalPane sessionKey="pm" title="Project Manager (pm)" />
        <TerminalPane sessionKey="frontend" title="Frontend (fed)" />
        <TerminalPane sessionKey="backend" title="Backend (bed)" />
      </div>
      <div className="text-center text-sm text-gray-400 mt-4">
        <p>
          To run this locally:
          <br />
          1. Save the `docker-compose.yml`, `backend/Dockerfile`, `backend/requirements.txt`, `backend/main.py`, and
          `backend/shell_manager.py` files.
          <br />
          2. Navigate to the directory containing `docker-compose.yml` and run `docker-compose up --build`.
          <br />
          3. Ensure your frontend (this Next.js app) is running and can connect to `localhost:8000` for the backend and
          `localhost:7681`, `7682`, `7683` for `ttyd`.
        </p>
      </div>
    </div>
  )
}
