"""Isolated launcher checks: never start Slotera or connect to its database."""
import importlib.util
from pathlib import Path
import socket
import subprocess
import sys
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("dev_processes", Path(__file__).with_name("dev-processes.py"))
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


class LauncherTests(unittest.TestCase):
    def test_port_collision_closes_every_probe_and_names_owner_check(self):
        probes = []

        class Probe:
            def __init__(self):
                self.closed = False
                probes.append(self)

            def bind(self, address):
                if address[1] == 3344:
                    raise OSError("busy")

            def close(self):
                self.closed = True

        with patch.object(socket, "socket", Probe):
            with self.assertRaisesRegex(RuntimeError, "3344.*lsof"):
                launcher.check_ports()
        self.assertEqual(len(probes), 2)
        self.assertTrue(all(probe.closed for probe in probes))

    def test_owned_group_stops_but_unrelated_process_survives(self):
        owned = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"], start_new_session=True)
        unrelated = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"], start_new_session=True)
        try:
            launcher.stop_groups([owned])
            self.assertIsNotNone(owned.poll())
            self.assertIsNone(unrelated.poll())
        finally:
            launcher.stop_groups([owned, unrelated])


if __name__ == "__main__":
    unittest.main()
