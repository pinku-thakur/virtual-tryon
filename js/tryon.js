import { supabase } from "./supabase-config.js";

// =================================================================
// === VITON-HD API INTEGRATION CONFIGURATION ===
// =================================================================
let API_BASE_URL = localStorage.getItem("api_url") || ((window.location.protocol === "file:") ? "" : window.location.origin); // Load from storage or origin

// ── HF Token (session-only, never permanently stored) ─────────────
function getSessionHFToken() {
    return sessionStorage.getItem("hf_token") || null;
}
function setSessionHFToken(token) {
    sessionStorage.setItem("hf_token", token);
}
function clearSessionHFToken() {
    sessionStorage.removeItem("hf_token");
}
const POLLING_INTERVAL = 1000;

// Expose function to update URL from UI
window.updateApiUrl = function (url) {
    if (url.endsWith("/")) url = url.slice(0, -1); // Remove trailing slash
    API_BASE_URL = url;
    localStorage.setItem("api_url", url);
    console.log("API URL Updated:", API_BASE_URL);
    // Optional: Test connection
    fetch(API_BASE_URL + "/").then(r => r.json()).then(d => Swal.fire("Connected!", "Server is online.", "success")).catch(e => Swal.fire("Error", "Could not reach server.", "error"));
};

// Check if URL is set on load
if (!API_BASE_URL) {
    // Swal.fire("Setup Required", "Please paste your Colab/Ngrok URL in the sidebar.", "info");
} else {
    // Populate input if exists
    const input = document.getElementById("api-url");
    if (input) input.value = API_BASE_URL;
}

let currentStyle = "formal";
let uploadedImage = null; // Base64 of the person image
let selectedCloth = null; // Base64 of the selected clothing item
const accessories = {};

// --- Immediate LocalStorage Cache Load ---
let cachedBaseImage = localStorage.getItem("cached_base_image");
if (cachedBaseImage) {
    uploadedImage = cachedBaseImage;
}

// DOM Elements
const userImageInput = document.getElementById('user-image');
const previewImg = document.getElementById('preview');
const tryonResult = document.getElementById('tryon-result'); // Target for the AI result
const aiTryonBtn = document.getElementById('ai-tryon-btn'); // New: For disabling

const accessoryInput = document.getElementById('accessory-upload');


// --- Loader Helpers (Existing) ---
function showLoader(message) {
    document.querySelector('.loading-text').textContent = message || 'Loading...';
    document.getElementById('loading-overlay').style.display = 'flex';
    aiTryonBtn.disabled = true; // Button disable karein
}
function hideLoader() {
    document.getElementById('loading-overlay').style.display = 'none';
    aiTryonBtn.disabled = false; // Button re-enable karein
}


