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
  padding-right: 46px;
}

.calendar-trigger {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  min-height: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 8px;
  border: 0;
  background: transparent;
  color: var(--header-text);
  box-shadow: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.calendar-trigger svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.calendar-trigger:hover {
  background: color-mix(in srgb, var(--input-border) 40%, transparent);
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
