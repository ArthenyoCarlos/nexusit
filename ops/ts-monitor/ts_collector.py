"""Read-only TS collector. No disconnect/logoff actions."""
def classify(state, is_admin, disconnected_seconds):
    if state == 'ACTIVE':
        return 'ACTIVE'
    if state != 'DISCONNECTED':
        return 'UNKNOWN'
    if is_admin is True:
        return 'EXEMPT'
    if is_admin is None or disconnected_seconds is None or disconnected_seconds < 0:
        return 'UNKNOWN'
    return 'OVERDUE' if disconnected_seconds > 1920 else 'WITHIN_LIMIT'


def prepare_snapshot(raw):
    for row in raw['sessions']:
        row['compliance'] = classify(row['state'], row.get('isAdmin'), row.get('disconnectedSeconds'))
        row['disconnectEvidence'] = 'WTSInfo.DisconnectTime' if row.get('disconnectedAt') else 'UNAVAILABLE'
    rows = raw['sessions']
    raw.update(status='OK', error=None, lastSuccessAt=raw['collectedAt'])
    raw['summary'] = dict(total=len(rows), active=sum(r['state']=='ACTIVE' for r in rows),
        disconnected=sum(r['state']=='DISCONNECTED' for r in rows),
        overdue=sum(r['compliance']=='OVERDUE' for r in rows),
        exempt=sum(r.get('isAdmin') is True for r in rows),
        unknown=sum(r['compliance']=='UNKNOWN' for r in rows))
    return raw


def main():
    import base64, datetime, fcntl, gzip, json, os, sqlite3
    from pathlib import Path
    from ts_access import session
    state = Path('/home/galdino/.hermes/state')
    state.mkdir(parents=True, exist_ok=True)
    lock = (state/'ts_sessions.lock').open('w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return
    target = state/'ts_sessions.json'
    previous = json.loads(target.read_text()) if target.exists() else {}
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        b64 = base64.b64encode(gzip.compress(Path(__file__).with_name('collect-sessions.ps1').read_bytes())).decode()
        command = "[Console]::OutputEncoding=New-Object Text.UTF8Encoding;$b=[Convert]::FromBase64String('"+b64+"');$m=New-Object IO.MemoryStream(,$b);$g=New-Object IO.Compression.GzipStream($m,[IO.Compression.CompressionMode]::Decompress);$r=New-Object IO.StreamReader($g);Invoke-Expression $r.ReadToEnd()"
        result = session().run_cmd('powershell.exe', ['-NoProfile','-NonInteractive','-Command',command])
        if result.status_code:
            raise RuntimeError('Remote collection failed')
        raw = json.loads(result.std_out.decode('utf-8-sig'))
        remote_at = datetime.datetime.fromisoformat(raw['collectedAt'].replace('Z','+00:00'))
        if abs((datetime.datetime.now(datetime.timezone.utc)-remote_at).total_seconds()) > 120:
            raise RuntimeError('Server clock differs from collector')
        data = prepare_snapshot(raw)
        with sqlite3.connect(state/'ts_sessions_history.sqlite') as db:
            db.execute('CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, at TEXT NOT NULL, payload TEXT NOT NULL)')
            db.executemany('INSERT OR IGNORE INTO events VALUES (?,?,?)',[(e['id'],e['at'],json.dumps(e,ensure_ascii=False)) for e in data['events']])
            cutoff = (datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(days=30)).isoformat()
            db.execute('DELETE FROM events WHERE at < ?', (cutoff,))
            data['events'] = [json.loads(r[0]) for r in db.execute('SELECT payload FROM events ORDER BY at DESC LIMIT 1000')]
        if previous.get('status')=='ERROR':
            print('✅ TS 192.168.2.100: coleta de sessões recuperada.')
        old = {f"{r.get('id')}:{r.get('logonAt')}" for r in previous.get('sessions',[]) if r.get('compliance')=='OVERDUE'}
        for r in data['sessions']:
            key=f"{r['id']}:{r.get('logonAt')}"
            if r['compliance']=='OVERDUE' and key not in old:
                print(f"⚠️ TS: {r['user']} — sessão {r['id']} desconectada há {r['disconnectedSeconds']//60} min, além de 30 min + 2 min de tolerância. Verifique a política de logoff.")
        current = {f"{r['id']}:{r.get('logonAt')}" for r in data['sessions'] if r['compliance']=='OVERDUE'}
        if old-current and previous.get('status')=='OK':
            print('✅ TS: sessão anteriormente acima do limite não está mais em violação nesta coleta. Consulte os eventos para distinguir reconexão e logoff.')
        if data.get('eventHealth') != 'OK' and previous.get('eventHealth')=='OK':
            print('⚠️ TS: sessões coletadas, mas leitura do histórico de eventos indisponível.')
    except Exception as exc:
        data = dict(previous)
        data.update(server='TS-VM', ip='192.168.2.100', status='ERROR', collectedAt=now,
            error='Falha na coleta TS; verificar conectividade, credencial do cofre e permissões WinRM.')
        if previous.get('status')!='ERROR':
            print('⚠️ TS 192.168.2.100: falha na coleta de sessões; último dado preservado. '+type(exc).__name__)
    temp = target.with_suffix('.tmp')
    temp.write_text(json.dumps(data,ensure_ascii=False))
    os.chmod(temp,0o640)
    temp.replace(target)


if __name__ == '__main__':
    main()