// --- API TRIGGER FUNCTION (CRASH-PROOF LOCALHOST) ---
window.triggerApiTryon = async function () {
    let userImageFile = document.getElementById('user-image').files[0];

    // Find the currently selected clothing file from any of the upload inputs
    const clothInputIds = ['outfit-upload', 'accessory-upload'];
    let clothFile = null;

    for (const id of clothInputIds) {
        const input = document.getElementById(id);
        if (input && input.files.length > 0) {
            clothFile = input.files[0];
            break;
        }
    }

    // If no manual upload, check if we have a selectedCloth (from Combo or Retry)
    if (!clothFile && selectedCloth) {
        try {
            console.log("Fetching cloth from selectedCloth:", selectedCloth);
            const response = await fetch(selectedCloth);
            const blob = await response.blob();
            // Create a file from the blob
            const fileName = selectedCloth.split('/').pop() || "saved_cloth.png";
            clothFile = new File([blob], fileName.split('?')[0], { type: blob.type });
        } catch (e) {
            console.error("Error fetching selected cloth:", e);
        }
    }

    if (!userImageFile && uploadedImage) {
        try {
            console.log("Fetching base image from uploadedImage. Source:", uploadedImage.substring(0, 30));
            const response = await fetch(uploadedImage);
            const blob = await response.blob();
            userImageFile = new File([blob], "base_image.png", { type: blob.type });
        } catch (e) {
            console.error("Error creating file from uploadedImage:", e);
        }
    }

    if (!userImageFile || !clothFile) {
        return Swal.fire("❌ Error", "Please upload your base image. (Clothing is selected)", "error");
    }

    showLoader("1. Sending to AI Server (Colab)...");

    // 1. Prepare FormData
    const formData = new FormData();
    formData.append('person_image', userImageFile); // Note keys match Colab: person_image
    formData.append('garment_image', clothFile);    // Note keys match Colab: garment_image

    const categoryDropdown = document.getElementById('garment-category');
    if (categoryDropdown) {
        formData.append('category', categoryDropdown.value);
    }

    // Attach HF token if available in session
    const sessionToken = getSessionHFToken();
    if (sessionToken) {
        formData.append('hf_token', sessionToken);
    }

    try {
        if (!API_BASE_URL) throw new Error("Please enter Server URL first.");

        // 2. POST Request
        const response = await fetch(`${API_BASE_URL}/try_on`, {
            method: 'POST',
            headers: {
                'ngrok-skip-browser-warning': 'true',
                'Bypass-Tunnel-Reminder': 'true'
            },
            body: formData,
        });

        const textResponse = await response.text(); // Get raw text first to handle empty/HTML errors

        let data;
        try {
            data = JSON.parse(textResponse);
        } catch (e) {
            console.error("Raw response server returned:", textResponse);
            throw new Error(`The AI server returned an invalid response (it might be offline, resetting, or crashing). Make sure your Colab cell is running and Ngrok is active.\n\nRaw error: ${e.message}`);
        }

        // 3. Check if server needs an HF token
        if (data.status === "error" && data.error_code === "hf_token_required") {
            hideLoader();
            showHFTokenModal(data.message);
            return; // Wait for user to enter token — modal will auto-retry
        }

        if (data.status === "success" && (data.image_url || data.image)) {
            // 4. Result captured!
            let imageUrl = data.image_url || data.image;

            // Final result display
            tryonResult.innerHTML = `<div style="position: relative;">
                <img id="ai-result-img" src="${imageUrl}" style="max-width: 100%; max-height: 400px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);" crossorigin="anonymous" />
            </div>`;

            // Result display (no draggable accessories)

            hideLoader();
            Swal.fire("✅ Done!", "Virtual Try-On successful!", "success");
        } else {
            throw new Error(data.message || "Unknown error from server");
        }

    } catch (error) {
        hideLoader();
        Swal.fire("❌ Connection Error", `Could not reach AI Server.\n${error.message}`, "error");
        console.error("API Fetch Error:", error);
    }
};




// --- REST OF THE LOGIC (Same as before) ---
['outfit', 'accessory'].forEach(type => {
    const el = document.querySelector(`#${type}-upload`);
    if (el) el.addEventListener("change", e => handleUpload(e, type));
});

window.triggerUpload = function (type) {
    document.getElementById(`${type}-upload`).click();
};

function handleUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        selectedCloth = e.target.result;
        renderPreviewOverlay();
    };
    reader.readAsDataURL(file);
}

async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    const userInfoDiv = document.getElementById("user-info-nav"); // Updated Target ID

    if (user) {
        try {
            // Fetch user details from 'users' table
            const { data, error } = await supabase
                .from('users')
                .select('full_name')
                .eq('id', user.id)
                .single();

            if (userInfoDiv) {
                const fullName = data?.full_name || user.user_metadata?.full_name || user.email.split('@')[0];
                const avatarUrl = user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`;
                // Show Name, Email and Avatar in Navbar with Profile link
                userInfoDiv.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 8px; cursor: pointer;" onclick="window.location.href='profile.html'" title="Go to Profile">
                            <img src="${avatarUrl}" id="nav-avatar" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary);">
                            <div class="nav-user-details" style="display: flex; flex-direction: column; line-height: 1.2;">
                                <span id="nav-name" style="font-weight:600; color:var(--text); font-size: 14px;">${fullName}</span>
                                <span id="nav-email" style="font-size: 11px; color: var(--text-muted);">${user.email}</span>
                            </div>
                        </div>
                        <button onclick="logout()" class="nav-btn" style="margin-left: 10px;">Logout</button>
                    </div>
                `;

                const baseImageUrl = user.user_metadata?.base_image_url;

                // If local storage is already showing an image, keep it. Otherwise check remote.
                if (!uploadedImage && baseImageUrl) {
                    uploadedImage = baseImageUrl;
                }

                if (uploadedImage) {
                    previewImg.src = uploadedImage;
                    previewImg.style.display = 'block';
                    try { localStorage.setItem("cached_base_image", uploadedImage); } catch (e) { }
                    renderPreviewOverlay();
                }

                if (!sessionStorage.getItem("welcomed")) {
                    Swal.fire({ icon: 'success', title: `🎉 Welcome, ${fullName}!`, text: 'You have logged in successfully.' });
                    sessionStorage.setItem("welcomed", "true");
                }
            }
        } catch (err) {
            console.error("Error fetching user data:", err);
        }
    } else {
        window.location.href = "login.html";
    }
}

