from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import URLError
from urllib.request import ProxyHandler, build_opener
import webbrowser


ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 8765
URL = f"http://{HOST}:{PORT}/"


class LocalServer(ThreadingHTTPServer):
    allow_reuse_address = False


def main():
    handler = partial(SimpleHTTPRequestHandler, directory=ROOT)
    try:
        server = LocalServer((HOST, PORT), handler)
    except OSError:
        opener = build_opener(ProxyHandler({}))
        try:
            with opener.open(URL, timeout=2) as response:
                same_site = response.read() == (ROOT / "index.html").read_bytes()
        except (URLError, OSError):
            same_site = False
        if not same_site:
            raise SystemExit(f"Cannot open the scoreboard. Port {PORT} is unavailable.")
        webbrowser.open(URL)
        return

    with server:
        print(f"Bang diem: {URL}", flush=True)
        print("Giu cua so nay mo trong luc thi. Nhan Ctrl+C de tat.", flush=True)
        webbrowser.open(URL)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
