const DEFAULT_QUESTION = 'What stood out to you most in this section?';

export function initQuestion(container) {
  const el = document.createElement('div');
  el.className = 'question-text';
  el.contentEditable = 'true';
  el.spellcheck = false;
  el.textContent = DEFAULT_QUESTION;
  container.appendChild(el);
}
