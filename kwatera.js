document.addEventListener('DOMContentLoaded', function() {

    const reportUploader = document.getElementById('reportUploader');
    const fileNameSpan = document.getElementById('fileName');

    reportUploader.addEventListener('change', function(event) {
        const file = event.target.files[0]; 

        if (file) {
            fileNameSpan.textContent = file.name;
            const reader = new FileReader();

            reader.onload = function(e) {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                // KROK 2: Przetwarzamy surowe dane
                const cleanData = processKDPData(rawData);

                // Na razie wyświetlamy przetworzone dane w konsoli
                console.log("Dane po przetworzeniu:");
                console.log(cleanData);
            };

            reader.readAsArrayBuffer(file);

        } else {
            fileNameSpan.textContent = 'Nie wybrano pliku';
        }
    });

});


/**
 * Funkcja do przetwarzania surowych danych z raportu KDP.
 * @param {Array<Array<string>>} data - Surowe dane z pliku Excela.
 * @returns {Array<Object>} - Tablica czystych obiektów z danymi o sprzedaży.
 */
function processKDPData(data) {
    let headerRowIndex = -1;
    let headers = [];
    const processedData = [];

    // 1. Znajdź wiersz nagłówka (szukamy słowa "Date" lub "Data")
    for (let i = 0; i < data.length; i++) {
        if (data[i].includes('Date') || data[i].includes('Data')) {
            headerRowIndex = i;
            headers = data[i];
            break;
        }
    }

    // Jeśli nie znaleziono nagłówka, zwróć pustą tablicę
    if (headerRowIndex === -1) {
        console.error("Nie znaleziono wiersza nagłówkowego w raporcie.");
        return [];
    }
    
    // Ustal indeksy kluczowych kolumn
    const dateIndex = headers.indexOf('Date') !== -1 ? headers.indexOf('Date') : headers.indexOf('Data');
    const titleIndex = headers.indexOf('Title');
    const royaltyIndex = headers.indexOf('Royalty');
    const currencyIndex = headers.indexOf('Currency');
    const marketplaceIndex = headers.indexOf('Marketplace');

    // 2. Przejdź przez wiersze z danymi (zaczynając od wiersza po nagłówku)
    for (let i = headerRowIndex + 1; i < data.length; i++) {
        const row = data[i];
        
        // Pomiń puste wiersze lub wiersze podsumowania
        if (row.length === 0 || row[dateIndex] === null || row[dateIndex] === undefined) {
            continue;
        }

        // 3. Stwórz czysty obiekt dla każdego wiersza
        const saleRecord = {
            data: row[dateIndex],
            tytul: row[titleIndex],
            tantiema: row[royaltyIndex],
            waluta: row[currencyIndex],
            rynek: row[marketplaceIndex]
        };
        processedData.push(saleRecord);
    }

    return processedData;
}