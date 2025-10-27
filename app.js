// Глобальные переменные
let pyodide;
let clientsData = null;
let encryptedData = [];
let resultsData = null;

// Функция для отладки
function debugLog(message, data = null) {
    console.log('[DEBUG] ' + message, data);
    const status = document.getElementById('status');
    if (status) {
        status.textContent += ' | ' + message;
    }
}

// Инициализация приложения
async function initializeApp() {
    console.log('Инициализация приложения...');
    updateStatus('Загрузка Python среды...', 'processing');
    
    try {
        pyodide = await loadPyodide();
        
        // Загружаем только совместимые пакеты
        await pyodide.loadPackage(["micropip", "pandas", "scikit-learn"]);
        
        const micropip = pyodide.pyimport("micropip");
        
        // Устанавливаем только совместимые пакеты
        console.log('Установка transliterate...');
        await micropip.install("transliterate");
        
        // fuzzywuzzy может работать без python-levenshtein, но с ограничениями
        try {
            console.log('Попытка установки fuzzywuzzy...');
            await micropip.install("fuzzywuzzy");
        } catch (error) {
            console.warn('fuzzywuzzy не установлен, используем альтернативы:', error);
        }
        
        await loadPythonCode(pyodide);
        
        setupEventListeners();
        updateStatus('Готов к работе', 'ready');
        console.log('Приложение инициализировано');
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        updateStatus('Ошибка загрузки: ' + error.message, 'error');
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Обработка файла клиентов
    document.getElementById('clientsFile').addEventListener('change', handleClientsFile);
    
    // Обработка зашифрованного файла
    document.getElementById('encryptedFile').addEventListener('change', handleEncryptedFile);
    
    // Обновление информации о формате
    document.getElementById('partner').addEventListener('change', updateFormatInfo);
}

// Упрощенная функция загрузки файла клиентов
async function handleClientsFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    console.log('Загрузка файла клиентов:', file.name);
    updateStatus('Чтение файла клиентов...', 'processing');
    
    try {
        let data;
        
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            data = await readExcelFile(file);
        } else if (file.name.endsWith('.csv')) {
            data = await readCSVFile(file);
        } else {
            throw new Error('Неподдерживаемый формат файла');
        }

        if (!data || data.length === 0) {
            throw new Error('Файл пуст');
        }

        // Просто сохраняем данные без показа превью
        await saveClientsDataToPyodide(pyodide, data);
        
        clientsData = data;
        document.getElementById('clientsFileInfo').textContent = `${file.name} загружен`;
        
        // Скрываем превью если оно было показано
        const preview = document.getElementById('clientsPreview');
        if (preview) preview.classList.add('hidden');
        
        updateStatus('База клиентов загружена', 'ready');
        checkReadyState();
        
    } catch (error) {
        console.error('Ошибка загрузки файла:', error);
        updateStatus('Ошибка загрузки файла', 'error');
    }
}

// Обработка зашифрованного файла
async function handleEncryptedFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    updateStatus('Чтение файла...', 'processing');
    
    try {
        const partner = document.getElementById('partner').value;
        let clients = [];

        if (file.name.endsWith('.pdf')) {
            const pdfText = await extractTextFromPDF(file);
            clients = await processPDFForPartner(pdfText, partner);
            showDataPreview(clients, pdfText.substring(0, 500) + '...');
            
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            const data = await readExcelFile(file);
            clients = data.flat().filter(item => item && typeof item === 'string' && item.length > 3);
            showDataPreview(clients, 'Excel файл загружен');
            
        } else if (file.name.endsWith('.csv')) {
            const data = await readCSVFile(file);
            clients = data.flat().filter(item => item && typeof item === 'string' && item.length > 3);
            showDataPreview(clients, 'CSV файл загружен');
            
        } else if (file.name.endsWith('.txt')) {
            const text = await file.text();
            // ИСПРАВЛЕНО: убрал лишний обратный слеш
            clients = text.split('\n').filter(line => line.trim()).map(line => line.trim());
            showDataPreview(clients, text.substring(0, 500) + '...');
        }

        encryptedData = clients;
        
        document.getElementById('encryptedFileInfo').textContent = 
            file.name + ' (' + encryptedData.length + ' клиентов)';
        
        updateStatus('Загружено ' + encryptedData.length + ' клиентов', 'ready');
        checkReadyState();
        
    } catch (error) {
        console.error('Ошибка чтения файла:', error);
        updateStatus('Ошибка чтения файла: ' + error.message, 'error');
    }
}

// Ручной ввод данных
function useManualInput() {
    const manualInput = document.getElementById('manualInput').value;
    if (!manualInput.trim()) {
        alert('Введите данные');
        return;
    }

    // ИСПРАВЛЕНО: убрал лишний обратный слеш
    encryptedData = manualInput.split('\n')
        .filter(line => line.trim())
        .map(line => line.trim());

    document.getElementById('encryptedFileInfo').textContent = 
        'Ручной ввод (' + encryptedData.length + ' клиентов)';
    
    showDataPreview(encryptedData, manualInput.substring(0, 500) + '...');
    updateStatus('Загружено ' + encryptedData.length + ' клиентов', 'ready');
    checkReadyState();
}

