# AI Photobooth - Individual & Group Photo Generator

A modern web application that creates AI-generated photos using n8n workflows and Baserow database. Users can create individual photos by combining person and outfit images, or group photos by selecting multiple individual AI-generated images.

## Features

- 🎨 **Dual Mode Operation**: Individual and Group photo creation
- 👤 **Individual Photos**: Upload person + outfit images for AI combination
- 👥 **Group Photos**: Select multiple individual AI images to create group compositions
- 🔒 **Single User Restriction**: Activity status management prevents concurrent usage
- 📊 **Baserow Integration**: Stores images and tracks processing status
- 🔄 **n8n Workflow Integration**: Separate webhooks for individual and group processing
- 💻 **Modern UI**: Responsive design with real-time status updates
- ⚡ **TypeScript Backend**: Robust server with proper error handling

## Architecture

### Database Structure (Baserow)
- **Individual Images Table** (698): Stores initial images and generated individual results
- **Group Images Table** (700): Stores selected images and generated group results  
- **Activity Table** (699): Manages single-user access control

### n8n Webhooks
- **Individual Webhook**: `https://dev-n8n.fxwebapps.com/webhook/a405b599-cb5e-459c-abf2-0e7367d2007a`
- **Group Webhook**: `https://dev-n8n.fxwebapps.com/webhook/20dbdb7c-15e4-42e5-80c0-7c44985d5090`

## Quick Start

1. **Clone and setup**:
   ```bash
   cd c:\Users\Acer\William\Project\photobooth-n8n
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your Baserow token and configuration
   ```

3. **Start the application**:
   ```bash
   npm start
   ```

4. **Open your browser** and navigate to `http://localhost:3000`

## Environment Configuration

Create a `.env` file based on `.env.example`:

```env
# Server Configuration
PORT=3000

# n8n Webhook URLs
N8N_INDIVIDUAL_WEBHOOK_URL=https://dev-n8n.fxwebapps.com/webhook/a405b599-cb5e-459c-abf2-0e7367d2007a
N8N_GROUP_WEBHOOK_URL=https://dev-n8n.fxwebapps.com/webhook/20dbdb7c-15e4-42e5-80c0-7c44985d5090

# Baserow Configuration
BASEROW_TOKEN=your_baserow_token_here
BASEROW_BASE_URL=https://dev-n8n-baserow.fxwebapps.com/api/database/rows/table

# Table IDs and API endpoints
INDIVIDUAL_IMAGES_TABLE_ID=698
INDIVIDUAL_IMAGES_API=https://dev-n8n-baserow.fxwebapps.com/api/database/rows/table/698/

GROUP_IMAGES_TABLE_ID=700
GROUP_IMAGES_API=https://dev-n8n-baserow.fxwebapps.com/api/database/rows/table/700/

ACTIVITY_TABLE_ID=699
ACTIVITY_ROW_ID=1
ACTIVITY_API=https://dev-n8n-baserow.fxwebapps.com/api/database/rows/table/699/1/
```

## Usage Workflow

### Individual Photo Creation
1. Select "Individual Photo" mode
2. Upload a person photo and outfit photo
3. Click "Generate Individual Photo"
4. Wait for AI processing (1-3 minutes)
5. View and download the generated result

### Group Photo Creation
1. Select "Group Photo" mode
2. Choose from available individual AI-generated images
3. Select multiple images (minimum 2)
4. Click "Generate Group Photo"
5. Wait for AI processing (1-3 minutes)
6. View and download the generated group result

## API Endpoints

### Activity Management
- `GET /get_activity` - Get current activity status
- `POST /update_activity` - Update activity status (Starting/Processing only)

### Individual Photos
- `POST /upload-individual` - Upload person and outfit images
- `GET /get-individual-images` - Get completed individual images

### Group Photos
- `POST /upload-group` - Process selected individual images into group photo

### Results
- `GET /get-latest-result` - Get the most recent generated image (individual or group)

## Development

- **Development mode**: `npm run dev` (uses nodemon for hot reloading)
- **Build only**: `npm run build`
- **Production**: `npm run prod`

## Technical Details

- **Backend**: Express.js with TypeScript
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **File Upload**: Multer for handling multipart/form-data
- **HTTP Client**: Axios for n8n webhook requests and Baserow API
- **Database**: Baserow (cloud-based Airtable alternative)
- **Workflow Engine**: n8n for AI image processing

## Activity Status Flow

1. **Finish** - System available for new requests
2. **Starting** - User initiated a request
3. **Processing** - n8n workflow is processing images
4. **Finish** - Processing complete, results available

The system enforces single-user access by checking activity status. When one user is processing, others see a "busy" screen until processing completes.

## File Structure

```
photobooth-n8n/
├── src/
│   └── server.ts          # TypeScript server
├── public/
│   ├── index.html         # Main HTML interface
│   ├── script.js          # Frontend JavaScript
│   └── styles.css         # CSS styling
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── .env.example           # Environment template
└── README.md              # This file
```

## Browser Compatibility

Requires a modern browser with:
- File API support
- Fetch API support
- ES6+ JavaScript support
- CSS Grid and Flexbox support

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Security Features

- File size limit: 10MB per image
- Memory-based file storage (no files saved to disk)
- CORS enabled for cross-origin requests
- Activity status validation
- Proper error handling and user feedback
