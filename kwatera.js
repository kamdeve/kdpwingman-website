document.addEventListener('DOMContentLoaded', function() {

    const reportUploader = document.getElementById('reportUploader');
    const uploadLabel = document.querySelector('.cta-button');
    const fileNameSpan = document.getElementById('fileName');

    uploadLabel.addEventListener('click', function() {
        reportUploader.click();
    });

    // Gdy użytkownik wybierze plik...
    reportUploader.addEventListener('change', function(event) {
        const file = event.target.files[0]; // Pobieramy wybrany plik

        if (file) {
            fileNameSpan.textContent = file.name; // Pokazujemy nazwę pliku

            // ZACZYNAMY ODCZYT PLIKU
            const reader = new FileReader();

            reader.onload = function(e) {
                const data = new Uint8Array(e.target.result);
                // Używamy biblioteki SheetJS (XLSX) do odczytania danych
                const workbook = XLSX.read(data, { type: 'array' });

                // Bierzemy pierwszy arkusz z pliku Excela
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Konwertujemy arkusz na format JSON (tablica tablic)
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                // Na razie, po prostu wyświetlmy wynik w konsoli deweloperskiej
                console.log("Udało się odczytać plik! Oto dane:");
                console.log(jsonData);
            };

            // Rozpocznij odczytywanie pliku
            reader.readAsArrayBuffer(file);

        } else {
            fileNameSpan.textContent = 'Nie wybrano pliku';
        }
    });
});