// Показ превью данных
function showDataPreview(clients, rawText = '') {
    const previewSection = document.getElementById('previewSection');
    const dataPreview = document.getElementById('dataPreview');
    
    if (!previewSection || !dataPreview) return;
    
    let previewHTML = '<strong>Найдено клиентов: ' + clients.length + '</strong><br><br>';
    previewHTML += '<strong>Примеры:</strong><br>';
    
    clients.slice(0, 10).forEach(client => {
        previewHTML += '• ' + client + '<br>';
    });
    
    if (clients.length > 10) {
        previewHTML += '... и еще ' + (clients.length - 10) + ' клиентов<br>';
    }
    
    dataPreview.innerHTML = previewHTML;
    previewSection.classList.remove('hidden');
}

// Обновление статуса
function updateStatus(text, type = 'ready') {
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.textContent = text;
        statusElement.className = 'status ' + type;
    }
}

// Проверка готовности
function checkReadyState() {
    const hasClients = clientsData !== null;
    const hasEncrypted = encryptedData.length > 0;
    
    const processBtn = document.getElementById('processBtn');
    if (processBtn) {
        processBtn.disabled = !(hasClients && hasEncrypted);
    }
    
    if (hasClients && hasEncrypted) {
        updateStatus('Готов к обработке', 'ready');
    } else if (!hasClients) {
        updateStatus('Загрузите базу клиентов', 'ready');
    } else {
        updateStatus('Загрузите файл с клиентами', 'ready');
    }
    
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.disabled = resultsData === null;
    }
}

// Обработка данных
async function processData() {
    if (!clientsData || encryptedData.length === 0) {
        alert('Сначала загрузите оба файла');
        return;
    }

    updateStatus('Обработка данных...', 'processing');
    const progressBar = document.getElementById('progressBar');
    if (progressBar) progressBar.classList.remove('hidden');
    
    try {
        const quarter = document.querySelector('input[name="quarter"]:checked').value;
        const partner = document.getElementById('partner').value;

        // ИСПРАВЛЕНО: убрал параметры колонок - используем автоопределение
        const result = await pyodide.runPythonAsync(`
try:
    # Создаем словарь клиентов с автоопределением колонок
    clients_dict, matcher = create_client_dictionary(clients_df)

    encrypted_list = ${JSON.stringify(encryptedData)}
    results = process_encrypted_data(encrypted_list, clients_dict, matcher, threshold=25)

    import json
    results_df = pd.DataFrame(results)
    results_df['selected_quarter'] = '${quarter}'
    results_df['selected_partner'] = '${partner}'

    results_json = results_df.to_json(orient='records', force_ascii=False)
    results_json
    
except Exception as e:
    error_msg = f"Ошибка: {str(e)}"
    print(error_msg)
    '[]'
        `);

        resultsData = JSON.parse(result);
        displayResults(resultsData);
        
        updateStatus('Обработка завершена', 'ready');
        if (progressBar) progressBar.classList.add('hidden');
        checkReadyState();
        
    } catch (error) {
        console.error('Ошибка обработки:', error);
        updateStatus('Ошибка обработки: ' + error.message, 'error');
        if (progressBar) progressBar.classList.add('hidden');
    }
}

// Отображение результатов
function displayResults(results) {
    const tbody = document.getElementById('resultsBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    let foundCount = 0;
    
    if (results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Нет результатов</td></tr>';
        return;
    }
    
    results.forEach(result => {
        const row = document.createElement('tr');
        
        if (result.confidence_score > 0) foundCount++;
        
        const confidenceColor = result.confidence_score > 65 ? 'var(--success)' : 
                              result.confidence_score > 30 ? 'var(--accent)' : 'var(--warning)';
        
        row.innerHTML = [
            '<td>' + (result.encrypted_string || '') + '</td>',
            '<td>' + (result.matched_client || '') + '</td>',
            '<td>' + (result.client_id || '') + '</td>',
            '<td>' + (result.responsible || '') + '</td>',
            '<td style="color: ' + confidenceColor + '">' + (result.confidence_score ? result.confidence_score.toFixed(1) : '0') + '%</td>',
            '<td>' + (result.method_used || '') + '</td>'
        ].join('');
        
        tbody.appendChild(row);
    });

    const stats = document.getElementById('stats');
    if (stats) {
        stats.textContent = 'Обработано: ' + results.length + ' | Найдено совпадений: ' + foundCount;
    }
}

// Сохранение результатов
function saveResults() {
    if (!resultsData) {
        alert('Нет данных для сохранения');
        return;
    }

    const headers = ['Зашифрованный клиент', 'Client ID', 'Плательщик', 'Уверенность', 'Метод', 'Ответственный'];
    const csvContent = [
        headers.join(','),
        ...resultsData.map(row => [
            '"' + (row.encrypted_string || '') + '"',
            row.client_id || '',
            '"' + (row.matched_client || '') + '"',
            row.confidence_score ? row.confidence_score.toFixed(1) : '0',
            row.method_used || '',
            '"' + (row.responsible || '') + '"'
        ].join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'wiqs_results_' + new Date().toISOString().slice(0,10) + '.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Обновление информации о формате
function updateFormatInfo() {
    const partner = document.getElementById('partner').value;
    const formatInfo = document.getElementById('formatInfo');
    
    if (!formatInfo) return;
    
    const formats = {
        'ЗАО Ардшинбанк': 'Формат: Excel/CSV файл',
        'ОАО Армброк': 'Формат: Excel/CSV файл', 
        'АО Финам': 'Формат: Excel/CSV файл',
        'ЗАО «Мета-Икс Маркетс»': 'Формат: PDF/Excel/CSV файл',
        'QR': 'Формат: PDF/Excel/CSV файл',
        'ТТА': 'Формат: Excel/CSV файл'
    };
    
    formatInfo.textContent = formats[partner] || 'Выберите партнера';
}

// Запуск приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', initializeApp);