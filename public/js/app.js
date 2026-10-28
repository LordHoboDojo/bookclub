// Progressive enhancement only; every feature works without JavaScript.
document.addEventListener('submit', (event) => {
  const form = event.target;
  const message = form.dataset.confirm;
  if (message && !window.confirm(message)) {
    event.preventDefault();
    return;
  }
  const button = event.submitter || form.querySelector('[data-loading]');
  if (button && button.dataset.loading) {
    // Defer so the button's value is still submitted.
    setTimeout(() => {
      button.disabled = true;
      button.classList.add('is-loading');
      button.textContent = button.dataset.loading;
    }, 0);
  }
});

document.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-fill]');
  if (!chip) return;
  const target = document.querySelector(chip.dataset.fill);
  if (target) {
    target.value = chip.textContent.trim();
    target.focus();
  }
});
