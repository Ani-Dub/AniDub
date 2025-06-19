# AniDub Chrome Extension

AniDub is a Chrome extension that enhances the AniList anime website by displaying the dub status of anime titles directly on anime detail and list pages. It integrates with a custom API to fetch up-to-date dub information for each anime.

## Features

- **Anime Detail Page:**
  - Shows the dub status (Not available, Finished, or next dubbed episode countdown) in the sidebar for each anime.
  - Uses cached data when available for fast display.
  - Fetches fresh data from the API if not cached.
- **Anime List Page:**
  - Adds a "Dub Status" column to your anime list (e.g., Planning list).
  - Displays dub status for each anime in the list using a single API call for efficiency.
  - Updates dynamically as the list changes.
- **Robust Error Handling:**
  - Handles missing or invalid tokens with user notifications.
  - Handles API/server errors gracefully and logs warnings.
  - Prevents duplicate or stale dub status entries when navigating between pages.

## Setup & Development

1. **Clone the repository:**
   ```sh
   git clone <your-repo-url>
   cd AniDub
   ```
2. **Install dependencies:**
   ```sh
   npm install
   ```
3. **Add environment variables:**
   - Create `.env` file from `.env.sample`
   - Replace placeholders with desired values
4. **Build the extension:**
   ```sh
   npm run build
   ```
5. **Load the extension in Chrome:**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `src/public` directory

## API Requirements

- The extension expects a backend API with the following endpoints:
  - `GET /dubs/list` — Returns a list of dub statuses for all anime.
  - `GET /dubs/:id` — Returns the dub status for a specific anime by AniList ID.
- The API must accept an `Authorization` header with the user's AniList token.
- All error responses should be in the format: `{ "error": "error info here" }`

## File Structure

- `src/main.ts` — Main extension logic (content script)
- `src/public/` — Static assets (CSS, popup, icons)
- `manifest.json` — Chrome extension manifest

## Development Notes

- The extension uses polling and mutation observers to handle dynamic page changes on AniList.
- Dub status is inserted only after the relevant DOM elements are available to avoid layout issues.

## License

MIT License
