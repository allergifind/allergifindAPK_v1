// Main allergen categories from CSV
const mainAllergens = [
  'dairy',
  'sea food',
  'gluten',
  'peanut',
  'soy',
  'tree nuts',
  'meat',
  'tomatoes',
  'eggplant',
  'potatoes',
  'celery',
  'mustard',
  'sesame',
  'papaya',
  'banana'
];

// Function to initialize allergen toggles
function initializeAllergenToggles() {
  const allergiesGrid = document.getElementById('allergies-grid');
  
  mainAllergens.forEach(allergen => {
    const toggleDiv = document.createElement('div');
    toggleDiv.className = 'allergy-toggle';
    
    // Capitalize allergen name
    const displayName = allergen
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    toggleDiv.innerHTML = `
      <label for="${allergen}">${displayName}</label>
      <label class="switch">
        <input type="checkbox" id="${allergen}">
        <span class="slider"></span>
      </label>
    `;
    
    allergiesGrid.appendChild(toggleDiv);
  });
}

// Function to toggle sections
function toggleSection(sectionId) {
  const content = document.getElementById(`${sectionId}-content`);
  const header = content.previousElementSibling;
  
  // Toggle active class
  content.classList.toggle('active');
  header.classList.toggle('active');
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  initializeAllergenToggles();
  
  // Open all sections by default
  document.querySelectorAll('.card-content').forEach(content => {
    content.classList.add('active');
    content.previousElementSibling.classList.add('active');
  });
  
  // Save form data to localStorage when changed
  document.getElementById('name').addEventListener('change', (e) => {
    localStorage.setItem('userName', e.target.value);
  });
  
  document.getElementById('dob').addEventListener('change', (e) => {
    localStorage.setItem('userDob', e.target.value);
  });
  
  // Load saved data
  const savedName = localStorage.getItem('userName');
  const savedDob = localStorage.getItem('userDob');
  
  if (savedName) document.getElementById('name').value = savedName;
  if (savedDob) document.getElementById('dob').value = savedDob;
});