checkUser();

window.logout = async function () {
    await supabase.auth.signOut();
    sessionStorage.removeItem("welcomed");
    localStorage.removeItem("cached_base_image");
    Swal.fire({ icon: 'info', title: 'Logged out', text: 'You have been logged out successfully.' }).then(() => {
        window.location.href = "login.html";
    });
};

userImageInput.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (e) {
        uploadedImage = e.target.result;
        previewImg.src = uploadedImage;
        previewImg.style.display = 'block';
        try { localStorage.setItem("cached_base_image", uploadedImage); } catch (err) { }
        renderPreviewOverlay();

        // (Background auto-upload removed to prevent unwanted overwriting of default image)
    };
    reader.readAsDataURL(file);
});






const isRemote = (url) => url && (url.startsWith('http') || url.startsWith('//'));

function renderPreviewOverlay() {
    if (!uploadedImage) return;

    // Check if base image is remote (unlikely for upload, but possible if changed later)
    const baseCrossOrigin = isRemote(uploadedImage) ? 'crossorigin="anonymous"' : '';

    let html = `<div style="position: relative; display: inline-block;">
        <img src="${uploadedImage}" style="max-width: 300px; border-radius: 10px;" ${baseCrossOrigin} />`;

    if (selectedCloth) {
        const clothCrossOrigin = isRemote(selectedCloth) ? 'crossorigin="anonymous"' : '';
        html += `<img src="${selectedCloth}" style="position: absolute; top: 0; left: 0; max-width: 300px; opacity: 0.85;" ${clothCrossOrigin} />`;
    }
    html += `</div>`;
    // Removed tryonResult.innerHTML to preserve the 3D Lottie animation guide
    // tryonResult is now exclusively modified by the AI Generation result.
}



window.saveAsImage = function () {
    const target = document.querySelector("#tryon-result > div");
    const aiResult = document.getElementById("ai-result-img");

    if (!target || !aiResult) {
        return Swal.fire("❌ Error", "Please generate a Try-On outfit before saving.", "error");
    }

    html2canvas(target).then(canvas => {
        const link = document.createElement("a");
        link.download = "my-virtual-look.png";
        link.href = canvas.toDataURL();
        link.click();
    });
};

window.saveToWardrobe = async function () {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Swal.fire("Login required", "", "warning");

    const container = document.querySelector("#tryon-result > div");
    const baseImg = container ? container.querySelector("img#ai-result-img") : null;

    if (!container || !baseImg) {
        return Swal.fire("❌ Error", "Please generate a Try-On outfit before saving to your wardrobe.", "error");
    }

    // --- NEW: Metadata Prompt ---
    const { value: formValues } = await Swal.fire({
        title: 'Save to Wardrobe',
        html:
            '<select id="swal-style" class="swal2-input">' +
            '<option value="" disabled selected>Select Style Combo</option>' +
            '<option value="Casual">Casual</option>' +
            '<option value="Formal">Formal</option>' +
            '<option value="Streetwear">Streetwear</option>' +
            '<option value="Party">Party</option>' +
            '<option value="Other">Other</option>' +
            '</select>' +
            '<input id="swal-accessory" class="swal2-input" placeholder="Accessory Name (Optional)">',
        focusConfirm: false,
        showCancelButton: true,
        preConfirm: () => {
            return [
                document.getElementById('swal-style').value,
                document.getElementById('swal-accessory').value
            ]
        }
    });

    if (!formValues) return; // User cancelled

    const [styleName, accessoryName] = formValues;
    if (!styleName) return Swal.fire("Style Required", "Please select a style category.", "warning");

    showLoader("Saving outfit...");
    // Call internal save with metadata
    await _internalSaveToWardrobe(user, container, baseImg, styleName, accessoryName);
};

