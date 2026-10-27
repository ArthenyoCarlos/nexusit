import unittest,tempfile,json
from pathlib import Path
import ts_refresh_worker as worker

class RefreshTest(unittest.TestCase):
 def test_success_requires_new_healthy_snapshot_and_preserves_request_id(self):
  with tempfile.TemporaryDirectory() as d:
   state=Path(d); request={'id':'f0871dee-97f9-4e8a-a0a3-7432ca42d556','requestedAt':'2026-10-27T10:00:00Z'}
   (state/'ts_refresh_request.json').write_text(json.dumps(request))
   (state/'ts_sessions.json').write_text(json.dumps({'status':'OK','collectedAt':'old'}))
   def collect():
    (state/'ts_sessions.json').write_text(json.dumps({'status':'OK','collectedAt':'new'}))
    return 'notification'
   self.assertTrue(worker.process_once(state,collect))
   result=json.loads((state/'ts_refresh_result.json').read_text())
   self.assertEqual('SUCCEEDED',result['status']);self.assertEqual(request['id'],result['id'])
   self.assertFalse(worker.process_once(state,lambda: self.fail('must not repeat')))
 def test_failed_collection_never_reports_old_snapshot_as_success(self):
  with tempfile.TemporaryDirectory() as d:
   state=Path(d);(state/'ts_refresh_request.json').write_text(json.dumps({'id':'f0871dee-97f9-4e8a-a0a3-7432ca42d556'}))
   (state/'ts_sessions.json').write_text(json.dumps({'status':'OK','collectedAt':'old'}))
   worker.process_once(state,lambda: '')
   self.assertEqual('FAILED',json.loads((state/'ts_refresh_result.json').read_text())['status'])
 def test_no_request_is_noop(self):
  with tempfile.TemporaryDirectory() as d:self.assertFalse(worker.process_once(Path(d),lambda: self.fail()))
