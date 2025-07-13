// Czekaj, aż cała strona HTML się załaduje
document.addEventListener('DOMContentLoaded', function() {

    // Znajdź kluczowe elementy na stronie po ich ID
    const reportUploader = document.getElementById('reportUploader');
    const uploadLabel = document.querySelector('.upload-section .btn'); // Nasz stylizowany przycisk
    const fileNameSpan = document.getElementById('fileName');

    // Gdy użytkownik kliknie na nasz stylizowany przycisk "Wybierz plik raportu"...
    uploadLabel.addEventListener('click', function() {
        // ...wywołaj kliknięcie na prawdziwym, ukrytym inpucie typu "file"
        reportUploader.click();
    });

    // Gdy użytkownik wybierze plik i zamknie okno wyboru...
    reportUploader.addEventListener('change', function() {
        // Sprawdź, czy jakiś plik został wybrany
        if (reportUploader.files.length > 0) {
            // Jeśli tak, pokaż jego nazwę obok przycisku
            fileNameSpan.textContent = reportUploader.files[0].name;
            console.log('Wybrano plik:', reportUploader.files[0]); // Wyświetlamy info w konsoli deweloperskiej
        } else {
            // Jeśli nie, pokaż domyślny tekst
            fileNameSpan.textContent = 'Nie wybrano pliku';
        }
    });

});