# Notulenize API Documentation

A NestJS-based API for video and audio meeting transcription and summarization with flexible storage support.

## Features

- Upload video files and extract audio
- Upload audio files directly
- Generate transcripts from audio files
- Create AI-powered meeting summaries
- Retrieve meeting results and transcripts
- Flexible storage: Local filesystem or Supabase Storage

## Setup

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- FFmpeg installed on your system
- Supabase project (optional, for cloud storage)

### Installation

1. Install dependencies:

```bash
pnpm install
```

2. Set up environment variables:

```bash
# Database configuration
DATABASE_URL="postgresql://username:password@localhost:5432/notulenize_db?schema=public"

# File upload settings
UPLOAD_PATH="./uploads"
MAX_FILE_SIZE=100000000
FFMPEG_PATH="ffmpeg"

# Storage configuration
STORAGE_PROVIDER=local  # or 'supabase' for cloud storage
STORAGE_BASE_URL=http://localhost:3000

# Supabase configuration (only needed if using Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_BUCKET=notulenize-files
```

3. Set up the database:

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init
```

4. Start the application:

```bash
# Development mode
pnpm run start:dev

# Production mode
pnpm run build
pnpm run start:prod
```

## Storage Configuration

The API supports two storage providers:

### Local Storage (Default)

- Files are stored in the local filesystem
- Set `STORAGE_PROVIDER=local`
- Configure `UPLOAD_PATH` for the storage directory
- Set `STORAGE_BASE_URL` for public file URLs

### Supabase Storage

- Files are stored in a Supabase Storage bucket
- Set `STORAGE_PROVIDER=supabase`
- Configure Supabase credentials and bucket settings
- Files are organized in folders: `videos/`, `audio/`, `files/`

## API Endpoints

### Upload Module

#### POST /api/upload/video

Upload a video file and extract audio.

**Request:**

- Content-Type: `multipart/form-data`
- Body:
  - `file`: Video file (required)
  - `title`: Meeting title (optional)
  - `description`: Meeting description (optional)

**Response:**

```json
{
  "meetingId": "string",
  "fileId": "string",
  "originalName": "string",
  "videoPath": "string",
  "audioPath": "string",
  "videoUrl": "string",
  "audioUrl": "string",
  "message": "Video uploaded and audio extracted successfully"
}
```

#### POST /api/upload/audio

Upload an audio file directly.

**Request:**

- Content-Type: `multipart/form-data`
- Body:
  - `file`: Audio file (required)
  - `title`: Meeting title (optional)
  - `description`: Meeting description (optional)

**Supported Audio Formats:**

- MP3 (audio/mp3, audio/mpeg)
- WAV (audio/wav)
- M4A (audio/m4a)
- AAC (audio/aac)
- OGG (audio/ogg)
- FLAC (audio/flac)
- WebM Audio (audio/webm)

**Response:**

```json
{
  "meetingId": "string",
  "fileId": "string",
  "originalName": "string",
  "audioPath": "string",
  "audioUrl": "string",
  "message": "Audio uploaded and processed successfully"
}
```

### Transcript Module

#### POST /api/transcribe/:fileId

Generate transcript from audio file.

**Request:**

- Body:
  - `meetingId`: Meeting ID (required)
  - `language`: Language code (optional, default: "en")

**Response:**

```json
{
  "transcriptId": "string",
  "meetingId": "string",
  "content": "string",
  "language": "string",
  "duration": "number",
  "message": "Audio transcribed successfully"
}
```

### Summary Module

#### POST /api/summarize/:transcriptId

Generate AI summary from transcript.

**Request:**

- No body required

**Response:**

```json
{
  "summaryId": "string",
  "meetingId": "string",
  "transcriptId": "string",
  "content": "string",
  "keyPoints": ["string"],
  "actionItems": ["string"],
  "participants": ["string"],
  "duration": "number",
  "message": "Summary generated successfully"
}
```

### Results Module

#### GET /api/results

Get all meetings.

**Response:**

```json
{
  "meetings": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "createdAt": "string",
      "updatedAt": "string",
      "transcriptCount": "number",
      "summaryCount": "number",
      "hasTranscripts": "boolean",
      "hasSummaries": "boolean"
    }
  ],
  "message": "All meetings retrieved successfully"
}
```

#### GET /api/results/:meetingId

Get specific meeting results with transcripts and summaries.

**Response:**

```json
{
  "meeting": {
    "id": "string",
    "title": "string",
    "description": "string",
    "createdAt": "string",
    "updatedAt": "string"
  },
  "transcripts": [
    {
      "id": "string",
      "content": "string",
      "language": "string",
      "duration": "number",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ],
  "summaries": [
    {
      "id": "string",
      "content": "string",
      "keyPoints": ["string"],
      "actionItems": ["string"],
      "participants": ["string"],
      "duration": "number",
      "createdAt": "string",
      "updatedAt": "string",
      "transcript": {
        "id": "string",
        "content": "string",
        "language": "string",
        "duration": "number"
      }
    }
  ],
  "message": "Meeting results retrieved successfully"
}
```

## Usage Examples

### 1. Upload a video file:

```bash
curl -X POST http://localhost:3000/api/upload/video \
  -F "file=@meeting.mp4" \
  -F "title=Weekly Team Meeting" \
  -F "description=Discussion about project progress"
```

### 2. Upload an audio file directly:

```bash
curl -X POST http://localhost:3000/api/upload/audio \
  -F "file=@meeting.mp3" \
  -F "title=Audio Recording" \
  -F "description=Team discussion"
```

### 3. Generate transcript:

```bash
curl -X POST http://localhost:3000/api/transcribe/audio-1234567890-123456789.mp3 \
  -H "Content-Type: application/json" \
  -d '{"meetingId": "meeting-id-from-upload"}'
```

### 4. Generate summary:

```bash
curl -X POST http://localhost:3000/api/summarize/transcript-id
```

### 5. Get results:

```bash
curl http://localhost:3000/api/results/meeting-id
```

## Storage Migration

To switch from local storage to Supabase:

1. Set up your Supabase project and create a storage bucket
2. Update environment variables:
   ```bash
   STORAGE_PROVIDER=supabase
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_BUCKET=notulenize-files
   ```
3. Restart your application

The API will automatically use Supabase for all new uploads. Existing local files will remain accessible.

## Notes

- The current implementation uses mock data for transcription and summarization
- For production use, integrate with real speech-to-text and AI services
- Ensure FFmpeg is properly installed and accessible in your system PATH
- Supported video formats: MP4, AVI, MOV, WMV, FLV, WebM, MKV
- Supported audio formats: MP3, WAV, M4A, AAC, OGG, FLAC, WebM Audio
- Audio files are automatically converted to WAV format for processing
- Files are organized in folders: `videos/`, `audio/`, `files/`
