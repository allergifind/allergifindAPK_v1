// Get elements
const cameraStream = document.getElementById('camera-stream');
const clickPictureButton = document.getElementById('click-picture');
const chooseFromGalleryButton = document.getElementById('choose-from-gallery');
const fileInput = document.getElementById('file-input');
const productDetails = document.getElementById('product-details');
const productName = document.getElementById('product-name');
const ingredientsList = document.getElementById('ingredients-list');
const nutritionList = document.getElementById('nutrition-list');
const allergenWarning = document.getElementById('allergen-warning');

// Add this at the top with other global variables
let allergenDatabase = {};

// Add this function to load and parse the CSV
async function loadAllergenDatabase() {
  try {
    const response = await fetch('allergiesV2.csv');
    const csvText = await response.text();
    const lines = csvText.split('\n');
    
    let currentCategory = '';
    lines.forEach(line => {
      const [category, item, alternatives] = line.split(',').map(cell => cell.trim());
      if (category) currentCategory = category;
      if (item) {
        if (!allergenDatabase[currentCategory]) {
          allergenDatabase[currentCategory] = [];
        }
        allergenDatabase[currentCategory].push({
          item: item.toLowerCase(),
          alternatives: alternatives ? alternatives.split(/[,.]/).map(alt => alt.trim().toLowerCase()).filter(Boolean) : []
        });
      }
    });
  } catch (error) {
    console.error('Error loading allergen database:', error);
  }
}

// Function to start the camera
async function startCamera() {
  try {
    // First, check if there's an existing stream and stop it
    if (cameraStream.srcObject) {
      const tracks = cameraStream.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }

    const constraints = {
      video: { 
        facingMode: { exact: "environment" }, // Force rear camera
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    cameraStream.srcObject = stream;
    
    // Wait for the video to be ready
    return new Promise((resolve) => {
      cameraStream.onloadedmetadata = () => {
        cameraStream.play()
          .then(() => {
            console.log('Camera started successfully');
            resolve(true);
          })
          .catch(error => {
            console.error('Error playing video:', error);
            resolve(false);
          });
      };
    });
  } catch (error) {
    console.error('Error accessing camera:', error);
    // Try fallback to any available camera
    try {
      const fallbackConstraints = {
        video: { facingMode: "environment" }
      };
      const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      cameraStream.srcObject = stream;
      await cameraStream.play();
      console.log('Camera started with fallback');
    } catch (fallbackError) {
      console.error('Fallback camera error:', fallbackError);
      alert('Camera access failed. Please check permissions.');
    }
  }
}

// Function to capture and process image
async function capturePicture() {
  const video = cameraStream;
  
  if (!video.srcObject) {
    console.error('No camera stream available');
    alert('Camera not ready. Please wait...');
    return;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    try {
      const imageData = canvas.toDataURL('image/png');
      const result = await detectBarcode(imageData);
      if (result) {
        console.log('Barcode detected:', result);
        await fetchProductInfo(result);
      } else {
        alert('No barcode detected. Please try again.');
      }
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Error processing image. Please try again.');
    }
  } else {
    alert('Camera not ready. Please try again.');
  }
}

// Function to detect barcode using ZXing
async function detectBarcode(imageData) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);
        
        const hints = new Map();
        const formats = [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8];
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
        
        const reader = new ZXing.MultiFormatReader();
        reader.setHints(hints);
        
        const luminanceSource = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
        const binaryBitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminanceSource));
        
        const result = reader.decode(binaryBitmap);
        console.log('Detected barcode:', result.text);
        resolve(result.text);
      } catch (error) {
        console.error('Barcode detection error:', error);
        resolve(null);
      }
    };
    img.src = imageData;
  });
}

// Function to fetch product info
async function fetchProductInfo(barcode) {
  const apiUrl = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    if (data.status === 1 && data.product) {
      // Hide camera container
      const cameraContainer = document.querySelector('.camera-container');
      if (cameraContainer) {
        cameraContainer.style.display = 'none';
      }

      // Show and update product details
      const productDetailsSection = document.getElementById('product-details');
      if (productDetailsSection) {
        displayProductInfo(data.product);
        productDetailsSection.style.display = 'block';
      } else {
        console.error('Product details section not found');
      }
    } else {
      alert('Product not found');
    }
  } catch (error) {
    console.error('Error fetching product info:', error);
    alert('Error fetching product information');
  }
}