// Internal function to handle the actual saving logic (refactored from original saveToWardrobe)
async function _internalSaveToWardrobe(user, container, baseImg, styleName, accessoryName) {
    try {
        // 1. Upload Cloth Image (if base64)
        let clothUrl = selectedCloth;
        // Check if selectedCloth is base64
        if (selectedCloth && selectedCloth.startsWith("data:")) {
            const clothFileName = `${user.id}/cloths/${Date.now()}.png`;
            // Convert base64 to blob? Or just upload? Supabase storage upload needs Blob/File/ArrayBuffer
            // Let's fetch it to get a blob
            const clothRes = await fetch(selectedCloth);
            const clothBlob = await clothRes.blob();

            const { data: clothUpload, error: clothErr } = await supabase.storage
                .from('wardrobe_images')
                .upload(clothFileName, clothBlob);

            if (clothErr) throw clothErr;

            const { data: { publicUrl } } = supabase.storage.from('wardrobe_images').getPublicUrl(clothFileName);
            clothUrl = publicUrl;
        }

        // 2. Manual Canvas Composition
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Use the displayed dimensions of the base image
        const w = baseImg.clientWidth;
        const h = baseImg.clientHeight;
        canvas.width = w;
        canvas.height = h;

        // Draw ALL core images (Base Person + Cloth Overlay if exists)
        // Exclude accessories for now, we draw them later
        const coreImages = container.querySelectorAll('img:not(.accessory)');
        coreImages.forEach(img => {
            // Draw if visible
            if (img.style.display !== 'none') {
                // If it's absolute, use its position, otherwise 0,0
                const x = img.style.position === 'absolute' ? img.offsetLeft : 0;
                const y = img.style.position === 'absolute' ? img.offsetTop : 0;
                ctx.drawImage(img, x, y, img.clientWidth, img.clientHeight);
            }
        });



        // Convert to Blob
        await new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (!blob) {
                    reject(new Error("Canvas compilation failed"));
                    return;
                }

                (async () => {
                    try {
                        const fileName = `${user.id}/wardrobe/outfit_${Date.now()}.png`;

                        const { data: uploadData, error: uploadError } = await supabase.storage
                            .from('wardrobe_images')
                            .upload(fileName, blob);

                        if (uploadError) throw uploadError;

                        const { data: { publicUrl } } = supabase.storage
                            .from('wardrobe_images')
                            .getPublicUrl(fileName);

                        // 3. Save Metadata to Supabase DB
                        const { error: dbError } = await supabase
                            .from('wardrobe')
                            .insert([{
                                user_id: user.id,
                                image_url: publicUrl,
                                cloth_url: clothUrl,
                                style: styleName, // Saved from user input
                                accessories: accessoryName ? { [accessoryName]: true, ...accessories } : accessories,
                                created_at: new Date()
                            }]);

                        if (dbError) throw dbError;

                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                })();
            }, 'image/png');
        });

        hideLoader();
        Swal.fire("✅ Saved!", "Outfit saved to your wardrobe database.", "success");

    } catch (error) {
        hideLoader();
        console.error("Saving error:", error);
        // alert(`Saving Failed: ${error.message}`);
        Swal.fire("❌ Error", `Could not save to database: ${error.message}`, "error");
    }
};

window.generateRecommendation = async function () {
    if (!API_BASE_URL) return Swal.fire("Setup Required", "Please paste your Server URL in the sidebar.", "info");

    const aiResult = document.getElementById("ai-result-img");
    if (!uploadedImage || !aiResult) {
        return Swal.fire("❌ Error", "Please generate a Try-On outfit first before requesting styling suggestions.", "error");
    }

    showLoader("AI is styling you...");

    try {
        // Determine clothing type from whichever upload was used
        let clothingType = document.getElementById('accessory-upload')?.files.length > 0 ? 'accessory' : 'outfit';

        const body = {
            clothing_type: clothingType,
            occasion: currentStyle || null,
            image_data: uploadedImage // Send user/outfit base64 image used in preview
        };

        const response = await fetch(`${API_BASE_URL}/recommend`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
                'Bypass-Tunnel-Reminder': 'true'
            },
            body: JSON.stringify(body),
        });

        const textResponse = await response.text();
        let data;
        try {
            data = JSON.parse(textResponse);
        } catch (e) {
            throw new Error(`The AI server returned an invalid response (Colab might have crashed). Raw output: ${textResponse.substring(0, 100)}...`);
        }

        hideLoader();

        if (data.status === 'success' && data.suggestion) {
            document.getElementById("rec-text").textContent = data.suggestion;
            document.getElementById("recommendation").style.display = "block";
        } else {
            throw new Error(data.message || "No suggestion returned");
        }
    } catch (error) {
        hideLoader();
        // Fallback to basic suggestion if backend fails
        document.getElementById("rec-text").textContent = "AI Suggests: White sneakers, a brown leather watch, and a minimal chain create a versatile look.";
        document.getElementById("recommendation").style.display = "block";
        console.error("Recommendation error:", error);
    }
};

