// Python код для Pyodide
const PYTHON_CODE = `
import pandas as pd
import numpy as np
from transliterate import translit
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import warnings
import re
import js

warnings.filterwarnings('ignore')

# Альтернативная реализация fuzzy matching без python-levenshtein
def simple_similarity(str1, str2):
    """Простая реализация похожести строк"""
    if not str1 or not str2:
        return 0
    
    str1 = str1.lower().strip()
    str2 = str2.lower().strip()
    
    # Если строки одинаковые
    if str1 == str2:
        return 100
    
    # Проверка на частичное совпадение
    if str1 in str2 or str2 in str1:
        return 90
    
    # Простая проверка по словам
    words1 = set(str1.split())
    words2 = set(str2.split())
    
    if words1 & words2:  # пересечение множеств
        common_words = len(words1 & words2)
        total_words = len(words1 | words2)
        return (common_words / total_words) * 100
    
    # Проверка по символам
    common_chars = set(str1) & set(str2)
    if common_chars:
        return min(70, len(common_chars) * 10)
    
    return 0

def token_similarity(str1, str2):
    """Похожесть на основе токенов"""
    tokens1 = set(re.findall(r'\\w+', str1.lower()))
    tokens2 = set(re.findall(r'\\w+', str2.lower()))
    
    if not tokens1 or not tokens2:
        return 0
    
    intersection = len(tokens1 & tokens2)
    union = len(tokens1 | tokens2)
    
    if union == 0:
        return 0
    
    return (intersection / union) * 100

class ClientMatcher:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(analyzer='char', ngram_range=(1, 3), min_df=1, lowercase=True)
        self.client_vectors = None
        self.client_names = []
        self.client_ids = []
        self.client_sales = []

    def fit(self, client_data_tuples):
        self.client_names = [name for name, client_id, sale in client_data_tuples]
        self.client_ids = [client_id for name, client_id, sale in client_data_tuples]
        self.client_sales = [sale for name, client_id, sale in client_data_tuples]

        if self.client_names:
            self.client_vectors = self.vectorizer.fit_transform(self.client_names)

    def find_match(self, encrypted_name, threshold=0.3):
        if not self.client_names:
            return None

        try:
            encrypted_vec = self.vectorizer.transform([encrypted_name])
            similarities = cosine_similarity(encrypted_vec, self.client_vectors).flatten()
            
            best_match_idx = np.argmax(similarities)
            best_score = similarities[best_match_idx]
            
            if best_score >= threshold:
                return {
                    'name': self.client_names[best_match_idx],
                    'client_id': self.client_ids[best_match_idx],
                    'sale': self.client_sales[best_match_idx],
                    'score': best_score
                }
        except:
            pass
            
        return None

def create_client_dictionary(df, name_column='Название', id_column=None, sale_column='Ответственный'):
    clients_dict = {}
    client_data_tuples = []

    for idx, row in df.iterrows():
        original_name = str(row[name_column])
        
        if id_column and id_column in df.columns:
            client_id = row[id_column]
        else:
            client_id = idx

        if sale_column and sale_column in df.columns:
            sale = row[sale_column]
        else:
            sale = None

        variants = generate_name_variants(original_name)

        clients_dict[client_id] = {
            'original': original_name,
            'variants': variants,
            'sale': sale
        }

        for variant in variants:
            client_data_tuples.append((variant, client_id, sale))

    matcher = ClientMatcher()
    matcher.fit(client_data_tuples)

    return clients_dict, matcher

def generate_name_variants(name):
    variants = [name.lower(), name.upper(), name.title()]
    
    try:
        translit_name = translit(name, 'ru', reversed=True)
        variants.extend([translit_name.lower(), translit_name.upper(), translit_name.title()])
    except:
        pass
    
    return list(set([v for v in variants if v and len(v) > 0]))

def process_encrypted_data(encrypted_strings, clients_dict, matcher, threshold=25):
    results = []
    
    for encrypted_string in encrypted_strings:
        if not encrypted_string or encrypted_string.strip() == '':
            continue
            
        match = matcher.find_match(encrypted_string, threshold=threshold/100)
        
        if match:
            results.append({
                'encrypted_string': encrypted_string,
                'matched_client': match['name'],
                'client_id': match['client_id'],
                'confidence_score': match['score'] * 100,
                'method_used': 'tfidf',
                'responsible': match['sale']
            })
        else:
            fuzzy_match = fuzzy_search(encrypted_string, clients_dict)
            if fuzzy_match:
                results.append(fuzzy_match)
            else:
                results.append({
                    'encrypted_string': encrypted_string,
                    'matched_client': 'Не найдено',
                    'client_id': -1,
                    'confidence_score': 0,
                    'method_used': 'none',
                    'responsible': None
                })
    
    return results

def fuzzy_search(encrypted_string, clients_dict):
    best_score = 0
    best_match = None
    
    for client_id, client_data in clients_dict.items():
        for variant in client_data['variants']:
            # Используем нашу простую реализацию вместо fuzzywuzzy
            score = max(
                simple_similarity(encrypted_string, variant),
                token_similarity(encrypted_string, variant)
            )
            
            if score > best_score and score > 70:
                best_score = score
                best_match = {
                    'encrypted_string': encrypted_string,
                    'matched_client': client_data['original'],
                    'client_id': client_id,
                    'confidence_score': score,
                    'method_used': 'fuzzy',
                    'responsible': client_data.get('sale')
                }
    
    return best_match

js.create_client_dictionary = create_client_dictionary
js.process_encrypted_data = process_encrypted_data
`;

// Функция для загрузки Python кода в Pyodide
async function loadPythonCode(pyodide) {
    await pyodide.runPythonAsync(PYTHON_CODE);
    console.log('Python код загружен');
}