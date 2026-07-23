/**
 * Settings Modal Controller
 */
const SettingsManager = (() => {
  let selectedModel = "gemini-3.6-flash";

  const DEFAULT_MODELS = [
    { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", desc: "Recommended: Fast & intelligent default model" },
    { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview", desc: "Advanced reasoning & deep code synthesis" },
    { id: "gemini-3.1-flash-image", name: "Gemini 3.1 Flash Image", desc: "Multimodal generation model" }
  ];

  function init() {
    const creds = AppDB.getCredentials();
    const custom = AppDB.getAICustomization();

    const apiKeyInput = document.getElementById('setting-api-key');
    const modelInput = document.getElementById('setting-model-input');

    apiKeyInput.value = creds.apiKey || '';
    selectedModel = creds.model || 'gemini-3.6-flash';

    modelInput.value = selectedModel;

    document.getElementById('setting-complexity').value = custom.complexity || 'intermediate';
    document.getElementById('setting-field').value = custom.field || '';
    document.getElementById('setting-topics').value = custom.topics || '';

    modelInput.addEventListener('input', () => {
      const val = modelInput.value.trim();
      selectedModel = val ? val : 'gemini-3.6-flash';
      highlightMatchingPreset(selectedModel);
    });

    renderModelPicker(DEFAULT_MODELS);
  }

  function renderModelPicker(modelsList) {
    const picker = document.getElementById('model-picker-list');
    picker.innerHTML = '';

    modelsList.forEach(m => {
      const card = document.createElement('div');
      const modelId = m.id || m.name;
      
      card.className = `model-card ${modelId === selectedModel ? 'active' : ''}`;
      card.setAttribute('data-model-id', modelId);

      card.innerHTML = `
        <div class="model-info">
          <span class="model-name">${m.displayName || m.name || modelId}</span>
          <span class="model-desc">${m.desc || m.description || 'Google Generative AI Model'}</span>
        </div>
        <i class="ph-fill ph-check-circle model-check"></i>
      `;

      card.addEventListener('click', () => {
        selectedModel = modelId;
        document.getElementById('setting-model-input').value = modelId;
        highlightMatchingPreset(selectedModel);
      });

      picker.appendChild(card);
    });
  }

  function highlightMatchingPreset(modelId) {
    document.querySelectorAll('.model-card').forEach(c => {
      if (c.getAttribute('data-model-id') === modelId) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });
  }

  async function saveSettings(showToastCallback) {
    const apiKey = document.getElementById('setting-api-key').value.trim();
    const customModelVal = document.getElementById('setting-model-input').value.trim();
    const btnSave = document.getElementById('btn-save-settings');
    const keyError = document.getElementById('key-error-msg');

    let finalModel = customModelVal ? customModelVal : 'gemini-3.6-flash';

    // Verify key against Interactions endpoint
    if (apiKey) {
      btnSave.disabled = true;
      btnSave.innerHTML = `<i class="ph-fill ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Validating...`;

      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/interactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            model: finalModel,
            input: "ping"
          })
        });

        if (!res.ok && res.status === 401) {
          throw new Error("Invalid API Key");
        }
      } catch (err) {
        btnSave.disabled = false;
        btnSave.innerHTML = `Save Changes`;
        keyError.classList.remove('hidden');
        showToastCallback("Invalid Google API Key", "ph-warning-circle");
        return false;
      }
    }

    btnSave.disabled = false;
    btnSave.innerHTML = `Save Changes`;
    keyError.classList.add('hidden');

    AppDB.saveCredentials({ model: finalModel, apiKey });
    AppDB.saveAICustomization({
      complexity: document.getElementById('setting-complexity').value,
      field: document.getElementById('setting-field').value,
      topics: document.getElementById('setting-topics').value
    });

    showToastCallback("Settings Saved", "ph-check-circle");
    return true;
  }

  return { init, saveSettings };
})();