"""File-queue worker: fixed read-only TS collection only; no arbitrary commands/hosts."""
import datetime,fcntl,json,os,subprocess,time,uuid
from pathlib import Path
STATE=Path('/home/galdino/.hermes/state')

def read(path):
 try:return json.loads(path.read_text())
 except (OSError,ValueError):return {}

def write(path,value):
 tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(value));os.chmod(tmp,0o640);tmp.replace(path)

def process_once(state,collect):
 request=read(state/'ts_refresh_request.json');id=request.get('id')
 try:uuid.UUID(id)
 except (ValueError,TypeError,AttributeError):return False
 result_path=state/'ts_refresh_result.json';previous=read(result_path)
 if previous.get('id')==id and previous.get('status') in ['SUCCEEDED','FAILED']:return False
 before=read(state/'ts_sessions.json').get('collectedAt')
 write(result_path,dict(id=id,status='RUNNING',startedAt=datetime.datetime.now(datetime.timezone.utc).isoformat()))
 try:
  output=collect()
  snapshot=read(state/'ts_sessions.json')
  if output:
   with (state/'ts_manual_notifications.lock').open('a') as lock:
    fcntl.flock(lock,fcntl.LOCK_EX)
    with (state/'ts_manual_notifications.log').open('a') as stream:stream.write(output+'\n')
  if snapshot.get('status')!='OK' or snapshot.get('collectedAt') in [None,before]:raise RuntimeError('No fresh snapshot')
  result=dict(id=id,status='SUCCEEDED',collectedAt=snapshot['collectedAt'])
 except Exception:
  result=dict(id=id,status='FAILED',error='Falha ao coletar no TS. Últimos dados preservados; verifique conectividade e credencial no cofre.')
 result['completedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();write(result_path,result)
 return True

def collect():
 result=subprocess.run(['/home/galdino/.hermes/venvs/ts-monitor/bin/python',str(Path(__file__).with_name('ts_collector.py')),'--wait-lock'],capture_output=True,text=True,timeout=85,check=True)
 return result.stdout

def main():
 STATE.mkdir(parents=True,exist_ok=True)
 with (STATE/'ts_refresh_worker.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  while True:
   process_once(STATE,collect)
   time.sleep(0.5)
if __name__=='__main__':main()
