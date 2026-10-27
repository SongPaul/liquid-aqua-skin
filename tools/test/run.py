# -*- coding: utf-8 -*-
"""Run the skin's browser test suites.

    python tools/test/run.py                  every suite
    python tools/test/run.py card grinder     named suites

Each suite is a JavaScript file in tools/test/suites/. The runner builds a
throwaway copy of index.html with the harness and the suite appended, serves
it from a local http server so the skin resolves its gateway the way it does
in a browser, loads it in headless Chrome, and reads the result out of the
DOM. The throwaway copy is always removed.

A gateway is expected at 127.0.0.1:8080 (SB_HOST / SB_PORT override). The
cases put the skin into the state they assert on, so they do not care which
devices are connected -- but the page has to boot.
"""
import io
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
SKIN = os.path.abspath(os.path.join(HERE, '..', '..'))
SUITES = os.path.join(HERE, 'suites')

CHROME = [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
]


def chrome():
    for c in CHROME:
        if os.path.exists(c):
            return c
    found = shutil.which('chrome') or shutil.which('google-chrome') or shutil.which('chromium')
    if found:
        return found
    sys.exit('no chrome found; set one of: ' + ', '.join(CHROME))


def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port


def serve(directory, port):
    try:
        from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
    except ImportError:
        sys.exit('python 3.7+ required')

    class Quiet(SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=directory, **kw)

        def log_message(self, *a):
            pass

    srv = ThreadingHTTPServer(('127.0.0.1', port), Quiet)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def build(suite_path, out_path):
    page = io.open(os.path.join(SKIN, 'index.html'), encoding='utf-8').read()
    harness = io.open(os.path.join(HERE, 'harness.js'), encoding='utf-8').read()
    suite = io.open(suite_path, encoding='utf-8').read()
    if page.count('</body>') != 1:
        sys.exit('index.html: expected exactly one </body>')
    # The fade would otherwise be caught mid-animation by a virtual clock
    # that does not drive CSS transitions.
    freeze = ('<style>.overlay,.modal{transition:none !important}'
              '.overlay.show .modal{transform:none !important}</style>')
    blob = freeze + '<script>\n' + harness + '\n</script>\n<script>\n' + suite + '\n</script>'
    io.open(out_path, 'w', encoding='utf-8', newline='').write(
        page.replace('</body>', blob + '</body>'))


def run_suite(name, port, budget=20000):
    suite_path = os.path.join(SUITES, name + '.js')
    if not os.path.exists(suite_path):
        sys.exit('no such suite: ' + name)
    out_name = '__test_%s.html' % name
    out_path = os.path.join(SKIN, out_name)
    profile = tempfile.mkdtemp(prefix='liquid-aqua-test-')
    try:
        build(suite_path, out_path)
        proc = subprocess.run(
            [chrome(), '--headless=new', '--disable-gpu', '--no-sandbox',
             '--hide-scrollbars', '--user-data-dir=' + profile,
             '--window-size=1280,800',
             '--virtual-time-budget=%d' % budget, '--dump-dom',
             'http://127.0.0.1:%d/%s' % (port, out_name)],
            capture_output=True, text=True, encoding='utf-8',
            errors='replace', timeout=180)
        dom = proc.stdout or ''
    except subprocess.TimeoutExpired:
        return name, None, 'chrome timed out'
    finally:
        if os.path.exists(out_path):
            os.remove(out_path)
        shutil.rmtree(profile, ignore_errors=True)

    m = re.search(r'<pre id="__test">BEGIN\n(.*?)\n(GREEN|RED)\nFINISH</pre>', dom, re.S)
    if not m:
        return name, None, 'suite produced no result (page failed to boot?)'
    return name, m.group(2) == 'GREEN', m.group(1)


def main(argv):
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding='utf-8', errors='replace')
        except AttributeError:
            pass
    if not os.path.isdir(SUITES):
        sys.exit('no suites directory at ' + SUITES)
    names = argv or sorted(
        f[:-3] for f in os.listdir(SUITES) if f.endswith('.js'))
    if not names:
        sys.exit('no suites found')

    port = free_port()
    srv = serve(SKIN, port)
    time.sleep(0.2)
    failed = []
    try:
        for name in names:
            started = time.time()
            name, green, body = run_suite(name, port)
            took = time.time() - started
            print('== %s (%.1fs)' % (name, took))
            print(body)
            print('')
            if not green:
                failed.append(name)
    finally:
        srv.shutdown()

    if failed:
        print('FAILED: ' + ', '.join(failed))
        return 1
    print('all suites green')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
