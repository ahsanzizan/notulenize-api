## Overview

**Base URL**: `http://localhost:3000/api/v1`

**Content-Type**: `application/json` (unless specified otherwise)

## Authentication

> **Note**: This API currently doesn't include authentication. In production, you should implement JWT or similar authentication mechanisms.

## Error Responses

All endpoints return standardized error responses:

```json
{
  "statusCode": 400,
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/api/v1/upload/init",
  "message": "Validation failed: filename is required"
}
```

### Common HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation errors)
- `404` - Resource Not Found
- `409` - Conflict (duplicate resource)
- `422` - Unprocessable Entity
- `500` - Internal Server Error

---

## Upload Management

### 1. Initialize Upload Session

Start a new resumable upload session.

**Endpoint**: `POST /upload/init`

**Request Body**:

```json
{
  "filename": "meeting-recording.mp4",
  "fileType": "video/mp4",
  "totalParts": 10,
  "userId": "user_123456789"
}
```

**Request Validation**:

- `filename`: Required string
- `fileType`: Must be one of: `audio/mpeg`, `audio/wav`, `audio/mp3`, `video/mp4`, `video/avi`, `video/mov`
- `totalParts`: Number between 1-1000
- `userId`: Valid UUID format

**Success Response** (200):

```json
{
  "uploadId": "clr1234567890abcdef",
  "status": "initialized"
}
```

**Error Responses**:

- `400` - Invalid file type or validation errors
- `500` - Database connection issues

---

### 2. Upload File Part

Upload a chunk of the file to temporary storage.

**Endpoint**: `PUT /upload/{uploadId}/part`

**URL Parameters**:

- `uploadId` - UUID of the upload session

**Request**: `multipart/form-data`

- `chunk` - File chunk (max 50MB)
- `partIndex` - Number (0-based index of the part)

**cURL Example**:

```bash
curl -X PUT \
  "http://localhost:3000/api/v1/upload/clr1234567890abcdef/part" \
  -F "chunk=@chunk-0.bin" \
  -F "partIndex=0"
```

**Success Response** (200):

```json
{
  "partIndex": 0,
  "status": "uploaded",
  "size": 1048576
}
```

**Error Responses**:

- `400` - Invalid part index or missing chunk
- `404` - Upload session not found
- `422` - Upload session not in progress
- `413` - File chunk too large (>50MB)

---

### 3. Complete Upload

Assemble all parts and trigger background processing.

**Endpoint**: `POST /upload/{uploadId}/complete`

**URL Parameters**:

- `uploadId` - UUID of the upload session

**Request Body**: None

**Success Response** (200):

```json
{
  "uploadId": "clr1234567890abcdef",
  "status": "completed",
  "message": "File uploaded successfully. Processing started."
}
```

**Error Responses**:

- `400` - Missing file parts or assembly failure
- `404` - Upload session not found
- `422` - Upload session not in progress

---
