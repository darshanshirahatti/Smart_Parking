# SmartPark

SmartPark is a smart city parking management dashboard built with React, TypeScript, Vite, and Tailwind CSS. It provides a parking overview, live availability monitoring, booking flow, and admin controls in a single responsive interface.

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

## Getting Started

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open the local URL shown in the terminal to view the app.

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

## GitHub Push

> Warning: before running `git add .`, make sure `.gitignore` is saved and includes folders like `node_modules` and `dist`. If Git still warns about files being untracked or ignored, check that the files are not already being tracked and run the commands again.

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## License

This project is for educational and demonstration purposes.
