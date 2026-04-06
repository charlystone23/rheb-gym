<script setup>
import { ref } from "vue"
import { displayToNativeDate, formatDateInput, nativeDateToDisplay } from "../utils/date"

const props = defineProps({
  modelValue: {
    type: String,
    default: ""
  },
  placeholder: {
    type: String,
    default: "dd/mm/aaaa"
  },
  max: {
    type: String,
    default: ""
  },
  inputId: {
    type: String,
    default: ""
  }
})

const emit = defineEmits(["update:modelValue"])
const nativeInput = ref(null)

function updateTextValue(value) {
  emit("update:modelValue", formatDateInput(value))
}

function updateNativeValue(value) {
  emit("update:modelValue", nativeDateToDisplay(value))
}

function openPicker() {
  if (nativeInput.value?.showPicker) {
    nativeInput.value.showPicker()
    return
  }

  nativeInput.value?.focus()
  nativeInput.value?.click()
}
</script>

<template>
  <div class="date-field">
    <input
      :id="inputId"
      class="date-text-input"
      type="text"
      :value="modelValue"
      :placeholder="placeholder"
      maxlength="10"
      @input="event => updateTextValue(event.target.value)"
    >
    <button type="button" class="calendar-trigger" aria-label="Abrir calendario" @click="openPicker">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm12 8H5v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8ZM6 6a1 1 0 0 0-1 1v1h14V7a1 1 0 0 0-1-1H6Zm2 6h3v3H8v-3Z"/>
      </svg>
    </button>
    <input
      ref="nativeInput"
      class="native-date-proxy"
      type="date"
      :value="displayToNativeDate(modelValue)"
      :max="max"
      tabindex="-1"
      aria-hidden="true"
      @change="event => updateNativeValue(event.target.value)"
    >
  </div>
</template>

<style scoped>
.date-field {
  position: relative;
  width: 100%;
}

.date-text-input {
  width: 100%;
  min-height: 56px;
  padding: 15px 64px 15px 16px;
  border: 2px solid var(--input-border);
  border-radius: 14px;
  background: linear-gradient(180deg, var(--card-bg) 0%, var(--input-bg) 100%);
  color: var(--header-text);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  box-sizing: border-box;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.date-text-input::placeholder {
  color: var(--subtitle-text);
  font-weight: 500;
}

.date-text-input:hover {
  border-color: color-mix(in srgb, var(--rheb-primary-green) 45%, var(--input-border));
}

.date-text-input:focus {
  outline: none;
  border-color: var(--rheb-primary-green);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--rheb-primary-green) 18%, transparent);
}

.calendar-trigger {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  min-height: 0;
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--rheb-primary-green) 30%, var(--input-border));
  background: color-mix(in srgb, var(--rheb-primary-green) 10%, var(--card-bg));
  color: var(--header-text);
  box-shadow: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
}

.calendar-trigger svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.calendar-trigger:hover {
  background: color-mix(in srgb, var(--rheb-primary-green) 18%, var(--card-bg));
  border-color: color-mix(in srgb, var(--rheb-primary-green) 55%, var(--input-border));
}

.calendar-trigger:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--rheb-primary-green) 18%, transparent);
}

.native-date-proxy {
  position: absolute;
  inset: auto 0 0 auto;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
</style>
