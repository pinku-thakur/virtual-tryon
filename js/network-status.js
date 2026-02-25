document.addEventListener("DOMContentLoaded", () => {
    function handleOffline() {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'No Internet Connection',
                text: 'You are currently offline. Please check your network connection to continue using AI Virtual Try-On.',
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false,
                backdrop: `rgba(0,0,0,0.85)`
            });
        } else {
            // Fallback native DOM overlay if SweetAlert CDN failed to load
            let overlay = document.getElementById('offline-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'offline-overlay';
                overlay.style.position = 'fixed';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100%';
                overlay.style.height = '100%';
                overlay.style.backgroundColor = 'rgba(15, 13, 26, 0.95)';
                overlay.style.color = 'white';
                overlay.style.display = 'flex';
                overlay.style.flexDirection = 'column';
                overlay.style.alignItems = 'center';
                overlay.style.justifyContent = 'center';
                overlay.style.zIndex = '99999';
                overlay.style.fontFamily = 'Inter, sans-serif';
                overlay.innerHTML = '<h2 style="color:#ff4757; margin-bottom: 10px; font-size: 24px;">No Internet Connection</h2><p style="color: #9d95b0;">You are currently offline. Please check your network connection.</p>';
                document.body.appendChild(overlay);
            }
            overlay.style.display = 'flex';
        }
    }

    function handleOnline() {
        if (typeof Swal !== 'undefined') {
            Swal.close();
            Swal.fire({
                icon: 'success',
                title: 'Back Online! 🚀',
                text: 'Your connection has been restored.',
                timer: 2500,
                showConfirmButton: false
            });
        } else {
            const overlay = document.getElementById('offline-overlay');
            if (overlay) {
                overlay.style.display = 'none';
            }
        }
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // Initial check on load
    if (!navigator.onLine) {
        handleOffline();
    }
});
