document.addEventListener('DOMContentLoaded', () => {

  // --- VÁLTOZÓK ÉS DOM ELEMEK ---
  let penalCodeData = [];
  let isFavoritesView = false;

  // DOM elemek gyors elérése
  const itemList = document.getElementById('item-list');
  const searchInput = document.getElementById('search-input');
  const cartItems = document.getElementById('cart-items');
  const cartPlaceholder = document.getElementById('cart-placeholder');
  let cart = [];
  let cartIdCounter = 0;
  let favorites = [];

  // Összesítő elemek
  const summaryFine = document.getElementById('summary-fine');
  const summaryJail = document.getElementById('summary-jail');
  const fineSlider = document.getElementById('fine-slider');
  const jailSlider = document.getElementById('jail-slider');
  const selectedFine = document.getElementById('selected-fine');
  const selectedJail = document.getElementById('selected-jail');

  // Parancs generátor elemek
  const commandOutput = document.getElementById('command-output');
  const copyCommandButton = document.getElementById('copy-command-button');
  const clearCartButton = document.getElementById('clear-cart-button');

  // --- FŐ INDÍTÓ FÜGGVÉNY ---

  // 1. Az app inicializálása
  async function initializeApp() {
    await loadPenalCode();
    prepareData();
    loadFavorites();
    renderItemList(allItems);

    setupEventListeners();
  }

  // 2. A JSON adatok betöltése
  async function loadPenalCode() {
    try {
      const response = await fetch('penalcode.json');
      if (!response.ok) {
        throw new Error(`HTTP hiba! Státusz: ${response.status}`);
      }
      penalCodeData = await response.json();
      console.log('Penal Code sikeresen betöltve.');
    } catch (error) {
      console.error('Hiba a Penal Code betöltésekor:', error);
      itemList.innerHTML = '<div class="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 px-4 py-3 rounded" role="alert">Hiba történt a penalcode.json betöltése közben. Ellenőrizd a konzolt.</div>';
    }
  }

  let allItems = [];

  function prepareData() {
    let idCounter = 0;
    penalCodeData.forEach(kategoria => {
      kategoria.tetelek.forEach(tetel => {
        if (tetel.alpontok && tetel.alpontok.length > 0) {
          tetel.alpontok.forEach(alpont => {
            allItems.push({
              ...alpont,
              id: `item-${idCounter++}`,
              kategoria_nev: kategoria.kategoria_nev,
              fo_tetel_nev: tetel.megnevezes
            });
          });
        } else if (tetel.rovidites) {
          allItems.push({
            ...tetel,
            id: `item-${idCounter++}`,
            kategoria_nev: kategoria.kategoria_nev
          });
        }
      });
    });
    console.log('Adatok előkészítve a kereséshez:', allItems);
  }

  // 3. Tételek renderelése a bal oszlopba
  function renderItemList(itemsToRender = allItems) {
    itemList.innerHTML = '';

    if (itemsToRender.length === 0) {
      itemList.innerHTML = '<p class="text-gray-500 text-center py-4">Nincs a keresésnek megfelelő találat.</p>';
      return;
    }

    // Csoportosítsuk a tételeket kategóriák szerint
    const groupedByKategoria = itemsToRender.reduce((acc, item) => {
      const kategoria = item.kategoria_nev;
      if (!acc[kategoria]) {
        acc[kategoria] = [];
      }
      acc[kategoria].push(item);
      return acc;
    }, {});

    // Hozzuk létre a HTML-t
    for (const kategoriaNev in groupedByKategoria) {
      const kategoriaWrapper = document.createElement('div');
      kategoriaWrapper.className = 'bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden';

      kategoriaWrapper.innerHTML = `
                <h2 class="text-xl font-semibold p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer">
                    ${kategoriaNev}
                </h2>
            `;

      // Tételek listája a kategórián belül
      const tetelListaDiv = document.createElement('div');
      tetelListaDiv.className = 'divide-y divide-gray-200 dark:divide-gray-700';

      groupedByKategoria[kategoriaNev].forEach(item => {
        const tetelKartya = document.createElement('div');
        tetelKartya.className = 'p-4 flex justify-between items-start';

        // Tétel adatai (bal oldal)
        let tetelHtml = `
                    <div>
                        <h3 class="text-lg font-medium text-blue-600 dark:text-blue-400">${item.megnevezes}</h3>
                `;

        // Ha alpont, mutassuk a fő tételt is
        if (item.fo_tetel_nev) {
          tetelHtml += `<p class="text-sm text-gray-500 dark:text-gray-400">${item.fo_tetel_nev} (${item.paragrafus})</p>`;
        } else {
          tetelHtml += `<p class="text-sm text-gray-500 dark:text-gray-400">${item.paragrafus}</p>`;
        }

        // Bírság és Fegyház infók
        tetelHtml += `
                        <div class="text-sm mt-1">
                            <span>Bírság: <strong>${formatCurrency(item.min_birsag)} - ${formatCurrency(item.max_birsag)}</strong></span>
                            <span class="ml-4">Fegyház: <strong>${formatJailTime(item.min_fegyhaz)} - ${formatJailTime(item.max_fegyhaz)}</strong></span>
                        </div>
                        <p class="text-xs text-gray-600 dark:text-gray-500 mt-1 italic">${item.megjegyzes || ''}</p>
                    </div>
                `;

        // Gombok (jobb oldal)
        const isFavorite = favorites.includes(item.id);
        const favoriteClass = isFavorite ? 'text-yellow-400' : 'text-gray-400';

        const gombokHtml = `
                    <div class="flex-shrink-0 flex flex-col items-end space-y-2 ml-4">
                        <button data-item-id="${item.id}" class="add-to-cart-btn px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors">
                            Hozzáadás
                        </button>
                        <button data-item-id="${item.id}" class="toggle-favorite-btn p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 ${favoriteClass}">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                        </button>
                    </div>
                `;

        tetelKartya.innerHTML = tetelHtml + gombokHtml;
        tetelListaDiv.appendChild(tetelKartya);
      });

      kategoriaWrapper.appendChild(tetelListaDiv);
      itemList.appendChild(kategoriaWrapper);
    }
  }

  // 4. Eseménykezelők (Kereső, Gombok...)
  function setupEventListeners() {

    // Kereső eseménykezelője
    searchInput.addEventListener('keyup', filterAndRender); // Átneveztük!

    // Kosár törlése gomb
    clearCartButton.addEventListener('click', clearCart);

    // Tétel lista
    itemList.addEventListener('click', (e) => {
      const target = e.target.closest('button');
      if (!target) return;

      const itemId = target.dataset.itemId;

      if (target.classList.contains('add-to-cart-btn')) {
        addToCart(itemId);
      }

      if (target.classList.contains('toggle-favorite-btn')) {
        toggleFavorite(itemId, target);
      }
    });

    // Kosár
    cartItems.addEventListener('click', (e) => {
      const target = e.target.closest('button');
      if (!target) return;

      const cartId = target.dataset.cartId;

      if (target.classList.contains('inc-qty-btn')) {
        updateCartQuantity(cartId, 1);
      } else if (target.classList.contains('dec-qty-btn')) {
        updateCartQuantity(cartId, -1);
      } else if (target.classList.contains('remove-from-cart-btn')) {
        removeFromCart(cartId);
      }
    });

    // Csúszkák eseménykezelői
    fineSlider.addEventListener('input', () => {
      updateSliderValueDisplay();
      generateCommands();
    });
    jailSlider.addEventListener('input', () => {
      updateSliderValueDisplay();
      generateCommands();
    });

    // Másolás gomb
    copyCommandButton.addEventListener('click', copyCommands);

    // Fő Kedvencek gomb a fejlécben
    document.getElementById('toggle-favorites').addEventListener('click', toggleFavoritesView);

    // document.getElementById('toggle-dark-mode').addEventListener('click', ...);
  }

  // --- KERESÉS ÉS SZŰRÉS FUNKCIÓK ---

  function filterAndRender() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    let itemsToFilter = allItems;

    // 1. Szűrés Kedvencekre (ha aktív)
    if (isFavoritesView) {
      itemsToFilter = allItems.filter(item => favorites.includes(item.id));
    }

    // 2. Szűrés Keresőszóra
    let filteredItems = itemsToFilter;
    if (searchTerm !== '') {
      filteredItems = itemsToFilter.filter(item => {
        const name = item.megnevezes.toLowerCase();
        const abbreviation = item.rovidites ? item.rovidites.toLowerCase() : '';
        const paragraph = item.paragrafus.toLowerCase();
        const note = item.megjegyzes ? item.megjegyzes.toLowerCase() : '';

        return name.includes(searchTerm) ||
          abbreviation.includes(searchTerm) ||
          paragraph.includes(searchTerm) ||
          note.includes(searchTerm);
      });
    }

    // 3. Végül renderelés
    renderItemList(filteredItems);
  }

  function handleSearch() {
    filterAndRender();
  }

  // --- KOSÁR FUNKCIÓK ---

  // Tétel hozzáadása a kosárhoz
  function addToCart(itemId) {
    const existingCartItem = cart.find(cartItem => cartItem.item.id === itemId);

    if (existingCartItem) {
      existingCartItem.quantity++;
    } else {
      const itemToAdd = allItems.find(item => item.id === itemId);
      if (itemToAdd) {
        cart.push({
          item: itemToAdd,
          quantity: 1,
          cartId: `cart-${cartIdCounter++}` // Egyedi kosár-azonosító
        });
      }
    }

    updateCartDisplay();
    calculateSummary();
  }

  // Kosár tartalmának frissítése a HTML-ben
  function updateCartDisplay() {
    cartItems.innerHTML = ''; // Kosár kiürítése

    if (cart.length === 0) {
      cartPlaceholder.classList.remove('hidden'); // "A jegyzőkönyv üres" mutatása
      return;
    }

    cartPlaceholder.classList.add('hidden'); // "A jegyzőkönyv üres" elrejtése

    cart.forEach(cartItem => {
      const { item, quantity, cartId } = cartItem;

      const cartRow = document.createElement('div');
      cartRow.className = 'flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700';
      cartRow.innerHTML = `
                <div class="flex-1 min-w-0 mr-2">
                    <p class="text-sm font-medium truncate">${item.megnevezes}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                        ${formatCurrency(item.min_birsag)} / ${formatJailTime(item.min_fegyhaz)}
                    </p>
                </div>
                <div class="flex items-center space-x-2">
                    <button data-cart-id="${cartId}" class="dec-qty-btn p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">-</button>
                    <span class="text-sm font-bold w-4 text-center">${quantity}</span>
                    <button data-cart-id="${cartId}" class="inc-qty-btn p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">+</button>
                    
                    <button data-cart-id="${cartId}" class="remove-from-cart-btn p-1 text-red-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                    </button>
                </div>
            `;
      cartItems.appendChild(cartRow);
    });
  }

  // Darabszám változtatása
  function updateCartQuantity(cartId, change) {
    const cartItem = cart.find(item => item.cartId === cartId);
    if (!cartItem) return;

    cartItem.quantity += change;

    if (cartItem.quantity <= 0) {
      removeFromCart(cartId);
    } else {
      updateCartDisplay();
      calculateSummary(); // Újraszámolás
    }
  }

  // Tétel törlése a kosárból
  function removeFromCart(cartId) {
    cart = cart.filter(item => item.cartId !== cartId);
    updateCartDisplay();
    calculateSummary();
  }

  // Teljes kosár törlése
  function clearCart() {
    cart = [];
    updateCartDisplay();
    calculateSummary();
  }

  // --- ÖSSZESÍTÉS FUNKCIÓ (Egyelőre üres) ---
  function calculateSummary() {
    let totalMinFine = 0;
    let totalMaxFine = 0;
    let totalMinJail = 0;
    let totalMaxJail = 0;
    let specialJailNotes = [];

    cart.forEach(cartItem => {
      const item = cartItem.item;
      const qty = cartItem.quantity;

      // Bírságok számolása
      if (typeof item.min_birsag === 'number') {
        totalMinFine += item.min_birsag * qty;
      }
      if (typeof item.max_birsag === 'number') {
        totalMaxFine += item.max_birsag * qty;
      }

      // Fegyház számolása
      // Min Fegyház
      if (typeof item.min_fegyhaz === 'number') {
        totalMinJail += item.min_fegyhaz * qty;
      } else if (item.min_fegyhaz) {
        specialJailNotes.push(`${item.megnevezes}: ${item.min_fegyhaz} (x${qty})`);
      }
      // Max Fegyház
      if (typeof item.max_fegyhaz === 'number') {
        totalMaxJail += item.max_fegyhaz * qty;
      } else if (item.max_fegyhaz) {
        specialJailNotes.push(`${item.megnevezes}: ${item.max_fegyhaz} (x${qty})`);
      }
    });

    // 1. Összesítő szövegek frissítése
    summaryFine.textContent = `${formatCurrency(totalMinFine)} - ${formatCurrency(totalMaxFine)}`;
    summaryJail.textContent = `${totalMinJail} perc - ${totalMaxJail} perc`;

    // Speciális megjegyzések hozzáadása
    const notesContainer = document.getElementById('jail-notes-container');
    if (notesContainer) notesContainer.remove(); // Előző megjegyzések törlése

    if (specialJailNotes.length > 0) {
      const container = document.createElement('div');
      container.id = 'jail-notes-container';
      container.className = 'text-xs text-amber-600 dark:text-amber-400 mt-1 border-t border-gray-200 dark:border-gray-700 pt-2';
      container.innerHTML = '<strong>Speciális tételek:</strong><ul class="list-disc list-inside"><li>' + specialJailNotes.join('</li><li>') + '</li></ul>';
      summaryJail.parentElement.appendChild(container); // A "Fegyház Keret" alá szúrja be
    }

    // 2. Csúszkák beállítása
    // Bírság csúszka
    fineSlider.min = totalMinFine;
    fineSlider.max = totalMaxFine;
    fineSlider.value = totalMinFine; // Alapértelmezett a minimum
    fineSlider.disabled = (totalMinFine === 0 && totalMaxFine === 0); // Tiltás, ha nincs bírság

    // Fegyház csúszka
    jailSlider.min = totalMinJail;
    jailSlider.max = totalMaxJail;
    jailSlider.value = totalMinJail; // Alapértelmezett a minimum
    jailSlider.disabled = (totalMinJail === 0 && totalMaxJail === 0); // Tiltás, ha nincs fegyház

    // 3. Generátorok indítása
    updateSliderValueDisplay();
    generateCommands();
  }

  // A csúszka alatti "Kiszabott: X" szöveg frissítése
  function updateSliderValueDisplay() {
    selectedFine.textContent = formatCurrency(parseInt(fineSlider.value));
    selectedJail.textContent = `${jailSlider.value} perc`;
  }

  // --- PARANCS GENERÁTOR ---
  function generateCommands() {
    const fineValue = parseInt(fineSlider.value);
    const jailValue = parseInt(jailSlider.value);

    if (cart.length === 0) {
      commandOutput.value = '/ticket [ID] ...';
      copyCommandButton.disabled = true;
      return;
    }

    copyCommandButton.disabled = false;

    // Rövidítések összegyűjtése
    const reasons = cart.map(cartItem => {
      const item = cartItem.item;
      const qty = cartItem.quantity;
      return `${item.rovidites}${qty > 1 ? `(x${qty})` : ''}`;
    }).join(', ');

    // Parancsok generálása
    let commands = [];
    if (fineValue > 0) {
      commands.push(`/ticket [ID] ${fineValue} ${reasons}`);
    }
    if (jailValue > 0) {
      commands.push(`/jail [ID] ${jailValue} ${reasons}`);
    }

    // Ha van speciális szöveges büntetés, azt is jelezzük
    if (document.getElementById('jail-notes-container')) {
      if (commands.length > 0) commands.push("\n"); // Térköz
      commands.push("FIGYELEM: A fenti tételek speciális (szöveges) büntetést tartalmaznak, lásd 'Speciális tételek'!");
    }

    if (commands.length === 0) {
      commandOutput.value = "Nincs kiszabandó bírság vagy fegyház.";
    } else {
      commandOutput.value = commands.join('\n');
    }
  }

  // --- ESZKÖZ FUNKCIÓK ---

  // Parancsok másolása vágólapra
  function copyCommands() {
    if (!commandOutput.value) return;

    navigator.clipboard.writeText(commandOutput.value).then(() => {
      copyCommandButton.textContent = 'Másolva!';
      copyCommandButton.classList.add('bg-green-600', 'hover:bg-green-700');
      copyCommandButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');

      setTimeout(() => {
        copyCommandButton.textContent = 'Parancsok Másolása';
        copyCommandButton.classList.remove('bg-green-600', 'hover:bg-green-700');
        copyCommandButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
      }, 1500);
    }).catch(err => {
      console.error('Hiba a vágólapra másoláskor:', err);
      alert("Hiba történt a másolás közben. Ellenőrizd a konzolt.");
    });
  }

  // --- KEDVENC FUNKCIÓK ---

  // Betölti a kedvenceket a localStorage-ból
  function loadFavorites() {
    const storedFavorites = localStorage.getItem('hlmta_favorites');
    if (storedFavorites) {
      favorites = JSON.parse(storedFavorites);
    }
  }

  // Elmenti a kedvenceket a localStorage-ba
  function saveFavorites() {
    localStorage.setItem('hlmta_favorites', JSON.stringify(favorites));
  }

  // Hozzáad/elvesz egy tételt a kedvencekből
  function toggleFavorite(itemId, buttonElement) {
    const index = favorites.indexOf(itemId);

    if (index > -1) {
      // Már kedvenc, ezért eltávolítjuk
      favorites.splice(index, 1);
      buttonElement.classList.remove('text-yellow-400');
      buttonElement.classList.add('text-gray-400');
    } else {
      // Még nem kedvenc, ezért hozzáadjuk
      favorites.push(itemId);
      buttonElement.classList.add('text-yellow-400');
      buttonElement.classList.remove('text-gray-400');
    }

    saveFavorites();
  }

  // A fő nézetkapcsoló (Összes / Csak kedvencek)
  function toggleFavoritesView() {
    isFavoritesView = !isFavoritesView;

    // Gomb állapotának frissítése
    const favButton = document.getElementById('toggle-favorites');
    if (isFavoritesView) {
      favButton.classList.add('bg-blue-100', 'dark:bg-blue-900', 'text-blue-600');
    } else {
      favButton.classList.remove('bg-blue-100', 'dark:bg-blue-900', 'text-blue-600');
    }

    // A lista újrarajzolása a szűrő alapján
    filterAndRender();
  }

  // --- SEGÉDFÜGGVÉNYEK ---

  // Pénz formázása
  function formatCurrency(value) {
    if (value === null || value === undefined) return '---';
    return `$${value.toLocaleString('hu-HU')}`;
  }

  // Idő formázása
  function formatJailTime(value) {
    if (value === null || value === undefined) return '---';
    if (typeof value === 'string') return value;
    return `${value} perc`;
  }

  // --- ALKALMAZÁS INDÍTÁSA ---
  initializeApp();

});