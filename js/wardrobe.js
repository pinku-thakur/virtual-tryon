import { supabase } from "./supabase-config.js";

const wardrobeList = document.getElementById("wardrobe-list");
const userInfo = document.getElementById("user-info");

let allOutfits = [];

async function checkUserAndLoadWardrobe() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    alert("Please log in.");
    window.location.href = "login.html";
    return;
  }

  const userInfoDiv = document.getElementById("user-info-nav");

  if (userInfoDiv && user) {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const fullName = userData?.full_name || user.user_metadata?.full_name || user.email.split('@')[0];
      const avatarUrl = user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`;

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
    } catch (e) {
      console.error("Error fetching user data for nav:", e);
    }
  }
  // userInfo.innerHTML = `Logged in as <strong>${user.email}</strong><br><br>`;

  const wardrobeBody = document.querySelector('.wardrobe-body');
  if (wardrobeBody) wardrobeBody.classList.add('is-open');

  try {
    const { data, error } = await supabase
      .from('wardrobe')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    allOutfits = data.map(item => {
      let accs = item.accessories;
      if (typeof accs === 'string') {
        try { accs = JSON.parse(accs); } catch (e) { accs = {}; }
      } else if (!accs) {
        accs = {};
      }

      return {
        id: item.id,
        imageUrl: item.image_url,
        cloth: item.cloth_url, // Assuming we saved it or it's null
        accessories: accs, // Handle missing accessories if not saved
        style: item.style || 'Unknown',
        final_look_name: item.final_look_name || accs.final_look_name || 'Final Look',
        attire_used_name: item.attire_used_name || accs.attire_used_name || 'Attire Used',
        timestamp: item.created_at
      };
    });

    if (allOutfits.length === 0) {
      wardrobeList.innerHTML = "<p>No outfits saved yet.</p>";
      if (wardrobeBody) setTimeout(() => wardrobeBody.classList.remove('is-open'), 1500);
    } else {
      renderWardrobe(allOutfits);
    }
  } catch (e) {
    console.error("Error loading wardrobe:", e);
    wardrobeList.innerHTML = "<p>Error loading your wardrobe.</p>";
    if (wardrobeBody) setTimeout(() => wardrobeBody.classList.remove('is-open'), 1000);
  }
}

checkUserAndLoadWardrobe();

// Listen for auth changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    window.location.href = "login.html";
  }
});

// Helpers
function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}

// Update time display in render
// Update time display in render
function renderWardrobe(outfits) {
  const wardrobeBody = document.querySelector('.wardrobe-body');
  if (wardrobeBody) wardrobeBody.classList.add('is-open');

  wardrobeList.innerHTML = "";

  outfits.forEach((data, index) => {
    const item = document.createElement("div");
    item.className = "outfit-card animate-in";
    item.style.animationDelay = `${index * 0.15}s`;

    const time = formatDate(data.timestamp);

    item.innerHTML = `
      <div class="outfit-meta">
          <p><strong>Style Name:</strong> ${data.style}</p>
          <p><strong>Date:</strong> ${time}</p>
      </div>
      
      <p style="margin-top:10px; color:#ff4757; font-weight:600; text-transform:uppercase; font-size:12px;">${data.final_look_name}</p>
      <img src="${data.imageUrl}" crossorigin="anonymous" style="border:1px solid #57606f;" />
      
      <p style="margin-top:10px; color:#a4b0be; font-size:12px;">${data.attire_used_name}</p>
      ${data.cloth ? `<img src="${data.cloth}" style="max-height: 80px;" crossorigin="anonymous" />` : '<span style="color:#555;">N/A</span>'}
      
      <div style="margin-top:15px; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
          <button onclick='renameMetadata("${data.id}", "${data.style}", "${data.final_look_name}", "${data.attire_used_name}")' style="background:#5578c2; color:#fff; border:none; padding:6px 12px; border-radius:4px; font-size:12px;">✏️ Rename</button>
          <button onclick='retryOutfit(${JSON.stringify(data).replace(/'/g, "\\'")})' style="background:#2f3542; color:#fff; border:1px solid #57606f; padding:6px 12px; border-radius:4px; font-size:12px;">🔄 Re-Try</button>
          <button onclick='deleteOutfit("${data.id}")' style="background: #ff4757; color: white; border:none; padding:6px 12px; border-radius:4px; font-size:12px;">🗑 Delete</button>
      </div>
    `;

    wardrobeList.appendChild(item);
  });

  // Calculate trajectory dynamically based on 3D Wardrobe's real location
  const cssWardrobe = document.querySelector('.css-wardrobe');
  if (cssWardrobe) {
    requestAnimationFrame(() => {
      const wRect = cssWardrobe.getBoundingClientRect();
      const wX = wRect.left + (wRect.width / 2);
      const wY = wRect.top + (wRect.height / 2);

      const cards = wardrobeList.querySelectorAll('.outfit-card');
      cards.forEach(card => {
        const cRect = card.getBoundingClientRect();
        // Calculate center of destination card
        const cX = cRect.left + (cRect.width / 2);
        const cY = cRect.top + (cRect.height / 2);

        // Setup variables for the destination to animate back down into position
        card.style.setProperty('--fly-start-x', `${wX - cX}px`);
        card.style.setProperty('--fly-start-y', `${wY - cY}px`);
        // Random rotational variance for a chaotic burst look
        card.style.setProperty('--fly-rot', `${(Math.random() - 0.5) * 60}deg`);
      });
    });
  }

  const durationMs = outfits.length * 150 + 800 + 400; // 0.8s animation + staggered delays + buffer
  setTimeout(() => {
    if (wardrobeBody) wardrobeBody.classList.remove('is-open');
  }, durationMs);
}

window.retryOutfit = function (data) {
  // Map back to what tryon expects
  const retryData = {
    style: data.style,
    cloth: data.cloth,
    accessories: data.accessories,
    baseImage: data.imageUrl
  };
  localStorage.setItem("retryOutfit", JSON.stringify(retryData));
  window.location.href = "tryon.html";
};

window.deleteOutfit = async function (docId) {
  if (!confirm("Are you sure you want to delete this outfit?")) return;

  try {
    const { error } = await supabase
      .from('wardrobe')
      .delete()
      .eq('id', docId);

    if (error) throw error;

    alert("Outfit deleted.");
    location.reload();
  } catch (e) {
    console.error("Delete failed:", e);
    alert("Failed to delete outfit.");
  }
};

window.renameMetadata = async function (docId, currentStyle, currentFinal, currentAttire) {
  const suggestions = ["Formal Wear", "Casual Ensemble", "Party Outfit", "Streetwear Look", "Business Casual", "Summer Vibe", "Winter Attire"];

  const { value: formValues } = await Swal.fire({
    title: 'Rename Metadata',
    html:
      '<div style="text-align: left; margin-bottom: 10px; position:relative;">' +
      '  <label style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 14px; color: #4b5563;">Style Name</label>' +
      '  <input id="swal-style-placeholder" class="swal2-input" disabled style="position: absolute; top: 25px; left: 0; margin: 0; width: 100%; box-sizing: border-box; background: transparent; color: #9ca3af; border-color: transparent; z-index: 1;">' +
      '  <input id="swal-style" class="swal2-input" placeholder="' + currentStyle + '" value="" style="position: relative; margin: 0; width: 100%; box-sizing: border-box; background: transparent; z-index: 2;">' +
      '</div>' +
      '<div style="text-align: left; margin-bottom: 10px;">' +
      '  <label style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 14px; color: #4b5563;">Final Look Name</label>' +
      '  <input id="swal-final" class="swal2-input" placeholder="' + currentFinal + '" value="" style="margin: 0; width: 100%; box-sizing: border-box;">' +
      '</div>' +
      '<div style="text-align: left; margin-bottom: 10px;">' +
      '  <label style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 14px; color: #4b5563;">Attire Used Name</label>' +
      '  <input id="swal-attire" class="swal2-input" placeholder="' + currentAttire + '" value="" style="margin: 0; width: 100%; box-sizing: border-box;">' +
      '</div>',
    focusConfirm: false,
    showCancelButton: true,
    didOpen: () => {
      const input = document.getElementById('swal-style');
      const hint = document.getElementById('swal-style-placeholder');
      hint.value = currentStyle;
      let matched = "";

      input.addEventListener('input', (e) => {
        const val = e.target.value;
        if (!val) {
          hint.value = currentStyle;
          matched = "";
          return;
        }
        matched = suggestions.find(s => s.toLowerCase().startsWith(val.toLowerCase())) || "";
        hint.value = matched ? val + matched.substring(val.length) : "";
      });

      input.addEventListener('keydown', (e) => {
        if ((e.key === 'Tab' || e.key === 'Enter') && matched) {
          e.preventDefault();
          input.value = matched;
          hint.value = matched;
        }
      });
    },
    preConfirm: () => {
      return {
        style: document.getElementById('swal-style').value || currentStyle,
        final_look_name: document.getElementById('swal-final').value || currentFinal,
        attire_used_name: document.getElementById('swal-attire').value || currentAttire
      }
    }
  });

  if (formValues) {
    try {
      const { data: rowData, error: fetchError } = await supabase.from('wardrobe').select('*').eq('id', docId).single();
      if (fetchError) throw new Error("Fetch Error: " + fetchError.message);

      let updatedAccessories = rowData.accessories;
      let isString = false;
      if (typeof updatedAccessories === 'string') {
        isString = true;
        try { updatedAccessories = JSON.parse(updatedAccessories); } catch (e) { updatedAccessories = {}; }
      } else if (!updatedAccessories) {
        updatedAccessories = {};
      }

      updatedAccessories.final_look_name = formValues.final_look_name;
      updatedAccessories.attire_used_name = formValues.attire_used_name;

      const payload = { style: formValues.style };
      payload.accessories = isString ? JSON.stringify(updatedAccessories) : updatedAccessories;

      // Notice `.select()` is added to ensure we get returning rows
      const { data: updateData, error: updateError } = await supabase.from('wardrobe').update(payload).eq('id', docId).select();

      if (updateError) {
        // If update fails on 'accessories' because of strict schemas, fallback to direct columns as last resort 
        const fallbackError = await supabase.from('wardrobe').update({
          style: formValues.style,
          final_look_name: formValues.final_look_name,
          attire_used_name: formValues.attire_used_name
        }).eq('id', docId).select();

        if (fallbackError.error) throw new Error("Update Error: " + updateError.message + " | Fallback: " + fallbackError.error.message);

        if (!fallbackError.data || fallbackError.data.length === 0) {
          throw new Error("Supabase RLS is silently blocking your UPDATE request. Database record was not changed.");
        }
      } else {
        if (!updateData || updateData.length === 0) {
          throw new Error("Supabase RLS is silently blocking your UPDATE request. Database record was not changed.");
        }
      }

      Swal.fire("Updated!", "Metadata renamed successfully.", "success").then(() => {
        location.reload();
      });
    } catch (e) {
      console.error("Update error:", e);
      let errMsg = e.message || JSON.stringify(e);
      Swal.fire("Error Details", "Could not rename metadata. Reason: " + errMsg, "error");
    }
  }
};

// Logout function
window.logout = async function () {
  await supabase.auth.signOut();
  window.location.href = "login.html";
};

// Filters
window.applyFilters = function () {
  const styleFilter = document.getElementById("style-filter").value;
  const accFilter = document.getElementById("accessory-filter").value;

  const filtered = allOutfits.filter(outfit => {
    const rawStyle = outfit.style || "";
    const matchesStyle = styleFilter ? rawStyle.toLowerCase() === styleFilter.toLowerCase() : true;

    // Check accessories (keys of the object)
    let matchesAccessory = true;
    if (accFilter) {
      if (!outfit.accessories) matchesAccessory = false;
      else {
        const accKeys = Object.keys(outfit.accessories).map(k => k.toLowerCase());
        matchesAccessory = accKeys.includes(accFilter.toLowerCase());
      }
    }
    return matchesStyle && matchesAccessory;
  });

  renderWardrobe(filtered);
};

window.resetFilters = function () {
  document.getElementById("style-filter").value = "";
  document.getElementById("accessory-filter").value = "";
  renderWardrobe(allOutfits);
};
