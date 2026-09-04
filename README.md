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
├── bridge.py
├── index.html
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── vite.config.ts
├── README.md
└── .gitignore
```

## Requirements

- Node.js 18 or newer
- npm 9 or newer

## Getting Started

Clone the repository and install its dependencies:

```bash
git clone https://github.com/darshanshirahatti/Smart_Parking.git
cd Smart_Parking
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL shown in the terminal to view the app.

### ThingsBoard Configuration

Telemetry integration is optional. To enable it, copy the example environment file and add a ThingsBoard API key:

```bash
copy .env.example .env
```

Then set `VITE_THINGSBOARD_API_KEY` in `.env` and restart the development server. The current sensor mapping reads `occupied`, `occupied2`, and `occupied3` for slots `A01`, `A02`, and `A03`; `A04` remains available for reservations until another sensor is mapped.

Never commit `.env` or any other file containing a real API key. Vite embeds `VITE_*` values in the browser bundle, so use a restricted, demo-only key for this frontend integration.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and create a production build |
| `npm run preview` | Preview the production build locally |

## Optional Local Bridge

This project also includes a Python bridge file for local service simulation. Run it in a separate terminal if your local workflow requires it:

```bash
python bridge.py
```

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
