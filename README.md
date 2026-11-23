# SmartPark

SmartPark is a smart city parking management dashboard built with React, TypeScript, Vite, and Tailwind CSS. It combines live slot availability, reservations, parking payments, and administration in one responsive interface.

Live repository: [github.com/darshanshirahatti/Smart_Parking](https://github.com/darshanshirahatti/Smart_Parking)

## Features

- Real-time dashboard for available, occupied, and reserved slots
- Parking map and lot finder for four parking bays (`A01`-`A04`)
- Reservation workflow with vehicle details, arrival time, duration, and advance payment
- Booking lifecycle from reservation through parking completion and final payment
- Admin controls for hourly rate, grace period, billing method, and slot management
- Optional ThingsBoard telemetry integration for hardware-backed occupancy

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Radix UI primitives
- Lucide React icons

## Project Structure

```text
smart-parking/
├── src/
│   ├── components/
│   ├── lib/
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── server/
│   ├── index.js
│   ├── schema.sql
│   └── package.json
├── tests/
│   └── test_bridge.py
├── bridge.py
├── index.html
├── package.json
├── requirements.txt
├── .env.example
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── vite.config.ts
├── README.md
└── .gitignore
```

## Requirements

- Node.js 18.18 or newer
- npm 9 or newer
- A Neon PostgreSQL database for shared reservations and accounts
- Python 3.10 or newer (for the optional hardware bridge)

## Getting Started

The app's login and reservation features require the API and a configured Neon database. Clone the repository and install the frontend and API dependencies:

```bash
git clone https://github.com/darshanshirahatti/Smart_Parking.git
cd Smart_Parking
npm install
npm --prefix server install
```

In PowerShell, copy the API environment template and edit `server/.env` with your Neon connection string and a random `SENSOR_EVENT_TOKEN` of at least 32 characters:

```powershell
Copy-Item server/.env.example server/.env
```

Run `server/schema.sql` in the Neon SQL Editor to create the required tables, then build the frontend and start the API:

```powershell
Set-Location server
npm start
```

Open [http://localhost:3001](http://localhost:3001). The API checks database connectivity on startup; `/health` reports database readiness. Email/password login works without Twilio. Phone-code login requires the optional Twilio Verify credentials described below.

For frontend development with Vite, install the dependencies above, start the API with `npm run start:api` from the project root, and in a second terminal run `npm run dev` from the project root. Vite serves the frontend at [http://localhost:5173](http://localhost:5173) and proxies API requests to port 3001.

### ThingsBoard Configuration

Telemetry integration is optional. The dashboard currently reads the ThingsBoard device and telemetry mapping configured in `src/lib/parking-context.tsx`. It reads `occupied`, `occupied2`, and `occupied3` for slots `A01`, `A02`, and `A03`; `A04` remains available for reservations until another sensor is mapped.

Copy `.env.example` to `.env.local` and set the ThingsBoard API key for the device receiving the bridge telemetry. The app defaults to the ThingsBoard device ID previously configured in the source; set `VITE_THINGSBOARD_DEVICE_ID` to override it when your telemetry is sent to another device. Vite reads these values when the app is built, so restart the dev server or rebuild/redeploy after changing them. For a live deployment, configure the variables in the hosting provider's build environment; your ignored local `.env` file is not uploaded with the static site. The browser polls every two seconds; failed requests and missing/invalid sensor values do not reset a slot to available.

The dashboard currently calls ThingsBoard directly from the browser. Any `VITE_` value is included in the public JavaScript bundle, and the ThingsBoard host must allow the deployed site through CORS. Use only a least-privilege telemetry-read key for a demo. For a real deployment, put the telemetry read behind a server-side proxy and keep its credential on that server. Never commit `.env` files, API keys, device tokens, or other credentials. Rotate any credentials that were previously committed or included in a deployed bundle.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and create a production build |
| `npm run preview` | Preview the production build locally |

## Sensor Bridge

The bridge reads newline-terminated JSON objects from the sensor's serial port, posts them to ThingsBoard, and sends occupancy changes to the reservation backend. Install its dependencies and configure it in PowerShell, or set `SERIAL_PORT`, `THINGSBOARD_DEVICE_TOKEN`, and `SENSOR_EVENT_TOKEN` in the ignored root `.env` file:

```powershell
python -m pip install -r requirements.txt
$env:SERIAL_PORT = "COM5"
$env:THINGSBOARD_DEVICE_TOKEN = "your_device_token"
$env:SENSOR_EVENT_TOKEN = "same_random_secret_as_server_env"
python bridge.py
```

Set `SERIAL_PORT` to the actual sensor port, `THINGSBOARD_DEVICE_TOKEN` to that device's token, and `SENSOR_EVENT_TOKEN` to the same random secret configured in `server/.env`. `SENSOR_EVENT_API_URL` defaults to `http://localhost:3001/api/sensor-events`; for a remote backend, set it to the deployed endpoint. `BAUD_RATE` defaults to `9600`; `THINGSBOARD_HOST` defaults to `https://thingsboard.cloud`. Optional `SERIAL_TIMEOUT`, `HTTP_TIMEOUT`, and `RECONNECT_DELAY` values control serial polling, request timeout, and reconnect delay. The sensor must send JSON with the telemetry keys configured above, for example `{"occupied":true}`. The bridge retries temporary network failures and reconnects after serial errors. Do not put a device token or sensor event secret in source code or commit it.

On an occupied-to-clear sensor transition, the backend marks the active reservation completed and immediately releases the slot for every user. The backend stores the last sensor reading, so the transition survives browser reloads; the reservation is completed only when its scheduled arrival has started.

The bridge must run on a machine physically connected to the sensor. The deployed dashboard separately needs the ThingsBoard device ID and a read-only telemetry key (or, preferably, a server-side proxy); deploying the static website alone cannot access a local USB/serial sensor.

## Shared Reservations (Neon PostgreSQL)

Reservations are stored in Neon through the Node API, not only in the current browser. Create the table by running `server/schema.sql` in the Neon SQL Editor. The standalone backend lives in `server/`, with its own `package.json` and `.env.example`. Copy `server/.env.example` to `server/.env` and replace the sample `DATABASE_URL` with your Neon connection string. Never put `DATABASE_URL` in a `VITE_` variable or commit it.

### User Login

The app is gated behind sign-in. Users can self-register with an email and password (minimum 10 characters), or sign in/create an account with an SMS code sent to their Indian mobile number. Enter the 10-digit mobile number; the app adds the `+91` country code automatically. Reservations remain shared across signed-in users. Email passwords are stored as salted scrypt hashes; login sessions use an HttpOnly cookie and are persisted in Neon.

To enable phone sign-in, create a Twilio Verify service and set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID` in `server/.env` from the Twilio console. Keep these server-only credentials private. Email/password login works without Twilio, but mobile OTP returns a configuration error until those values are set. Run the updated `server/schema.sql` in the Neon SQL Editor once to create the user/session tables before starting the backend.

The Admin tab requires a second password check. Add the email address of an already registered email/password account to `ADMIN_EMAILS` in `server/.env` (comma-separated for multiple admins), then restart the backend. The admin email must also be used for the regular sign-in account; phone-only accounts cannot pass the admin password check. Admin verification expires after 15 minutes and is requested again when leaving and reopening the Admin tab.

For a single local command that builds the frontend and runs the full application, use the setup above and run `npm start` from `server/`. The backend checks the Neon connection and database schema before starting, serves the production frontend build at `http://localhost:3001`, and provides the reservation API on the same origin. Check `http://localhost:3001/health` for database readiness.

Vite proxies `/api` to port 3001 when `VITE_RESERVATION_API_URL` is blank. If the frontend is hosted separately from the API, set `VITE_RESERVATION_API_URL` to the public API base URL in the frontend build environment and set `CORS_ORIGINS` to the exact website origin(s) in `server/.env`. In production, set `CORS_ORIGINS` even when the backend serves the frontend itself. `RESERVATION_GRACE_MINUTES` defaults to 10 and controls how long a missed arrival remains held after its expected exit. The API polls reservations every two seconds, and a database exclusion constraint prevents overlapping reservations for the same slot.

The database URL must use the actual Neon hostname ending in `.neon.tech`; the sample `user:password@your-neon-host` is intentionally not a working database. Keep `server/.env` ignored. The API reports a clear startup error if the database cannot connect or `server/schema.sql` has not been applied.

The arrival field is interpreted as India Standard Time (IST, UTC+05:30), regardless of the browser's timezone. A slot shows RESERVED after the API accepts its reservation; mapped live sensor telemetry takes display priority and shows OCCUPIED when a car is detected. When a car leaves an active reservation, the serial bridge reports the clear transition to the backend and the completed reservation is removed from shared availability. Only slots with configured sensor telemetry keys can show sensor-based occupancy.

## Production Build

```bash
npm run build
```

This creates a production-ready build in the `dist` folder.

## Contributing

Create a branch for your change, run the production build, and open a pull request:

```bash
git checkout -b feature/your-change
npm run build
git add .
git commit -m "Describe your change"
git push -u origin feature/your-change
```

## License

This project is for educational and demonstration purposes.
