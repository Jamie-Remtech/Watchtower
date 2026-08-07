# Google Maps Setup for Watchtower

The tactical map now uses Google Maps for real map visualization with satellite, roadmap, terrain, and hybrid views.

## Setup Instructions

### 1. Get a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **API Key**
5. Copy your new API key

### 2. Enable Required APIs

In the Google Cloud Console, enable these APIs:
- **Maps JavaScript API**
- **Geocoding API** (optional, for address lookup)

### 3. Add API Key to Your Project

Open the `.env` file in your project root and replace `YOUR_API_KEY_HERE`:

```
VITE_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

### 4. Restart Development Server

After updating the `.env` file, restart your development server for the changes to take effect.

## Features

The tactical map now includes:
- Real satellite imagery from Google Maps
- Multiple map modes (satellite, roadmap, terrain, hybrid)
- Interactive device markers (drones, cameras, sensors)
- Info windows with device details
- Full pan and zoom controls
- All existing Watchtower overlays and controls

## Troubleshooting

If you see a warning message about missing API key:
1. Verify the API key is correctly set in `.env`
2. Ensure the key name is exactly: `VITE_GOOGLE_MAPS_API_KEY`
3. Restart the development server
4. Check that Maps JavaScript API is enabled in Google Cloud Console

## Cost Considerations

Google Maps offers a free tier with $200 monthly credit. For typical development and low-volume usage, this should be sufficient. Monitor your usage in the Google Cloud Console.
