import unittest
from ts_collector import classify, prepare_snapshot

class SnapshotTest(unittest.TestCase):
    def test_real_snapshot_calculates_counts_and_identity(self):
        raw={'collectedAt':'2026-10-27T13:35:01Z','sessions':[{'id':9,'user':'u','domain':'TS','state':'DISCONNECTED','logonAt':'2026-10-25T00:00:00Z','disconnectedSeconds':2000,'isAdmin':False}],'events':[]}
        data=prepare_snapshot(raw)
        self.assertEqual('OVERDUE',data['sessions'][0]['compliance'])
        self.assertEqual(1,data['summary']['overdue'])
        self.assertEqual(raw['collectedAt'],data['lastSuccessAt'])
        self.assertEqual('OK',data['status'])


class ComplianceTest(unittest.TestCase):
    def test_disconnected_admin_is_exempt(self):
        self.assertEqual('EXEMPT', classify('DISCONNECTED', True, 5000))
    def test_unknown_admin_is_not_declared_overdue(self):
        self.assertEqual('UNKNOWN', classify('DISCONNECTED', None, 5000))
    def test_unknown_disconnect_time_is_unknown(self):
        self.assertEqual('UNKNOWN', classify('DISCONNECTED', False, None))
    def test_only_past_limit_and_tolerance_is_overdue(self):
        self.assertEqual('WITHIN_LIMIT', classify('DISCONNECTED', False, 1920))
        self.assertEqual('OVERDUE', classify('DISCONNECTED', False, 1921))
    def test_active_is_not_targeted(self):
        self.assertEqual('ACTIVE', classify('ACTIVE', False, 9999))
    def test_negative_duration_is_unknown(self):
        self.assertEqual('UNKNOWN', classify('DISCONNECTED', False, -5))

if __name__ == '__main__': unittest.main()
