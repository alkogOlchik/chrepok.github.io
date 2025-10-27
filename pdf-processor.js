// Настройка PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// Функция для извлечения текста из PDF
async function extractTextFromPDF(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        
        fileReader.onload = async function() {
            try {
                const typedarray = new Uint8Array(this.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                
                let fullText = '';
                
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\\n';
                }
                
                resolve(fullText);
            } catch (error) {
                reject(error);
            }
        };
        
        fileReader.onerror = reject;
        fileReader.readAsArrayBuffer(file);
    });
}

// Обработка PDF для разных партнеров
async function processPDFForPartner(pdfText, partner) {
    const lines = pdfText.split('\n').filter(line => line.trim().length > 0);
    let clients = [];

    switch(partner) {
        case 'QR':
            const qrCodes = {
                "090725_1": "Gulyan Karlen",
                "140225_1": "Уфимкина Тамара Витальевна", 
                "150424_1": "Лысов Денис Константинович",
                "150725_1": "Грёнберг Марина Вячеславовна",
                "161224_1": "Шин Егор Борисович",
                "170725_1": "Городенкер Владимир Борисович",
                "170925_1": "Громов Арсений Артемович",
                "290324_1": "Кобяков Владислав Юрьевич",
                "290825_1": "Бурунов Сергей Александрович"
            };

            for (const code in qrCodes) {
                if (pdfText.includes(code)) {
                    clients.push(qrCodes[code]);
                }
            }
            break;

        default:
            for (const line of lines) {
                if (line.length > 5 && line.length < 100 && 
                    !line.toLowerCase().includes('итого') &&
                    !line.toLowerCase().includes('total') &&
                    !line.match(/^[\\d\\s.,]+$/)) {
                    clients.push(line.trim());
                }
            }
    }

    return clients.filter((client, index) => clients.indexOf(client) === index);
}