window.applyCombo = async function (style) {
    if (!uploadedImage) return Swal.fire("Upload photo first!", "", "info");

    currentStyle = style;

    // Try to fetch combo from backend (includes AI tip), fallback to local
    if (API_BASE_URL) {
        try {
            const response = await fetch(`${API_BASE_URL}/combos/${style}`);
            const data = await response.json();

            if (data.status === 'success') {
                selectedCloth = data.clothing;
                accessories.glasses = data.accessories.glasses;
                accessories.watch = data.accessories.watch;
                accessories.chain = data.accessories.chain;
                accessories.earring = data.accessories.earring;
                accessories.bag = data.accessories.bag;
                accessories.shoes = data.accessories.shoes;

                renderPreviewOverlay();
                document.getElementById("recommendation").style.display = "none";

                // Show AI tip if available
                if (data.ai_tip) {
                    document.getElementById("rec-text").textContent = `💡 ${data.ai_tip}`;
                    document.getElementById("recommendation").style.display = "block";
                }
                return;
            }
        } catch (e) {
            console.warn("Backend combo fetch failed, using local fallback:", e);
        }
    }

    // Local fallback (same as original behavior)
    selectedCloth = `images/combos/${style}_${style === 'party' ? 'jacket' : 'shirt'}.png`;
    accessories.glasses = style === 'casual' ? `images/combos/${style}_glasses.png` : null;
    accessories.watch = style === 'formal' ? `images/combos/${style}_watch.png` : null;
    accessories.chain = (style === 'formal' || style === 'party') ? `images/combos/${style}_chain.png` : null;
    accessories.earring = style === 'party' ? `images/combos/${style}_earring.png` : null;
    accessories.bag = null;
    accessories.shoes = `images/combos/${style}_shoes.png`;

    renderPreviewOverlay();
    document.getElementById("recommendation").style.display = "none";
};

let webcamStream = null;
window.startWebcam = function () {
    const video = document.getElementById("webcam");
    const captureBtn = document.getElementById("capture-btn");

    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        webcamStream = stream;
        video.srcObject = stream;
        video.style.display = "block";
        captureBtn.style.display = "inline-block";
    }).catch((err) => {
        Swal.fire("Camera Error", "Camera access denied or unavailable.", "error");
        console.error(err);
    });
};

window.capturePhoto = function () {
    const video = document.getElementById("webcam");
    const canvas = document.getElementById("webcam-canvas");
    const preview = document.getElementById("preview");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataURL = canvas.toDataURL("image/png");
    uploadedImage = dataURL;
    previewImg.src = uploadedImage;
    previewImg.style.display = "block";
    try { localStorage.setItem("cached_base_image", uploadedImage); } catch (err) { }

    video.style.display = "none";
    document.getElementById("capture-btn").style.display = "none";

    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
    }

    renderPreviewOverlay();

    // (Background auto-upload removed to prevent unwanted overwriting of default image)
};

window.useProfilePhoto = async function () {
    showLoader("Processing...");
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        hideLoader();
        return;
    }

    if (uploadedImage && uploadedImage.startsWith("data:image")) {
        hideLoader();
        const result = await Swal.fire({
            title: 'Default Image',
            text: "Do you want to save this new photo as your default, or load your existing default photo?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Save as Default',
            cancelButtonText: 'Load Existing',
            reverseButtons: true
        });

        if (result.isConfirmed) {
            showLoader("Saving as Default Image...");
            try {
                const response = await fetch(uploadedImage);
                const blob = await response.blob();
                const file = new File([blob], "default_base.png", { type: "image/png" });
                const fileName = `${user.id}/base_image_${Date.now()}.png`;

                const { error: uploadError } = await supabase.storage.from('wardrobe_images').upload(fileName, file);
                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage.from('wardrobe_images').getPublicUrl(fileName);
                    await supabase.auth.updateUser({ data: { base_image_url: publicUrl } });
                    uploadedImage = publicUrl;
                    try { localStorage.setItem("cached_base_image", uploadedImage); } catch (err) { }
                    hideLoader();
                    Swal.fire("Saved", "This image is now your default image.", "success");
                    return;
                }
            } catch (e) {
                console.error(e);
            }
            hideLoader();
            Swal.fire("Error", "Could not save image as default.", "error");
            return;
        } else if (result.dismiss !== Swal.DismissReason.cancel) {
            return; // Clicked outside
        }
        showLoader("Loading default image...");
    }

    const baseImageUrl = user.user_metadata?.base_image_url;
    if (baseImageUrl) {
        uploadedImage = baseImageUrl;
        previewImg.src = uploadedImage;
        previewImg.style.display = 'block';
        try { localStorage.setItem("cached_base_image", uploadedImage); } catch (err) { }
        renderPreviewOverlay();
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true,
        });
        Toast.fire({
            icon: 'success',
            title: 'Loaded default image'
        });
    } else {
        Swal.fire("No Profile Photo", "You don't have a default base image saved. Please upload one and save it.", "info");
    }
    hideLoader();
};

