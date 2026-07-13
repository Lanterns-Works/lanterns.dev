// lanterns.dev — the contact form's behavior. THE one file with a dependency:
// EmailJS (client-side), vendored + lazy-loaded on first Contact open.
//
// These IDs are client-side identifiers, NOT secrets — EmailJS keys are meant to
// ship in the bundle. The abuse-lock is the domain allowlist in the EmailJS
// dashboard (em: restrict to lanterns.dev). The honeypot field is "subject": the
// template doesn't reference {{subject}}, so a filled "subject" means a bot.

const EMAILJS = {
  serviceId: 'service_7l3gxy7',
  templateId: 'template_u0ip2d7',
  publicKey: 'UKCcIrXweNCFfZE5m',
};
const SDK_SRC = '/assets/vendor/emailjs.min.js';
const HONEYPOT = 'subject';

// Lazy-load the SDK once, on first submit — the ~95% who never open Contact
// (or open it and never send) pay nothing.
let sdkPromise = null;
function loadSdk() {
  if (window.emailjs) return Promise.resolve(window.emailjs);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SDK_SRC;
      s.onload = () => {
        if (!window.emailjs) {
          sdkPromise = null; // loaded but didn't define the global — let a retry re-attempt
          reject(new Error('EmailJS SDK missing after load'));
          return;
        }
        window.emailjs.init({ publicKey: EMAILJS.publicKey });
        resolve(window.emailjs);
      };
      s.onerror = () => {
        sdkPromise = null; // let a later attempt retry
        reject(new Error('EmailJS SDK failed to load'));
      };
      document.head.appendChild(s);
    });
  }
  return sdkPromise;
}

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Pure + exported so the ?contacttest self-check (bottom) can exercise it.
export function validateContact({ name, email, message }) {
  const errors = {};
  if (!name.trim()) errors.name = 'Please add your name.';
  if (!email.trim()) errors.email = 'Please add your email.';
  else if (!isEmail(email.trim())) errors.email = "That email doesn't look right.";
  if (!message.trim()) errors.message = 'Please add a message.';
  return errors;
}

function showErrors(form, errors) {
  for (const k of ['name', 'email', 'message']) {
    const slot = form.querySelector(`.field-error[data-for="${k}"]`);
    const input = form.querySelector(`[name="${k}"]`);
    const msg = errors[k] || '';
    if (slot) slot.textContent = msg;
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
}

export function wireContactForm(form) {
  if (!form || form.dataset.wired) return; // render rebuilds a fresh form each open
  form.dataset.wired = '1';

  const status = form.querySelector('.form-status');
  const submit = form.querySelector('.form-submit');
  const setStatus = (msg, isError) => {
    status.textContent = msg;
    status.classList.toggle('is-error', !!isError);
  };
  const setBusy = (busy) => {
    submit.disabled = busy;
    submit.textContent = busy ? 'Sending…' : 'Send';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // honeypot: a filled "subject" is a bot — swallow it with a friendly no-op.
    if (form.querySelector(`[name="${HONEYPOT}"]`).value.trim()) {
      form.reset();
      setStatus('Thanks — your message is on its way.');
      return;
    }

    const data = {
      name: form.querySelector('[name="name"]').value,
      email: form.querySelector('[name="email"]').value,
      message: form.querySelector('[name="message"]').value,
    };
    const errors = validateContact(data);
    showErrors(form, errors);
    if (Object.keys(errors).length) {
      setStatus('');
      return;
    }

    setBusy(true);
    setStatus('');
    try {
      const emailjs = await loadSdk();
      await emailjs.sendForm(EMAILJS.serviceId, EMAILJS.templateId, form, {
        publicKey: EMAILJS.publicKey,
      });
      form.reset();
      setStatus('Thanks — your message is on its way.');
    } catch (err) {
      setStatus('That didn’t send. Try again, or email hello@lanterns.dev.', true);
    } finally {
      setBusy(false);
    }
  });
}

// ?contacttest — dev self-check for the validator (zero-cost when the param is
// absent), mirroring the scene's ?shadertest harness convention.
if (typeof location !== 'undefined' && location.search.includes('contacttest')) {
  const check = (pass, msg) =>
    (pass ? console.log : console.error)(`[contacttest] ${pass ? 'PASS' : 'FAIL'} — ${msg}`);
  const empty = validateContact({ name: '', email: '', message: '' });
  check(empty.name && empty.email && empty.message, 'empty rejects all three fields');
  const bad = validateContact({ name: 'A', email: 'nope', message: 'hi' });
  check(bad.email && !bad.name && !bad.message, 'bad email flagged, valid fields clean');
  const good = validateContact({ name: 'A', email: 'a@b.co', message: 'hi' });
  check(Object.keys(good).length === 0, 'valid payload passes');
}
