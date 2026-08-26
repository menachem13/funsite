// Funsite landing page — waitlist form handling + small live-demo touches.
//
// NOTE: there's no waitlist API yet (see spec section 8). This validates
// client-side and shows a success state; wire the fetch() call up to a real
// endpoint (or an email-marketing provider per section 10.10) before launch.

(function () {
  document.getElementById('year').textContent = new Date().getFullYear();

  function setupWaitlistForm(formId, noteId) {
    const form = document.getElementById(formId);
    if (!form) return;
    const note = document.getElementById(noteId);
    const defaultNote = note.textContent;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const email = form.querySelector('input[type="email"]').value.trim();
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailPattern.test(email)) {
        note.textContent = 'Enter a valid email address.';
        note.className = 'form-note error';
        return;
      }

      // Placeholder for the real submission — see NOTE above.
      form.reset();
      note.textContent = "You're on the list! We'll email you when Funsite opens in your area.";
      note.className = 'form-note success';
    });

    form.addEventListener(
      'input',
      () => {
        if (note.classList.contains('error')) {
          note.textContent = defaultNote;
          note.className = 'form-note';
        }
      },
      true
    );
  }

  setupWaitlistForm('waitlist-form', 'form-note');
  setupWaitlistForm('waitlist-form-footer', 'form-note-footer');

  // Gently animate the demo view counts so the "live" indicator reads as live.
  document.querySelectorAll('.live-count').forEach((el) => {
    const base = parseInt(el.textContent, 10);
    if (Number.isNaN(base)) return;

    setInterval(() => {
      const delta = Math.random() > 0.5 ? 1 : 0;
      if (delta) {
        el.textContent = String(parseInt(el.textContent, 10) + delta);
      }
    }, 4000);
  });
})();