window.goToWardrobe = function () {
    window.location.href = "wardrobe.html";
};

// Check for Retry Outfit from Wardrobe
window.addEventListener("DOMContentLoaded", () => {
    const retryData = localStorage.getItem("retryOutfit");
    if (retryData) {
        try {
            const data = JSON.parse(retryData);
            console.log("Retrying outfit:", data);

            // Restore style
            if (data.style) currentStyle = data.style;

            // Restore Cloth
            if (data.cloth) {
                selectedCloth = data.cloth;
            }

            // Restore Accessories
            if (data.accessories) {
                Object.assign(accessories, data.accessories);
            }

            if (data.baseImage) {
                uploadedImage = data.baseImage;
                previewImg.src = uploadedImage;
                previewImg.style.display = 'block';
            }

            renderPreviewOverlay();

            // Clean up
            localStorage.removeItem("retryOutfit");

            // Render (This will only show if user uploads a person image, 
            // but the state is set so it will appear instantly upon upload)
            // If they already have an image (unused feature currently), it would show.
            // We can alert them.
            Swal.fire({
                title: 'Outfit Loaded!',
                text: data.baseImage ? 'Your previously saved outfit and image have been loaded.' : 'Please upload your photo to try on this saved outfit.',
                icon: 'success',
                timer: 3000
            });

        } catch (e) {
            console.error("Error parsing retry data:", e);
        }
    }
});


// =================================================================
// === HF TOKEN MODAL CONTROLLER ===
// =================================================================

function showHFTokenModal(errorMessage) {
    const overlay = document.getElementById('hf-modal-overlay');
    const errorDiv = document.getElementById('hf-modal-error');
    const input = document.getElementById('hf-token-input');

    // Show error message from server
    if (errorMessage) {
        errorDiv.textContent = errorMessage;
        errorDiv.style.display = 'block';
    } else {
        errorDiv.style.display = 'none';
    }

    // Pre-fill if session has a token (user might be re-entering)
    const existing = getSessionHFToken();
    if (existing) input.value = existing;

    overlay.style.display = 'flex';
    input.focus();
}

function hideHFTokenModal() {
    document.getElementById('hf-modal-overlay').style.display = 'none';
    document.getElementById('hf-token-input').value = '';
    document.getElementById('hf-modal-error').style.display = 'none';
}

// Submit button
document.getElementById('hf-token-submit')?.addEventListener('click', () => {
    const input = document.getElementById('hf-token-input');
    const errorDiv = document.getElementById('hf-modal-error');
    const token = input.value.trim();

    // Validate format: must start with hf_ and be reasonable length
    if (!token) {
        errorDiv.textContent = 'Please enter a token.';
        errorDiv.style.display = 'block';
        return;
    }
    if (!token.startsWith('hf_') || token.length < 10) {
        errorDiv.textContent = 'Invalid format. Token must start with "hf_" and be at least 10 characters.';
        errorDiv.style.display = 'block';
        return;
    }

    // Store in session and retry
    setSessionHFToken(token);
    hideHFTokenModal();

    Swal.fire({
        title: 'Token saved!',
        text: 'Retrying your try-on request...',
        icon: 'info',
        timer: 1500,
        showConfirmButton: false,
    });

    // Auto-retry the try-on
    setTimeout(() => {
        window.triggerApiTryon();
    }, 800);
});

// Cancel button
document.getElementById('hf-token-cancel')?.addEventListener('click', hideHFTokenModal);

// Toggle password visibility
document.getElementById('hf-token-toggle')?.addEventListener('click', () => {
    const input = document.getElementById('hf-token-input');
    input.type = input.type === 'password' ? 'text' : 'password';
});

// Allow Enter key to submit
document.getElementById('hf-token-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('hf-token-submit').click();
    }
});