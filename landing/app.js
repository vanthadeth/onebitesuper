const steps = {
  ios: {
    en: ['Open the app you want to install in Safari.', 'Tap Share, then choose Add to Home Screen. You may need to scroll the share menu.', 'Tap Add. Open the new icon on your home screen to sign in.'],
    km: ['បើកកម្មវិធីដែលអ្នកចង់ដំឡើងក្នុង Safari។', 'ចុច Share បន្ទាប់មកជ្រើស Add to Home Screen។ អ្នកប្រហែលជាត្រូវរំកិលម៉ឺនុយ។', 'ចុច Add។ បើករូបតំណាងថ្មីនៅលើអេក្រង់ដើម ដើម្បីចូលគណនី។'],
  },
  android: {
    en: ['Open the app you want to install in Chrome.', 'Open the browser menu (⋮), then choose Install app or Add to Home screen.', 'Confirm installation. Open the new app icon to sign in.'],
    km: ['បើកកម្មវិធីដែលអ្នកចង់ដំឡើងក្នុង Chrome។', 'បើកម៉ឺនុយកម្មវិធីរុករក (⋮) រួចជ្រើស Install app ឬ Add to Home screen។', 'បញ្ជាក់ការដំឡើង។ បើករូបតំណាងកម្មវិធីថ្មី ដើម្បីចូលគណនី។'],
  },
  desktop: {
    en: ['Open the app you want to install in Chrome or Edge.', 'Use the install icon in the address bar, or the browser menu’s install option when available.', 'Confirm installation. The app opens in its own window.'],
    km: ['បើកកម្មវិធីដែលអ្នកចង់ដំឡើងក្នុង Chrome ឬ Edge។', 'ប្រើរូបតំណាងដំឡើងនៅរបារអាសយដ្ឋាន ឬជម្រើសដំឡើងក្នុងម៉ឺនុយ ប្រសិនបើមាន។', 'បញ្ជាក់ការដំឡើង។ កម្មវិធីនឹងបើកក្នុងបង្អួចរបស់វា។'],
  },
};
let language = 'km';
let platform = /Android/i.test(navigator.userAgent) ? 'android' : /iPhone|iPad/i.test(navigator.userAgent) ? 'ios' : 'desktop';
try { if (localStorage.getItem('onebite-landing-language') === 'en') language = 'en'; } catch { /* Storage is optional. */ }
function render() {
  document.documentElement.lang = language;
  document.querySelectorAll('[data-km]').forEach(element => { element.textContent = element.dataset[language].replaceAll('\\n', '\n'); });
  document.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === language)));
  document.querySelectorAll('[data-platform]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.platform === platform)));
  const list = document.querySelector('#install-steps');
  list.replaceChildren(...steps[platform][language].map(text => { const item = document.createElement('li'); item.textContent = text; return item; }));
}
document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => {
  language = button.dataset.language;
  try { localStorage.setItem('onebite-landing-language', language); } catch { /* Storage is optional. */ }
  render();
}));
document.querySelectorAll('[data-platform]').forEach(button => button.addEventListener('click', () => { platform = button.dataset.platform; render(); }));
render();
