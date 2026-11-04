import os
import unittest

JS_PATH = os.path.abspath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "app", "static", "js", "kasir", "modules", "settings", "settings_network.js"
))

POLL_1000 = "loadCloudflareTunnelStatus(), 1000)"
POLL_300 = "loadCloudflareTunnelStatus(), 300)"


class TestSettingsNetworkPoller(unittest.TestCase):
    """Polling status Cloudflare Tunnel harus 1 detik, bukan 300 ms (3,3 req/detik)."""

    def setUp(self):
        with open(JS_PATH, "r", encoding="utf-8") as f:
            self.content = f.read()

    def test_poller_interval_is_1000ms(self):
        self.assertTrue(
            POLL_1000 in self.content,
            "Poller status Cloudflare harus memakai interval 1000 ms",
        )

    def test_poller_interval_300ms_absent(self):
        self.assertFalse(
            POLL_300 in self.content,
            "Varian interval 300 ms untuk status Cloudflare masih ada",
        )


if __name__ == "__main__":
    unittest.main()
