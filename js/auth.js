import { supabase } from "./supabase-config.js";

// Helper functions for loading
function showLoader(message) {
  const loadingText = document.querySelector('.loading-text');
  if (loadingText) loadingText.textContent = message || 'Please wait...';
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) loadingOverlay.style.display = 'flex';
}

function hideLoader() {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) loadingOverlay.style.display = 'none';
}

// Show user info on screen
async function checkUser() {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    let fullName = user.email;
    // Fetch user details from 'users' table
    const { data, error } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single();

    if (data && data.full_name) {
      fullName = data.full_name;
    }

    const userInfo = document.getElementById("user-info");
    if (userInfo) {
      userInfo.innerHTML = `<strong>Welcome, ${fullName}</strong><br/><span class="email">${user.email}</span>`;
    }
  } else {
    // Only redirect if we are NOT on login or signup pages
    const path = window.location.pathname;
    if (!path.includes("login.html") && !path.includes("signup.html")) {
      window.location.href = "login.html";
    }
  }
}

// Check on load
checkUser();

// Listen for auth changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    window.location.href = "login.html";
  }
});

window.logout = async function () {
  await supabase.auth.signOut();
  window.location.href = "login.html";
};

// Webcam Handling
let video = document.getElementById("webcam");
let canvas = document.getElementById("webcam-canvas");
let preview = document.getElementById("preview");

window.startWebcam = async function () {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.style.display = "block";
    document.getElementById("capture-btn").style.display = "inline-block";
  } catch (err) {
    alert("Webcam access denied.");
  }
};

window.capturePhoto = function () {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  preview.src = canvas.toDataURL("image/png");
  preview.style.display = "block";
};

// Try Clothing Logic
window.triggerUpload = function (type) {
  document.getElementById(`${type}-upload`).click();
};

window.handleUpload = function (event, type) {
  showLoader(`Applying ${type}...`);

  const file = event.target.files[0];
  const reader = new FileReader();

  reader.onload = function () {
    const img = document.createElement("img");
    img.src = reader.result;
    img.alt = type;
    img.style.maxWidth = "100px";
    img.style.margin = "5px";

    document.getElementById("tryon-result").appendChild(img);
    hideLoader();
    Swal.fire({
      icon: 'success',
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Added`,
      text: `You've added a ${type} to your look.`,
      confirmButtonColor: '#007bff'
    });
  };

  if (file) {
    reader.readAsDataURL(file);
  } else {
    hideLoader();
  }
};

// Save Final Look
window.saveAsImage = function () {
  showLoader("Saving image...");
  html2canvas(document.getElementById("tryon-result")).then(canvas => {
    const link = document.createElement("a");
    link.download = "virtual-look.png";
    link.href = canvas.toDataURL();
    link.click();
    hideLoader();
    Swal.fire({
      icon: 'success',
      title: 'Image Saved',
      text: 'Look downloaded as image!',
      confirmButtonColor: '#28a745'
    });
  });
};

// Save to Wardrobe
// Save to Wardrobe
window.saveToWardrobe = async function () {
  showLoader("Saving to wardrobe...");

  html2canvas(document.getElementById("tryon-result")).then(async canvas => {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      try {
        // Convert canvas to blob
        canvas.toBlob(async (blob) => {
          const fileName = `${user.id}/${Date.now()}.png`;

          // 1. Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('wardrobe_images')
            .upload(fileName, blob);

          if (uploadError) throw uploadError;

          // 2. Get Public URL
          const { data: { publicUrl } } = supabase.storage
            .from('wardrobe_images')
            .getPublicUrl(fileName);

          // 3. Save metadata to Supabase DB
          const { error: dbError } = await supabase
            .from('wardrobe')
            .insert([
              {
                user_id: user.id,
                image_url: publicUrl
              }
            ]);

          if (dbError) throw dbError;

          hideLoader();
          Swal.fire({
            icon: 'success',
            title: 'Saved!',
            text: 'Outfit saved to wardrobe!',
            confirmButtonColor: '#28a745'
          });
        });
      } catch (error) {
        hideLoader();
        console.error("Error saving to wardrobe:", error);
        Swal.fire({
          icon: 'error',
          title: 'Save Failed',
          text: error.message || 'Could not save to wardrobe.',
          confirmButtonColor: '#d33'
        });
      }
    } else {
      hideLoader();
      Swal.fire({
        icon: 'warning',
        title: 'Not Logged In',
        text: 'Please log in to save your wardrobe.',
        confirmButtonColor: '#ffc107'
      });
    }
  });
};

// Apply Outfit Combo
window.applyCombo = function (type) {
  showLoader("Loading combo...");

  setTimeout(() => {
    hideLoader();
    Swal.fire({
      icon: 'info',
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Combo`,
      text: `Applied ${type} outfit combo successfully.`,
      confirmButtonColor: '#17a2b8'
    });
  }, 1500);
};

// AI Recommendation
window.generateRecommendation = function () {
  showLoader("AI is styling you...");

  setTimeout(() => {
    hideLoader();
    const suggestion = "👕 Try a white T-shirt with dark jeans and a leather watch.";
    document.getElementById("recommendation").style.display = "block";
    document.getElementById("rec-text").innerText = suggestion;

    Swal.fire({
      icon: 'info',
      title: 'AI Suggestion',
      text: suggestion,
      confirmButtonColor: '#007bff'
    });
  }, 2000);
};
