import serial
import requests
import json
import time

# --- CONFIGURATION ---
COM_PORT = 'COM5'  # Replace with your Arduino COM port
BAUD_RATE = 9600
ACCESS_TOKEN = '3BdKB2IwPGoNao2c1vgg'
THINGSBOARD_URL = f'http://thingsboard.cloud/api/v1/3BdKB2IwPGoNao2c1vgg/telemetry'

def main():
    try:
        ser = serial.Serial(COM_PORT, BAUD_RATE, timeout=1)
        print(f"Connected to Arduino on {COM_PORT}. Waiting for data...")
        time.sleep(2)  # Allow time for serial reset

        while True:
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if line.startswith("{") and line.endswith("}"):
                    print(f"Arduino Raw Data: {line}")
                    try:
                        # Validate JSON format
                        payload = json.loads(line)
                        
                        # Post to ThingsBoard Telemetry API
                        response = requests.post(THINGSBOARD_URL, json=payload)
                        if response.status_code == 200:
                            print("-> Successfully forwarded to ThingsBoard Cloud!")
                        else:
                            print(f"-> ThingsBoard HTTP Error: {response.status_code}")
                    except json.JSONDecodeError:
                        print("-> Error: Malformed JSON string received.")
            time.sleep(0.1)

    except Exception as e:
        print(f"Serial Connection Error: {e}")

if __name__ == "__main__":
    main()