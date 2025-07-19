import os

class ShellManager:
    def __init__(self):
        # In a real scenario, these ports would be dynamically assigned or discovered
        # based on the spawned ttyd containers.
        self.ttyd_ports = {
            "pm": os.getenv("TTYD_PM_PORT", "7681"),
            "frontend": os.getenv("TTYD_FRONTEND_PORT", "7682"),
            "backend": os.getenv("TTYD_BACKEND_PORT", "7683"),
        }
        print(f"ShellManager initialized with ttyd ports: {self.ttyd_ports}")

    def get_ttyd_url(self, session_key: str) -> str:
        port = self.ttyd_ports.get(session_key)
        if not port:
            raise ValueError(f"Invalid session key: {session_key}")
        # In a real Docker setup, this would be the internal Docker network IP/hostname
        # For external access, it's localhost.
        return f"ws://localhost:{port}"

    # In a full implementation, you would have methods like:
    # def spawn_ttyd_instance(self, session_key: str):
    #     # Use docker-py to run a ttyd container
    #     pass
    #
    # def terminate_ttyd_instance(self, session_key: str):
    #     # Use docker-py to stop and remove a ttyd container
    #     pass

shell_manager = ShellManager()
