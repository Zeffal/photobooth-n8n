import express from 'express';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// n8n webhook URLs
const N8N_INDIVIDUAL_WEBHOOK_URL = process.env.N8N_INDIVIDUAL_WEBHOOK_URL!;
const N8N_GROUP_WEBHOOK_URL = process.env.N8N_GROUP_WEBHOOK_URL!;

// Baserow configuration
const BASEROW_TOKEN = process.env.BASEROW_TOKEN!;
const INDIVIDUAL_IMAGES_API = process.env.INDIVIDUAL_IMAGES_API!;
const GROUP_IMAGES_API = process.env.GROUP_IMAGES_API!;
const ACTIVITY_API = process.env.ACTIVITY_API!;

// Store current activity status
let currentActivity: string = 'Finish';

// Configure multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// Helper function to update activity status in Baserow
async function updateActivity(activity: string) {
  try {
    console.log(`Attempting to update activity to: ${activity}`);
    console.log(`Using API URL: ${ACTIVITY_API}?user_field_names=true`);
    
    const response = await axios.patch(`${ACTIVITY_API}?user_field_names=true`, {
      Activity: activity
    }, {
      headers: {
        'Authorization': `Token ${BASEROW_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log(`Activity successfully updated to: ${activity}`);
    console.log('Response data:', response.data);
    currentActivity = activity;
    return response.data;
  } catch (error: any) {
    console.error('Error updating activity:', error.message);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);
    throw error;
  }
}

// Function to fetch activity status
async function fetchActivityStatus() {
  try {
    const response = await axios.get(`${ACTIVITY_API}?user_field_names=true`, {
      headers: {
        'Authorization': `Token ${BASEROW_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response.data && response.data.Activity) {
      const newActivity = response.data.Activity;
      if (newActivity !== currentActivity) {
        console.log(`Activity changed: ${currentActivity} -> ${newActivity}`);
        currentActivity = newActivity;
      }
    }
  } catch (error: any) {
    console.error('Error fetching activity status:', error.message);
  }
}

// Function to create individual image record in Baserow
async function createIndividualImageRecord(personImageUrl: string, outfitImageUrl: string) {
  try {
    const response = await axios.post(`${INDIVIDUAL_IMAGES_API}?user_field_names=true`, {
      'Initial Images': [
        { url: personImageUrl, name: 'person.jpg' },
        { url: outfitImageUrl, name: 'outfit.jpg' }
      ],
      'Status': 'Processing'
    }, {
      headers: {
        'Authorization': `Token ${BASEROW_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error: any) {
    console.error('Error creating individual image record:', error.message);
    throw error;
  }
}

// Function to get individual images from Baserow
async function getIndividualImages() {
  try {
    const response = await axios.get(`${INDIVIDUAL_IMAGES_API}?user_field_names=true`, {
      headers: {
        'Authorization': `Token ${BASEROW_TOKEN}`
      }
    });
    
    return response.data.results || [];
  } catch (error: any) {
    console.error('Error fetching individual images:', error.message);
    throw error;
  }
}

// Function to get specific individual image by ID
async function getIndividualImageById(rowId: number) {
  try {
    const response = await axios.get(`${INDIVIDUAL_IMAGES_API}${rowId}/?user_field_names=true`, {
      headers: {
        'Authorization': `Token ${BASEROW_TOKEN}`
      }
    });
    
    return response.data;
  } catch (error: any) {
    console.error('Error fetching individual image by ID:', error.message);
    throw error;
  }
}

// Function to create group image record in Baserow
async function createGroupImageRecord(selectedImageIds: number[]) {
  try {
    const response = await axios.post(`${GROUP_IMAGES_API}?user_field_names=true`, {
      'Selected Images': selectedImageIds,
      'Status': 'Processing'
    }, {
      headers: {
        'Authorization': `Token ${BASEROW_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error: any) {
    console.error('Error creating group image record:', error.message);
    throw error;
  }
}

// Start polling activity status every 2 seconds
setInterval(fetchActivityStatus, 2000);
fetchActivityStatus(); // Initial fetch

// Routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get activity status endpoint
app.get('/get_activity', (req, res) => {
  res.json({ Activity: currentActivity });
});

// Update activity status endpoint
app.post('/update_activity', async (req, res) => {
  const { activity } = req.body;
  
  if (!activity) {
    return res.status(400).json({ error: 'Activity is required' });
  }
  
  // Only allow Starting and Processing from frontend
  if (activity !== 'Starting' && activity !== 'Processing') {
    return res.status(400).json({ error: 'Only Starting and Processing activities allowed from frontend' });
  }
  
  try {
    await updateActivity(activity);
    res.json({ success: true, activity: currentActivity });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

// Upload individual images (person + outfit) endpoint
app.post('/upload-individual', upload.fields([
  { name: 'personImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const { outfitUrl } = req.body;
    
    if (!files.personImage || !outfitUrl) {
      return res.status(400).json({ error: 'Both person image and outfit URL are required' });
    }

    const personImage = files.personImage[0];

    console.log('Received individual request:', {
      person: { name: personImage.originalname, size: personImage.size },
      outfitUrl: outfitUrl
    });

    // Update activity to Processing before sending to n8n
    console.log('Setting activity to Processing for individual images...');
    await updateActivity('Processing');

    // Download outfit image from URL
    const outfitResponse = await axios.get(outfitUrl, { 
      responseType: 'arraybuffer',
      baseURL: `http://localhost:${PORT}`
    });
    const outfitBuffer = Buffer.from(outfitResponse.data);
    
    // Create FormData for n8n webhook
    const formData = new FormData();
    formData.append('personImage', personImage.buffer, {
      filename: personImage.originalname || 'person.jpg',
      contentType: personImage.mimetype || 'image/jpeg'
    });
    formData.append('outfitImage', outfitBuffer, {
      filename: 'outfit.jpg',
      contentType: 'image/jpeg'
    });

    // Send to n8n individual workflow
    console.log('Sending to n8n individual webhook:', N8N_INDIVIDUAL_WEBHOOK_URL);
    
    const response = await axios.post(N8N_INDIVIDUAL_WEBHOOK_URL, formData, {
      headers: {
        ...formData.getHeaders()
      },
      timeout: 60000 // 60 second timeout for AI processing
    });

    console.log('n8n individual response:', response.status, response.statusText);

    res.json({
      success: true,
      message: 'Individual images uploaded successfully to n8n workflow',
      n8nResponse: {
        status: response.status,
        data: response.data
      }
    });

  } catch (error: any) {
    console.error('Error uploading individual images to n8n:', error);
    
    // Reset activity status to Finish if upload fails
    try {
      await updateActivity('Finish');
    } catch (updateError) {
      console.error('Failed to reset activity status:', updateError);
    }
    
    if (axios.isAxiosError(error)) {
      res.status(500).json({
        error: 'Failed to send images to n8n workflow',
        details: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
});

// Get available outfit assets
app.get('/get-outfit-assets', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const assetsDir = path.join(__dirname, '../public/assets');
    const files = fs.readdirSync(assetsDir);
    
    // Filter for image files
    const imageFiles = files.filter((file: string) => 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
    );
    
    const outfits = imageFiles.map((file: string) => ({
      filename: file,
      url: `/assets/${file}`,
      name: file.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '').replace(/[-_]/g, ' ')
    }));
    
    res.json({
      success: true,
      outfits: outfits
    });
  } catch (error: any) {
    console.error('Error fetching outfit assets:', error);
    res.status(500).json({ error: 'Failed to fetch outfit assets' });
  }
});

// Get individual images endpoint
app.get('/get-individual-images', async (req, res) => {
  try {
    const images = await getIndividualImages();
    
    // Filter only completed individual images with generated results
    const completedImages = images.filter((img: any) => 
      img.Status === 'Completed' && img['Generated Individual Image'] && img['Generated Individual Image'].length > 0
    );
    
    res.json({
      success: true,
      images: completedImages.map((img: any) => ({
        id: img.id,
        generatedImage: img['Generated Individual Image'][0],
        status: img.Status,
        createdAt: img.created_on
      }))
    });
  } catch (error: any) {
    console.error('Error fetching individual images:', error);
    res.status(500).json({ error: 'Failed to fetch individual images' });
  }
});

// Upload group images endpoint
app.post('/upload-group', async (req, res) => {
  try {
    const { selectedImageIds } = req.body;
    
    if (!selectedImageIds || !Array.isArray(selectedImageIds) || selectedImageIds.length === 0) {
      return res.status(400).json({ error: 'Selected image IDs are required' });
    }

    console.log('Creating group image with selected IDs:', selectedImageIds);

    // Update activity to Processing before sending to n8n
    console.log('Setting activity to Processing for group images...');
    await updateActivity('Processing');

    // Get the selected individual images from Baserow
    const allImages = await getIndividualImages();
    const selectedImages = allImages.filter((img: any) => selectedImageIds.includes(img.id));
    
    if (selectedImages.length !== selectedImageIds.length) {
      throw new Error('Some selected images not found');
    }

    // Create FormData for n8n webhook with selected generated images
    const formData = new FormData();
    
    for (let i = 0; i < selectedImages.length; i++) {
      const image = selectedImages[i];
      const generatedImageUrl = image['Generated Individual Image'][0].url;
      
      // Download the generated image and add to form data
      const imageResponse = await axios.get(generatedImageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(imageResponse.data);
      
      formData.append(`image${i + 1}`, imageBuffer, {
        filename: `generated_${image.id}.jpg`,
        contentType: 'image/jpeg'
      });
    }

    // Send to n8n group workflow
    console.log('Sending to n8n group webhook:', N8N_GROUP_WEBHOOK_URL);
    
    const response = await axios.post(N8N_GROUP_WEBHOOK_URL, formData, {
      headers: {
        ...formData.getHeaders()
      },
      timeout: 60000 // 60 second timeout for AI processing
    });

    console.log('n8n group response:', response.status, response.statusText);

    res.json({
      success: true,
      message: 'Group images uploaded successfully to n8n workflow',
      n8nResponse: {
        status: response.status,
        data: response.data
      }
    });

  } catch (error: any) {
    console.error('Error uploading group images to n8n:', error);
    
    // Reset activity status to Finish if upload fails
    try {
      await updateActivity('Finish');
    } catch (updateError) {
      console.error('Failed to reset activity status:', updateError);
    }
    
    if (axios.isAxiosError(error)) {
      res.status(500).json({
        error: 'Failed to send group images to n8n workflow',
        details: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
});

// Get latest generated image (individual or group) endpoint
app.get('/get-latest-result', async (req, res) => {
  try {
    console.log('Fetching latest results from Baserow...');
    
    // Check both individual and group tables for latest results
    const [individualImages, groupImages] = await Promise.all([
      getIndividualImages(),
      axios.get(`${GROUP_IMAGES_API}?user_field_names=true`, {
        headers: { 'Authorization': `Token ${BASEROW_TOKEN}` }
      }).then(response => response.data.results || [])
    ]);
    
    console.log(`Found ${individualImages.length} individual images, ${groupImages.length} group images`);
    
    // Find latest completed results (most recent first)
    const completedIndividual = individualImages
      .filter((img: any) => {
        const hasStatus = img.Status === 'Completed';
        const hasImage = img['Generated Individual Image']?.length > 0;
        console.log(`Individual ${img.id}: Status=${img.Status}, HasImage=${hasImage}, Created=${img.created_on}`);
        return hasStatus && hasImage;
      })
      .sort((a: any, b: any) => new Date(b.created_on).getTime() - new Date(a.created_on).getTime());
    
    const completedGroup = groupImages
      .filter((img: any) => {
        const hasStatus = img.Status === 'Completed';
        const hasImage = img['Generated Group Image']?.length > 0;
        console.log(`Group ${img.id}: Status=${img.Status}, HasImage=${hasImage}, Created=${img.created_on}`);
        return hasStatus && hasImage;
      })
      .sort((a: any, b: any) => new Date(b.created_on).getTime() - new Date(a.created_on).getTime());
    
    console.log(`Completed individual: ${completedIndividual.length}, Completed group: ${completedGroup.length}`);
    
    // Get the most recent result regardless of time (remove 5-minute restriction)
    let latestResult = null;
    let resultType = null;
    
    const latestIndividual = completedIndividual[0];
    const latestGroup = completedGroup[0];
    
    if (latestIndividual && latestGroup) {
      const individualTime = new Date(latestIndividual.created_on);
      const groupTime = new Date(latestGroup.created_on);
      
      if (groupTime > individualTime) {
        latestResult = latestGroup;
        resultType = 'group';
      } else {
        latestResult = latestIndividual;
        resultType = 'individual';
      }
    } else if (latestIndividual) {
      latestResult = latestIndividual;
      resultType = 'individual';
    } else if (latestGroup) {
      latestResult = latestGroup;
      resultType = 'group';
    }
    
    if (!latestResult) {
      console.log('No completed results found');
      return res.status(404).json({ 
        success: false,
        error: 'No completed results found',
        debug: {
          individualCount: individualImages.length,
          groupCount: groupImages.length,
          completedIndividualCount: completedIndividual.length,
          completedGroupCount: completedGroup.length
        }
      });
    }
    
    const imageField = resultType === 'individual' ? 'Generated Individual Image' : 'Generated Group Image';
    const imageUrl = latestResult[imageField][0].url;
    
    console.log(`Found latest result: ${resultType} image with URL: ${imageUrl}`);
    
    res.json({
      success: true,
      type: resultType,
      imageUrl: imageUrl,
      status: latestResult.Status,
      createdAt: latestResult.created_on,
      id: latestResult.id
    });
    
  } catch (error: any) {
    console.error('Error fetching latest result:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch latest result',
      details: error.message 
    });
  }
});

// Get latest individual image by highest ID (most recent)
app.get('/get-latest-individual', async (req, res) => {
  try {
    console.log('Fetching latest individual image by highest ID...');
    const images = await getIndividualImages();
    
    // Filter completed images and sort by ID (highest first)
    const completedImages = images
      .filter((img: any) => img.Status === 'Completed' && img['Generated Individual Image']?.length > 0)
      .sort((a: any, b: any) => b.id - a.id); // Sort by ID descending (newest first)
    
    console.log('Latest completed images by ID:', completedImages.slice(0, 3).map((img: any) => ({
      id: img.id,
      status: img.Status,
      created_on: img.created_on
    })));
    
    if (completedImages.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'No completed individual images found' 
      });
    }
    
    const latestImage = completedImages[0];
    const imageUrl = latestImage['Generated Individual Image'][0].url;
    
    console.log(`Latest individual image: ID ${latestImage.id}, URL: ${imageUrl}`);
    
    res.json({
      success: true,
      image: {
        id: latestImage.id,
        imageUrl: imageUrl,
        createdAt: latestImage.created_on,
        status: latestImage.Status
      }
    });
    
  } catch (error: any) {
    console.error('Error fetching latest individual image:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch latest individual image' 
    });
  }
});

// Get latest group image by highest ID (most recent)
app.get('/get-latest-group', async (req, res) => {
  try {
    console.log('Fetching latest group image by highest ID...');
    const response = await axios.get(`${GROUP_IMAGES_API}?user_field_names=true`, {
      headers: { 'Authorization': `Token ${BASEROW_TOKEN}` }
    });
    const images = response.data.results || [];
    
    // Filter completed images and sort by ID (highest first)
    const completedImages = images
      .filter((img: any) => img.Status === 'Completed' && img['Generated Group Image']?.length > 0)
      .sort((a: any, b: any) => b.id - a.id); // Sort by ID descending (newest first)
    
    console.log('Latest completed group images by ID:', completedImages.slice(0, 3).map((img: any) => ({
      id: img.id,
      status: img.Status,
      created_on: img.created_on
    })));
    
    if (completedImages.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'No completed group images found' 
      });
    }
    
    const latestImage = completedImages[0];
    const imageUrl = latestImage['Generated Group Image'][0].url;
    
    console.log(`Latest group image: ID ${latestImage.id}, URL: ${imageUrl}`);
    
    res.json({
      success: true,
      image: {
        id: latestImage.id,
        imageUrl: imageUrl,
        createdAt: latestImage.created_on,
        status: latestImage.Status
      }
    });
    
  } catch (error: any) {
    console.error('Error fetching latest group image:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch latest group image' 
    });
  }
});

// Get individual images gallery endpoint
app.get('/gallery/individual', async (req, res) => {
  try {
    const images = await getIndividualImages();
    
    // Filter completed individual images and format for gallery
    const completedImages = images.filter((img: any) => img.Status === 'Completed' && img['Generated Individual Image']?.length > 0);
    
    console.log('All completed images before sorting:', completedImages.map((img: any) => ({
      id: img.id,
      created_on: img.created_on,
      status: img.Status
    })));
    
    const galleryImages = completedImages
      .sort((a: any, b: any) => {
        const timeA = new Date(a.created_on).getTime();
        const timeB = new Date(b.created_on).getTime();
        console.log(`Comparing: ID ${a.id} (${a.created_on}) vs ID ${b.id} (${b.created_on})`);
        return timeB - timeA; // Newest first
      })
      .map((img: any) => ({
        id: img.id,
        generatedImage: img['Generated Individual Image'][0],
        initialImages: img['Initial Images'] || [],
        status: img.Status,
        createdAt: img.created_on,
        updatedAt: img.updated_on
      }));
    
    console.log('Gallery images after sorting (first 3):', galleryImages.slice(0, 3).map((img: any) => ({
      id: img.id,
      createdAt: img.createdAt
    })));
    
    res.json({
      success: true,
      images: galleryImages,
      total: galleryImages.length
    });
  } catch (error: any) {
    console.error('Error fetching individual gallery:', error);
    res.status(500).json({ error: 'Failed to fetch individual gallery' });
  }
});

// Get group images gallery endpoint
app.get('/gallery/group', async (req, res) => {
  try {
    const response = await axios.get(`${GROUP_IMAGES_API}?user_field_names=true`, {
      headers: { 'Authorization': `Token ${BASEROW_TOKEN}` }
    });
    
    const images = response.data.results || [];
    
    // Filter completed group images and format for gallery
    const completedImages = images.filter((img: any) => img.Status === 'Completed' && img['Generated Group Image']?.length > 0);
    
    console.log('All completed group images before sorting:', completedImages.map((img: any) => ({
      id: img.id,
      created_on: img.created_on,
      status: img.Status
    })));
    
    const galleryImages = completedImages
      .sort((a: any, b: any) => {
        const timeA = new Date(a.created_on).getTime();
        const timeB = new Date(b.created_on).getTime();
        console.log(`Comparing group: ID ${a.id} (${a.created_on}) vs ID ${b.id} (${b.created_on})`);
        return timeB - timeA; // Newest first
      })
      .map((img: any) => ({
        id: img.id,
        generatedGroupImage: img['Generated Group Image'][0],
        selectedImages: img['Selected Images'] || [],
        status: img.Status,
        createdAt: img.created_on,
        updatedAt: img.updated_on
      }));
    
    console.log('Group gallery images after sorting (first 3):', galleryImages.slice(0, 3).map((img: any) => ({
      id: img.id,
      createdAt: img.createdAt
    })));
    
    res.json({
      success: true,
      images: galleryImages,
      total: galleryImages.length
    });
  } catch (error: any) {
    console.error('Error fetching group gallery:', error);
    res.status(500).json({ error: 'Failed to fetch group gallery' });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Photobooth Server running on http://localhost:${PORT}`);
  console.log(`📸 Individual webhook: ${N8N_INDIVIDUAL_WEBHOOK_URL}`);
  console.log(`👥 Group webhook: ${N8N_GROUP_WEBHOOK_URL}`);
  console.log(`📊 Baserow Individual API: ${INDIVIDUAL_IMAGES_API}`);
  console.log(`📊 Baserow Group API: ${GROUP_IMAGES_API}`);
  console.log(`⚡ Activity status polling: ${ACTIVITY_API}`);
  console.log(`🔄 Activity status will be polled every 2 seconds`);
});
