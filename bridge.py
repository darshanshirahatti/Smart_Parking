import json
import logging
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests
import serial
from dotenv import load_dotenv


LOGGER = logging.getLogger("smartpark.bridge")


@dataclass(frozen=True)
class BridgeConfig:
    serial_port: str
    baud_rate: int
    serial_timeout: float
    thingsboard_url: str
    sensor_event_url: str
    sensor_event_token: str
    request_timeout: float
    reconnect_delay: float

    @classmethod
    def from_env(cls) -> "BridgeConfig":
        serial_port = os.getenv("SERIAL_PORT", "").strip()
        device_token = os.getenv("THINGSBOARD_DEVICE_TOKEN", "").strip()
        sensor_event_token = os.getenv("SENSOR_EVENT_TOKEN", "").strip()
        if not serial_port:
            raise ValueError("Set SERIAL_PORT to the sensor's serial port (for example, COM4s).")
        if not device_token:
            raise ValueError("Set THINGSBOARD_DEVICE_TOKEN to the ThingsBoard device token.")
        if len(sensor_event_token) < 32:
            raise ValueError("Set SENSOR_EVENT_TOKEN to the same random secret configured in server/.env.")

        thingsboard_host = os.getenv("THINGSBOARD_HOST", "https://thingsboard.cloud").strip().rstrip("/")
        if not thingsboard_host.startswith(("https://", "http://")):
            raise ValueError("THINGSBOARD_HOST must start with https:// or http://.")
        sensor_event_url = os.getenv(
            "SENSOR_EVENT_API_URL",
            "http://localhost:3001/api/sensor-events",
        ).strip()
        if not sensor_event_url.startswith(("https://", "http://")):
            raise ValueError("SENSOR_EVENT_API_URL must start with https:// or http://.")

        try:
            baud_rate = int(os.getenv("BAUD_RATE", "9600"))
            serial_timeout = float(os.getenv("SERIAL_TIMEOUT", "1"))
            request_timeout = float(os.getenv("HTTP_TIMEOUT", "5"))
            reconnect_delay = float(os.getenv("RECONNECT_DELAY", "3"))
        except ValueError as error:
            raise ValueError("BAUD_RATE, SERIAL_TIMEOUT, HTTP_TIMEOUT, and RECONNECT_DELAY must be numbers.") from error

        if baud_rate <= 0 or serial_timeout <= 0 or request_timeout <= 0 or reconnect_delay <= 0:
            raise ValueError("Serial and network settings must be greater than zero.")

        telemetry_url = (
            f"{thingsboard_host}/api/v1/{quote(device_token, safe='')}/telemetry"
        )
        return cls(
            serial_port=serial_port,
            baud_rate=baud_rate,
            serial_timeout=serial_timeout,
            thingsboard_url=telemetry_url,
            sensor_event_url=sensor_event_url,
            sensor_event_token=sensor_event_token,
            request_timeout=request_timeout,
            reconnect_delay=reconnect_delay,
        )


def parse_sensor_line(line: str) -> dict[str, Any]:
    try:
        payload = json.loads(line)
    except json.JSONDecodeError as error:
        raise ValueError("Sensor sent malformed JSON.") from error

    if not isinstance(payload, dict) or not payload:
        raise ValueError("Sensor data must be a non-empty JSON object.")
    return payload


def forward_telemetry(
    payload: dict[str, Any],
    session: requests.Session,
    config: BridgeConfig,
) -> None:
    for attempt in range(1, 4):
        try:
            with session.post(
                config.thingsboard_url,
                json=payload,
                timeout=config.request_timeout,
            ) as response:
                response.raise_for_status()
            LOGGER.info("Forwarded telemetry to ThingsBoard.")
            return
        except requests.RequestException:
            if attempt == 3:
                raise
            delay = 2 ** (attempt - 1)
            LOGGER.warning(
                "ThingsBoard request failed (attempt %s/3); retrying in %s second(s).",
                attempt,
                delay,
            )
            time.sleep(delay)


def forward_sensor_events(
    payload: dict[str, Any],
    session: requests.Session,
    config: BridgeConfig,
) -> None:
    sensor_slots = {"occupied": "A01", "occupied2": "A02", "occupied3": "A03"}
    for key, slot_number in sensor_slots.items():
        value = payload.get(key)
        if isinstance(value, bool):
            occupied = value
        elif isinstance(value, int) and value in (0, 1):
            occupied = value == 1
        elif isinstance(value, str) and value.strip().lower() in ("true", "false", "0", "1"):
            occupied = value.strip().lower() in ("true", "1")
        else:
            continue

        for attempt in range(1, 4):
            try:
                with session.post(
                    config.sensor_event_url,
                    json={"slotNumber": slot_number, "occupied": occupied},
                    headers={"Authorization": f"Bearer {config.sensor_event_token}"},
                    timeout=config.request_timeout,
                ) as response:
                    response.raise_for_status()
                LOGGER.info("Forwarded %s sensor state for %s to SmartPark.", "occupied" if occupied else "clear", slot_number)
                break
            except requests.RequestException:
                if attempt == 3:
                    raise
                delay = 2 ** (attempt - 1)
                LOGGER.warning(
                    "SmartPark sensor event failed (attempt %s/3); retrying in %s second(s).",
                    attempt,
                    delay,
                )
                time.sleep(delay)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    load_dotenv(Path(__file__).resolve().with_name(".env"))
    try:
        config = BridgeConfig.from_env()
    except ValueError as error:
        LOGGER.error("Invalid bridge configuration: %s", error)
        raise SystemExit(2) from error
    session = requests.Session()
    LOGGER.info("Starting sensor bridge on %s at %s baud.", config.serial_port, config.baud_rate)

    try:
        while True:
            try:
                with serial.Serial(
                    config.serial_port,
                    config.baud_rate,
                    timeout=config.serial_timeout,
                ) as sensor:
                    LOGGER.info("Connected to sensor; waiting for JSON telemetry.")
                    while True:
                        raw_line = sensor.readline()
                        if not raw_line:
                            continue

                        line = raw_line.decode("utf-8", errors="replace").strip()
                        if not line:
                            continue

                        try:
                            payload = parse_sensor_line(line)
                        except ValueError as error:
                            LOGGER.warning("%s", error)
                            continue

                        try:
                            forward_telemetry(payload, session, config)
                        except requests.RequestException as error:
                            LOGGER.error(
                                "Unable to forward telemetry after retries (%s).",
                                type(error).__name__,
                            )
                        try:
                            forward_sensor_events(payload, session, config)
                        except requests.RequestException as error:
                            LOGGER.error(
                                "Unable to update SmartPark sensor state after retries (%s).",
                                type(error).__name__,
                            )
            except (serial.SerialException, OSError) as error:
                LOGGER.error(
                    "Sensor connection failed on %s: %s. Retrying in %s second(s).",
                    config.serial_port,
                    error,
                    config.reconnect_delay,
                )
                time.sleep(config.reconnect_delay)
    except KeyboardInterrupt:
        LOGGER.info("Sensor bridge stopped.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
