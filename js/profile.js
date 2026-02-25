import { supabase } from "./supabase-config.js";

// DOM Elements
const userInfoNav = document.getElementById("user-info-nav");
const profileForm = document.getElementById("profile-details-form");
const passwordForm = document.getElementById("profile-password-form");
const fullNameInput = document.getElementById("profile-fullname");
const emailInput = document.getElementById("profile-email");
const phoneInput = document.getElementById("profile-phone");
const genderInput = document.getElementById("profile-gender");
const avatarPreview = document.getElementById("profile-avatar-preview");
const avatarUpload = document.getElementById("avatar-upload");
const saveAvatarBtn = document.getElementById("save-avatar-btn");

let currentUser = null;
let currentAvatarFile = null;

function showLoader(message = 'Processing...') {
    const textEl = document.querySelector('.loading-text');
    if (textEl) textEl.textContent = message;
    document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoader() {
    document.getElementById('loading-overlay').style.display = 'none';
}

async function checkUserAndLoadProfile() {
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (!user || authErr) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;
    emailInput.value = user.email;

    try {
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', user.id)
            .single();

        const fullName = userData?.full_name || user.user_metadata?.full_name || user.email.split('@')[0];
        const avatarUrl = user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`;

        fullNameInput.value = fullName;
        avatarPreview.src = avatarUrl;

        // Load professional fields
        if (user.user_metadata?.phone) phoneInput.value = user.user_metadata.phone;
        if (user.user_metadata?.gender) genderInput.value = user.user_metadata.gender;

        // Render Navbar
        if (userInfoNav) {
            userInfoNav.innerHTML = `
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
        }

    } catch (err) {
        console.error("Error loading profile:", err);
    }
}

// Initial Load
checkUserAndLoadProfile();

// --- Logout ---
window.logout = async function () {
    await supabase.auth.signOut();
    window.location.href = "login.html";
};

// --- Profile Update ---
profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    showLoader("Updating details...");
    try {
        const newName = fullNameInput.value.trim();
        const newPhone = phoneInput.value.trim();
        const newGender = genderInput.value;

        // 1. Update users table with name (optional: phone/gender if columns added in future)
        const { error: dbError } = await supabase
            .from('users')
            .update({ full_name: newName })
            .eq('id', currentUser.id);

        if (dbError) throw dbError;

        // 2. Update user metadata for all options
        const { error: authError } = await supabase.auth.updateUser({
            data: {
                full_name: newName,
                phone: newPhone,
                gender: newGender
            }
        });

        if (authError) throw authError;

        hideLoader();
        Swal.fire("Success", "Profile details updated!", "success");

        // Update nav directly for instant feedback
        document.getElementById("nav-name").textContent = newName;

    } catch (err) {
        hideLoader();
        Swal.fire("Error", err.message, "error");
    }
});

// --- Password Update ---
passwordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById("profile-new-password").value;

    if (newPassword.length < 6) {
        return Swal.fire("Error", "Password must be at least 6 characters.", "warning");
    }

    showLoader("Updating password...");
    try {
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) throw error;

        hideLoader();
        document.getElementById("profile-new-password").value = "";
        Swal.fire("Success", "Password updated successfully!", "success");

    } catch (err) {
        hideLoader();
        Swal.fire("Error", err.message, "error");
    }
});

// --- Avatar Upload Local Preview ---
avatarUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    currentAvatarFile = file;
    const reader = new FileReader();
    reader.onload = (event) => {
        avatarPreview.src = event.target.result;
        saveAvatarBtn.style.display = "block"; // Show the save button
    };
    reader.readAsDataURL(file);
});

// --- Save Avatar to Supabase Storage ---
saveAvatarBtn.addEventListener("click", async () => {
    if (!currentAvatarFile || !currentUser) return;

    showLoader("Uploading avatar...");
    try {
        const fileExt = currentAvatarFile.name.split('.').pop();
        const fileName = `${currentUser.id}/avatar_${Date.now()}.${fileExt}`;

        // 1. Upload to Supabase 'avatars' storage bucket (Assuming we use 'wardrobe_images' or new 'avatars' bucket)
        // Let's use 'wardrobe_images' bucket to avoid creating a new bucket programmatically if it doesn't exist,
        // or we just use 'avatars' and assume it exists. Using 'wardrobe_images' for safety.
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('wardrobe_images')
            .upload(fileName, currentAvatarFile);

        if (uploadError) throw uploadError;

        // 2. Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('wardrobe_images')
            .getPublicUrl(fileName);

        // 3. Update auth user metadata
        const { error: dbError } = await supabase.auth.updateUser({
            data: { avatar_url: publicUrl }
        });

        if (dbError) throw dbError;

        hideLoader();
        saveAvatarBtn.style.display = "none";
        Swal.fire("Success", "Profile photo updated!", "success");

        // Update nav
        document.getElementById("nav-avatar").src = publicUrl;

    } catch (err) {
        hideLoader();
        Swal.fire("Upload Failed", err.message, "error");
    }
});
