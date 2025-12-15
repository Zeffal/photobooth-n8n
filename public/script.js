class PhotoboothApp {
    constructor() {
        // DOM elements
        this.step1 = document.getElementById('step1');
        this.step2 = document.getElementById('step2');
        this.step3 = document.getElementById('step3');
        this.step4 = document.getElementById('step4');
        this.step5 = document.getElementById('step5');
        this.step6 = document.getElementById('step6');
        this.blockedScreen = document.getElementById('blockedScreen');
        
        // Mode selection
        this.individualMode = document.getElementById('individualMode');
        this.groupMode = document.getElementById('groupMode');
        this.galleryMode = document.getElementById('galleryMode');
        
        // Individual upload elements
        this.personUploadArea = document.getElementById('personUploadArea');
        this.personImageInput = document.getElementById('personImageInput');
        this.personPreview = document.getElementById('personPreview');
        this.processIndividualBtn = document.getElementById('processIndividualBtn');
        
        // Selection preview elements
        this.selectionPreview = document.getElementById('selectionPreview');
        this.personPreviewImg = document.getElementById('personPreviewImg');
        this.removePersonBtn = document.getElementById('removePersonBtn');
        
        // Outfit selection elements
        this.outfitGrid = document.getElementById('outfitGrid');
        this.selectedOutfit = document.getElementById('selectedOutfit');
        this.selectedOutfitImg = document.getElementById('selectedOutfitImg');
        this.removeOutfitBtn = document.getElementById('removeOutfitBtn');
        
        // Group selection elements
        this.availableImages = document.getElementById('availableImages');
        this.selectedGrid = document.getElementById('selectedGrid');
        this.selectedCount = document.getElementById('selectedCount');
        this.processGroupBtn = document.getElementById('processGroupBtn');
        
        // Gallery elements
        this.individualGalleryTab = document.getElementById('individualGalleryTab');
        this.groupGalleryTab = document.getElementById('groupGalleryTab');
        this.individualGallery = document.getElementById('individualGallery');
        this.groupGallery = document.getElementById('groupGallery');
        
        // Navigation buttons
        this.backToModeBtn = document.getElementById('backToModeBtn');
        this.backToModeFromGroupBtn = document.getElementById('backToModeFromGroupBtn');
        this.backToModeFromGalleryBtn = document.getElementById('backToModeFromGalleryBtn');
        this.backToModeFromResultBtn = document.getElementById('backToModeFromResultBtn');
        this.refreshStatusBtn = document.getElementById('refreshStatusBtn');
        
        // Processing elements
        this.processingTitle = document.getElementById('processingTitle');
        this.processingDescription = document.getElementById('processingDescription');
        this.activityStatus = document.getElementById('activityStatus');
        this.blockedActivityStatus = document.getElementById('blockedActivityStatus');
        
        // Result elements
        this.resultImage = document.getElementById('resultImage');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.shareBtn = document.getElementById('shareBtn');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        
        // Fullscreen modal
        this.fullscreenModal = document.getElementById('fullscreenModal');
        this.fullscreenImage = document.getElementById('fullscreenImage');
        this.closeFullscreenModal = document.getElementById('closeFullscreenModal');
        
        // State variables
        this.currentMode = null;
        this.selectedImages = [];
        this.personImageFile = null;
        this.selectedOutfitUrl = null;
        this.selectedImageIds = [];
        this.currentResultUrl = null;
        this.currentActivity = 'Finish';
        this.currentGenerationType = null; // Track what type of generation is in progress
        this.pollIntervalId = null;
        this.processingStepIndex = 0;
        
        this.initEventListeners();
        this.startBackgroundPolling();
        this.checkInitialActivity();
    }
    
    initEventListeners() {
        // Mode selection
        this.individualMode?.addEventListener('click', () => this.selectMode('individual'));
        this.groupMode?.addEventListener('click', () => this.selectMode('group'));
        this.galleryMode?.addEventListener('click', () => this.selectMode('gallery'));
        
        // Individual upload
        this.personUploadArea?.addEventListener('click', () => this.personImageInput.click());
        this.personImageInput?.addEventListener('change', (e) => this.handlePersonImageUpload(e));
        this.removePersonBtn?.addEventListener('click', () => this.removePersonImage());
        this.removeOutfitBtn?.addEventListener('click', () => this.removeSelectedOutfit());
        this.processIndividualBtn?.addEventListener('click', () => this.processIndividualImages());
        
        // Group processing
        this.processGroupBtn?.addEventListener('click', () => this.processGroupImages());
        
        // Gallery tabs
        this.individualGalleryTab?.addEventListener('click', () => this.switchGalleryTab('individual'));
        this.groupGalleryTab?.addEventListener('click', () => this.switchGalleryTab('group'));
        
        // Navigation
        this.backToModeBtn?.addEventListener('click', () => this.showStep(1));
        this.backToModeFromGroupBtn?.addEventListener('click', () => this.showStep(1));
        this.backToModeFromGalleryBtn?.addEventListener('click', () => this.showStep(1));
        this.backToModeFromResultBtn?.addEventListener('click', () => window.location.reload());
        this.refreshStatusBtn?.addEventListener('click', () => this.checkActivityStatus());
        
        // Result actions
        this.downloadBtn?.addEventListener('click', () => this.downloadImage());
        this.shareBtn?.addEventListener('click', () => this.copyImageLink());
        this.fullscreenBtn?.addEventListener('click', () => this.showFullscreen());
        
        // Fullscreen modal
        this.closeFullscreenModal?.addEventListener('click', () => this.hideFullscreen());
        
        // ESC key handling
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.fullscreenModal?.style.display === 'block') {
                this.hideFullscreen();
            }
        });
        
        // Close fullscreen when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === this.fullscreenModal) this.hideFullscreen();
        });
    }
    
    async checkInitialActivity() {
        try {
            const response = await fetch('/get_activity');
            const data = await response.json();
            this.currentActivity = data.Activity;
            
            if (this.currentActivity !== 'Finish') {
                this.showBlockedScreen();
            }
        } catch (error) {
            console.error('Error checking initial activity:', error);
        }
    }
    
    startBackgroundPolling() {
        this.pollIntervalId = setInterval(async () => {
            await this.checkActivityStatus();
        }, 2000);
    }
    
    async checkActivityStatus() {
        try {
            const response = await fetch('/get_activity');
            const data = await response.json();
            const newActivity = data.Activity;
            
            if (newActivity !== this.currentActivity) {
                console.log(`Activity changed: ${this.currentActivity} -> ${newActivity}`);
                this.currentActivity = newActivity;
                
                if (this.activityStatus) {
                    this.activityStatus.textContent = newActivity;
                }
                if (this.blockedActivityStatus) {
                    this.blockedActivityStatus.textContent = newActivity;
                }
                
                // Handle activity changes
                if (newActivity === 'Finish') {
                    if (this.blockedScreen.style.display !== 'none') {
                        this.hideBlockedScreen();
                    }
                    if (this.step4.style.display !== 'none') {
                        // Processing finished, check for results
                        await this.checkForResults();
                    }
                } else if (newActivity === 'Processing' || newActivity === 'Starting') {
                    if (this.step4.style.display === 'none' && this.step5.style.display === 'none') {
                        this.showBlockedScreen();
                    }
                }
            }
        } catch (error) {
            console.error('Error checking activity status:', error);
        }
    }
    
    selectMode(mode) {
        this.currentMode = mode;
        
        if (mode === 'individual') {
            this.loadOutfitAssets();
            this.showStep(2);
        } else if (mode === 'group') {
            this.loadAvailableImages();
            this.showStep(3);
        } else if (mode === 'gallery') {
            this.loadGallery();
            this.showStep(6);
        }
    }
    
    showStep(stepNumber) {
        // Hide all steps and blocked screen
        [this.step1, this.step2, this.step3, this.step4, this.step5, this.step6, this.blockedScreen].forEach(step => {
            if (step) step.style.display = 'none';
        });
        
        // Show the requested step
        const stepElement = document.getElementById(`step${stepNumber}`);
        if (stepElement) {
            stepElement.style.display = 'block';
        }
    }
    
    showBlockedScreen() {
        [this.step1, this.step2, this.step3, this.step4, this.step5, this.step6].forEach(step => {
            if (step) step.style.display = 'none';
        });
        this.blockedScreen.style.display = 'block';
    }
    
    hideBlockedScreen() {
        this.blockedScreen.style.display = 'none';
        this.showStep(1);
    }
    
    handlePersonImageUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.personImageFile = file;
            this.showPersonPreview(file);
            this.checkIndividualReadiness();
        }
    }
    
    showPersonPreview(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.personPreviewImg.src = e.target.result;
            this.updateSelectionPreview();
        };
        reader.readAsDataURL(file);
    }
    
    removePersonImage() {
        this.personImageFile = null;
        this.personPreviewImg.src = '';
        this.updateSelectionPreview();
        this.checkIndividualReadiness();
    }
    
    async loadOutfitAssets() {
        try {
            this.outfitGrid.innerHTML = '<div class="loading-message">Loading available outfits...</div>';
            
            const response = await fetch('/get-outfit-assets');
            const result = await response.json();
            
            if (result.success && result.outfits.length > 0) {
                this.displayOutfitGrid(result.outfits);
            } else {
                this.outfitGrid.innerHTML = '<div class="error-message">No outfit assets found.</div>';
            }
        } catch (error) {
            console.error('Error loading outfit assets:', error);
            this.outfitGrid.innerHTML = '<div class="error-message">Error loading outfits. Please try again.</div>';
        }
    }
    
    displayOutfitGrid(outfits) {
        const outfitsHtml = outfits.map(outfit => `
            <div class="outfit-option" onclick="photoboothApp.selectOutfit('${outfit.url}', '${outfit.filename}')">
                <img src="${outfit.url}" alt="${outfit.name}" />
                <div class="outfit-name">${outfit.name}</div>
            </div>
        `).join('');
        
        this.outfitGrid.innerHTML = `
            <div class="outfit-options">
                ${outfitsHtml}
            </div>
        `;
    }
    
    selectOutfit(outfitUrl, filename) {
        this.selectedOutfitUrl = outfitUrl;
        this.selectedOutfitImg.src = outfitUrl;
        this.updateSelectionPreview();
        this.checkIndividualReadiness();
    }
    
    removeSelectedOutfit() {
        this.selectedOutfitUrl = null;
        this.selectedOutfitImg.src = '';
        this.updateSelectionPreview();
        this.checkIndividualReadiness();
    }
    
    updateSelectionPreview() {
        const hasPersonImage = this.personImageFile && this.personPreviewImg.src;
        const hasOutfitImage = this.selectedOutfitUrl && this.selectedOutfitImg.src;
        
        if (hasPersonImage || hasOutfitImage) {
            this.selectionPreview.style.display = 'block';
        } else {
            this.selectionPreview.style.display = 'none';
        }
    }
    
    showImagePreview(file, previewElement, uploadArea) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = previewElement.querySelector('img');
            if (img) {
                img.src = e.target.result;
            }
            previewElement.style.display = 'block';
            uploadArea.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
    
    checkIndividualReadiness() {
        if (this.personImageFile && this.selectedOutfitUrl) {
            this.processIndividualBtn.disabled = false;
        } else {
            this.processIndividualBtn.disabled = true;
        }
    }
    
    async processIndividualImages() {
        if (!this.personImageFile || !this.selectedOutfitUrl) {
            alert('Please select both person image and outfit');
            return;
        }
        
        try {
            // Set generation type and timestamp
            this.currentGenerationType = 'individual';
            this.generationStartTime = new Date().toISOString();
            
            // Update activity to Starting
            await this.updateActivity('Starting');
            
            // Show processing screen
            this.processingTitle.textContent = '🎨 Processing Individual Photo';
            this.processingDescription.textContent = 'AI is combining your person and outfit images...';
            this.showStep(4);
            this.startProcessingAnimation();
            
            // Create FormData
            const formData = new FormData();
            formData.append('personImage', this.personImageFile);
            formData.append('outfitUrl', this.selectedOutfitUrl);
            
            // Upload to server
            const response = await fetch('/upload-individual', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('Individual images uploaded successfully');
                // Processing will continue in background, polling will handle completion
            } else {
                throw new Error(result.error || 'Upload failed');
            }
            
        } catch (error) {
            console.error('Error processing individual images:', error);
            alert('Error processing images: ' + error.message);
            this.resetToMode();
        }
    }
    
    async loadAvailableImages() {
        try {
            this.availableImages.innerHTML = '<div class="loading-message">Loading available images...</div>';
            
            const response = await fetch('/get-individual-images');
            const result = await response.json();
            
            if (result.success && result.images.length > 0) {
                this.displayAvailableImages(result.images);
            } else {
                this.availableImages.innerHTML = `
                    <div class="no-images-message">
                        <p>No individual AI-generated images available yet.</p>
                        <p>Create some individual photos first!</p>
                        <button class="btn btn-primary" onclick="photoboothApp.showStep(1)">Create Individual Photo</button>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading available images:', error);
            this.availableImages.innerHTML = '<div class="error-message">Error loading images. Please try again.</div>';
        }
    }
    
    displayAvailableImages(images) {
        const imagesHtml = images.map(image => `
            <div class="available-image" data-id="${image.id}">
                <img src="${image.generatedImage.url}" alt="Generated image ${image.id}" />
                <div class="image-overlay">
                    <button class="select-btn" onclick="photoboothApp.toggleImageSelection(${image.id})">
                        Select
                    </button>
                </div>
            </div>
        `).join('');
        
        this.availableImages.innerHTML = `
            <h3>Available Individual Images (${images.length})</h3>
            <div class="images-grid">
                ${imagesHtml}
            </div>
        `;
    }
    
    toggleImageSelection(imageId) {
        const imageElement = document.querySelector(`[data-id="${imageId}"]`);
        const selectBtn = imageElement.querySelector('.select-btn');
        
        if (this.selectedImageIds.includes(imageId)) {
            // Deselect
            this.selectedImageIds = this.selectedImageIds.filter(id => id !== imageId);
            imageElement.classList.remove('selected');
            selectBtn.textContent = 'Select';
        } else {
            // Select
            this.selectedImageIds.push(imageId);
            imageElement.classList.add('selected');
            selectBtn.textContent = 'Selected';
        }
        
        this.updateSelectedDisplay();
    }
    
    updateSelectedDisplay() {
        this.selectedCount.textContent = this.selectedImageIds.length;
        
        if (this.selectedImageIds.length === 0) {
            this.selectedGrid.innerHTML = '<div class="no-selection">No images selected yet</div>';
            this.processGroupBtn.disabled = true;
        } else {
            const selectedHtml = this.selectedImageIds.map(id => {
                const imageElement = document.querySelector(`[data-id="${id}"]`);
                const imgSrc = imageElement.querySelector('img').src;
                return `
                    <div class="selected-image">
                        <img src="${imgSrc}" alt="Selected image ${id}" />
                        <button class="remove-btn" onclick="photoboothApp.toggleImageSelection(${id})">×</button>
                    </div>
                `;
            }).join('');
            
            this.selectedGrid.innerHTML = selectedHtml;
            this.processGroupBtn.disabled = this.selectedImageIds.length < 2;
        }
    }
    
    async processGroupImages() {
        if (this.selectedImageIds.length === 0) {
            alert('Please select at least one image for group processing');
            return;
        }
        
        try {
            // Set generation type and timestamp
            this.currentGenerationType = 'group';
            this.generationStartTime = new Date().toISOString();
            
            // Update activity to Starting
            await this.updateActivity('Starting');
            
            // Show processing screen
            this.processingTitle.textContent = '👥 Processing Group Photo';
            this.processingDescription.textContent = 'AI is combining your selected images...';
            this.showStep(4);
            this.startProcessingAnimation();
            
            // Send selected image IDs to server
            const response = await fetch('/upload-group', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    selectedImageIds: this.selectedImageIds
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('Group images uploaded successfully');
                // Processing will continue in background, polling will handle completion
            } else {
                throw new Error(result.error || 'Upload failed');
            }
            
        } catch (error) {
            console.error('Error processing group images:', error);
            alert('Error processing group images: ' + error.message);
            this.resetToMode();
        }
    }
    
    startProcessingAnimation() {
        this.processingStepIndex = 0;
        const steps = document.querySelectorAll('.process-step');
        
        const animateStep = () => {
            if (this.processingStepIndex < steps.length) {
                steps[this.processingStepIndex].classList.add('active');
                this.processingStepIndex++;
                setTimeout(animateStep, 1500);
            }
        };
        
        // Reset all steps
        steps.forEach(step => step.classList.remove('active'));
        setTimeout(animateStep, 500);
    }
    
    async checkForResults() {
        try {
            console.log(`Checking for latest ${this.currentGenerationType} result...`);
            
            // Use gallery endpoint and sort by highest ID on frontend
            const endpoint = this.currentGenerationType === 'individual' 
                ? '/gallery/individual' 
                : '/gallery/group';
            
            const response = await fetch(endpoint);
            const result = await response.json();
            
            console.log(`${this.currentGenerationType} gallery response:`, result);
            
            if (result.success && result.images && result.images.length > 0) {
                // Sort by ID (highest first) to get the newest image
                const sortedImages = result.images.sort((a, b) => b.id - a.id);
                const latestImage = sortedImages[0];
                
                console.log(`Latest image object:`, latestImage);
                
                let imageUrl;
                if (this.currentGenerationType === 'individual') {
                    imageUrl = latestImage.generatedImage?.url;
                } else {
                    // For group images, check both possible field structures
                    imageUrl = latestImage.generatedGroupImage?.url || latestImage.generatedImage?.url;
                }
                
                console.log(`Found latest ${this.currentGenerationType} image (ID: ${latestImage.id}):`, imageUrl);
                
                if (imageUrl) {
                    this.currentResultUrl = imageUrl;
                    this.showResult(imageUrl, this.currentGenerationType);
                } else {
                    console.error('No image URL found in latest image object');
                    setTimeout(() => {
                        this.checkForResults();
                    }, 2000);
                }
            } else {
                console.log(`No ${this.currentGenerationType} results available, retrying in 2 seconds...`);
                setTimeout(() => {
                    this.checkForResults();
                }, 2000);
            }
        } catch (error) {
            console.error('Error checking for results:', error);
            setTimeout(() => {
                this.checkForResults();
            }, 2000);
        }
    }
    
    showResult(imageUrl, resultType) {
        // Set the current result URL for button functionality
        this.currentResultUrl = imageUrl;
        this.resultImage.src = imageUrl;
        
        // Update result title based on type
        const resultTitle = document.querySelector('#step5 h2');
        if (resultTitle) {
            if (resultType === 'individual') {
                resultTitle.textContent = '🎨 Your Individual Photo is Ready!';
            } else if (resultType === 'group') {
                resultTitle.textContent = '👥 Your Group Photo is Ready!';
            } else {
                resultTitle.textContent = '✨ Your Photo is Ready!';
            }
        }
        
        this.showStep(5);
    }
    
    showResultError(errorMessage) {
        // Show error in result step instead of going back to home
        const resultContainer = document.querySelector('#step5 .result-container');
        if (resultContainer) {
            resultContainer.innerHTML = `
                <div class="error-result">
                    <div class="error-icon">⚠️</div>
                    <h3>Generation Failed</h3>
                    <p>${errorMessage}</p>
                    <button class="btn btn-primary" onclick="photoboothApp.resetToMode()">Try Again</button>
                </div>
            `;
        }
        this.showStep(5);
    }
    
    async updateActivity(activity) {
        try {
            const response = await fetch('/update_activity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ activity })
            });
            
            const result = await response.json();
            if (result.success) {
                this.currentActivity = result.activity;
            }
        } catch (error) {
            console.error('Error updating activity:', error);
        }
    }
    
    downloadImage() {
        if (this.currentResultUrl) {
            const link = document.createElement('a');
            link.href = this.currentResultUrl;
            link.download = `ai-photobooth-${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
    
    async copyImageLink() {
        if (this.currentResultUrl) {
            try {
                await navigator.clipboard.writeText(this.currentResultUrl);
                alert('Image link copied to clipboard!');
            } catch (error) {
                console.error('Error copying to clipboard:', error);
                alert('Could not copy link to clipboard');
            }
        }
    }
    
    showFullscreen() {
        if (this.currentResultUrl) {
            this.fullscreenImage.src = this.currentResultUrl;
            this.fullscreenModal.style.display = 'block';
        }
    }
    
    hideFullscreen() {
        this.fullscreenModal.style.display = 'none';
    }
    
    resetApp() {
        // Reset all state
        this.currentMode = null;
        this.personImageFile = null;
        this.outfitImageFile = null;
        this.selectedImageIds = [];
        this.currentResultUrl = null;
        
        // Reset UI elements
        if (this.personPreview) {
            this.personPreview.style.display = 'none';
            this.personUploadArea.querySelector('.upload-placeholder').style.display = 'block';
        }
        if (this.outfitPreview) {
            this.outfitPreview.style.display = 'none';
            this.outfitUploadArea.querySelector('.upload-placeholder').style.display = 'block';
        }
        
        this.processIndividualBtn.disabled = true;
        this.processGroupBtn.disabled = true;
        
        // Go back to mode selection
        this.showStep(1);
    }
    
    resetToMode() {
        this.showStep(1);
    }
    
    // Gallery functions
    async loadGallery() {
        // Load individual gallery by default
        this.switchGalleryTab('individual');
    }
    
    switchGalleryTab(tabType) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        if (tabType === 'individual') {
            this.individualGalleryTab.classList.add('active');
            this.individualGallery.style.display = 'block';
            this.groupGallery.style.display = 'none';
            this.loadIndividualGallery();
        } else {
            this.groupGalleryTab.classList.add('active');
            this.individualGallery.style.display = 'none';
            this.groupGallery.style.display = 'block';
            this.loadGroupGallery();
        }
    }
    
    async loadIndividualGallery() {
        try {
            this.individualGallery.innerHTML = '<div class="loading-message">Loading individual images...</div>';
            
            const response = await fetch('/gallery/individual');
            const result = await response.json();
            
            if (result.success && result.images.length > 0) {
                this.displayIndividualGallery(result.images);
            } else {
                this.individualGallery.innerHTML = `
                    <div class="no-images-message">
                        <p>No individual images found.</p>
                        <p>Create some individual photos first!</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading individual gallery:', error);
            this.individualGallery.innerHTML = '<div class="error-message">Error loading gallery. Please try again.</div>';
        }
    }
    
    async loadGroupGallery() {
        try {
            this.groupGallery.innerHTML = '<div class="loading-message">Loading group images...</div>';
            
            const response = await fetch('/gallery/group');
            const result = await response.json();
            
            if (result.success && result.images.length > 0) {
                this.displayGroupGallery(result.images);
            } else {
                this.groupGallery.innerHTML = `
                    <div class="no-images-message">
                        <p>No group images found.</p>
                        <p>Create some group photos first!</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading group gallery:', error);
            this.groupGallery.innerHTML = '<div class="error-message">Error loading gallery. Please try again.</div>';
        }
    }
    
    displayIndividualGallery(images) {
        const imagesHtml = images.map(image => `
            <div class="gallery-item">
                <div class="gallery-image">
                    <img src="${image.generatedImage.url}" alt="Individual image ${image.id}" />
                    <div class="gallery-overlay">
                        <button class="gallery-btn" onclick="photoboothApp.viewGalleryImage('${image.generatedImage.url}')">
                            View Full
                        </button>
                        <button class="gallery-btn" onclick="photoboothApp.downloadGalleryImage('${image.generatedImage.url}', 'individual_${image.id}')">
                            Download
                        </button>
                    </div>
                </div>
                <div class="gallery-info">
                    <p class="gallery-id">ID: ${image.id}</p>
                </div>
            </div>
        `).join('');
        
        this.individualGallery.innerHTML = `
            <div class="gallery-header">
                <h3>Individual Images (${images.length})</h3>
            </div>
            <div class="gallery-items">
                ${imagesHtml}
            </div>
        `;
    }
    
    displayGroupGallery(images) {
        const imagesHtml = images.map(image => `
            <div class="gallery-item">
                <div class="gallery-image">
                    <img src="${image.generatedImage.url}" alt="Group image ${image.id}" />
                    <div class="gallery-overlay">
                        <button class="gallery-btn" onclick="photoboothApp.viewGalleryImage('${image.generatedImage.url}')">
                            View Full
                        </button>
                        <button class="gallery-btn" onclick="photoboothApp.downloadGalleryImage('${image.generatedImage.url}', 'group_${image.id}')">
                            Download
                        </button>
                    </div>
                </div>
                <div class="gallery-info">
                    <p class="gallery-id">ID: ${image.id}</p>
                </div>
            </div>
        `).join('');
        
        this.groupGallery.innerHTML = `
            <div class="gallery-header">
                <h3>Group Images (${images.length})</h3>
            </div>
            <div class="gallery-items">
                ${imagesHtml}
            </div>
        `;
    }
    
    viewGalleryImage(imageUrl) {
        this.fullscreenImage.src = imageUrl;
        this.fullscreenModal.style.display = 'block';
    }
    
    downloadGalleryImage(imageUrl, filename) {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `${filename}_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Initialize the app when DOM is loaded
let photoboothApp;
document.addEventListener('DOMContentLoaded', () => {
    photoboothApp = new PhotoboothApp();
});
