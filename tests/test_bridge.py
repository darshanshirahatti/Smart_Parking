import os
import unittest
from unittest.mock import MagicMock, patch

import requests

from bridge import BridgeConfig, forward_sensor_events, forward_telemetry, parse_sensor_line


class BridgeConfigTests(unittest.TestCase):
    @patch.dict(
        os.environ,
        {
            "SERIAL_PORT": "COM7",
            "THINGSBOARD_DEVICE_TOKEN": "token/with-slash",
            "THINGSBOARD_HOST": "https://thingsboard.example/",
            "SENSOR_EVENT_TOKEN": "s" * 64,
        },
        clear=True,
    )
    def test_reads_environment_and_encodes_device_token(self) -> None:
        config = BridgeConfig.from_env()

        self.assertEqual(config.serial_port, "COM7")
        self.assertEqual(
            config.sensor_event_url,
            "http://localhost:3001/api/sensor-events",
        )
        self.assertEqual(
            config.thingsboard_url,
            "https://thingsboard.example/api/v1/token%2Fwith-slash/telemetry",
        )

    @patch.dict(os.environ, {}, clear=True)
    def test_requires_sensor_port_and_device_token(self) -> None:
        with self.assertRaisesRegex(ValueError, "SERIAL_PORT"):
            BridgeConfig.from_env()


class ParseSensorLineTests(unittest.TestCase):
    def test_parses_sensor_telemetry_object(self) -> None:
        self.assertEqual(parse_sensor_line('{"occupied":true}'), {"occupied": True})

    def test_rejects_invalid_or_non_object_json(self) -> None:
        for line in ("{invalid}", "[]", "null", "{}"):
            with self.subTest(line=line), self.assertRaises(ValueError):
                parse_sensor_line(line)


class ForwardTelemetryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.config = BridgeConfig(
            serial_port="COM4",
            baud_rate=9600,
            serial_timeout=1,
            thingsboard_url="https://thingsboard.cloud/api/v1/device-token/telemetry",
            sensor_event_url="http://localhost:3001/api/sensor-events",
            sensor_event_token="s" * 64,
            request_timeout=5,
            reconnect_delay=3,
        )
        self.session = MagicMock()
        self.response = MagicMock()
        self.session.post.return_value.__enter__.return_value = self.response

    def test_posts_payload_with_timeout(self) -> None:
        payload = {"occupied": True}

        forward_telemetry(payload, self.session, self.config)

        self.session.post.assert_called_once_with(
            self.config.thingsboard_url,
            json=payload,
            timeout=5,
        )
        self.response.raise_for_status.assert_called_once_with()

    def test_posts_valid_sensor_state_to_smartpark(self) -> None:
        forward_sensor_events(
            {"occupied": False, "occupied2": True, "unknown": True},
            self.session,
            self.config,
        )

        calls = self.session.post.call_args_list
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0].args[0], self.config.sensor_event_url)
        self.assertEqual(calls[0].kwargs["json"], {"slotNumber": "A01", "occupied": False})
        self.assertEqual(
            calls[0].kwargs["headers"]["Authorization"],
            f"Bearer {self.config.sensor_event_token}",
        )
        self.assertEqual(calls[1].kwargs["json"], {"slotNumber": "A02", "occupied": True})

    def test_ignores_invalid_sensor_values(self) -> None:
        forward_sensor_events(
            {"occupied": "unknown", "occupied2": None},
            self.session,
            self.config,
        )

        self.session.post.assert_not_called()

    @patch("bridge.time.sleep")
    def test_retries_temporary_request_failure(self, sleep: MagicMock) -> None:
        self.session.post.side_effect = [
            requests.ConnectionError("temporarily unavailable"),
            MagicMock(__enter__=MagicMock(return_value=self.response)),
        ]

        forward_telemetry({"occupied": False}, self.session, self.config)

        self.assertEqual(self.session.post.call_count, 2)
        sleep.assert_called_once_with(1)

    @patch("bridge.time.sleep")
    def test_raises_after_three_failed_requests(self, sleep: MagicMock) -> None:
        self.session.post.side_effect = requests.Timeout("timed out")

        with self.assertRaises(requests.Timeout):
            forward_telemetry({"occupied": True}, self.session, self.config)

        self.assertEqual(self.session.post.call_count, 3)
        self.assertEqual([call.args[0] for call in sleep.call_args_list], [1, 2])


if __name__ == "__main__":
    unittest.main()
