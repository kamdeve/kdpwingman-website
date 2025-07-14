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

                // Przetwarzamy dane z arkusza "Combined Sales"
                const cleanData = processKDPData(workbook);

                // Wyświetlamy przetworzone dane w konsoli
                console.log("Dane po przetworzeniu z 'Combined Sales':");
                console.log(cleanData);
            };

            reader.readAsArrayBuffer(file);

        } else {
            fileNameSpan.textContent = 'Nie wybrano pliku';
        }
    });

});

/**
 * ZAKTUALIZOWANA funkcja do przetwarzania danych z raportu KDP.
 * @param {Object} workbook - Cały skoroszyt (plik Excela) odczytany przez SheetJS.
 * @returns {Array<Object>} - Tablica czystych obiektów z danymi o sprzedaży.
 */
function processKDPData(workbook) {
    // ZMIANA 1: Szukamy arkusza o konkretnej nazwie "Combined Sales"
    const sheetName = "Combined Sales";
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
        console.error(`Nie znaleziono arkusza o nazwie "${sheetName}" w raporcie.`);
        return [];
    }

    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    let headerRowIndex = -1;
    let headers = [];
    const processedData = [];

    // ZMIANA 2: Szukamy wiersza nagłówkowego zawierającego "Royalty Date"
    for (let i = 0; i < rawData.length; i++) {
        if (rawData[i].includes('Royalty Date')) {
            headerRowIndex = i;
            headers = rawData[i];
            break;
        }
    }

    if (headerRowIndex === -1) {
        console.error("Nie znaleziono wiersza nagłówkowego w arkuszu 'Combined Sales'.");
        return [];
    }
    
    // ZMIANA 3: Używamy nowych, dokładnych nazw nagłówków do znalezienia indeksów
    const dateIndex = headers.indexOf('Royalty Date');
    const titleIndex = headers.indexOf('Title');
    const royaltyIndex = headers.indexOf('Royalty');
    const currencyIndex = headers.indexOf('Currency');
    const marketplaceIndex = headers.indexOf('Marketplace');

    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        
        if (row.length === 0 || !row[dateIndex] || !row[royaltyIndex]) {
            continue;
        }

        // ZMIANA 4: Upewniamy się, że tantiemy są poprawnie konwertowane na liczbę
        const royaltyValue = parseFloat(String(row[royaltyIndex]).replace(',', '.'));

        const saleRecord = {
            data: row[dateIndex],
            tytul: row[titleIndex],
            tantiema: royaltyValue,
            waluta: row[currencyIndex],
            rynek: row[marketplaceIndex]
        };
        processedData.push(saleRecord);
    }

    return processedData;
}