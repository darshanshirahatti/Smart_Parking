# SmartPark

SmartPark is a smart city parking management dashboard built with React, TypeScript, Vite, and Tailwind CSS. It provides a parking overview, live availability monitoring, booking flow, and admin controls in a single responsive interface.

Live repository: [github.com/darshanshirahatti/Smart_Parking](https://github.com/darshanshirahatti/Smart_Parking)

## Features

- Real-time parking dashboard with status overview
- Parking map and lot finder interface
- Booking panel for reserving available space
- Admin controls for managing lot information and capacity
- Responsive UI for desktop and tablet usage
- Modern component-driven frontend architecture

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
