import { supabase } from "./supabase-config.js";

function showLoader(message) {
    const loadingText = document.querySelector('.loading-text');
    if (loadingText) loadingText.textContent = message;
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
}

function hideLoader() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.style.display = 'none';
}

const resetForm = document.getElementById("reset-password-form");

if (resetForm) {
    resetForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const newPassword = document.getElementById("new-password").value;

        showLoader("Updating your password...");

        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            hideLoader();
            Swal.fire({
                icon: 'success',
                title: 'Password Updated!',
                text: 'Your password has been changed successfully.',
                confirmButtonText: 'Go to Login',
                confirmButtonColor: '#007bff'
            }).then(() => {
                window.location.href = 'login.html';
            });

        } catch (error) {
            hideLoader();
            Swal.fire({
                icon: 'error',
                title: 'Update Failed',
                text: error.message,
                confirmButtonColor: '#d33'
            });
        }
    });
}
