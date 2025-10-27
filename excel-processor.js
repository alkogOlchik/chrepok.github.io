// Функция для чтения Excel файлов
function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                resolve(jsonData);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Функция для чтения CSV файлов
function readCSVFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const csvText = e.target.result;
                const lines = csvText.split('\\n').filter(line => line.trim());
                const result = [];
                
                for (let i = 0; i < lines.length; i++) {
                    const cells = lines[i].split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
                    result.push(cells);
                }
                
                resolve(result);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

// Сохранение данных клиентов в Pyodide
async function saveClientsDataToPyodide(pyodide, data) {
    const headers = data[0];
    const rows = data.slice(1);
    
    const pythonCode = `
import pandas as pd

headers = ${JSON.stringify(headers)}
rows = ${JSON.stringify(rows)}

clients_df = pd.DataFrame(rows, columns=headers)
print(f"Создан DataFrame с {len(clients_df)} записями")
print("Колонки:", list(clients_df.columns))
    `;
    
    await pyodide.runPythonAsync(pythonCode);
}

// Показ превью данных клиентов
function showClientsPreview(data, fileName) {
    const preview = document.getElementById('clientsPreview');
    let previewHTML = `<strong>Файл: ${fileName}</strong><br>`;
    previewHTML += `<strong>Записей: ${data.length - 1}</strong><br><br>`;
    previewHTML += `<strong>Колонки:</strong><br>`;
    
    if (data.length > 0) {
        data[0].forEach((col, index) => {
            previewHTML += `${index + 1}. ${col || '(пусто)'}<br>`;
        });
        
        previewHTML += `<br><strong>Первые 3 записи:</strong><br>`;
        for (let i = 1; i < Math.min(4, data.length); i++) {
            previewHTML += `${i}. ${data[i].join(' | ')}<br>`;
        }
    }
    
    preview.innerHTML = previewHTML;
    preview.classList.remove('hidden');
}