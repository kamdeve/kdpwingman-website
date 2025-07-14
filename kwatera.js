document.addEventListener('DOMContentLoaded', function() {

    // Znajdź kluczowe elementy na stronie po ich ID
    const reportUploader = document.getElementById('reportUploader');
    //const uploadLabel = document.querySelector('.cta-button'); // Ten element nie jest już nam potrzebny w JS
    const fileNameSpan = document.getElementById('fileName');

    // -----------------------------------------------------------------
    // USUNĘLIŚMY STĄD BLOK KODU, KTÓRY POWODOWAŁ PODWÓJNE KLIKNIĘCIE
    // -----------------------------------------------------------------

    // Gdy użytkownik wybierze plik i zamknie okno wyboru...
    reportUploader.addEventListener('change', function(event) {
        // Sprawdź, czy jakiś plik został wybrany (to jest event.target)
        const file = event.target.files[0]; 

        if (file) {
            fileNameSpan.textContent = file.name;

            const reader = new FileReader();

            reader.onload = function(e) {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                console.log("Udało się odczytać plik! Oto dane:");
                console.log(jsonData);
            };

            reader.readAsArrayBuffer(file);

        } else {
            fileNameSpan.textContent = 'Nie wybrano pliku';
        }
    });

});