// Add this function before displayProductInfo
function cleanIngredientText(text) {
  if (!text) return null;
  return text.trim();
}

// Update the displayProductInfo function to handle missing data
function displayProductInfo(product) {
  console.log('Displaying product info:', product);
  
  // Update product name
  if (productName) {
    productName.textContent = product.product_name || 'Unknown Product';
  }

  // Process ingredients for allergens
  let detectedAllergens = new Set();
  if (product.ingredients_text) {
    // Split ingredients into individual words
    const ingredientWords = product.ingredients_text
      .toLowerCase()
      .replace(/[()]/g, '') // Remove parentheses
      .split(/[\s,\/\-]+/) // Split on spaces, commas, forward slashes, and hyphens
      .filter(word => word.length > 2); // Filter out very short words

    // Check each word against allergen database
    ingredientWords.forEach(word => {
      for (const [category, allergens] of Object.entries(allergenDatabase)) {
        allergens.forEach(allergen => {
          if (word === allergen.item || allergen.alternatives.includes(word)) {
            detectedAllergens.add(`${category} (${allergen.item})`);
          }
        });
      }
    });
  }

  // Update allergen warning
  if (allergenWarning) {
    if (detectedAllergens.size > 0) {
      allergenWarning.textContent = `Contains: ${Array.from(detectedAllergens).join(', ')}`;
      allergenWarning.parentElement.style.display = 'block';
    } else {
      allergenWarning.textContent = 'No common allergens detected';
      allergenWarning.parentElement.style.display = 'block';
    }
  }

  // Update ingredients list
  if (ingredientsList) {
    ingredientsList.innerHTML = '';
    if (product.ingredients && Array.isArray(product.ingredients)) {
      product.ingredients.forEach(ingredient => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${cleanIngredientText(ingredient.text) || 'Unknown Ingredient'}</td>
          <td>${ingredient.percent_estimate ? `${ingredient.percent_estimate.toFixed(1)}%` : '-'}</td>
        `;
        ingredientsList.appendChild(row);
      });
    } else {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="2">No ingredients information available</td>';
      ingredientsList.appendChild(row);
    }
  }

  // Update nutrition info
  if (nutritionList) {
    nutritionList.innerHTML = '';
    const nutrients = {
      'Energy': ['energy-kcal', 'kcal'],
      'Fat': ['fat', 'g'],
      'Saturated Fat': ['saturated-fat', 'g'],
      'Carbohydrates': ['carbohydrates', 'g'],
      'Sugars': ['sugars', 'g'],
      'Proteins': ['proteins', 'g'],
      'Salt': ['salt', 'g']
    };

    Object.entries(nutrients).forEach(([label, [key, unit]]) => {
      const row = document.createElement('tr');
      const value = product.nutriments ? (product.nutriments[key] || '-') : '-';
      row.innerHTML = `
        <td>${label}</td>
        <td>${value}${value !== '-' ? ` ${unit}` : ''}</td>
      `;
      nutritionList.appendChild(row);
    });
  }

  // Make sure content sections are visible initially
  document.getElementById('ingredients-content').classList.add('active');
  document.getElementById('nutrition-content').classList.add('active');
  document.querySelectorAll('.card-header').forEach(header => header.classList.add('active'));

  // Make product details visible
  productDetails.classList.remove('hidden');
}

// Function to toggle sections
function toggleSection(sectionId) {
  const content = document.getElementById(`${sectionId}-content`);
  const header = content.previousElementSibling;
  content.classList.toggle('active');
  header.classList.toggle('active');
}

// Function to handle file input from gallery
function handleFileInput(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const result = await detectBarcode(e.target.result);
        if (result) {
          await fetchProductInfo(result);
        } else {
          alert('No barcode detected in the image');
        }
      } catch (error) {
        console.error('Error processing image:', error);
        alert('Error processing image');
      }
    };
    reader.readAsDataURL(file);
    // Reset file input to allow selecting the same file again
    event.target.value = '';
  }
}

// Initialize camera when page loads
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Page loaded, loading allergen database...');
  await loadAllergenDatabase();
  console.log('Starting camera...');
  await startCamera();
  
  clickPictureButton.addEventListener('click', () => {
    console.log('Capture button clicked');
    capturePicture();
  });
  
  chooseFromGalleryButton.addEventListener('click', () => {
    console.log('Gallery button clicked');
    fileInput.click();
  });
  
  fileInput.addEventListener('change', handleFileInput);
});