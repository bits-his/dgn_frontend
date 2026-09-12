function isZeroNumericValue(value: string) {
  return value === '0' || /^-?0(?:\.0+)?$/.test(value)
}

function isNumericEntryInput(el: EventTarget | null): el is HTMLInputElement {
  if (!(el instanceof HTMLInputElement)) return false
  if (el.disabled || el.readOnly) return false
  if (el.type === 'number') return true
  return el.inputMode === 'decimal' || el.inputMode === 'numeric'
}

function setNativeInputValue(el: HTMLInputElement, next: string) {
  const previous = el.value
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(el, next)
  const tracker = (el as HTMLInputElement & {
    _valueTracker?: { setValue: (value: string) => void }
  })._valueTracker
  tracker?.setValue(previous)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Clears a leading 0 so the next keystroke does not append (e.g. 05). */
export function clearZeroNumberInput(el: HTMLInputElement) {
  if (!isZeroNumericValue(el.value)) return
  setNativeInputValue(el, '')
  requestAnimationFrame(() => {
    if (isZeroNumericValue(el.value)) el.select()
  })
}

export function installClearZeroOnNumberFocus() {
  const onFocusIn = (event: FocusEvent) => {
    if (!isNumericEntryInput(event.target)) return
    clearZeroNumberInput(event.target)
  }
  document.addEventListener('focusin', onFocusIn)
  return () => document.removeEventListener('focusin', onFocusIn)
}
