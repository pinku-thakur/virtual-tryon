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

const loginForm = document.getElementById("login-form");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  showLoader("Logging you in...");

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) throw error;

    const user = data.user;

    // Fetch user details
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const fullName = (userData && userData.full_name) ? userData.full_name : "User";

    hideLoader();
    Swal.fire({
      icon: 'success',
      title: 'Login Successful! 👋',
      text: `Welcome back, ${fullName}!`,
      confirmButtonText: 'Start Styling',
      confirmButtonColor: '#007bff'
    }).then(() => {
      window.location.href = 'tryon.html';
    });
  } catch (error) {
    hideLoader();
    Swal.fire({
      icon: 'error',
      title: 'Login Failed',
      text: error.message,
      confirmButtonColor: '#d33'
    });
  }
});

// Forgot Password Logic
const forgotPasswordLink = document.getElementById("forgot-password-link");
if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener("click", async (e) => {
    e.preventDefault();
    const { value: email } = await Swal.fire({
      title: 'Reset Password',
      input: 'email',
      inputLabel: 'Enter your email address',
      inputPlaceholder: 'Enter your email',
      showCancelButton: true,
      confirmButtonText: 'Send Reset Link',
      showLoaderOnConfirm: true,
      preConfirm: async (email) => {
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password.html', // Ideally we'd have a reset page
          });
          if (error) throw new Error(error.message);
          return email;
        } catch (error) {
          Swal.showValidationMessage(`Request failed: ${error}`);
        }
      },
      allowOutsideClick: () => !Swal.isLoading()
    });

    if (email) {
      Swal.fire({
        title: 'Check your email',
        text: 'Password reset link sent to ' + email,
        icon: 'success'
      });
    }
  });
}
