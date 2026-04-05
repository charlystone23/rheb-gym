export function formatDateAR(value) {
  if (!value) return ""

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()

  return `${day}/${month}/${year}`
}

export function formatDateTimeAR(value) {
  if (!value) return ""

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date)
}

export function formatDateInput(value) {
  const numbers = String(value || "").replace(/\D/g, "")

  if (numbers.length <= 2) return numbers
  if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`

  return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`
}

export function parseDisplayDate(value) {
  if (!value || !/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return null

  const [day, month, year] = value.split("/").map(Number)
  const date = new Date(year, month - 1, day)

  if (
    Number.isNaN(date.getTime()) ||
    date.getDate() !== day ||
    date.getMonth() !== month - 1 ||
    date.getFullYear() !== year
  ) {
    return null
  }

  return date
}

export function nativeDateToDisplay(value) {
  if (!value) return ""

  const [year, month, day] = String(value).split("-")
  if (!year || !month || !day) return ""

  return `${day}/${month}/${year}`
}

export function displayToNativeDate(value) {
  if (!value || !/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return ""

  const [day, month, year] = value.split("/")
  return `${year}-${month}-${day}`
}

export function getMonthRangeDisplay(year, month) {
  return {
    start: formatDateAR(new Date(year, month, 1)),
    end: formatDateAR(new Date(year, month + 1, 0))
  }
}
