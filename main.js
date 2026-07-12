// lanterns.dev — wind on the lantern
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (min, max) => min + Math.random() * (max - min);
const glowField = document.querySelector('.glow-field');

function scheduleGust() {
  setTimeout(() => {
    const duration = rand(0.4, 1.0);
    glowField.style.animationDuration = duration.toFixed(2) + 's';
    glowField.classList.add('gust');
    setTimeout(() => {
      glowField.classList.remove('gust');
      scheduleGust();
    }, duration * 1000 + 50);
  }, rand(4000, 14000));
}

if (!reduceMotion) scheduleGust();
